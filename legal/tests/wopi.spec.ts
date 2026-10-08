/** Real Host route tests allocate loopback listeners and private document roots. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request as httpRequest } from 'node:http'
import { expect, it, onTestFinished, vi } from 'vitest'
import { amendDocument } from '../src/document.ts'
import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { DocumentStore } from '../src/store.ts'
import * as EditorPlugin from '../src/editor/index.ts'
import type { EditorGrant } from '../src/editor/wopi.ts'
import { contractFixture } from './fixture.ts'

async function fixture(maxFileBytes = 1024 * 1024, maxDocuments = 4, maxPendingRequests = 8) {
  const root = await mkdtemp(join(tmpdir(), 'legal-wopi-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const store = new DocumentStore(root, { maxFileBytes, maxExpandedBytes: 4 * 1024 * 1024,
    maxParts: 100, maxProjectionBytes: 64 * 1024, maxAmendments: 10 }, 'Commercial Agent')
  const session = SessionId('wopi-session')
  const original = contractFixture()
  const first = await store.start(session, 'synthetic.docx', original, new AbortController().signal)
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  ctx.provide('legalDocuments', store)
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const plugin = await ctx.plugin(EditorPlugin, { parentOrigin: 'dsh-app://app', maxDocuments, maxPendingRequests })
  const host = ctx.legalEditor
  const grant = await host.open(session)
  const origin = `http://127.0.0.1:${ctx.webServer.port}`
  const url = (value: EditorGrant, contents = false) =>
    `${origin}/legal/wopi/files/${value.fileId}${contents ? '/contents' : ''}?access_token=${value.accessToken}`
  const request = (override: string, lock = '', bytes?: Buffer, contents = false) => fetch(url(grant, contents), {
    method: 'POST', headers: { 'X-WOPI-Override': override, 'X-WOPI-Lock': lock },
    ...(bytes === undefined ? {} : { body: new Uint8Array(bytes) }),
  })
  return { ctx, plugin, store, session, first, original, host, grant, url, request, origin }
}

it('serves complete bytes and preserves native revisions through locked saves', async () => {
  const f = await fixture()
  const info = await fetch(f.url(f.grant))
  expect(info.headers.get('cache-control')).toBe('no-store')
  expect(await info.json()).toMatchObject({ BaseFileName: 'synthetic.docx', Size: f.original.byteLength,
    SupportsLocks: true, SupportsUpdate: true, PostMessageOrigin: 'dsh-app://app' })
  const source = await fetch(f.url(f.grant, true))
  expect(Buffer.from(await source.arrayBuffer())).toEqual(f.original)
  expect((await f.request('LOCK', 'editor-lock')).status).toBe(200)
  const mismatch = await f.request('PUT', 'wrong-lock', f.original, true)
  expect(mismatch.status).toBe(409)
  expect(mismatch.headers.get('x-wopi-lock')).toBe('editor-lock')
  expect((await f.request('REFRESH_LOCK', 'editor-lock')).status).toBe(200)
  const amended = await amendDocument(f.original, [{ old_text: 'GBP 100000', new_text: 'GBP 150000' }],
    'Commercial Agent', f.store.limits)
  const edited = amended.bytes
  const saved = await f.request('PUT', 'editor-lock', edited, true)
  expect(saved.status).toBe(200)
  const head = await f.store.read(f.session)
  expect(head.generation).toBe(2)
  expect(head.originalHash).toBe(f.first.originalHash)
  expect(head.projection).toContain('150000')
  expect(head.projection).toContain('Keep this human comment.')
  const current = await fetch(f.url(f.grant, true))
  expect(Buffer.from(await current.arrayBuffer())).toEqual(edited)
  expect(saved.headers.get('x-wopi-itemversion')).toBe(current.headers.get('x-wopi-itemversion'))
  expect((await f.request('UNLOCK', 'editor-lock')).status).toBe(200)
  expect((await f.request('PUT', 'editor-lock', f.original, true)).status).toBe(409)
  await f.host.close(f.grant.fileId)
  expect((await fetch(f.url(f.grant))).status).toBe(401)
  const next = await f.store.amend(f.session, head.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], new AbortController().signal)
  expect(next.generation).toBe(3)
})

it('revokes an expired capability and refuses its document requests', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  onTestFinished(() => { vi.useRealTimers() })
  const f = await fixture()
  vi.setSystemTime(f.grant.expiresAt)
  expect((await fetch(f.url(f.grant))).status).toBe(401)
  await f.host.close(f.grant.fileId)
  const renewed = await f.host.open(f.session)
  expect(renewed.fileId).not.toBe(f.grant.fileId)
  expect(renewed.accessToken).not.toBe(f.grant.accessToken)
  expect((await fetch(f.url(renewed))).status).toBe(200)
})

it('aborts an incomplete save and settles it before releasing editor ownership', async () => {
  const f = await fixture(1024 * 1024, 1, 1)
  await expect(f.host.open(SessionId('other-document'))).rejects.toThrow('document limit')
  expect((await f.request('LOCK', 'editor-lock')).status).toBe(200)
  const started = Promise.withResolvers<void>()
  const url = new URL(f.url(f.grant, true))
  const remove = f.ctx.webServer.register({ kind: 'exact', path: url.pathname, handler: (req, res) => {
    // The first body chunk proves this request reached the owned server before closure.
    req.once('data', () => started.resolve())
    return f.host.handle(req, res)
  } })
  onTestFinished(remove)
  const settled = Promise.withResolvers<void>()
  const request = httpRequest(url, { method: 'POST', headers: {
    'X-WOPI-Override': 'PUT', 'X-WOPI-Lock': 'editor-lock', 'Content-Length': f.original.byteLength,
  } }, res => { res.resume(); res.on('end', () => settled.resolve()); res.on('error', () => settled.resolve()) })
  onTestFinished(() => { request.destroy() })
  request.on('error', () => settled.resolve())
  request.write(f.original.subarray(0, 100))
  await started.promise
  const busy = await fetch(f.url(f.grant))
  expect(busy.status).toBe(409)
  expect(busy.headers.get('x-wopi-lock')).toBe('editor-lock')
  await f.host.close(f.grant.fileId)
  await settled.promise
  expect(await f.store.read(f.session)).toEqual(f.first)
  expect((await fetch(f.url(f.grant))).status).toBe(401)
  const next = await f.store.amend(f.session, f.first.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], new AbortController().signal)
  expect(next.generation).toBe(2)
})

it('bounds chunked uploads even without a declared content length', async () => {
  const f = await fixture(8192)
  expect((await f.request('LOCK', 'a')).status).toBe(200)
  const status = Promise.withResolvers<number>()
  const request = httpRequest(f.url(f.grant, true), { method: 'POST', headers: {
    'X-WOPI-Override': 'PUT', 'X-WOPI-Lock': 'a', 'Transfer-Encoding': 'chunked',
  } }, res => {
    res.resume()
    res.on('end', () => status.resolve(res.statusCode!))
    res.on('error', error => status.reject(error))
  })
  onTestFinished(() => { request.destroy() })
  request.on('error', error => status.reject(error))
  request.end(Buffer.alloc(8193))
  expect(await status.promise).toBe(413)
  expect(await f.store.read(f.session)).toEqual(f.first)
})

it('rejects incorrect capabilities and invalid or oversized saves without changing the head', async () => {
  const f = await fixture(8192)
  expect((await fetch(f.url({ ...f.grant, accessToken: '0'.repeat(64) as EditorGrant['accessToken'] }))).status).toBe(401)
  expect((await fetch(f.url(f.grant) + '&access_token=extra')).status).toBe(401)
  expect((await fetch(`${f.origin}/legal/wopi/files/../../head.json`)).status).toBe(404)
  expect((await f.request('LOCK', 'a')).status).toBe(200)
  expect((await f.request('LOCK', 'b')).status).toBe(409)
  expect((await f.request('GET_LOCK')).headers.get('x-wopi-lock')).toBe('a')
  expect((await f.request('PUT', 'a', Buffer.from('not a DOCX'), true)).status).toBe(500)
  expect((await f.request('PUT', 'a', Buffer.alloc(8193), true)).status).toBe(413)
  expect((await f.request('DELETE', 'a')).status).toBe(501)
  expect(await f.store.read(f.session)).toEqual(f.first)
})

it('unloads routes and capabilities before releasing the document to the agent', async () => {
  const f = await fixture()
  await expect(f.host.open(f.session)).rejects.toThrow()
  await f.plugin.dispose()
  expect((await fetch(f.url(f.grant))).status).toBe(404)
  await expect(f.host.open(f.session)).rejects.toThrow('closed')
  const next = await f.store.amend(f.session, f.first.currentHash, [{ old_text: 'insurance', new_text: 'coverage' }], new AbortController().signal)
  expect(next.generation).toBe(2)
})
