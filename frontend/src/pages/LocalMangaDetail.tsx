import { useEffect, useState } from 'react'
import ReadingListButton from '@/components/ReadingListButton'
import RatingReviews from '@/components/RatingReviews'

import MangaComments from '@/components/MangaComments'
import RecommendedManga from '@/components/RecommendedManga'

import DownloadChapterButton from '@/components/DownloadChapterButton'
import { useParams, Link } from 'react-router-dom'
import { Heart, BookOpen, Eye, Calendar, ChevronRight, User, Trash2 } from 'lucide-react'
import axios from 'axios'
import type { LocalManga, LocalChapter } from '@/types'
import { useAuth } from '@/context/AuthContext'

const STATUS_COLORS: Record<string, string> = {
  ongoing: 'text-green-400 bg-green-400/10 border-green-400/20',
  completed: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  hiatus: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  cancelled: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export default function LocalMangaDetail() {
  const { id } = useParams<{ id: string }>()
  const [manga, setManga] = useState<LocalManga | null>(null)
  const [chapters, setChapters] = useState<LocalChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [saves, setSaves] = useState<number>(0)

  const { toggleFavorite, isFavorite, user, isAdmin } = useAuth()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      axios.get(`/api/local-manga/${id}`),

      axios.get(`/api/local-manga/${id}/chapters`),
      axios.get(`/api/favorites/saves/local_${id}`).catch(() => ({ data: { saves: 0 } })),
    ]).then(([mangaRes, chaptersRes, savesRes]) => {
      setManga(mangaRes.data)
      setChapters(chaptersRes.data)
      setSaves(savesRes.data.saves ?? 0)

    }).finally(() => setLoading(false))
  }, [id])

  const handleDeleteChapter = async (chapterId: string) => {
    if (!confirm('Delete this chapter? This cannot be undone.')) return
    setDeletingId(chapterId)
    try {
      await axios.delete(`/api/admin/chapters/${chapterId}`, { withCredentials: true })
      setChapters((prev) => prev.filter((c) => c._id !== chapterId))
    } catch {
      alert('Failed to delete chapter.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-5 pt-28 pb-16 animate-pulse">
      <div className="flex gap-8">
        <div className="skeleton w-48 rounded-2xl flex-shrink-0" style={{ aspectRatio: '2/3' }} />
        <div className="flex-1 space-y-4 pt-4">
          <div className="skeleton h-8 rounded w-3/4" />
          <div className="skeleton h-4 rounded w-1/2" />
          <div className="skeleton h-24 rounded w-full" />
        </div>
      </div>
    </div>
  )

  if (!manga) return (
    <div className="pt-28 text-center">
      <p className="text-text-muted font-body">Manga not found.</p>
      <Link to="/catalog" className="mt-4 inline-block text-primary hover:underline text-sm">← Back to Catalog</Link>
    </div>
  )

  const fav = isFavorite(`local_${manga._id}`)

  return (
    <div className="max-w-5xl mx-auto px-5 pt-28 pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-muted font-body mb-6">
        <Link to="/catalog" className="hover:text-text transition-colors">Catalog</Link>
        <ChevronRight size={12} />
        <span className="text-text truncate">{manga.title}</span>
      </div>

      {/* Hero */}
      <div className="relative mb-10">
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
          <img
            src={manga.coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover opacity-10 blur-2xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
        </div>
        <div className="flex flex-col md:flex-row gap-8 p-6">
          {/* Cover */}
          <div className="flex-shrink-0">
            <img src={manga.coverUrl} alt={manga.title}
              className="w-44 md:w-56 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] mx-auto md:mx-0"
              style={{ aspectRatio: '2/3', objectFit: 'cover' }} />
          </div>
          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full font-body border border-amber-500/20">
                Site Exclusive
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-body border capitalize ${STATUS_COLORS[manga.status]}`}>
                {manga.status}
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl text-white mb-1 leading-tight">{manga.title}</h1>
            {manga.altTitle && <p className="text-text-muted text-sm font-body mb-3">{manga.altTitle}</p>}

            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-text-muted font-body">
              {manga.author && <span className="flex items-center gap-1.5"><User size={13} />{manga.author}</span>}
              {manga.year && <span className="flex items-center gap-1.5"><Calendar size={13} />{manga.year}</span>}
              <span className="flex items-center gap-1.5"><Eye size={13} />{manga.views.toLocaleString()} views</span>

              <span className="flex items-center gap-1.5"><Heart size={13} className="text-primary" />{saves.toLocaleString()} saves</span>

              <span className="flex items-center gap-1.5"><BookOpen size={13} />{chapters.length} chapters</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {manga.genres.map(g => (
                <span key={g} className="text-xs px-3 py-1 glass rounded-full text-text-muted font-body border border-white/10">{g}</span>
              ))}
            </div>

            <p className="text-text-muted text-sm font-body leading-relaxed mb-6 max-w-xl line-clamp-4">{manga.description}</p>

            <div className="flex gap-3">
              {chapters.length > 0 && (
                <Link to={`/read/local/${chapters[0]._id}`}
                  className="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-body font-medium text-sm rounded-xl transition-all hover:shadow-[0_0_24px_rgba(232,57,77,0.5)]">
                  Read First Chapter →
                </Link>
              )}
              {user && (
                <>
                  <button

                    onClick={async () => {
                      const wasFav = fav
                      await toggleFavorite(`local_${manga._id}`)
                      setSaves(s => wasFav ? Math.max(0, s - 1) : s + 1)
                    }}

                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-body border transition-all ${
                      fav
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'glass border-white/10 text-text-muted hover:border-primary/30'
                    }`}
                  >
                    <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
                    {fav ? 'Saved' : 'Save'}
                  </button>

                  <ReadingListButton mangaId={`local_${manga._id}`} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div>
        <h2 className="font-display text-2xl text-white tracking-wide mb-4">CHAPTERS</h2>
        {chapters.length === 0 ? (
          <div className="text-center py-16 glass rounded-2xl">
            <BookOpen size={40} className="text-text-muted mx-auto mb-3 opacity-30" />
            <p className="font-body text-text-muted">No chapters available yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...chapters].reverse().map((ch, i) => (
              <div key={ch._id} className="flex items-center gap-2 group/row">
                <Link to={`/read/local/${ch._id}`}
                  className="flex-1 flex items-center justify-between glass rounded-xl px-5 py-3.5 hover:border-primary/30 border border-transparent transition-all group">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-text-muted w-6">{chapters.length - i}</span>
                    <div>
                      <span className="font-body text-sm text-text group-hover:text-primary transition-colors">
                        {ch.volume && `Vol.${ch.volume} `}Chapter {ch.chapterNumber}
                        {ch.title && <span className="text-text-muted"> — {ch.title}</span>}
                      </span>
                      <p className="text-xs text-text-muted font-body mt-0.5">{ch.pages.length} pages</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted font-body">
                      {new Date(ch.createdAt).toLocaleDateString()}
                    </span>
                    <ChevronRight size={14} className="text-text-muted group-hover:text-primary transition-colors" />
                  </div>
                </Link>

                <DownloadChapterButton
                  chapterId={ch._id}
                  chapterNumber={ch.chapterNumber}
                  chapterTitle={ch.title}
                  source="manual"
                  mangaId={manga._id}
                  mangaTitle={manga.title}
                  mangaCover={manga.coverUrl}
                  resolvePages={async () => ch.pages}
                  compact
                />

                {/* Admin: delete button */}
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteChapter(ch._id)}
                    disabled={deletingId === ch._id}
                    className="p-2 text-text-muted hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0"
                    title="Delete chapter"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        <RecommendedManga localGenres={manga.genres} excludeId={manga._id} />

        {/* Ratings & Reviews */}
        <RatingReviews mangaId={`local_${manga._id}`} />

        <MangaComments mangaId={`local_${manga._id}`} />

      </div>
    </div>
  )
}