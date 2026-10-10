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
  readonly loadTimeoutMs: number
  readonly saveTimeoutMs: number
}
