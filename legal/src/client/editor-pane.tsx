/** Retained native iframe with explicit save acknowledgement before close. */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TabId } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { EditorFileId, EditorLaunch } from '@deepseek-legal/redlining/editor/types'
import { editorMessage, sendEditorMessage } from './editor-bridge.ts'
import { EditorSession } from './editor-session.ts'
import type { NS, LegalEditorKey } from './locales.ts'
import css from './editor-pane.module.css'

/** Authenticated operations and the close hook injected by the Client plugin. */
export interface EditorPaneInjected {
  readonly launch: (session: SessionId, path: string, signal: AbortSignal) => Promise<RemoteResult<EditorLaunch>>
  readonly release: (session: SessionId, file: EditorFileId) => Promise<RemoteResult<void>>
  readonly bindClose: (tab: TabId, close: () => void) => () => void
}

/** A live grant stays in component memory, never in persisted tab parameters.
 * @param props Existing Session/tab hooks, localized copy and authenticated operations.
 * @returns The editor, bounded progress and retry/save feedback.
 */
export function EditorPane(props: PropsRuntime<'sidebar.right.pane.tab'>
  & PropsLocale<typeof NS> & InjectFace<EditorPaneInjected>): ReactNode {
  const info = props.useTabInfo()
  const params = info.tab.navigation.params
  const path = params !== undefined && 'path' in params ? params.path : undefined
  const [attempt, setAttempt] = useState(0)
  const [grant, setGrant] = useState<EditorLaunch>()
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<LegalEditorKey>('loading')
  const [busy, setBusy] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const save = useRef<(() => Promise<void>) | undefined>(undefined)
  const close = useRef<(() => void) | undefined>(undefined)
  const releasing = useRef(Promise.resolve())

  useEffect(() => {
    if (path === undefined) { setStatus('missing'); return }
    const controller = new AbortController()
    let acquired: EditorLaunch | undefined
    setGrant(undefined); setReady(false); setStatus('loading')
    void releasing.current.then(() => {
      controller.signal.throwIfAborted()
      return props.launch(props.sessionId, path, AbortSignal.any([controller.signal, info.tab.signal]))
    }).then(async result => {
      if (!result.ok) { if (!controller.signal.aborted) setStatus('openFailed'); return }
      acquired = result.value
      if (controller.signal.aborted) { await props.release(props.sessionId, result.value.fileId); return }
      setGrant(result.value)
    }).catch((_error: unknown) => {
      if (!controller.signal.aborted) setStatus('openFailed')
    })
    return () => {
      controller.abort()
      if (acquired !== undefined) releasing.current = props.release(props.sessionId, acquired.fileId).then(result => {
        if (!result.ok) throw new Error('Editor access could not close.')
      })
      void releasing.current.catch((_error: unknown) => { /* A failed release prevents replacement acquisition. */ })
    }
  }, [props.sessionId, props.launch, props.release, path, attempt, info.tab.signal])

  useEffect(() => {
    if (grant === undefined) return
    const origin = new URL(grant.editorUrl).origin
    let disposed = false
    const send = (id: string, values: Record<string, unknown> = {}): void => {
      const target = frame.current?.contentWindow
      if (target !== null && target !== undefined) sendEditorMessage(target, origin, id, values)
    }
    const editor = new EditorSession(grant, send, state => {
      setStatus(state.status); setReady(state.ready); setBusy(state.busy)
      if (frame.current !== null) frame.current.inert = state.busy
    }, async () => {
      const result = await props.release(props.sessionId, grant.fileId)
      if (!result.ok) throw new Error('Editor access could not close.')
    })
    save.current = () => editor.save()
    const performClose = (): void => {
      void editor.close().then(() => {
        if (disposed) return
        unbind()
        info.tab.actions.close()
      }).catch((_error: unknown) => { /* The failed save or release retains the editor and its feedback. */ })
    }
    close.current = performClose
    const unbind = props.bindClose(info.tab.id, performClose)
    const listener = (event: MessageEvent): void => {
      const message = editorMessage(event, frame.current?.contentWindow ?? null, origin)
      if (message !== undefined) editor.receive(message)
    }
    window.addEventListener('message', listener)
    form.current?.submit()
    return () => {
      disposed = true; unbind(); window.removeEventListener('message', listener)
      editor.dispose()
      save.current = undefined; close.current = undefined
    }
  }, [grant, props.bindClose, props.release, props.sessionId, info.tab.id, info.tab.actions])

  const failed = status === 'failed' || status === 'openFailed'
  return <div className={css.pane}>
    <div className={css.toolbar}>
      <span className={css.status} role="status">{props.t(status)}</span>
      {failed && <Button size="sm" onClick={() => setAttempt(value => value + 1)}>{props.t('retry')}</Button>}
      <Button size="sm" disabled={!ready || busy} onClick={() => { void save.current?.().catch((_error: unknown) => { /* Save feedback stays in the pane. */ }) }}>{props.t('save')}</Button>
      <Button size="sm" disabled={!ready || busy} onClick={() => close.current?.()}>{props.t('close')}</Button>
    </div>
    <p className={css.notice}>{props.t('manual')}</p>
    {grant !== undefined && <>
      <form ref={form} method="post" action={grant.editorUrl} target={`legal-editor-${grant.fileId}`} hidden>
        <input type="hidden" name="access_token" value={grant.accessToken} />
        <input type="hidden" name="access_token_ttl" value={grant.expiresAt} />
      </form>
      <iframe ref={frame} className={css.frame} name={`legal-editor-${grant.fileId}`} title={props.t('title')}
        allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer" />
    </>}
  </div>
}
