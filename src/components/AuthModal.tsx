import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props { onClose: () => void }
type Tab = 'login' | 'register'

const ERROR_MAP: Record<string, string> = {
  'Email not confirmed':       'لم يتم تأكيد البريد الإلكتروني. تحقق من صندوق الوارد.',
  'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'User already registered':   'هذا البريد الإلكتروني مسجّل مسبقاً.',
  'Password should be at least 6 characters': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
}

function friendlyError(msg: string) {
  return ERROR_MAP[msg] ?? msg
}

export default function AuthModal({ onClose }: Props) {
  const [tab, setTab]                     = useState<Tab>('login')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [confirm, setConfirm]             = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')
  const [needsConfirm, setNeedsConfirm]   = useState(false)
  const [resending, setResending]         = useState(false)

  const switchTab = (t: Tab) => { setTab(t); setError(''); setSuccess(''); setNeedsConfirm(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNeedsConfirm(false)
    if (tab === 'register' && password !== confirm) { setError('كلمات المرور غير متطابقة'); return }
    setLoading(true)
    const { error } = tab === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    setLoading(false)
    if (error) {
      if (error.message === 'Email not confirmed') setNeedsConfirm(true)
      setError(friendlyError(error.message))
      return
    }
    if (tab === 'register') setSuccess('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيد حسابك ثم سجّل الدخول.')
    else onClose()
  }

  const handleResend = async () => {
    setResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (error) setError(friendlyError(error.message))
    else { setError(''); setSuccess('تم إعادة إرسال رابط التأكيد. تحقق من بريدك الإلكتروني.') }
  }

  const handleOAuth = (provider: 'google' | 'facebook') =>
    supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 fade-in" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-arabic text-2xl font-bold text-navy-800">
            {tab === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-3xl leading-none">×</button>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
          {(['login', 'register'] as Tab[]).map((t) => (
            <button key={t} onClick={() => switchTab(t)}
              className={`flex-1 py-2 text-sm font-sans font-medium rounded-lg transition-all ${
                tab === t ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'login' ? 'دخول' : 'حساب جديد'}
            </button>
          ))}
        </div>

        <div className="space-y-2 mb-5">
          {(['google', 'facebook'] as const).map((p) => (
            <button key={p} onClick={() => void handleOAuth(p)}
              className="w-full flex items-center justify-center gap-3 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-sans font-medium">
              {p === 'google'
                ? <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              }
              المتابعة مع {p === 'google' ? 'Google' : 'Facebook'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-slate-400 text-xs font-sans">أو</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {success
          ? <p className="text-center text-green-600 font-arabic py-2">{success}</p>
          : <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
              <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-sans focus:outline-none focus:border-gold-500" />
              <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-sans focus:outline-none focus:border-gold-500" />
              {tab === 'register' && (
                <input type="password" placeholder="تأكيد كلمة المرور" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-sans focus:outline-none focus:border-gold-500" />
              )}
              {error && (
                <div>
                  <p className="text-red-500 text-xs font-sans">{error}</p>
                  {needsConfirm && (
                    <button type="button" onClick={() => void handleResend()} disabled={resending}
                      className="mt-1 text-xs text-gold-600 hover:underline font-sans">
                      {resending ? '…' : 'إعادة إرسال رابط التأكيد'}
                    </button>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gold-500 hover:bg-gold-600 disabled:opacity-60 text-white font-sans font-medium rounded-xl transition-colors">
                {loading ? '…' : tab === 'login' ? 'دخول' : 'إنشاء الحساب'}
              </button>
            </form>
        }
      </div>
    </div>
  )
}
