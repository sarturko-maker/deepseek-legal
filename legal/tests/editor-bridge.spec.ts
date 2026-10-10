/** The iframe is the authority for editor acknowledgements, never the ambient message bus. */
import { expect, it } from 'vitest'
import { editorMessage } from '../src/client/editor-bridge.ts'

it('accepts only bounded JSON from the granted iframe and exact origin', () => {
  const first = new MessageChannel()
  const second = new MessageChannel()
  const frame = first.port1
  const other = second.port1
  try {
    const event = { source: frame, origin: 'http://127.0.0.1:9980',
      data: JSON.stringify({ MessageId: 'Action_Save_Resp', Values: { success: true } }) }
    expect(editorMessage(event, frame, event.origin)?.Values?.success).toBe(true)
    expect(editorMessage({ ...event, source: other }, frame, event.origin)).toBeUndefined()
    expect(editorMessage({ ...event, origin: 'http://localhost:9980' }, frame, event.origin)).toBeUndefined()
    expect(editorMessage(event, null, event.origin)).toBeUndefined()
    for (const data of ['{', '{}', JSON.stringify({ MessageId: 3 }), 'x'.repeat(65537)]) {
      expect(editorMessage({ ...event, data }, frame, event.origin)).toBeUndefined()
    }
  } finally { first.port1.close(); first.port2.close(); second.port1.close(); second.port2.close() }
})
