import { useEffect, useState } from 'react'
import { useOperations } from '../hooks/useOperations'
import type { Operation } from '../types'
import { downloadDocx, downloadTxt } from '../utils/fileWriter'

interface Props {
  onOpen: (op: Operation) => void
  onBack: () => void
}

export default function Dashboard({ onOpen, onBack }: Props) {
  const { operations, loading, error, fetchAll, update, remove } = useOperations()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { void fetchAll() }, [fetchAll])

  const filtered = operations.filter(
    (op) => op.title.includes(search) || op.tashkeel_text.includes(search),
  )

  const startRename = (op: Operation) => { setEditingId(op.id); setEditTitle(op.title) }
  const commitRename = async (id: string) => {
    await update(id, { title: editTitle.trim() || 'بدون عنوان' })
    setEditingId(null)
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('ar-MA', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="fade-in mt-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-arabic text-2xl font-bold text-navy-800">عملياتي</h2>
        <button onClick={onBack}
          className="px-4 py-2 text-sm font-sans text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          ← وثيقة جديدة
        </button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث…"
        className="w-full mb-4 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-arabic focus:outline-none focus:border-gold-500" />

      {loading && <p className="text-center text-slate-400 py-12 font-arabic">جارٍ التحميل…</p>}
      {error   && <p className="text-center text-red-500 py-8 text-sm font-sans">{error}</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-center text-slate-400 py-16 font-arabic text-lg">لا توجد عمليات محفوظة</p>
      )}

      <div className="space-y-3">
        {filtered.map((op) => (
          <div key={op.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-gold-400 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editingId === op.id
                  ? <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => void commitRename(op.id)}
                      onKeyDown={(e) => e.key === 'Enter' && void commitRename(op.id)}
                      className="font-arabic text-navy-800 font-semibold text-base w-full border-b border-gold-400 focus:outline-none bg-transparent" />
                  : <button onClick={() => startRename(op)}
                      className="font-arabic text-navy-800 font-semibold text-base text-right w-full hover:text-gold-600 transition-colors truncate block">
                      {op.title || 'بدون عنوان'}
                    </button>
                }
                <p className="text-xs text-slate-400 font-sans mt-1">
                  {fmt(op.created_at)} · {op.tashkeel_text.trim().split(/\s+/).length} كلمة
                </p>
                <p className="text-sm text-slate-500 font-arabic mt-2 line-clamp-2" style={{ lineHeight: '2' }}>
                  {op.tashkeel_text.slice(0, 120)}…
                </p>
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => onOpen(op)}
                  className="px-3 py-1.5 text-xs font-sans bg-gold-500 hover:bg-gold-600 text-white rounded-lg transition-colors">
                  فتح
                </button>
                <button onClick={() => downloadTxt(op.tashkeel_text, op.title || 'تشكيل')}
                  className="px-3 py-1.5 text-xs font-sans bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                  TXT
                </button>
                <button onClick={() => void downloadDocx(op.tashkeel_text, op.title || 'تشكيل')}
                  className="px-3 py-1.5 text-xs font-sans bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                  Word
                </button>
                {confirmDelete === op.id
                  ? <div className="flex gap-1">
                      <button onClick={() => void remove(op.id).then(() => setConfirmDelete(null))}
                        className="px-2 py-1 text-xs font-sans bg-red-500 text-white rounded-lg">حذف</button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 text-xs font-sans bg-slate-200 rounded-lg">إلغاء</button>
                    </div>
                  : <button onClick={() => setConfirmDelete(op.id)}
                      className="px-3 py-1.5 text-xs font-sans text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      حذف
                    </button>
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
