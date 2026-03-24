import { useEffect, useState, useCallback } from 'react'
import { Download, Trash2, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  downloadChapterOffline,
  isChapterDownloaded,
  deleteOfflineChapter,
} from '@/utils/offlineStorage'

interface Props {
  chapterId: string
  chapterNumber: string
  chapterTitle?: string
  source: 'api' | 'manual'
  mangaId: string
  mangaTitle: string
  mangaCover: string
  resolvePages: () => Promise<string[]>
  compact?: boolean
  onStatusChange?: (downloaded: boolean) => void
}

type Status = 'idle' | 'checking' | 'downloading' | 'done' | 'error' | 'deleting'

export default function DownloadChapterButton({
  chapterId,
  chapterNumber,
  chapterTitle,
  source,
  mangaId,
  mangaTitle,
  mangaCover,
  resolvePages,
  compact = false,
  onStatusChange,
}: Props) {
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<Status>('checking')
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    // Wait for auth to finish loading before checking storage
    if (authLoading) return
    // Guest users can't use offline downloads
    if (!user) { setStatus('idle'); return }

    isChapterDownloaded(user.id, chapterId)
      .then(yes => setStatus(yes ? 'done' : 'idle'))
      .catch(() => setStatus('idle'))
  }, [authLoading, user, chapterId])

  const handleDownload = useCallback(async () => {
    if (!user) return
    if (status === 'downloading' || status === 'deleting') return
    setStatus('downloading')
    setProgress(0)
    setError('')

    try {
      const pages = await resolvePages()
      setTotal(pages.length)

      await downloadChapterOffline(
        user.id,
        { chapterId, mangaId, mangaTitle, mangaCover, chapterNumber, chapterTitle, pageCount: pages.length, source },
        pages,
        (l, t) => {
          setLoaded(l)
          setTotal(t)
          setProgress(Math.round((l / t) * 100))
        }
      )

      setStatus('done')
      onStatusChange?.(true)
    } catch (e: any) {
      setError(e.message || 'Download failed')
      setStatus('error')
    }
  }, [user, chapterId, resolvePages, status])

  const handleDelete = useCallback(async () => {
    if (!user) return
    if (!confirm('Remove this chapter from offline storage?')) return
    setStatus('deleting')
    try {
      await deleteOfflineChapter(user.id, chapterId)
      setStatus('idle')
      onStatusChange?.(false)
    } catch {
      setStatus('done')
    }
  }, [user, chapterId])

  // Guest or auth still loading — hide button entirely
  if (authLoading || !user) return null

  // ── Compact variant ───────────────────────────────────────────────────────
  if (compact) {
    if (status === 'checking') return null

    if (status === 'downloading') {
      return (
        <div className="relative w-7 h-7 flex items-center justify-center" title={`Downloading… ${progress}%`}>
          <svg className="absolute inset-0 w-7 h-7 -rotate-90" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
            <circle cx="14" cy="14" r="11" fill="none" stroke="#7c6af7" strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 11}`}
              strokeDashoffset={`${2 * Math.PI * 11 * (1 - progress / 100)}`}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s' }} />
          </svg>
          <Loader size={11} className="text-violet-400 animate-spin" />
        </div>
      )
    }

    if (status === 'done') {
      return (
        <button onClick={handleDelete}
          className="p-1.5 text-violet-400 hover:text-red-400 transition-colors"
          title="Downloaded — click to remove">
          <WifiOff size={14} />
        </button>
      )
    }

    if (status === 'deleting') {
      return <Loader size={14} className="text-text-muted animate-spin mx-1.5" />
    }

    return (
      <button onClick={handleDownload}
        className="p-1.5 text-text-muted hover:text-violet-400 transition-colors"
        title="Save for offline reading">
        <Download size={14} />
      </button>
    )
  }

  // ── Full variant ──────────────────────────────────────────────────────────
  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl opacity-50">
        <Loader size={13} className="animate-spin text-text-muted" />
        <span className="text-xs font-body text-text-muted">Checking…</span>
      </div>
    )
  }

  if (status === 'downloading') {
    return (
      <div className="flex flex-col gap-1.5 px-4 py-2 bg-violet-500/10 border border-violet-500/30 rounded-xl min-w-[140px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader size={12} className="animate-spin text-violet-400" />
            <span className="text-xs font-body text-violet-300">Saving offline…</span>
          </div>
          <span className="text-[10px] font-mono text-violet-400">{loaded}/{total}</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }} />
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/10 border border-violet-500/30 rounded-xl">
          <WifiOff size={12} className="text-violet-400" />
          <span className="text-xs font-body text-violet-300">Offline ready</span>
        </div>
        <button onClick={handleDelete}
          className="p-2 text-text-muted hover:text-red-400 transition-colors"
          title="Remove offline copy">
          <Trash2 size={13} />
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <button onClick={handleDownload}
        className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-body rounded-xl hover:bg-red-500/20 transition-all"
        title={error}>
        <Download size={12} />
        Retry
      </button>
    )
  }

  return (
    <button onClick={handleDownload}
      className="flex items-center gap-1.5 px-3 py-2 glass border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-violet-400 hover:border-violet-400/30 transition-all">
      <Download size={12} />
      Save offline
    </button>
  )
}