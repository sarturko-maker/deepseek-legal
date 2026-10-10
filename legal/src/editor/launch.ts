/** Authenticated editor launch over the existing Harness Gateway and Session lookup. */
import type { Context } from '@deepseek-ai/cordis'
import type { WorkspaceFileScope } from '@deepseek-ai/dsh-api-workspace-files'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { DOMParser } from '@xmldom/xmldom'
import { basename } from 'node:path'
import { openDocument } from '../open.ts'
import type { EditorLaunch, EditorFileId } from './types.ts'
export type { EditorLaunch } from './types.ts'
import type {} from '../index.ts'
import type {} from './index.ts'

/** Deployment addresses and bounded discovery requests. */
export interface LaunchConfig {
  readonly editorOrigin: string
  readonly callbackOrigin: string
  readonly discoveryTimeoutMs: number
  readonly maxDiscoveryBytes: number
  readonly loadTimeoutMs: number
  readonly saveTimeoutMs: number
}

/** Resolve the pinned editor's DOCX edit action; refuses redirects and different origins.
 * @param config Validated local deployment addresses and limits.
 * @param signal Caller cancellation.
 * @returns Same-origin DOCX edit URL from discovery.
 */
export async function discoverEditor(config: LaunchConfig, signal: AbortSignal): Promise<URL> {
  const response = await fetch(new URL('/hosting/discovery', config.editorOrigin), {
    redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(config.discoveryTimeoutMs)]),
  })
  if (!response.ok || response.body === null) throw new Error('Collabora discovery is unavailable. Start the legal editor container.')
  const chunks: Uint8Array[] = []
  let length = 0
  const reader = response.body.getReader()
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      length += part.value.byteLength
      if (length > config.maxDiscoveryBytes) throw new Error('Collabora discovery exceeds the configured limit.')
      chunks.push(part.value)
    }
  } finally { await reader.cancel(); reader.releaseLock() }
  const xml = Buffer.concat(chunks).toString('utf8')
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new Error('Collabora discovery contains unsupported XML declarations.')
  const document = new DOMParser({ onError: () => { throw new Error('Collabora discovery is invalid XML.') } })
    .parseFromString(xml, 'application/xml')
  const actions = Array.from(document.getElementsByTagName('action'))
    .filter(action => action.getAttribute('ext') === 'docx' && action.getAttribute('name') === 'edit')
  if (actions.length !== 1) throw new Error('Collabora discovery must advertise one DOCX editing action.')
  const template = actions[0]?.getAttribute('urlsrc') ?? ''
  const url = new URL(template.split('?')[0] ?? '', config.editorOrigin)
  if (url.origin !== config.editorOrigin || url.username !== '' || url.password !== '' || url.hash !== ''
    || !/^\/browser\/[^/]+\/cool\.html$/u.test(url.pathname)) throw new Error('Collabora discovery returned an unexpected editor address.')
  return url
}

/** Session-authorized operations; WOPI capabilities never reach the model transcript. */
export class LegalEditorGateway extends TypertRemoteService {
  static inject = ['legalDocuments', 'legalEditor', 'fs']

  constructor(ctx: Context, private readonly config: LaunchConfig) {
    super(ctx, 'legalEditorGateway', { namespace: 'legalEditor' })
  }

  /** Import the selected DOCX and acquire an editor lifetime.
   * @param workspaceFileScope Existing Gateway lookup resolves the Session and its workspace.
   * @param path Selected source read through Harness's filesystem permission controls.
   * @param signal Caller cancellation; acquired capabilities are revoked on failure.
   * @returns Private editor form data for the continuing managed document.
   */
  @Remote
  async open(workspaceFileScope: WorkspaceFileScope, path: string, signal: AbortSignal): Promise<EditorLaunch> {
    const editorUrl = await discoverEditor(this.config, signal)
    const view = await openDocument(this.ctx, this.ctx.legalDocuments, workspaceFileScope.sessionId,
      workspaceFileScope.workspaceRoot, path, signal, true)
    signal.throwIfAborted()
    const grant = await this.ctx.legalEditor.open(workspaceFileScope.sessionId)
    try {
      signal.throwIfAborted()
      editorUrl.searchParams.set('WOPISrc', new URL(`/legal/wopi/files/${grant.fileId}`, this.config.callbackOrigin).href)
      return { ...grant, editorUrl: editorUrl.href, title: basename(view.source),
        loadTimeoutMs: this.config.loadTimeoutMs, saveTimeoutMs: this.config.saveTimeoutMs }
    } catch (error) { await this.ctx.legalEditor.close(grant.fileId); throw error }
  }

  /** Revoke this Session's editor lifetime and wait for writer ownership to end.
   * @param workspaceFileScope Existing Session lookup; another Session cannot close this grant.
   * @param fileId Private identity returned by open.
   * @returns Resolves after WOPI requests settle; already closed grants are harmless.
   */
  @Remote
  async close(workspaceFileScope: WorkspaceFileScope, fileId: EditorFileId): Promise<void> {
    await this.ctx.legalEditor.close(fileId, workspaceFileScope.sessionId)
  }
}
