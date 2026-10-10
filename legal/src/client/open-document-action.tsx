/** Explicit DOCX action on Harness's ordinary document preview. */
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { NS } from './locales.ts'

/** Navigation operation injected into the preview action. */
export interface OpenDocumentInjected {
  /** Open the selected Session's editor page. @param session Owning Session. @param path Selected DOCX. */
  readonly openEditor: (session: SessionId, path: string) => void
}
/** Render only for a DOCX preview; import occurs in the authenticated pane.
 * @param props Existing preview path, Session, locale and navigation.
 * @returns The editor action or null for another file type.
 */
export function OpenDocumentAction(props: PropsRuntime<'sidebar.right.tab.document.actions'>
  & PropsLocale<typeof NS> & InjectFace<OpenDocumentInjected>): ReactNode {
  if (!props.absolutePath.toLowerCase().endsWith('.docx')) return null
  return <Button variant="toolbar" size="sm" onClick={() => props.openEditor(props.sessionId, props.absolutePath)}>{props.t('open')}</Button>
}
