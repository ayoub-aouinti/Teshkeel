export default function Header() {
  return (
    <header className="bg-navy-800 text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-500 flex items-center justify-center">
            <span className="font-arabic text-navy-900 font-bold text-xl leading-none">ت</span>
          </div>
          <div>
            <h1 className="font-arabic text-2xl font-bold text-gold-400 leading-none">التشكيل</h1>
            <p className="text-slate-400 text-xs mt-0.5 font-sans tracking-wide">Al-Techkeel · Arabic Diacritization</p>
          </div>
        </div>
        <div className="text-slate-500 text-sm font-sans hidden sm:block">
          أداة إضافة التشكيل للنصوص العربية
        </div>
      </div>
    </header>
  )
}
