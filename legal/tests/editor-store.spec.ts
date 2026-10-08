/** Editor ownership uses the same on-disk writer lock as agent amendments. */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { DocumentStore } from '../src/store.ts'
import type { DocumentEditor } from '../src/store.ts'
import { documentHash } from '../src/document.ts'
import { contractFixture } from './fixture.ts'

const limits = { maxFileBytes: 1024 * 1024, maxExpandedBytes: 4 * 1024 * 1024,
  maxParts: 100, maxProjectionBytes: 64 * 1024, maxAmendments: 10 }
const session = SessionId('editor-store-test')
const signal = new AbortController().signal

it('publishes validated editor bytes, excludes other writers and releases ownership', async () => {
  const root = await mkdtemp(join(tmpdir(), 'legal-editor-store-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const store = new DocumentStore(root, limits, 'Commercial Agent')
  const original = contractFixture()
  const first = await store.start(session, 'contract.docx', original, signal)
  let retained: DocumentEditor | undefined
  const next = await store.withEditor(session, signal, async editor => {
    retained = editor
    const read = await editor.read()
    expect(read.bytes).toEqual(original)
    const peer = new DocumentStore(root, limits, 'Commercial Agent')
    await expect(peer.amend(session, first.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], signal)).rejects.toThrow()
    await expect(peer.withEditor(session, signal, async () => {})).rejects.toThrow()
    const unchanged = await editor.save(first.currentHash, original, signal)
    expect(unchanged.generation).toBe(1)
    await expect(editor.save(first.currentHash, Buffer.from('invalid DOCX'), signal)).rejects.toThrow()
    expect(await store.read(session)).toEqual(first)
    const edited = contractFixture('GBP 150000')
    const saved = await editor.save(first.currentHash, edited, signal)
    expect(saved.currentHash).toBe(documentHash(edited))
    expect(saved.generation).toBe(2)
    await expect(editor.save(first.currentHash, original, signal)).rejects.toThrow('changed')
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(editor.save(saved.currentHash, original, cancelled.signal)).rejects.toThrow()
    return saved
  })
  await expect(retained!.read()).rejects.toThrow()
  expect(await store.read(session)).toEqual(next)
  const directories = await readdir(root)
  expect(await readFile(join(root, directories[0]!, `${first.originalHash}.docx`))).toEqual(original)
  const redlined = await store.amend(session, next.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], signal)
  expect(redlined.generation).toBe(3)
})

it('releases the writer lock when the editor consumer fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'legal-editor-failure-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const store = new DocumentStore(root, limits, 'Commercial Agent')
  const first = await store.start(session, 'contract.docx', contractFixture(), signal)
  await expect(store.withEditor(session, signal, async () => { throw new Error('Editor disconnected.') })).rejects.toThrow('disconnected')
  expect(await store.amend(session, first.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], signal)).toHaveProperty('generation', 2)
})
