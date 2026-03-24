import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router-dom'
import { WifiOff, Trash2, BookOpen, HardDrive, Clock, ChevronRight, PackageOpen } from 'lucide-react'
import {
  getAllDownloads,
  deleteOfflineChapter,
  formatBytes,
  type OfflineChapterMeta,
} from '@/utils/offlineStorage'

export default function MyDownloads() {
  const { user } = useAuth()
  const [downloads, setDownloads] = useState<OfflineChapterMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    getAllDownloads(user?.id ?? '')
      .then(data => setDownloads(data.sort((a, b) =>
        new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
      )))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this chapter from offline storage?')) return
    setDeletingId(id)
    try {
      await deleteOfflineChapter(user?.id ?? '', id)
      setDownloads(prev => prev.filter(d => d.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete all ${downloads.length} offline chapters? This cannot be undone.`)) return
    setLoading(true)
    for (const d of downloads) {
      await deleteOfflineChapter(user?.id ?? '', d.id)
    }
    setDownloads([])
    setLoading(false)
  }

  // Group by manga
  const grouped = downloads.reduce<Record<string, OfflineChapterMeta[]>>((acc, d) => {
    if (!acc[d.mangaId]) acc[d.mangaId] = []
    acc[d.mangaId].push(d)
    return acc
  }, {})

  const totalSize = downloads.reduce((s, d) => s + d.sizeBytes, 0)

  const readHref = (d: OfflineChapterMeta) =>
    d.source === 'api' ? `/read/${d.id}` : `/read/manual/${d.id}`

  if (loading) return (
    <div className="max-w-3xl mx-auto px-5 pt-28 pb-16 space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton h-20 rounded-2xl" />
      ))}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-5 pt-28 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <WifiOff size={18} className="text-violet-400" />
            <h1 className="font-display text-3xl text-white tracking-wide">Offline Library</h1>
          </div>
          <p className="font-body text-sm text-text-muted">
            Chapters saved to your device — readable without internet
          </p>
        </div>
        {downloads.length > 0 && (
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-xs text-text-muted font-body mb-1">
              <HardDrive size={11} className="text-violet-400" />
              {formatBytes(totalSize)} used
            </div>
            <button
              onClick={handleDeleteAll}
              className="text-xs text-red-400 hover:text-red-300 font-body transition-colors">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {downloads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <PackageOpen size={28} className="text-text-muted" />
          </div>
          <div>
            <p className="font-body text-text-muted mb-1">No offline chapters yet</p>
            <p className="font-body text-xs text-text-muted/60">
              Tap "Save offline" on any chapter to read it without internet
            </p>
          </div>
          <Link to="/"
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-body rounded-xl hover:bg-violet-500/30 transition-all">
            <BookOpen size={14} />
            Browse manga
          </Link>
        </div>
      )}

      {/* Grouped chapter list */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([mangaId, chapters]) => {
          const first = chapters[0]
          const groupSize = chapters.reduce((s, c) => s + c.sizeBytes, 0)

          return (
            <div key={mangaId} className="glass rounded-2xl overflow-hidden border border-white/5">
              {/* Manga header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <img
                  src={first.mangaCover}
                  alt={first.mangaTitle}
                  className="w-8 h-11 rounded-lg object-cover ring-1 ring-white/10 flex-shrink-0"
                  loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/manga/${mangaId}`}
                    className="font-body text-sm text-white hover:text-violet-300 transition-colors truncate block">
                    {first.mangaTitle}
                  </Link>
                  <p className="font-mono text-[10px] text-text-muted">
                    {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} · {formatBytes(groupSize)}
                  </p>
                </div>
                <ChevronRight size={14} className="text-text-muted flex-shrink-0" />
              </div>

              {/* Chapter rows */}
              <div className="divide-y divide-white/5">
                {chapters.map(d => (
                  <div key={d.id} className="flex items-center gap-2 px-4 py-3 group hover:bg-white/[0.03] transition-colors">
                    <Link
                      to={readHref(d)}
                      className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <WifiOff size={12} className="text-violet-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-sm text-text group-hover:text-violet-300 transition-colors truncate">
                          Ch.{d.chapterNumber}{d.chapterTitle ? ` — ${d.chapterTitle}` : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-text-muted">{d.pageCount} pages</span>
                          <span className="text-white/20">·</span>
                          <span className="font-mono text-[10px] text-text-muted">{formatBytes(d.sizeBytes)}</span>
                          <span className="text-white/20">·</span>
                          <span className="flex items-center gap-1 font-mono text-[10px] text-text-muted">
                            <Clock size={9} />
                            {new Date(d.downloadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link
                        to={readHref(d)}
                        className="p-2 text-text-muted hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Read offline">
                        <BookOpen size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(d.id)}
                        disabled={deletingId === d.id}
                        className="p-2 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                        title="Remove offline copy">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}