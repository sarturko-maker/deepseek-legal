/** Document-scoped WOPI capabilities over an exclusively owned managed DOCX. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { EditorAccessToken, EditorFileId } from './types.ts'
export type { EditorAccessToken, EditorFileId } from './types.ts'
import type { DocumentHash } from '../document.ts'
import type { DocumentEditor, DocumentStore } from '../store.ts'

/** Deployment limits and the parent origin advertised to the editor. */
export interface WopiConfig {
  tokenLifetimeMs: number
  maxDocuments: number
  maxPendingRequests: number
  userName: string
  parentOrigin: string
}

/** Private launch data for the authenticated editor consumer. */
export interface EditorGrant {
  fileId: EditorFileId
  accessToken: EditorAccessToken
  expiresAt: number
}

interface Entry {
  session: SessionId
  editor: DocumentEditor
  digest: Buffer
  lifetime: AbortController
  expiresAt: number
  currentHash: DocumentHash
  lock: string
  lockExpiresAt: number
  finish: () => void
  done: Promise<void>
  tail: Promise<void>
  pending: number
  closed: boolean
  timer: ReturnType<typeof setTimeout> | undefined
}

class WopiFault extends Error {
  constructor(readonly status: number, readonly currentLock?: string) { super('WOPI request rejected.') }
}

// WOPI locks expire after 30 minutes unless the client refreshes them.
const LOCK_LIFETIME_MS = 30 * 60 * 1000
const ROUTE = /^\/legal\/wopi\/files\/([a-f0-9]{32})(\/contents)?$/u

function digest(token: string): Buffer { return createHash('sha256').update(token).digest() }

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name]
  if (Array.isArray(value)) throw new WopiFault(400)
  return value ?? ''
}

function requestLock(req: IncomingMessage, name = 'x-wopi-lock'): string {
  const value = header(req, name)
  if (value === '' || Buffer.byteLength(value, 'utf8') > 1024 || /[\r\n\u0000]/u.test(value)) throw new WopiFault(400)
  return value
}

async function body(req: IncomingMessage, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  const declared = header(req, 'content-length')
  if (declared !== '' && !/^\d+$/u.test(declared)) throw new WopiFault(400)
  if (declared !== '' && Number(declared) > maxBytes) throw new WopiFault(413)
  const chunks: Buffer[] = []
  let size = 0
  const abort = () => req.destroy(new Error('Editor access ended.'))
  signal.throwIfAborted()
  signal.addEventListener('abort', abort, { once: true })
  try {
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      if (!Buffer.isBuffer(chunk)) throw new WopiFault(400)
      size += chunk.byteLength
      if (size > maxBytes) throw new WopiFault(413)
      chunks.push(chunk)
    }
    signal.throwIfAborted()
    if (size === 0) throw new WopiFault(400)
    return Buffer.concat(chunks, size)
  } finally { signal.removeEventListener('abort', abort) }
}

/** Owns editor capabilities, ordered requests and writer-lock release. */
export class WopiHost {
  private readonly entries = new Map<EditorFileId, Entry>()
  private readonly jobs = new Set<Promise<void>>()
  private readonly failures: unknown[] = []
  private disposed = false

  constructor(private readonly store: DocumentStore, private readonly config: WopiConfig) {}

  /** Acquire exclusive editor ownership; callers must already authorize the Session.
   * @param session Session whose contract was opened through Harness.
   * @returns A short-lived private capability; competing writers reject until close.
   */
  async open(session: SessionId): Promise<EditorGrant> {
    if (this.disposed) throw new Error('The editor host has closed.')
    if (this.jobs.size >= this.config.maxDocuments) throw new Error('The configured editor document limit has been reached.')
    const fileId = brandString<EditorFileId>(randomBytes(16).toString('hex'))
    const accessToken = brandString<EditorAccessToken>(randomBytes(32).toString('hex'))
    const ready = Promise.withResolvers<EditorGrant>()
    const finished = Promise.withResolvers<void>()
    const lifetime = new AbortController()
    const done = this.store.withEditor(session, lifetime.signal, async editor => {
      const snapshot = await editor.read()
      if (this.disposed) throw new Error('The editor host has closed.')
      const expiresAt = Date.now() + this.config.tokenLifetimeMs
      const entry: Entry = { session, editor, digest: digest(accessToken), lifetime, expiresAt,
        currentHash: snapshot.view.currentHash, lock: '', lockExpiresAt: 0,
        finish: finished.resolve, done, tail: Promise.resolve(), pending: 0, closed: false, timer: undefined }
      this.entries.set(fileId, entry)
      entry.timer = setTimeout(() => {
        void this.close(fileId).catch((error: unknown) => { this.failures.push(error) })
      }, this.config.tokenLifetimeMs)
      entry.timer.unref()
      ready.resolve({ fileId, accessToken, expiresAt })
      try { await finished.promise }
      finally {
        lifetime.abort()
        await entry.tail
      }
    })
    this.jobs.add(done)
    void done.then(() => {
      ready.reject(new Error('The editor closed before it was ready.'))
    }, (error: unknown) => { ready.reject(error) }).finally(() => {
      this.jobs.delete(done)
      const entry = this.entries.get(fileId)
      if (entry?.timer !== undefined) clearTimeout(entry.timer)
      this.entries.delete(fileId)
    })
    return ready.promise
  }

