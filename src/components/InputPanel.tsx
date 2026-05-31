import { useCallback, useRef, useState } from 'react'

interface Props {
  onTextSubmit: (text: string, fileName: string) => void
  onFileUpload: (file: File) => void
}

type Tab = 'file' | 'text'

export default function InputPanel({ onTextSubmit, onFileUpload }: Props) {
  const [tab, setTab] = useState<Tab>('file')
  const [isDragging, setIsDragging] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFileUpload(file)
    },
    [onFileUpload],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileUpload(file)
  }

  const handleSubmitText = () => {
    const trimmed = pastedText.trim()
    if (!trimmed) return
    onTextSubmit(trimmed, 'نص')
  }

  return (
    <div className="fade-in max-w-2xl mx-auto mt-12">
      <div className="text-center mb-8">
        <h2 className="font-arabic text-3xl font-bold text-navy-800 mb-2">أضف التشكيل لنصك العربي</h2>
        <p className="text-slate-500 font-sans text-sm">ارفع ملفاً أو الصق النص مباشرة</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
        <button
          onClick={() => setTab('file')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-sans font-medium transition-all ${
            tab === 'file'
              ? 'bg-white text-navy-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          📄 رفع ملف
        </button>
        <button
          onClick={() => setTab('text')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-sans font-medium transition-all ${
            tab === 'text'
              ? 'bg-white text-navy-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          ✏️ لصق نص
        </button>
      </div>

      {tab === 'file' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-gold-500 bg-amber-50'
              : 'border-slate-300 bg-white hover:border-gold-400 hover:bg-amber-50/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="text-5xl mb-4">{isDragging ? '📂' : '📁'}</div>
          <p className="font-arabic text-xl text-navy-800 mb-1">
            {isDragging ? 'أفلت الملف هنا' : 'اسحب الملف وأفلته هنا'}
          </p>
          <p className="text-slate-400 text-sm font-sans mt-2">أو انقر للاختيار</p>
          <div className="mt-6 flex justify-center gap-3">
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-sans">.TXT</span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-sans">.DOCX</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="الصق أو اكتب النص العربي هنا..."
            className="tashkeel-area p-6 min-h-56 scrollbar-thin placeholder:text-slate-300"
            style={{ lineHeight: '2.8' }}
          />
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-slate-400 text-xs font-sans">
              {pastedText.trim().split(/\s+/).filter(Boolean).length} كلمة
            </span>
            <button
              onClick={handleSubmitText}
              disabled={!pastedText.trim()}
              className="px-5 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-medium text-sm rounded-lg transition-colors"
            >
              أضف التشكيل
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
