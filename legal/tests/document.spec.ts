/** Real ADEU round trips and package preservation, without a model or editor mock. */
import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { amendDocument, documentHash, projectDocument } from '../src/document.ts'
import { contractFixture } from './fixture.ts'
import type { DocumentLimits } from '../src/document.ts'

export const limits: DocumentLimits = {
  maxFileBytes: 1024 * 1024, maxExpandedBytes: 4 * 1024 * 1024,
  maxParts: 100, maxProjectionBytes: 64 * 1024, maxAmendments: 10,
}

describe('tracked document engine', () => {
  it('reads existing human comments and preserves original bytes during tracked replacement', async () => {
    const original = contractFixture()
    const originalHash = documentHash(original)
    const before = await projectDocument(original, limits)
    expect(before).toContain('GBP 100000')
    expect(before).toContain('Keep this human comment.')
    const result = await amendDocument(original, [{ old_text: 'GBP 100000', new_text: 'GBP 200000', comment: 'Increase the proposed cap.' }], 'Commercial Agent', limits)
    expect(documentHash(original)).toBe(originalHash)
    expect(result.projection).toContain('200000')
    const saved = unzipSync(result.bytes)
    const input = unzipSync(original)
    const xml = strFromU8(saved['word/document.xml']!)
    expect(xml).toMatch(/<w:ins\b/u)
    expect(xml).toMatch(/<w:del\b/u)
    expect(xml).toContain('Commercial Agent')
    expect(xml).toContain('<w:b')
    expect(xml).toContain('insurance')
    expect(saved['word/media/image1.png']).toEqual(input['word/media/image1.png'])
    expect(strFromU8(saved['word/header1.xml']!)).toContain('Synthetic contract header')
    const comments = strFromU8(saved['word/comments.xml']!)
    expect(comments).toContain('Human Reviewer')
    expect(comments).toContain('Keep this human comment.')
    expect(comments).toContain('Increase the proposed cap.')
  })

  it('rejects the whole batch when a later replacement cannot be located', async () => {
    const original = contractFixture()
    const hash = documentHash(original)
    await expect(amendDocument(original, [
      { old_text: 'GBP 100000', new_text: 'GBP 200000' },
      { old_text: 'This clause does not exist', new_text: 'Replacement' },
    ], 'Commercial Agent', limits)).rejects.toThrow()
    expect(documentHash(original)).toBe(hash)
  })

  it('rejects ambiguous replacements', async () => {
    await expect(amendDocument(contractFixture('cap cap'), [{ old_text: 'cap', new_text: 'limit' }], 'Commercial Agent', limits)).rejects.toThrow()
  })

  it('rejects file, expanded package, part, projection and batch limits', async () => {
    const bytes = contractFixture()
    for (const reduced of [
      { ...limits, maxFileBytes: 1 }, { ...limits, maxExpandedBytes: 1 },
      { ...limits, maxParts: 1 }, { ...limits, maxProjectionBytes: 1 },
    ]) await expect(projectDocument(bytes, reduced)).rejects.toThrow()
    await expect(projectDocument(Buffer.from('not a DOCX'), limits)).rejects.toThrow()
    await expect(amendDocument(bytes, [], 'Commercial Agent', limits)).rejects.toThrow()
  })
})
