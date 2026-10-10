/** One iframe's load and save acknowledgements, with bounded waits and retained failed saves. */
import type { EditorLaunch } from '@deepseek-legal/redlining/editor/types'
import type { EditorMessage } from './editor-bridge.ts'
import type { LegalEditorKey } from './locales.ts'

/** Local feedback; no capability values are persisted with this state. */
export interface EditorState {
  readonly status: LegalEditorKey
  readonly ready: boolean
  readonly busy: boolean
}

/** Owns one outstanding Host-requested save until its acknowledgement or disposal. */
export class EditorSession {
  private loaded = false
  private disposed = false
  private expired = false
  private state: EditorState = { status: 'loading', ready: false, busy: false }
  private pending: ReturnType<typeof Promise.withResolvers<void>> | undefined
  private closing: Promise<void> | undefined
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private readonly loadTimer: ReturnType<typeof setTimeout>
  private readonly expiryTimer: ReturnType<typeof setTimeout>

  /**
   * @param launch Authenticated grant with deployment-configured deadlines.
   * @param send Commands addressed to this iframe's exact origin.
   * @param report Feedback held by the retained pane.
   * @param release Revoke this grant and await Host writer release.
   */
  constructor(private readonly launch: Pick<EditorLaunch, 'loadTimeoutMs' | 'saveTimeoutMs' | 'expiresAt'>,
    private readonly send: (id: string, values?: Record<string, unknown>) => void,
    private readonly report: (state: EditorState) => void,
    private readonly release: () => Promise<void>) {
    this.loadTimer = setTimeout(() => this.update({ status: 'failed' }), launch.loadTimeoutMs)
    this.expiryTimer = setTimeout(() => {
      this.expired = true
      this.update({ status: 'expired', ready: false })
    }, Math.max(0, launch.expiresAt - Date.now()))
  }

  /** Process a message already checked for iframe identity, origin and bounded JSON.
   * @param message Checked Collabora message.
   */
  receive(message: EditorMessage): void {
    if (this.disposed || this.expired) return
    if (message.MessageId === 'App_LoadingStatus' && message.Values?.Status === 'Frame_Ready') {
      this.send('Host_PostmessageReady')
    }
    if ((message.MessageId === 'App_LoadingStatus' && message.Values?.Status === 'Document_Loaded')
      || (message.MessageId === 'Action_Load_Resp' && message.Values?.success === true)) {
      clearTimeout(this.loadTimer)
      this.loaded = true
      this.update({ status: 'source', ready: true })
    }
    if (message.MessageId !== 'Action_Save_Resp' || this.pending === undefined) return
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer)
    const operation = this.pending
    this.pending = undefined
    if (message.Values?.success === true || message.Values?.result === 'unmodified') {
      this.update({ status: 'saved', busy: false })
      operation.resolve()
    } else {
      this.update({ status: 'saveFailed', busy: false })
      operation.reject(new Error('Editor save was not confirmed.'))
    }
  }

  /** Request a save; a timed-out request stays outstanding so its late reply cannot settle a newer save.
   * @returns Resolves only on a positive or unchanged save acknowledgement.
   */
  save(): Promise<void> {
    if (this.pending !== undefined) return this.pending.promise
    if (this.disposed || this.expired || !this.loaded) return Promise.reject(new Error('The editor is not ready to save.'))
    const operation = Promise.withResolvers<void>()
    this.pending = operation
    this.update({ status: 'saving', busy: true })
    this.saveTimer = setTimeout(() => {
      this.update({ status: 'saveFailed', busy: false })
      operation.reject(new Error('Editor save was not confirmed.'))
    }, this.launch.saveTimeoutMs)
    try { this.send('Action_Save', { DontTerminateEdit: false, DontSaveIfUnmodified: true, Notify: true }) }
    catch (error) {
      clearTimeout(this.saveTimer)
      this.pending = undefined
      this.update({ status: 'saveFailed', busy: false })
      operation.reject(error)
    }
    return operation.promise
  }

  /** Save an editable document before revocation; a failed load can close without waiting for a save.
   * @returns Resolves after save acknowledgement and Host writer release; failure retains the pane.
   */
  close(): Promise<void> {
    if (this.closing !== undefined) return this.closing
    this.closing = (async () => {
      if (this.loaded) await this.save()
      this.update({ busy: true })
      await this.release()
    })().catch((error: unknown) => {
      this.closing = undefined
      this.update({ status: this.expired ? 'expired' : 'saveFailed', busy: false })
      throw error
    })
    return this.closing
  }

  /** Clear owned timers and reject an outstanding caller when the pane unmounts. */
  dispose(): void {
    this.disposed = true
    clearTimeout(this.loadTimer)
    clearTimeout(this.expiryTimer)
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer)
    this.pending?.reject(new Error('Editor pane closed.'))
    this.pending = undefined
  }

  private update(patch: Partial<EditorState>): void {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    this.report(this.state)
  }
}
