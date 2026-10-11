/** Display names retain the source filename on both supported path syntaxes. */
import { expect, it } from 'vitest'
import { editorFilename } from '../src/client/editor-label.ts'

it.each([
  ['C:\\Contracts\\one-way-nda.docx', 'one-way-nda.docx'],
  ['legal/manual-tests/nda-stage-2a/one-way-nda.docx', 'one-way-nda.docx'],
  [undefined, ''],
])('labels the working tab from %s', (path, name) => {
  expect(editorFilename(path)).toBe(name)
})
