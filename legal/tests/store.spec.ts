/** Persisted generation, stale-write and cancellation tests with private temporary roots. */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { DocumentStore } from '../src/store.ts'
import { documentHash } from '../src/document.ts'
import { contractFixture } from './fixture.ts'

const limits = { maxFileBytes: 1024 * 1024, maxExpandedBytes: 4 * 1024 * 1024,
  maxParts: 100, maxProjectionBytes: 64 * 1024, maxAmendments: 10 }
const session = SessionId('legal-test-session')
const signal = new AbortController().signal

async function storeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'deepseek-legal-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  return { root, store: new DocumentStore(root, limits, 'Commercial Agent') }
}

describe('continuing managed contract', () => {
  it('retains the original and committed generations across reload', async () => {
    const { root, store } = await storeFixture()
    const bytes = contractFixture()
    const first = await store.start(session, 'synthetic.docx', bytes, signal)
    const next = await store.amend(session, first.currentHash, [{ old_text: 'GBP 100000', new_text: 'GBP 200000' }], signal)
    expect(next.generation).toBe(2)
    expect(next.originalHash).toBe(documentHash(bytes))
    expect(next.currentHash).not.toBe(first.currentHash)
    const resumed = new DocumentStore(root, limits, 'Commercial Agent')
    expect(await resumed.read(session)).toEqual(next)
    const directories = await readdir(root)
    const original = await readFile(join(root, directories[0]!, `${first.originalHash}.docx`))
    expect(original).toEqual(bytes)
    expect(await store.start(session, 'synthetic.docx', bytes, signal)).toEqual(next)
    await expect(store.start(session, 'another.docx', bytes, signal)).rejects.toThrow('different contract')
  })

  it('preserves the committed head after a stale hash or failed batch', async () => {
    const { store } = await storeFixture()
    const first = await store.start(session, 'synthetic.docx', contractFixture(), signal)
    const next = await store.amend(session, first.currentHash, [{ old_text: 'GBP 100000', new_text: 'GBP 200000' }], signal)
    await expect(store.amend(session, first.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], signal)).rejects.toThrow('changed')
    await expect(store.amend(session, next.currentHash, [
      { old_text: 'insurance', new_text: 'coverage' }, { old_text: 'missing clause', new_text: 'new clause' },
    ], signal)).rejects.toThrow()
    expect(await store.read(session)).toEqual(next)
  })

  it('refuses cancelled amendments and unopened sessions', async () => {
    const { store } = await storeFixture()
    await expect(store.read(session)).rejects.toThrow('contract_open')
    const first = await store.start(session, 'synthetic.docx', contractFixture(), signal)
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(store.amend(session, first.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], cancelled.signal)).rejects.toThrow()
    expect(await store.read(session)).toEqual(first)
  })

  it('allows only one concurrent amendment to publish against a shared hash', async () => {
    const { root, store } = await storeFixture()
    const first = await store.start(session, 'synthetic.docx', contractFixture(), signal)
    const peer = new DocumentStore(root, limits, 'Commercial Agent')
    const outcomes = await Promise.allSettled([
      store.amend(session, first.currentHash, [{ old_text: 'GBP 100000', new_text: 'GBP 200000' }], signal),
      peer.amend(session, first.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], signal),
    ])
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1)
    expect((await store.read(session)).generation).toBe(2)
  })
})