  /** Revoke a capability and await active requests and writer-lock release.
   * @param fileId Editor lifetime returned by open.
   * @param session When supplied, only this owning Session may revoke the capability.
   */
  async close(fileId: EditorFileId, session?: SessionId): Promise<void> {
    const entry = this.entries.get(fileId)
    if (entry === undefined) return
    if (session !== undefined && entry.session !== session) throw new Error('This editor belongs to another Session.')
    entry.closed = true
    if (entry.timer !== undefined) clearTimeout(entry.timer)
    entry.lifetime.abort()
    entry.finish()
    await entry.done
  }

  /** Stop issuing capabilities, revoke all active ones and await every owned task. */
  async dispose(): Promise<void> {
    this.disposed = true
    const closing = [...this.entries.keys()].map(id => this.close(id))
    const results = await Promise.allSettled([...closing, ...this.jobs])
    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
    if (errors.length + this.failures.length > 0) throw new AggregateError([...errors, ...this.failures], 'Editor cleanup failed.')
  }

  /** Handle only WOPI operations; no endpoint here issues capabilities.
   * @param req Native HTTP request with a document-scoped access_token.
   * @param res Response owned through completion, with no cached document data.
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      let url: URL
      try { url = new URL(req.url ?? '/', 'http://wopi.invalid') }
      catch (_error: unknown) { throw new WopiFault(400) }
      const match = ROUTE.exec(url.pathname)
      if (match === null) throw new WopiFault(404)
      const tokens = url.searchParams.getAll('access_token')
      const token = tokens[0]
      const entry = this.entries.get(brandString<EditorFileId>(match[1]!))
      if (entry === undefined || entry.closed || tokens.length !== 1 || token === undefined || !/^[a-f0-9]{64}$/u.test(token)
        || !timingSafeEqual(digest(token), entry.digest) || entry.expiresAt <= Date.now()) throw new WopiFault(401)
      if (entry.pending >= this.config.maxPendingRequests) throw new WopiFault(409, this.currentLock(entry))
      entry.pending += 1
      const request = entry.tail.then(async () => {
        entry.lifetime.signal.throwIfAborted()
        if (entry.expiresAt <= Date.now()) throw new WopiFault(401)
        await this.respond(entry, match[2] !== undefined, req, res)
      })
      entry.tail = request.then(() => {}, (_error: unknown) => {
        // The HTTP handler reports the failure; later requests retain their ordering.
      })
      try { await request }
      finally { entry.pending -= 1 }
    } catch (error) {
      if (res.destroyed || res.headersSent) { res.destroy(); return }
      res.statusCode = error instanceof WopiFault ? error.status : 500
      if (error instanceof WopiFault && error.currentLock !== undefined) res.setHeader('X-WOPI-Lock', error.currentLock)
      res.end()
    } finally { req.resume() }
  }

  private currentLock(entry: Entry): string {
    if (entry.lockExpiresAt <= Date.now()) entry.lock = ''
    return entry.lock
  }

  private async respond(entry: Entry, contents: boolean, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET') {
      const snapshot = await entry.editor.read()
      res.setHeader('X-WOPI-ItemVersion', `${snapshot.view.generation}:${snapshot.view.currentHash}`)
      if (contents) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        res.setHeader('Content-Length', snapshot.bytes.byteLength)
        res.end(snapshot.bytes)
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ BaseFileName: basename(snapshot.view.source), Size: snapshot.bytes.byteLength,
          Version: `${snapshot.view.generation}:${snapshot.view.currentHash}`, OwnerId: 'local-reviewer',
          UserId: 'local-reviewer', UserFriendlyName: this.config.userName,
          UserCanWrite: true, ReadOnly: false, SupportsUpdate: true, SupportsLocks: true,
          SupportsGetLock: true, PostMessageOrigin: this.config.parentOrigin }))
      }
      return
    }
    if (req.method !== 'POST') throw new WopiFault(405)
    const override = header(req, 'x-wopi-override')
    const lock = this.currentLock(entry)
    if (contents) {
      if (override !== 'PUT') throw new WopiFault(501)
      if (lock === '' || header(req, 'x-wopi-lock') !== lock) throw new WopiFault(409, lock)
      const aborted = new AbortController()
      const onAbort = () => aborted.abort()
      const onClose = () => { if (!res.writableFinished) aborted.abort() }
      req.on('aborted', onAbort)
      res.on('close', onClose)
      try {
        const signal = AbortSignal.any([entry.lifetime.signal, aborted.signal])
        const bytes = await body(req, this.store.limits.maxFileBytes, signal)
        const view = await entry.editor.save(entry.currentHash, bytes, signal)
        entry.currentHash = view.currentHash
        res.setHeader('X-WOPI-ItemVersion', `${view.generation}:${view.currentHash}`)
      } finally { req.off('aborted', onAbort); res.off('close', onClose) }
    } else if (override === 'GET_LOCK') {
      res.setHeader('X-WOPI-Lock', lock)
    } else if (override === 'LOCK' || override === 'REFRESH_LOCK' || override === 'UNLOCK') {
      const requested = requestLock(req)
      const old = header(req, 'x-wopi-oldlock')
      if (override === 'LOCK') {
        if (old !== '' ? lock !== old : lock !== '' && lock !== requested) throw new WopiFault(409, lock)
        entry.lock = requested
      } else {
        if (lock === '' || lock !== requested) throw new WopiFault(409, lock)
        if (override === 'UNLOCK') entry.lock = ''
      }
      entry.lockExpiresAt = Date.now() + LOCK_LIFETIME_MS
    } else { throw new WopiFault(501) }
    res.statusCode = 200
    res.end()
  }
}
