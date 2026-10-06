/** Bounded ADEU projections and transactional tracked amendments of DOCX bytes. */
import { createHash } from 'node:crypto'
import { DocumentObject, RedlineEngine, extractTextFromBuffer } from '@adeu/core'
import { unzipSync } from 'fflate'
import { z } from 'zod'

/** SHA-256 identifying the exact complete document bytes. */
export const documentHashSchema = z.string().regex(/^[a-f0-9]{64}$/u).brand<'DocumentHash'>()
export type DocumentHash = z.infer<typeof documentHashSchema>

/** Literal replacements only; ambiguous matches and safety overrides are unavailable. */
export const amendmentSchema = z.strictObject({
  old_text: z.string().min(1),
  new_text: z.string(),
  comment: z.string().optional(),
}).refine(value => value.old_text !== value.new_text, 'The replacement must change the text.')
export type Amendment = z.infer<typeof amendmentSchema>

/** Deployment limits apply to the complete package and complete model projection. */
export interface DocumentLimits {
  maxFileBytes: number
  maxExpandedBytes: number
  maxParts: number
  maxProjectionBytes: number
  maxAmendments: number
}

/** Hash the complete bytes without loading or changing the package. @param bytes DOCX bytes. @returns Their content identity. */
export function documentHash(bytes: Uint8Array): DocumentHash {
  return documentHashSchema.parse(createHash('sha256').update(bytes).digest('hex'))
}

/** Reject oversized or incomplete packages before ADEU loads their XML. */
function validatePackage(bytes: Uint8Array, limits: DocumentLimits): void {
  if (bytes.byteLength > limits.maxFileBytes) throw new Error('The document exceeds the configured file limit.')
  let parts = 0
  let expanded = 0
  const archive = unzipSync(bytes, { filter(entry) {
    parts += 1
    expanded += entry.originalSize
    if (parts > limits.maxParts || expanded > limits.maxExpandedBytes) {
      throw new Error('The document exceeds the configured expanded package limit.')
    }
    return true
  } })
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    if (archive[part] === undefined) throw new Error(`The DOCX is missing ${part}.`)
  }
}

/** Return ADEU's current text, revisions and comment appendix without truncation.
 * @param bytes Complete DOCX bytes.
 * @param limits Configured package and projection limits.
 * @returns The marked-up current document; rejects unreadable or oversized input.
 */
export async function projectDocument(bytes: Uint8Array, limits: DocumentLimits): Promise<string> {
  validatePackage(bytes, limits)
  const projection = await extractTextFromBuffer(Buffer.from(bytes), false, true)
  if (Buffer.byteLength(projection, 'utf8') > limits.maxProjectionBytes) {
    throw new Error('The document projection exceeds the configured limit; it was not truncated.')
  }
  return projection
}

/** Apply one complete batch to a fresh DOM and verify the saved package can be read.
 * @param bytes Exact current DOCX bytes; never modified in place.
 * @param amendments Validated literal replacements, in document-state order.
 * @param author The visible tracked-change author.
 * @param limits Configured package, projection and batch limits.
 * @returns Complete DOCX bytes containing native tracked amendments and the current projection.
 */
export async function amendDocument(bytes: Uint8Array, amendments: readonly Amendment[], author: string,
  limits: DocumentLimits): Promise<{ bytes: Buffer; projection: string }> {
  if (amendments.length === 0 || amendments.length > limits.maxAmendments) {
    throw new Error('The amendment batch is empty or exceeds the configured limit.')
  }
  validatePackage(bytes, limits)
  const document = await DocumentObject.load(Buffer.from(bytes))
  const engine = new RedlineEngine(document, author)
  // A fresh DOM is discarded on failure; rejected batches never reach document storage.
  const outcome: unknown = engine.process_batch(amendments.map(amendment => ({
    type: 'modify' as const,
    target_text: amendment.old_text,
    new_text: amendment.new_text,
    match_mode: 'strict' as const,
    ...(amendment.comment === undefined ? {} : { comment: amendment.comment }),
  })), undefined, false)
  const status = z.object({ status: z.literal('ok'), edits_applied: z.number(), edits_skipped: z.literal(0) }).parse(outcome)
  if (status.edits_applied !== amendments.length) throw new Error('The engine did not apply the complete amendment batch.')
  const saved = await document.save()
  return { bytes: saved, projection: await projectDocument(saved, limits) }
}
