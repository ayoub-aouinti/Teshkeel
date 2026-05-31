import { useCallback, useEffect, useRef, useState } from 'react'
import { DocumentData } from '../types'
import { downloadDocx, downloadTxt } from '../utils/fileWriter'

interface Props {
  doc: DocumentData
  onChange: (text: string) => void
  onReset: () => void
}

export default function EditorPanel({ doc, onChange, onReset }: Props) {
  const [downloading, setDownloading] = useState<'txt' | 'docx' | null>(null)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [doc.tashkeelText])

  const wordCount = doc.tashkeelText.trim().split(/\s+/).filter(Boolean).length
  const charCount = doc.tashkeelText.length

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(doc.tashkeelText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [doc.tashkeelText])

  const handleDownloadTxt = () => {
    downloadTxt(doc.tashkeelText, doc.fileName)
  }

  const handleDownloadDocx = async () => {
    setDownloading('docx')
    try {
      await downloadDocx(doc.tashkeelText, doc.fileName)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="fade-in mt-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-sans text-slate-600 hover:text-navy-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            ← وثيقة جديدة
          </button>
          <span className="text-slate-300">|</span>
          <span className="font-arabic text-navy-800 text-sm">{doc.fileName}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-2 text-sm font-sans text-slate-600 hover:text-navy-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {copied ? '✓ تم النسخ' : 'نسخ النص'}
          </button>
          <button
            onClick={handleDownloadTxt}
            className="px-4 py-2 text-sm font-sans font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            ↓ TXT
          </button>
          <button
            onClick={() => void handleDownloadDocx()}
            disabled={downloading === 'docx'}
            className="px-4 py-2 text-sm font-sans font-medium bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {downloading === 'docx' ? '…' : '↓ Word'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-3 px-1">
        <span className="text-xs font-sans text-slate-400">{wordCount} كلمة</span>
        <span className="text-xs font-sans text-slate-400">{charCount} حرف</span>
      </div>

      {/* Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-sans text-slate-400 uppercase tracking-wide">النص المُشكَّل</span>
          <div className="w-2 h-2 rounded-full bg-gold-400" />
        </div>
        <textarea
          ref={textareaRef}
          value={doc.tashkeelText}
          onChange={(e) => onChange(e.target.value)}
          className="tashkeel-area p-6 scrollbar-thin"
          spellCheck={false}
          dir="rtl"
        />
      </div>

      {/* Original text toggle */}
      <details className="mt-4 group">
        <summary className="cursor-pointer text-sm font-sans text-slate-400 hover:text-slate-600 transition-colors list-none flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          عرض النص الأصلي
        </summary>
        <div className="mt-3 bg-white rounded-xl border border-slate-200 p-5 overflow-auto max-h-48 scrollbar-thin">
          <p className="text-arabic text-slate-500 whitespace-pre-wrap text-sm" style={{ lineHeight: '2.5', fontSize: '1.1rem' }}>
            {doc.originalText}
          </p>
        </div>
      </details>
    </div>
  )
}
