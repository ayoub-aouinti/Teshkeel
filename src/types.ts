export type AppState = 'idle' | 'processing' | 'editing' | 'error'

export interface DocumentData {
  originalText: string
  tashkeelText: string
  fileName: string
}
