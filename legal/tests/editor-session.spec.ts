/** Save failures keep writer ownership; fake time advances only the pane's owned deadlines. */
import { expect, it, onTestFinished, vi } from 'vitest'
import { EditorSession } from '../src/client/editor-session.ts'
import type { EditorState } from '../src/client/editor-session.ts'

function fixture(loaded = true, review = { showTrackedChanges: true, recordChanges: true }) {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  const send = vi.fn<(id: string, values?: Record<string, unknown>) => void>()
  const release = vi.fn<() => Promise<void>>().mockResolvedValue()
  const states: EditorState[] = []
  const editor = new EditorSession({ loadTimeoutMs: 1000, saveTimeoutMs: 2000, expiresAt: 60_000, ...review },
    send, state => states.push(state), release)
  onTestFinished(() => { editor.dispose(); vi.useRealTimers() })
  if (loaded) editor.receive({ MessageId: 'App_LoadingStatus', Values: { Status: 'Document_Loaded' } })
  return { editor, send, release, states }
}

it('waits for a save acknowledgement and writer release before closing', async () => {
  const f = fixture()
  const released = Promise.withResolvers<void>()
  f.release.mockReturnValue(released.promise)
  const closed = vi.fn()
  const closing = f.editor.close().then(closed)
  expect(f.editor.close()).toBeDefined()
  expect(f.send.mock.calls.filter(([id]) => id === 'Action_Save')).toHaveLength(1)
  expect(f.send).toHaveBeenCalledWith('Action_Save', { DontTerminateEdit: false, DontSaveIfUnmodified: true, Notify: true })
  expect(f.release).not.toHaveBeenCalled()
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: true } })
  await Promise.resolve()
  expect(f.release).toHaveBeenCalledTimes(1)
  expect(closed).not.toHaveBeenCalled()
  released.resolve()
  await closing
  expect(closed).toHaveBeenCalledTimes(1)
})

it('reports unsaved edits without treating a clean notification or repeated load as a save acknowledgement', async () => {
  const f = fixture()
  f.editor.receive({ MessageId: 'Doc_ModifiedStatus', Values: { Modified: true } })
  expect(f.states.at(-1)?.status).toBe('unsaved')
  f.editor.receive({ MessageId: 'Doc_ModifiedStatus', Values: { Modified: false } })
  f.editor.receive({ MessageId: 'Action_Load_Resp', Values: { success: true } })
  expect(f.states.at(-1)?.status).toBe('unsaved')
  const save = f.editor.save()
  f.editor.receive({ MessageId: 'Doc_ModifiedStatus', Values: { Modified: false } })
  expect(f.states.at(-1)?.status).toBe('saving')
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: true } })
  await save
  expect(f.states.at(-1)?.status).toBe('saved')
  f.editor.receive({ MessageId: 'Doc_ModifiedStatus', Values: { Modified: true } })
  expect(f.states.at(-1)?.status).toBe('unsaved')
})

it.each([true, false])('sets review and recording to %s once after document readiness', enabled => {
  const f = fixture(false, { showTrackedChanges: enabled, recordChanges: enabled })
  f.editor.receive({ MessageId: 'Action_Load_Resp', Values: { success: true } })
  expect(f.send).not.toHaveBeenCalled()
  f.editor.receive({ MessageId: 'App_LoadingStatus', Values: { Status: 'Document_Loaded' } })
  f.editor.receive({ MessageId: 'App_LoadingStatus', Values: { Status: 'Document_Loaded' } })
  expect(f.send.mock.calls).toEqual([
    ['Send_UNO_Command', { Command: '.uno:ShowTrackedChanges', Args: { ShowTrackedChanges: { type: 'boolean', value: enabled } } }],
    ['Send_UNO_Command', { Command: '.uno:TrackChanges', Args: { TrackChanges: { type: 'boolean', value: enabled } } }],
  ])
})

