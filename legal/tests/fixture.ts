/** Synthetic DOCX with existing comments, opaque media and independent package parts. */
import { strToU8, zipSync } from 'fflate'

/** Make a small contract; package preservation is checked independently of ADEU's report.
 * @param text Main paragraph text; default contains an explicit liability clause.
 * @param includeImage Embed the existing PNG in a visible drawing for real editor round trips.
 * @returns Complete synthetic DOCX bytes.
 */
export function contractFixture(text = 'The aggregate liability is capped at GBP 100000.', includeImage = false): Buffer {
  const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const relationship = 'http://schemas.openxmlformats.org/package/2006/relationships'
  const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const image = includeImage ? `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Synthetic image"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>` : ''
  const parts: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`),
    '_rels/.rels': strToU8(`<Relationships xmlns="${relationship}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="word/document.xml"/></Relationships>`),
    'word/document.xml': strToU8(`<w:document xmlns:w="${word}" xmlns:r="${office}"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Liability</w:t></w:r></w:p><w:p><w:commentRangeStart w:id="7"/><w:r><w:t>${text}</w:t></w:r><w:commentRangeEnd w:id="7"/><w:r><w:commentReference w:id="7"/></w:r></w:p><w:p><w:r><w:t>The supplier must maintain insurance.</w:t></w:r></w:p>${image}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/></w:sectPr></w:body></w:document>`),
    'word/_rels/document.xml.rels': strToU8(`<Relationships xmlns="${relationship}"><Relationship Id="rId1" Type="${office}/comments" Target="comments.xml"/><Relationship Id="rId2" Type="${office}/header" Target="header1.xml"/><Relationship Id="rId3" Type="${office}/image" Target="media/image1.png"/></Relationships>`),
    'word/comments.xml': strToU8(`<w:comments xmlns:w="${word}"><w:comment w:id="7" w:author="Human Reviewer" w:date="2026-10-06T10:00:00Z"><w:p><w:r><w:t>Keep this human comment.</w:t></w:r></w:p></w:comment></w:comments>`),
    'word/header1.xml': strToU8(`<w:hdr xmlns:w="${word}"><w:p><w:r><w:t>Synthetic contract header</w:t></w:r></w:p></w:hdr>`),
    // The opaque unit-test part keeps its original bytes; visible PNG data needs a valid IDAT checksum.
    'word/media/image1.png': Buffer.from(includeImage
      ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='
      : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6woAAAAASUVORK5CYII=', 'base64'),
  }
  return Buffer.from(zipSync(parts))
}
