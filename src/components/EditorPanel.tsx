import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOperations } from '../hooks/useOperations'
import type { DocumentData } from '../types'
import { downloadDocx, downloadTxt } from '../utils/fileWriter'

interface Props {
  doc: DocumentData
  onChange: (text: string) => void
  onReset: () => void
  onLoginRequired: () => void
  onDocSaved: (id: string) => void
}

export default function EditorPanel({ doc, onChange, onReset, onLoginRequired, onDocSaved }: Props) {
  const { user } = useAuth()
  const { save, update } = useOperations()
  const [downloading, setDownloading] = useState<'docx' | null>(null)
  const [copied, setCopied]           = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(!!doc.id)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [doc.tashkeelText])

  const wordCount = doc.tashkeelText.trim().split(/\s+/).filter(Boolean).length

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(doc.tashkeelText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [doc.tashkeelText])

  const handleSave = async () => {
    if (!user) { onLoginRequired(); return }
    setSaving(true)
    try {
      if (doc.id) {
        await update(doc.id, { tashkeel_text: doc.tashkeelText })
      } else {
        const op = await save({
          title: doc.fileName,
          original_text: doc.originalText,
          tashkeel_text: doc.tashkeelText,
        })
        onDocSaved(op.id)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fade-in mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-sans text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            ← وثيقة جديدة
          </button>
          <span className="text-slate-300">|</span>
          <span className="font-arabic text-navy-800 text-sm">{doc.fileName}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleCopy}
            className="px-3 py-2 text-sm font-sans text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            {copied ? '✓ تم النسخ' : 'نسخ'}
          </button>
          <button onClick={() => downloadTxt(doc.tashkeelText, doc.fileName)}
            className="px-4 py-2 text-sm font-sans font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
            ↓ TXT
          </button>
          <button onClick={() => { setDownloading('docx'); void downloadDocx(doc.tashkeelText, doc.fileName).finally(() => setDownloading(null)) }}
            disabled={downloading === 'docx'}
            className="px-4 py-2 text-sm font-sans font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 rounded-lg transition-colors">
            {downloading ? '…' : '↓ Word'}
          </button>
          <button onClick={() => void handleSave()} disabled={saving}
            className="px-4 py-2 text-sm font-sans font-medium bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white rounded-lg transition-colors">
            {saving ? '…' : saved ? '✓ محفوظ' : '💾 حفظ'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-3 px-1">
        <span className="text-xs font-sans text-slate-400">{wordCount} كلمة</span>
        <span className="text-xs font-sans text-slate-400">{doc.tashkeelText.length} حرف</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-sans text-slate-400 uppercase tracking-wide">النص المُشكَّل</span>
          <div className="w-2 h-2 rounded-full bg-gold-400" />
        </div>
        <textarea ref={textareaRef} value={doc.tashkeelText} onChange={(e) => onChange(e.target.value)}
          className="tashkeel-area p-6 scrollbar-thin" spellCheck={false} dir="rtl" />
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-sm font-sans text-slate-400 hover:text-slate-600 list-none flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          عرض النص الأصلي
        </summary>
        <div className="mt-3 bg-white rounded-xl border border-slate-200 p-5 overflow-auto max-h-48 scrollbar-thin">
          <p className="text-arabic text-slate-500 whitespace-pre-wrap" style={{ lineHeight: '2.5', fontSize: '1.1rem' }}>
            {doc.originalText}
          </p>
        </div>
      </details>
    </div>
  )
}