it('retains newer edits when a timed-out save later succeeds', async () => {
  const f = fixture()
  const closing = f.editor.close()
  const failed = expect(closing).rejects.toThrow('not confirmed')
  await vi.advanceTimersByTimeAsync(2000)
  await failed
  f.editor.receive({ MessageId: 'Doc_ModifiedStatus', Values: { Modified: true } })
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: true } })
  expect(f.states.at(-1)?.status).toBe('unsaved')
  expect(f.release).not.toHaveBeenCalled()
  const retry = f.editor.close()
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: true } })
  await retry
  expect(f.release).toHaveBeenCalledOnce()
})

it('does not release ownership if an edit arrives during a close save', async () => {
  const f = fixture()
  const closing = f.editor.close()
  const failed = expect(closing).rejects.toThrow('changed during saving')
  f.editor.receive({ MessageId: 'Doc_ModifiedStatus', Values: { Modified: true } })
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: true } })
  await failed
  expect(f.release).not.toHaveBeenCalled()
})

it('accepts an unchanged save and deduplicates simultaneous save requests', async () => {
  const f = fixture()
  const save = f.editor.save()
  expect(f.editor.save()).toBe(save)
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: false, result: 'unmodified' } })
  await save
  expect(f.states.at(-1)).toMatchObject({ status: 'saved', busy: false })
  expect(f.release).not.toHaveBeenCalled()
})

it('retains the editor on a failed save and allows an acknowledged retry', async () => {
  const f = fixture()
  const closing = f.editor.close()
  const failure = expect(closing).rejects.toThrow('not confirmed')
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: false } })
  await failure
  expect(f.release).not.toHaveBeenCalled()
  expect(f.states.at(-1)).toMatchObject({ status: 'saveFailed', busy: false })
  const retry = f.editor.close()
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: true } })
  await retry
  expect(f.release).toHaveBeenCalledTimes(1)
})

it('keeps a timed-out save outstanding until its late reply arrives', async () => {
  const f = fixture()
  const save = f.editor.save()
  const failure = expect(save).rejects.toThrow('not confirmed')
  await vi.advanceTimersByTimeAsync(2000)
  await failure
  expect(f.editor.save()).toBe(save)
  expect(f.send.mock.calls.filter(([id]) => id === 'Action_Save')).toHaveLength(1)
  expect(f.release).not.toHaveBeenCalled()
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: true } })
  expect(f.states.at(-1)?.status).toBe('saved')
  const retry = f.editor.save()
  expect(retry).not.toBe(save)
  f.editor.receive({ MessageId: 'Action_Save_Resp', Values: { success: true } })
  await retry
})

it('can close an editor that failed to load and disposes all its timers', async () => {
  const f = fixture(false)
  f.editor.receive({ MessageId: 'App_LoadingStatus', Values: { Status: 'Frame_Ready' } })
  expect(f.send).toHaveBeenCalledWith('Host_PostmessageReady')
  await vi.advanceTimersByTimeAsync(1000)
  expect(f.states.at(-1)?.status).toBe('failed')
  await f.editor.close()
  expect(f.send).toHaveBeenCalledTimes(1)
  expect(f.release).toHaveBeenCalledTimes(1)
  f.editor.dispose()
  expect(vi.getTimerCount()).toBe(0)
})

it('rejects pending work on disposal and ignores messages after expiry', async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(f.states.at(-1)).toMatchObject({ status: 'expired', ready: false })
  f.editor.receive({ MessageId: 'App_LoadingStatus', Values: { Status: 'Document_Loaded' } })
  expect(f.states.at(-1)?.status).toBe('expired')
  await expect(f.editor.close()).rejects.toThrow('not ready')
  expect(f.release).not.toHaveBeenCalled()
  const second = fixture()
  const save = second.editor.save()
  const failure = expect(save).rejects.toThrow('pane closed')
  second.editor.dispose()
  await failure
})
