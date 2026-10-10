/** Optional legal editor contribution to Harness's native Client slots and Gateway. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { TabId } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { TYPERT_REMOTE } from '@deepseek-legal/redlining/remote'
import { OpenDocumentAction } from './open-document-action.tsx'
import { EditorPane } from './editor-pane.tsx'
import { EditorTitle } from './editor-title.tsx'
import type { EditorPaneInjected } from './editor-pane.tsx'
import { NS, en, zh } from './locales.ts'
import type { LegalEditorKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { legalEditor: LegalEditorKey }
}
declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
  interface SidebarRightTabParamsMap { legalEditor: { readonly path: string } }
}

const ID = '@deepseek-legal/redlining'
/** Existing Client services; no replacement chat or layout owner. */
export const inject = ['remote', 'slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

/** Register the authenticated Remote contribution, explicit preview action and editor tab.
 * @param ctx Existing native Client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.remote.$mount(TYPERT_REMOTE))
  ctx.inject(['remote.legalEditor'], registerEditor)
}

function registerEditor(ctx: Context): void {
  const closeHandlers = new Map<TabId, () => void>()
  ctx.effect(() => ctx.locale.register(NS, { en, zh }))
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: ID, kind: 'legalEditor', keepMounted: true, title: () => t('title') }))
  ctx.effect(() => ctx.sidebarRight.registerCloseHandler('legalEditor', (_session, tab) => {
    const close = closeHandlers.get(tab.id)
    if (close === undefined) return
    close()
    return false
  }))
  const pane: EditorPaneInjected = {
    launch: (session, path, signal) => ctx.remote.legalEditor.open(session, path, signal),
    release: (session, file) => ctx.remote.legalEditor.close(session, file),
    bindClose(tab, close) {
      closeHandlers.set(tab, close)
      return () => { if (closeHandlers.get(tab) === close) closeHandlers.delete(tab) }
    },
  }
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: ID, locale: NS, inject: () => pane,
  }, EditorPane)))
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title', key: ID, locale: NS,
  }, EditorTitle)))
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({
    name: 'sidebar.right.tab.document.actions', id: ID, locale: NS,
    inject: () => ({ openEditor: (session: SessionId, path: string) => {
      ctx.sidebarRight.openTabIn(session, 'legalEditor', { params: { path } })
    } }),
  }, OpenDocumentAction)))
}
