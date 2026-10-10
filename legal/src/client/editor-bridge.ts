/** Checked Collabora messaging; messages from other windows and origins are ignored. */
import { z } from 'zod'

const messageSchema = z.object({ MessageId: z.string(), Values: z.record(z.string(), z.unknown()).optional() })
/** Accepted protocol message, after the iframe identity and JSON checks. */
export type EditorMessage = z.infer<typeof messageSchema>

/** Read one message only from the granted editor window.
 * @param event Browser message event.
 * @param frame Exact granted iframe window.
 * @param origin Exact configured editor HTTP origin.
 * @returns A checked message, or undefined for unrelated or malformed input.
 */
export function editorMessage(event: Pick<MessageEvent, 'source' | 'origin' | 'data'>,
  frame: MessageEventSource | null, origin: string): EditorMessage | undefined {
  if (frame === null || event.source !== frame || event.origin !== origin || typeof event.data !== 'string'
    || event.data.length > 64 * 1024) return undefined
  let value: unknown
  try { value = JSON.parse(event.data) }
  catch (_error) { return undefined /* Other iframe messages need not be JSON. */ }
  const result = messageSchema.safeParse(value)
  return result.success ? result.data : undefined
}

/** Send a Collabora command to the exact granted origin.
 * @param frame Granted editor window.
 * @param origin Exact configured editor HTTP origin.
 * @param id Collabora protocol command.
 * @param values Command values.
 */
export function sendEditorMessage(frame: Window, origin: string, id: string, values: Record<string, unknown> = {}): void {
  frame.postMessage(JSON.stringify({ MessageId: id, SendTime: Date.now(), Values: values }), origin)
}
