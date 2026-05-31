export default function ProcessingView() {
  return (
    <div className="flex flex-col items-center justify-center py-36 fade-in">
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full border-4 border-amber-100" />
        <div className="absolute inset-0 rounded-full border-4 border-t-gold-500 border-r-transparent border-b-transparent border-l-transparent spinner" />
        <div className="absolute inset-3 flex items-center justify-center">
          <span className="font-arabic text-gold-500 text-2xl font-bold">ت</span>
        </div>
      </div>
      <p className="font-arabic text-2xl text-navy-800 mb-2">جارٍ إضافة التشكيل…</p>
      <p className="text-slate-400 text-sm font-sans">يُرجى الانتظار</p>
    </div>
  )
}
