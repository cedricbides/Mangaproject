import { useCallback, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

interface ProgressEntry {
  mangaId: string
  chapterId: string
  page: number
  isLocal?: boolean
  updatedAt?: string
}

const SYNC_DELAY_MS = 2000

// Key is per-user so different logged-in users on the same browser don't share history
function progressKey(userId?: string) {
  return userId ? `mv_reader_progress_${userId}` : 'mv_reader_progress_guest'
}

function saveProgressLocal(chapterId: string, page: number, userId?: string) {
  try {
    const key = progressKey(userId)
    const all = JSON.parse(localStorage.getItem(key) || '{}')
    all[chapterId] = page
    localStorage.setItem(key, JSON.stringify(all))
  } catch {}
}

function loadProgressLocal(chapterId: string, userId?: string): number {
  try {
    const key = progressKey(userId)
    const all = JSON.parse(localStorage.getItem(key) || '{}')
    return all[chapterId] ?? 0
  } catch {
    return 0
  }
}

export function useReadingProgress() {
  const { user } = useAuth()
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trackProgress = useCallback(
    (mangaId: string, chapterId: string, page: number, isLocal = false) => {
      saveProgressLocal(chapterId, page, user?.id)
      if (!user) return
      if (syncTimer.current) clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(async () => {
        try {
          await axios.patch('/api/progress', { mangaId, chapterId, page, isLocal }, { withCredentials: true })
        } catch (err) {
          console.warn('[progress] sync failed', err)
        }
      }, SYNC_DELAY_MS)
    },
    [user]
  )

  const loadSyncedProgress = useCallback(
    async (chapterId: string): Promise<number> => {
      if (!user) return loadProgressLocal(chapterId)
      try {
        const res = await axios.get('/api/progress', { withCredentials: true })
        const history: ProgressEntry[] = res.data.readingHistory || []
        const entry = history.find((h) => h.chapterId === chapterId)
        if (entry && entry.page > 0) {
          saveProgressLocal(chapterId, entry.page, user.id)
          return entry.page
        }
      } catch (err) {
        console.warn('[progress] failed to load from backend', err)
      }
      return loadProgressLocal(chapterId, user?.id)
    },
    [user]
  )

  const getAllProgress = useCallback(async (): Promise<ProgressEntry[]> => {
    if (!user) return []
    try {
      const res = await axios.get('/api/progress', { withCredentials: true })
      return res.data.readingHistory || []
    } catch { return [] }
  }, [user])

  const getMangaProgress = useCallback(
    async (mangaId: string): Promise<ProgressEntry[]> => {
      if (!user) return []
      try {
        const res = await axios.get(`/api/progress/${mangaId}`, { withCredentials: true })
        return res.data.history || []
      } catch { return [] }
    },
    [user]
  )

  return { trackProgress, loadSyncedProgress, getAllProgress, getMangaProgress }
}