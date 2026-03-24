import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WifiOff, Trash2, HardDrive, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getAllDownloads,
  deleteOfflineChapter,
  formatBytes,
  type OfflineChapterMeta,
} from '@/utils/offlineStorage'

export default function Downloads() {
  const { user, loading: authLoading } = useAuth()
  const [downloads, setDownloads] = useState<OfflineChapterMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    // Wait for auth — never load with a null/guest user
    if (authLoading) return
    if (!user) { setLoading(false); setDownloads([]); return }

    setLoading(true)
    getAllDownloads(user.id)
      .then(data => setDownloads(
        data.sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime())
      ))
      .finally(() => setLoading(false))
  }, [authLoading, user])

  const remove = async (chapterId: string) => {
    if (!user) return
    setDeletingId(chapterId)
    try {
      await deleteOfflineChapter(user.id, chapterId)
      setDownloads(prev => prev.filter(d => d.chapterId !== chapterId))
    } finally {
      setDeletingId(null)
    }
  }

  const clearAll = async () => {
    if (!user) return
    if (!confirm('Clear all offline chapters? This cannot be undone.')) return
    setLoading(true)
    for (const d of downloads) {
      await deleteOfflineChapter(user.id, d.chapterId)
    }
    setDownloads([])
    setLoading(false)
  }

  const grouped = downloads.reduce<Record<string, OfflineChapterMeta[]>>((acc, d) => {
    const key = d.mangaId || 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  const totalSize = downloads.reduce((s, d) => s + d.sizeBytes, 0)

  const readHref = (d: OfflineChapterMeta) =>
    d.source === 'api' ? `/read/${d.chapterId}` : `/read/manual/${d.chapterId}`

  // Auth still loading
  if (authLoading) return (
    <div className="max-w-4xl mx-auto px-5 pt-28 pb-16 space-y-4 animate-pulse">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
    </div>
  )

  // Not logged in
  if (!user) return (
    <div className="max-w-4xl mx-auto px-5 pt-28 pb-16 text-center">
      <WifiOff size={48} className="text-text-muted mx-auto mb-4 opacity-20" />
      <p className="font-display text-2xl text-white mb-2">Sign in to use offline downloads</p>
      <p className="font-body text-sm text-text-muted mb-6">Downloads are saved per account so your library stays private.</p>
      <Link to="/login"
        className="px-6 py-3 bg-primary text-white font-body text-sm rounded-xl hover:bg-primary/90 transition-all">
        Sign In
      </Link>
    </div>
  )

  // Loading downloads
  if (loading) return (
    <div className="max-w-4xl mx-auto px-5 pt-28 pb-16 space-y-4 animate-pulse">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-5 pt-28 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <WifiOff size={18} className="text-violet-400" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-white tracking-wide">DOWNLOADS</h1>
            <p className="text-text-muted text-xs font-body">
              {downloads.length} chapter{downloads.length !== 1 ? 's' : ''} · {formatBytes(totalSize)} stored on this device
            </p>
          </div>
        </div>
        {downloads.length > 0 && (
          <button onClick={clearAll}
            className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-xl text-sm font-body text-text-muted hover:text-red-400 hover:border-red-400/30 transition-all">
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </div>

      {/* Info note */}
      <div className="glass rounded-2xl px-5 py-3.5 mb-6 border border-violet-500/20 flex items-start gap-3">
        <HardDrive size={16} className="text-violet-400 shrink-0 mt-0.5" />
        <p className="text-xs text-text-muted font-body leading-relaxed">
          Chapters are saved to <span className="text-text">your browser's local storage</span> as image data.
          Readable offline on this device — no internet needed.
        </p>
      </div>

      {/* Empty state */}
      {downloads.length === 0 ? (
        <div className="text-center py-24 glass rounded-2xl border border-white/5">
          <WifiOff size={48} className="text-text-muted mx-auto mb-4 opacity-20" />
          <p className="font-body text-text-muted mb-2">No offline chapters yet</p>
          <p className="text-sm text-text-muted/60 font-body mb-6">
            Hit the ↓ icon on any chapter to save it for offline reading
          </p>
          <Link to="/browse"
            className="px-5 py-2.5 bg-primary text-white font-body text-sm rounded-xl hover:bg-primary/90 transition-all">
            Browse Manga
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([mangaId, chapters]) => {
            const first = chapters[0]
            const groupSize = chapters.reduce((s, c) => s + c.sizeBytes, 0)
            return (
              <div key={mangaId} className="glass rounded-2xl overflow-hidden border border-white/5">

                {/* Manga header */}
                <div className="flex items-center gap-4 px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                  {first.mangaCover ? (
                    <img src={first.mangaCover} alt={first.mangaTitle}
                      className="w-10 h-14 object-cover rounded-lg flex-shrink-0 ring-1 ring-white/10"
                      loading="lazy" onError={e => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <div className="w-10 h-14 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <WifiOff size={16} className="text-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-text font-semibold line-clamp-1">{first.mangaTitle}</p>
                    <p className="text-xs text-text-muted font-body mt-0.5">
                      {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} · {formatBytes(groupSize)}
                    </p>
                  </div>
                  <Link to={`/manga/${mangaId}`}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-primary font-body transition-colors shrink-0">
                    View <ChevronRight size={12} />
                  </Link>
                </div>

                {/* Chapter rows */}
                <div className="divide-y divide-white/5">
                  {chapters.map(d => (
                    <div key={d.chapterId} className="flex items-center gap-3 px-5 py-3 group hover:bg-white/[0.02] transition-colors">
                      <Link to={readHref(d)} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <WifiOff size={11} className="text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text font-body group-hover:text-violet-400 transition-colors line-clamp-1">
                            Ch.{d.chapterNumber}
                            {d.chapterTitle && <span className="text-text-muted group-hover:text-violet-400/70"> — {d.chapterTitle}</span>}
                          </p>
                          <p className="text-xs text-text-muted font-body mt-0.5">
                            {d.pageCount} pages · {formatBytes(d.sizeBytes)} · {new Date(d.downloadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                      <button
                        onClick={() => remove(d.chapterId)}
                        disabled={deletingId === d.chapterId}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40 flex-shrink-0"
                        title="Remove offline copy">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}