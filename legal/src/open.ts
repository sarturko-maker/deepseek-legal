/** Shared import through Harness's authorized filesystem and managed document store. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-fs'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { DocumentStore, DocumentView } from './store.ts'

/** Import or reopen a Session's single contract without changing its source.
 * @param ctx Normal Harness filesystem provider.
 * @param store Managed originals and working generations.
 * @param session Authorized owning Session.
 * @param cwd Header-derived workspace directory.
 * @param path Selected DOCX path.
 * @param signal Caller cancellation.
 * @param workspaceOnly Require the resolved source to stay inside the Session's workspace for GUI imports.
 * @returns Current managed document; a different source in the same Session rejects.
 */
export async function openDocument(ctx: Context, store: DocumentStore, session: SessionId,
  cwd: string, path: string, signal: AbortSignal, workspaceOnly = false): Promise<DocumentView> {
  if (!path.toLowerCase().endsWith('.docx')) throw new Error('Only DOCX contracts are supported.')
  const target = await ctx.fs.resolve(path, { cwd, signal })
  if (workspaceOnly) {
    const root = await ctx.fs.resolve(cwd, { signal })
    if (!ctx.fs.contains(root, target)) throw new Error('The contract is outside this Session workspace.')
  }
  const bytes = await ctx.fs.readBytes(target, signal, store.limits.maxFileBytes)
  return store.start(session, target.displayPath, bytes, signal)
}
