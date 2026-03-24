import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, RefreshCw, Settings } from 'lucide-react'
import axios from 'axios'
import { useReaderSettings, BG_CLASSES } from '../hooks/useReaderSettings'
import { useReadingProgress } from '../hooks/useReadingProgress'
import ChapterComments from '../components/ChapterComments'
import ReaderSettingsPanel from '../components/ReaderSettingsPanel'

interface ManualChapter {
  _id: string
  mangaDexId: string
  mdxChapterId?: string
  chapterNumber: string
  title?: string
  volume?: string
  pages: string[]
  language: string
  createdAt: string
}

function proxyUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('/') || url.startsWith(window.location.origin)) return url
  return `/api/proxy/image?url=${encodeURIComponent(url)}`
}

export default function ManualReader() {
  const { chapterId } = useParams<{ chapterId: string }>()
  const navigate = useNavigate()
  const { settings, update } = useReaderSettings()
  const { trackProgress, loadSyncedProgress } = useReadingProgress()
  const [showSettings, setShowSettings] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [chapter, setChapter] = useState<ManualChapter | null>(null)
  const [allChapters, setAllChapters] = useState<ManualChapter[]>([])
  const [pages, setPages] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pagesLoading, setPagesLoading] = useState(false)
  const chapterRef = useRef<ManualChapter | null>(null)
  const preloadedRef = useRef<Set<number>>(new Set())
  chapterRef.current = chapter

  const fetchPages = useCallback(async (ch: ManualChapter) => {
    if (ch.mdxChapterId) {
      setPagesLoading(true)
      try {
        const res = await axios.get(`/api/mangadex/chapter-pages/${ch.mdxChapterId}`)
        setPages(res.data.pages || [])
      } catch {
        setPages([])
      } finally {
        setPagesLoading(false)
      }
    } else {
      setPages(ch.pages || [])
    }
  }, [])

  useEffect(() => {
    if (!chapterId) return
    setLoading(true)
    axios.get(`/api/local-manga/manual-chapter/${chapterId}`)
      .then(async res => {
        const ch: ManualChapter = res.data
        setChapter(ch)
        const savedPage = await loadSyncedProgress(chapterId)
        await fetchPages(ch)
        setPage(savedPage)
        return axios.get(`/api/admin/mangadex/${ch.mangaDexId}/chapters`, { withCredentials: true })
      })
      .then(res => setAllChapters(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [chapterId, fetchPages])

  const currentIndex = allChapters.findIndex(c => c._id === chapterId)
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null
  const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null

  const goToPage = useCallback((p: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, p))
    setPage(clamped)
    const ch = chapterRef.current
    if (chapterId && ch) trackProgress(ch.mangaDexId, chapterId, clamped, false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // Preload next 3 pages
    for (let i = 1; i <= 3; i++) {
      const next = clamped + i
      if (next < pages.length && !preloadedRef.current.has(next)) {
        preloadedRef.current.add(next)
        const img = new Image(); img.src = pages[next]
      }
    }
  }, [pages, chapterId, trackProgress])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (settings.layout === 'single') {
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          settings.direction === 'rtl' ? goToPage(page - 1) : goToPage(page + 1)
        }
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          settings.direction === 'rtl' ? goToPage(page + 1) : goToPage(page - 1)
        }
      }
      if (e.key === 'Escape') setShowSettings(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [page, goToPage, settings.layout, settings.direction])

  const bgClass = BG_CLASSES[settings.bg]
  const isLight = settings.bg === 'white'
  const textColor = isLight ? 'text-gray-700' : 'text-white'
  const mutedColor = isLight ? 'text-gray-400' : 'text-white/60'

  if (loading) return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
      <div className="skeleton w-80 h-[560px] rounded-2xl" />
    </div>
  )

  if (!chapter) return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
      <p className="text-text-muted font-body">Chapter not found.</p>
    </div>
  )

  return (
    <div className={`min-h-screen ${bgClass}`} onClick={() => settings.layout === 'single' && setShowControls(v => !v)}>
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${showControls || settings.layout === 'webtoon' ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className={`p-3 flex items-center justify-between ${isLight ? 'bg-white/95 border-b border-black/10' : 'bg-black/90 border-b border-white/5'} backdrop-blur-xl`}>
          <Link to={`/manga/${chapter.mangaDexId}`}
            className={`flex items-center gap-2 text-sm font-body transition-colors ${isLight ? 'text-gray-500 hover:text-black' : 'text-white/70 hover:text-primary'}`}
            onClick={e => e.stopPropagation()}>
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="text-center">
            <p className={`text-sm font-body ${textColor}`}>
              Chapter {chapter.chapterNumber}{chapter.title ? ` — ${chapter.title}` : ''}
            </p>
            <p className={`text-xs ${mutedColor}`}>
              {pagesLoading ? 'Loading pages…' :
                settings.layout === 'single' ? `Page ${page + 1} / ${pages.length}` :
                `${pages.length} pages`}
            </p>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {chapter.mdxChapterId && (
              <button onClick={() => fetchPages(chapter)}
                className={`flex items-center gap-1.5 text-xs font-body transition-colors ${mutedColor} hover:${textColor}`}>
                <RefreshCw size={13} className={pagesLoading ? 'animate-spin' : ''} />
              </button>
            )}
            <div className="relative">
              <button onClick={() => setShowSettings(v => !v)}
                className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'text-primary bg-primary/10' : `${mutedColor} hover:${textColor}`}`}>
                <Settings size={16} />
              </button>
              {showSettings && <ReaderSettingsPanel settings={settings} update={update} onClose={() => setShowSettings(false)} />}
            </div>
          </div>
        </div>
      </div>

      {settings.layout === 'webtoon' && (
        <div className="flex flex-col items-center pt-14 pb-4 gap-1">
          {pagesLoading ? (
            <div className="flex items-center justify-center" style={{ minHeight: '80vh' }}>
              <RefreshCw size={32} className="animate-spin text-white/50" />
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 text-white/50" style={{ minHeight: '80vh' }}>
              <p className="text-sm font-body">No pages available.</p>
            </div>
          ) : (
            pages.map((src, i) => (
              <img key={i} src={proxyUrl(src)} alt={`Page ${i + 1}`}
                className="block w-full max-w-3xl" loading="lazy"
                onError={e => { const img = e.currentTarget; if (img.src !== src) img.src = src }} />
            ))
          )}
          {chapterId && chapter && (
            <div className="w-full max-w-3xl px-4">
              <ChapterComments chapterId={chapterId} mangaId={chapter.mangaDexId} />
            </div>
          )}
          <div className="flex gap-3 mt-6" onClick={e => e.stopPropagation()}>
            {prevChapter && (
              <button onClick={() => navigate(`/read/manual/${prevChapter._id}`)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body transition-colors ${isLight ? 'bg-black/10 hover:bg-black/20 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                <ChevronLeft size={16} /> Ch. {prevChapter.chapterNumber}
              </button>
            )}
            {nextChapter && (
              <button onClick={() => navigate(`/read/manual/${nextChapter._id}`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl text-sm font-body border border-primary/30">
                Ch. {nextChapter.chapterNumber} <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {settings.layout === 'single' && (
        <>
          <div className="flex justify-center items-start min-h-screen pt-14 pb-20"
            onClick={e => {
              if (showSettings) { setShowSettings(false); return }
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const mid = rect.left + rect.width / 2
              setShowControls(v => {
                if (!v) return true
                if (settings.direction === 'rtl') {
                  e.clientX < mid ? goToPage(page + 1) : goToPage(page - 1)
                } else {
                  e.clientX > mid ? goToPage(page + 1) : goToPage(page - 1)
                }
                return v
              })
            }}>
            {pagesLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 text-white/50" style={{ minHeight: '80vh' }}>
                <RefreshCw size={32} className="animate-spin" />
                <p className="text-sm font-body">Fetching pages…</p>
              </div>
            ) : pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 text-white/50" style={{ minHeight: '80vh' }}>
                <p className="text-sm font-body">No pages available.</p>
              </div>
            ) : (
              <img key={`${chapterId}-${page}`}
                src={proxyUrl(pages[page])} alt={`Page ${page + 1}`}
                className={`object-contain ${
                  settings.fit === 'width' ? 'w-full max-w-3xl' :
                  settings.fit === 'height' ? 'h-[calc(100vh-120px)] w-auto' :
                  'max-w-full'
                }`}
                loading="lazy" onError={e => {
                  const img = e.currentTarget
                  const raw = pages[page]
                  if (img.src !== raw) img.src = raw
                  else img.src = 'https://placehold.co/800x1200/09090f/white?text=Image+Error'
                }} />
            )}
          </div>
          <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
            <div className={`p-3 ${isLight ? 'bg-white/95 border-t border-black/10' : 'bg-black/90 border-t border-white/5'} backdrop-blur-xl`}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3 max-w-3xl mx-auto">
                <span className={`font-mono text-xs w-6 ${mutedColor}`}>{page + 1}</span>
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    goToPage(Math.floor(((e.clientX - rect.left) / rect.width) * pages.length))
                  }}>
                  <div className="h-full bg-primary rounded-full transition-all duration-200"
                    style={{ width: `${pages.length ? ((page + 1) / pages.length) * 100 : 0}%` }} />
                </div>
                <span className={`font-mono text-xs w-6 text-right ${mutedColor}`}>{pages.length}</span>
              </div>
              <div className="flex items-center justify-between max-w-3xl mx-auto gap-3">
                {(settings.direction === 'rtl' ? page < pages.length - 1 : page > 0) ? (
                  <button onClick={() => settings.direction === 'rtl' ? goToPage(page + 1) : goToPage(page - 1)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body transition-colors ${isLight ? 'bg-black/10 hover:bg-black/20 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                    <ChevronLeft size={16} /> {settings.direction === 'rtl' ? 'Next' : 'Prev'}
                  </button>
                ) : prevChapter ? (
                  <button onClick={() => { navigate(`/read/manual/${prevChapter._id}`); setPage(0) }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body transition-colors ${isLight ? 'bg-black/5 hover:bg-black/10 text-gray-600' : 'bg-white/5 hover:bg-white/10 text-white/70'}`}>
                    <ChevronLeft size={16} /> Ch. {prevChapter.chapterNumber}
                  </button>
                ) : <div className="w-28" />}
                <div className="flex gap-2" />
                {(settings.direction === 'rtl' ? page > 0 : page < pages.length - 1) ? (
                  <button onClick={() => settings.direction === 'rtl' ? goToPage(page - 1) : goToPage(page + 1)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body transition-colors ${isLight ? 'bg-black/10 hover:bg-black/20 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                    {settings.direction === 'rtl' ? 'Prev' : 'Next'} <ChevronRight size={16} />
                  </button>
                ) : nextChapter ? (
                  <button onClick={() => { navigate(`/read/manual/${nextChapter._id}`); setPage(0) }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl text-sm font-body border border-primary/30">
                    Ch. {nextChapter.chapterNumber} <ChevronRight size={16} />
                  </button>
                ) : <div className="w-28" />}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}