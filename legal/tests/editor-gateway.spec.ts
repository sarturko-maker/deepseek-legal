/** Header-scoped imports use the real filesystem and revoke cancelled editor acquisitions. */
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import FsLocal from '@deepseek-ai/dsh-fs-local'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { expect, it, onTestFinished, vi } from 'vitest'
import { editorConfigSchema } from '../src/editor/index.ts'
import * as EditorPlugin from '../src/editor/index.ts'
import { DocumentStore } from '../src/store.ts'
import { contractFixture } from './fixture.ts'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'legal-launch-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const workspace = join(root, 'workspace')
  const outside = join(root, 'outside')
  await mkdir(workspace); await mkdir(outside)
  await writeFile(join(workspace, 'contract.docx'), contractFixture())
  await writeFile(join(outside, 'contract.docx'), contractFixture())
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const store = new DocumentStore(join(root, 'documents'), { maxFileBytes: 1024 * 1024,
    maxExpandedBytes: 4 * 1024 * 1024, maxParts: 100, maxProjectionBytes: 64 * 1024, maxAmendments: 10 }, 'Commercial Agent')
  ctx.provide('legalDocuments', store)
  await ctx.plugin(FsLocal, { cwd: workspace })
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const config = editorConfigSchema.parse({ parentOrigin: 'dsh-app://app',
    editorOrigin: 'http://127.0.0.1:9980', callbackOrigin: `http://host.docker.internal:${ctx.webServer.port}` })
  await ctx.plugin(EditorPlugin, config)
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async () => new Response(
    '<wopi-discovery><action ext="docx" name="edit" urlsrc="http://127.0.0.1:9980/browser/pinned/cool.html"/></wopi-discovery>')))
  onTestFinished(() => { vi.unstubAllGlobals() })
  const scope = { sessionId: SessionId('launch-owner'), workspaceRoot: workspace }
  return { ctx, store, scope, workspace, outside }
}

it('imports the workspace DOCX and reopens its managed original after writer release', async () => {
  const f = await fixture()
  const first = await f.ctx.legalEditorGateway.open(f.scope, 'contract.docx', new AbortController().signal)
  expect(first.title).toBe('contract.docx')
  expect(new URL(first.editorUrl).searchParams.get('WOPISrc'))
    .toBe(`http://host.docker.internal:${f.ctx.webServer.port}/legal/wopi/files/${first.fileId}`)
  await expect(f.ctx.legalEditorGateway.close({ ...f.scope, sessionId: SessionId('another-session') }, first.fileId))
    .rejects.toThrow('Session')
  await f.ctx.legalEditorGateway.close(f.scope, first.fileId)
  const initial = await f.store.read(f.scope.sessionId)
  await writeFile(join(f.workspace, 'contract.docx'), contractFixture('Changed source.'))
  const reopened = await f.ctx.legalEditorGateway.open(f.scope, 'contract.docx', new AbortController().signal)
  expect(reopened.fileId).not.toBe(first.fileId)
  expect(await f.store.read(f.scope.sessionId)).toEqual(initial)
})

it('rejects a sibling path and an escaping directory link before importing any document', async () => {
  const f = await fixture()
  const imported = vi.spyOn(f.store, 'start')
  const read = vi.spyOn(f.ctx.fs, 'readBytes')
  await expect(f.ctx.legalEditorGateway.open(f.scope, '../outside/contract.docx', new AbortController().signal))
    .rejects.toThrow('outside')
  await symlink(f.outside, join(f.workspace, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  await expect(f.ctx.legalEditorGateway.open(f.scope, 'escape/contract.docx', new AbortController().signal))
    .rejects.toThrow('outside')
  expect(read).not.toHaveBeenCalled()
  expect(imported).not.toHaveBeenCalled()
})

it('revokes an acquisition when cancellation arrives before returning it to the Client', async () => {
  const f = await fixture()
  const controller = new AbortController()
  const open = f.ctx.legalEditor.open.bind(f.ctx.legalEditor)
  vi.spyOn(f.ctx.legalEditor, 'open').mockImplementation(async session => {
    const grant = await open(session)
    controller.abort(new Error('tab closed'))
    return grant
  })
  const close = vi.spyOn(f.ctx.legalEditor, 'close')
  await expect(f.ctx.legalEditorGateway.open(f.scope, 'contract.docx', controller.signal)).rejects.toThrow('tab closed')
  expect(close).toHaveBeenCalledOnce()
  vi.restoreAllMocks()
  const next = await f.ctx.legalEditor.open(f.scope.sessionId)
  await f.ctx.legalEditor.close(next.fileId)
})
