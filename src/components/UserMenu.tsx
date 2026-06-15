import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  onDashboard: () => void
  onLogin: () => void
}

export default function UserMenu({ onDashboard, onLogin }: Props) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) {
    return (
      <button onClick={onLogin}
        className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-white text-sm font-sans font-medium rounded-lg transition-colors">
        تسجيل الدخول
      </button>
    )
  }

  const initials = (user.user_metadata?.full_name as string | undefined)
    ?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    ?? user.email?.slice(0, 2).toUpperCase()
    ?? '؟'

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full bg-gold-500 flex items-center justify-center text-white text-sm font-sans font-bold hover:bg-gold-600 transition-colors">
        {initials}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 fade-in" dir="rtl">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-xs text-slate-400 font-sans truncate">{user.email}</p>
          </div>
          <button onClick={() => { onDashboard(); setOpen(false) }}
            className="w-full text-right px-4 py-2.5 text-sm font-arabic text-slate-700 hover:bg-slate-50 transition-colors">
            عملياتي
          </button>
          <button onClick={() => { void signOut(); setOpen(false) }}
            className="w-full text-right px-4 py-2.5 text-sm font-arabic text-red-500 hover:bg-red-50 transition-colors">
            تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  )
}
