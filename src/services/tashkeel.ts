/**
 * Sends text to the local Express server (/api/tashkeel).
 * The server calls the Python mishkal library (pip install mishkal),
 * with a fallback to the Mishkal web service.
 * Start the API with: node server.cjs  (or npm run dev for both together)
 */
export async function addTashkeel(text: string): Promise<string> {
  const body = new URLSearchParams({ text })

  let response: Response
  try {
    response = await fetch('/api/tashkeel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch {
    throw new Error(
      'تعذّر الاتصال بخادم التشكيل.\n' +
      'تأكد من تشغيل الخادم: node server.cjs\n' +
      'أو شغّل الكل مرة واحدة: npm run dev',
    )
  }

  if (!response.ok) {
    let msg = `خطأ ${response.status}`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) msg = data.error
    } catch { /* empty */ }
    throw new Error(msg)
  }

  const data = (await response.json()) as Record<string, unknown>
  const result = data['result'] ?? data['vocalized'] ?? data['text']
  if (typeof result === 'string') return result

  throw new Error('استجابة غير متوقعة من خادم التشكيل')
}
