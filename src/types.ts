export type AppState = 'idle' | 'processing' | 'editing' | 'dashboard' | 'error'

export interface DocumentData {
  id?: string
  originalText: string
  tashkeelText: string
  fileName: string
}

export interface Operation {
  id: string
  user_id: string
  title: string
  original_text: string
  tashkeel_text: string
  created_at: string
  updated_at: string
}
