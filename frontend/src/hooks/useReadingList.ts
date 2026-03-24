import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

export type ReadingStatus = 'reading' | 'completed' | 'plan_to_read' | 'on_hold' | 'dropped'

export interface ReadingEntry {
  mangaId: string
  status: ReadingStatus
  updatedAt: string
}

export function useReadingList() {
  const { user } = useAuth()
  const [list, setList] = useState<ReadingEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    setInitialized(false)
    if (user) {
      setLoading(true)
      axios.get('/api/social/reading-list', { withCredentials: true })
        .then(res => setList(res.data.readingList || []))
        .catch(() => setList([]))
        .finally(() => {
          setLoading(false)
          setInitialized(true)
        })
    } else {
      setList([])
      setInitialized(true)
    }
  }, [user])

  const setStatus = useCallback(async (mangaId: string, status: ReadingStatus | null) => {
    if (!user) {
      window.location.href = '/login'
      return
    }
    try {
      const res = await axios.post('/api/social/reading-list', { mangaId, status }, { withCredentials: true })
      setList(res.data.readingList || [])
    } catch {}
  }, [user])

  const getStatus = useCallback((mangaId: string): ReadingStatus | null => {
    return list.find(e => e.mangaId === mangaId)?.status ?? null
  }, [list])

  return { list, loading, initialized, setStatus, getStatus }
}