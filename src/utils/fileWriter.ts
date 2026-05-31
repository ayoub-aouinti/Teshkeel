import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx'

// XML 1.0 forbids control chars except \t \n \r — strip them to avoid Word corruption
function sanitizeXml(str: string): string {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F￾￿]/g, '')
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadTxt(text: string, baseName: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  triggerDownload(blob, `${baseName}_تشكيل.txt`)
}

export async function downloadDocx(text: string, baseName: string) {
  const lines = sanitizeXml(text).split('\n')

  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            rightToLeft: true,
            font: 'Amiri',
            size: 28,
          }),
        ],
        rightToLeft: true,
        alignment: AlignmentType.RIGHT,
        spacing: { line: 480 },
      }),
  )

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  triggerDownload(blob, `${baseName}_تشكيل.docx`)
}
