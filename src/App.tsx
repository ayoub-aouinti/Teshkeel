import { useState } from 'react'
import EditorPanel from './components/EditorPanel'
import Header from './components/Header'
import InputPanel from './components/InputPanel'
import ProcessingView from './components/ProcessingView'
import { addTashkeel } from './services/tashkeel'
import { AppState, DocumentData } from './types'
import { getBaseName, readFile } from './utils/fileReader'

export default function App() {
  const [state, setState] = useState<AppState>('idle')
  const [doc, setDoc] = useState<DocumentData | null>(null)
  const [error, setError] = useState('')

  const process = async (text: string, fileName: string) => {
    setState('processing')
    setError('')
    try {
      const tashkeelText = await addTashkeel(text)
      setDoc({ originalText: text, tashkeelText, fileName })
      setState('editing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      setState('error')
    }
  }

  const handleTextSubmit = (text: string, fileName: string) => {
    void process(text, fileName)
  }

  const handleFileUpload = (file: File) => {
    const run = async () => {
      setState('processing')
      setError('')
      try {
        const text = await readFile(file)
        const tashkeelText = await addTashkeel(text)
        setDoc({ originalText: text, tashkeelText, fileName: getBaseName(file.name) })
        setState('editing')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ في معالجة الملف')
        setState('error')
      }
    }
    void run()
  }

  const handleReset = () => {
    setState('idle')
    setDoc(null)
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-16">
        {state === 'idle' && (
          <InputPanel onTextSubmit={handleTextSubmit} onFileUpload={handleFileUpload} />
        )}

        {state === 'processing' && <ProcessingView />}

        {state === 'editing' && doc !== null && (
          <EditorPanel
            doc={doc}
            onChange={(text) => setDoc({ ...doc, tashkeelText: text })}
            onReset={handleReset}
          />
        )}

        {state === 'error' && (
          <div className="fade-in flex flex-col items-center justify-center py-32 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="font-arabic text-xl text-red-600 mb-2">حدث خطأ</p>
            <p className="text-slate-500 text-sm font-sans mb-8 max-w-md">{error}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-gold-500 hover:bg-gold-600 text-white font-sans font-medium rounded-lg transition-colors"
            >
              حاول مرة أخرى
            </button>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-slate-400 text-xs font-sans border-t border-slate-100">
        تشكيل — أداة تشكيل النصوص العربية 
      </footer>
    </div>
  )
}
