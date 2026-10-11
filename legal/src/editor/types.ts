/** Browser-safe editor identities and authenticated launch data. */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** Opaque URL-safe identity of one editor lifetime. */
export type EditorFileId = Branded<'EditorFileId'>
/** Secret bearer capability; never include it in model results or logs. */
export type EditorAccessToken = Branded<'EditorAccessToken'>
/** Private response for the native editor form and bounded Client waits. */
export interface EditorLaunch {
  readonly fileId: EditorFileId
  readonly accessToken: EditorAccessToken
  readonly expiresAt: number
  readonly editorUrl: string
  readonly title: string
  /** Original import location; the iframe edits the Session's managed copy. */
  readonly source: string
  /** CODE presentation defaults supplied through its launch form. */
  readonly uiDefaults: string
  /** Initial pane preference; an existing user-selected width takes precedence. */
  readonly paneWidthRatio: number
  /** Initial review settings, explicitly set after CODE reports document readiness. */
  readonly showTrackedChanges: boolean
  readonly recordChanges: boolean
  readonly loadTimeoutMs: number
  readonly saveTimeoutMs: number
}
