import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Operation } from '../types'

export function useOperations() {
  const [operations, setOperations] = useState<Operation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('operations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setOperations((data as Operation[]) ?? [])
    setLoading(false)
  }, [])

  const save = useCallback(
    async (payload: Pick<Operation, 'title' | 'original_text' | 'tashkeel_text'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('يجب تسجيل الدخول أولاً')

      const { data, error } = await supabase
        .from('operations')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data as Operation
    },
    [],
  )

  const update = useCallback(
    async (id: string, changes: Partial<Pick<Operation, 'title' | 'tashkeel_text'>>) => {
      const { error } = await supabase.from('operations').update(changes).eq('id', id)
      if (error) throw new Error(error.message)
      setOperations((prev) => prev.map((op) => (op.id === id ? { ...op, ...changes } : op)))
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('operations').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setOperations((prev) => prev.filter((op) => op.id !== id))
  }, [])

  return { operations, loading, error, fetchAll, save, update, remove }
}
