import mammoth from 'mammoth'

export async function readTxtFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(new Error('فشل في قراءة الملف النصي'))
    reader.readAsText(file, 'UTF-8')
  })
}

export async function readDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

export async function readFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'txt') return readTxtFile(file)
  if (ext === 'docx') return readDocxFile(file)
  throw new Error(`نوع الملف غير مدعوم: .${ext}`)
}

export function getBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}
