/** Immutable original and content-addressed working generations in application-owned storage. */
import { createHash } from 'node:crypto'
import { mkdir, open, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { z } from 'zod'
import { amendDocument, documentHash, documentHashSchema, projectDocument } from './document.ts'
import type { Amendment, DocumentHash, DocumentLimits } from './document.ts'

const headSchema = z.strictObject({
  format: z.literal(1),
  source: z.string(),
  originalHash: documentHashSchema,
  currentHash: documentHashSchema,
  generation: z.number().int().positive(),
})
type Head = z.infer<typeof headSchema>

/** Current working document identity and full model projection. */
export interface DocumentView {
  source: string
  originalHash: DocumentHash
  currentHash: DocumentHash
  generation: number
  projection: string
}

/** Complete committed bytes and their current projection. */
export interface DocumentSnapshot {
  view: DocumentView
  bytes: Buffer
}

/** Editor operations valid only inside a held document writer lock. */
export interface DocumentEditor {
  /** Read committed bytes without releasing editor ownership. @returns The complete current document. */
  read(): Promise<DocumentSnapshot>
  /** Save a complete DOCX against its last read identity.
   * @param expected Current identity from the editor's previous read or save.
   * @param bytes Complete edited DOCX bytes.
   * @param signal Request cancellation, checked before publication.
   * @returns The committed projection; identical bytes retain the generation.
   */
  save(expected: DocumentHash, bytes: Uint8Array, signal: AbortSignal): Promise<DocumentView>
}

/** Private managed files only; this class never writes to the source workspace. */
export class DocumentStore {
  readonly root: string
  constructor(root: string, readonly limits: DocumentLimits, readonly author: string) {
    this.root = resolve(root)
  }

  private directory(session: SessionId): string {
    return join(this.root, createHash('sha256').update(session).digest('hex'))
  }

  private async readHead(directory: string): Promise<Head | undefined> {
    let source: string
    try { source = await readFile(join(directory, 'head.json'), 'utf8') }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
      throw error
    }
    return headSchema.parse(JSON.parse(source))
  }

  private async blob(directory: string, hash: DocumentHash): Promise<Buffer> {
    const bytes = await readFile(join(directory, `${hash}.docx`))
    if (bytes.byteLength > this.limits.maxFileBytes || documentHash(bytes) !== hash) {
      throw new Error('The stored document failed its size or integrity check.')
    }
    return bytes
  }

  private async publishBlob(directory: string, bytes: Uint8Array): Promise<DocumentHash> {
    const hash = documentHash(bytes)
    let handle
    try { handle = await open(join(directory, `${hash}.docx`), 'wx', 0o600) }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
      await this.blob(directory, hash)
      return hash
    }
    try { await handle.writeFile(bytes); await handle.sync() }
    finally { await handle.close() }
    return hash
  }

  private async publishHead(directory: string, head: Head): Promise<void> {
    const path = join(directory, 'head.json')
    await writeFileAtomic(path, JSON.stringify(head) + '\n', { mode: 0o600, dirMode: 0o700 })
    const handle = await open(path, 'r+')
    try { await handle.sync() }
    finally { await handle.close() }
  }

  private async view(directory: string, head: Head): Promise<DocumentView> {
    await this.blob(directory, head.originalHash)
    return this.checkView({ ...head, projection: await projectDocument(await this.blob(directory, head.currentHash), this.limits) })
  }

  private checkView(view: DocumentView): DocumentView {
    if (Buffer.byteLength(JSON.stringify(view), 'utf8') > this.limits.maxProjectionBytes) {
      throw new Error('The complete contract response exceeds the configured projection limit.')
    }
    return view
  }

  /** Open one immutable source per Session. Reopening a different source rejects.
   * @param session Owning Harness Session.
   * @param source Canonical authorized source path, for display only.
   * @param bytes Complete bytes from the composed filesystem's bounded read.
   * @param signal Cancellation checked before the head commit.
   * @returns The continuing working document, or a new identical copy of the source.
   */
  async start(session: SessionId, source: string, bytes: Uint8Array, signal: AbortSignal): Promise<DocumentView> {
    const directory = this.directory(session)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    return withFileLock(join(directory, 'head.json'), async () => {
      signal.throwIfAborted()
      const existing = await this.readHead(directory)
      if (existing !== undefined) {
        if (existing.source !== source) throw new Error('This Session already owns a different contract. Start a new Session.')
        return this.view(directory, existing)
      }
      const projection = await projectDocument(bytes, this.limits)
      const hash = documentHash(bytes)
      const head: Head = { format: 1, source, originalHash: hash, currentHash: hash, generation: 1 }
      const view = this.checkView({ ...head, projection })
      signal.throwIfAborted()
      await this.publishBlob(directory, bytes)
      signal.throwIfAborted()
      await this.publishHead(directory, head)
      return view
    }, { waitMs: 0 })
  }

  /** Read the committed current document and verify its original.
   * @param session Owning Harness Session.
   * @returns Full current marked-up text and byte identities; rejects an unopened contract.
   */
  async read(session: SessionId): Promise<DocumentView> {
    const directory = this.directory(session)
    const head = await this.readHead(directory)
    if (head === undefined) throw new Error('Open a contract with contract_open first.')
    return this.view(directory, head)
  }

  /** Hold the existing cross-process writer lock throughout one editor lifetime.
   * @param session Owning Harness Session with an already opened contract.
   * @param signal Editor lifetime cancellation.
   * @param operation Consumer owning the editor lifetime and awaiting its requests.
   * @returns The consumer result after pending operations settle and ownership releases.
   */
  async withEditor<T>(session: SessionId, signal: AbortSignal,
    operation: (editor: DocumentEditor) => Promise<T>): Promise<T> {
    const directory = this.directory(session)
    return withFileLock(join(directory, 'head.json'), async () => {
      signal.throwIfAborted()
      if (await this.readHead(directory) === undefined) throw new Error('Open a contract with contract_open first.')
      const lifetime = new AbortController()
      const active = AbortSignal.any([signal, lifetime.signal])
      let tail: Promise<void> = Promise.resolve()
      const run = <R>(work: () => Promise<R>): Promise<R> => {
        const result = tail.then(() => { active.throwIfAborted(); return work() })
        tail = result.then(() => {}, (_error: unknown) => {
          // The caller receives failures; later requests must still be admitted.
        })
        return result
      }
      const editor: DocumentEditor = {
        read: () => run(async () => {
          const head = await this.readHead(directory)
          if (head === undefined) throw new Error('The managed contract head is missing.')
          return { view: await this.view(directory, head), bytes: await this.blob(directory, head.currentHash) }
        }),
        save: (expected, bytes, requestSignal) => run(async () => {
          const saveSignal = AbortSignal.any([active, requestSignal])
          saveSignal.throwIfAborted()
          const head = await this.readHead(directory)
          if (head === undefined) throw new Error('The managed contract head is missing.')
          if (head.currentHash !== expected) throw new Error('The contract has changed. Reload before saving.')
          await this.blob(directory, head.originalHash)
          const projection = await projectDocument(bytes, this.limits)
          const hash = documentHash(bytes)
          const next: Head = { ...head, currentHash: hash,
            generation: head.generation + (hash === head.currentHash ? 0 : 1) }
          const view = this.checkView({ ...next, projection })
          saveSignal.throwIfAborted()
          await this.publishBlob(directory, bytes)
          saveSignal.throwIfAborted()
          await this.publishHead(directory, next)
          return view
        }),
      }
      try { return await operation(editor) }
      finally {
        lifetime.abort()
        await tail
      }
    }, { waitMs: 0 })
  }

  /** Publish a complete tracked batch only against the expected current hash.
   * @param session Owning Harness Session.
   * @param expected Hash supplied by the latest read result.
   * @param amendments Literal tracked amendments.
   * @param signal Cancellation checked before the head commit.
   * @returns The new current document; failures leave the old head intact.
   */
  async amend(session: SessionId, expected: DocumentHash, amendments: readonly Amendment[], signal: AbortSignal): Promise<DocumentView> {
    const directory = this.directory(session)
    return withFileLock(join(directory, 'head.json'), async () => {
      signal.throwIfAborted()
      const head = await this.readHead(directory)
      if (head === undefined) throw new Error('Open a contract with contract_open first.')
      if (head.currentHash !== expected) throw new Error('The contract has changed. Read it again before proposing amendments.')
      await this.blob(directory, head.originalHash)
      const result = await amendDocument(await this.blob(directory, head.currentHash), amendments, this.author, this.limits)
      const hash = documentHash(result.bytes)
      const next: Head = { ...head, currentHash: hash, generation: head.generation + 1 }
      const view = this.checkView({ ...next, projection: result.projection })
      signal.throwIfAborted()
      await this.publishBlob(directory, result.bytes)
      signal.throwIfAborted()
      await this.publishHead(directory, next)
      return view
    }, { waitMs: 0 })
  }
}
