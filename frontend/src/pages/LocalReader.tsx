import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, Settings } from 'lucide-react'
import axios from 'axios'
import type { LocalChapter } from '@/types'
import { useReaderSettings, BG_CLASSES } from '../hooks/useReaderSettings'
import { mediaUrl } from '@/utils/mediaUrl'
import { useReadingProgress } from '../hooks/useReadingProgress'
import ChapterComments from '../components/ChapterComments'
import ReaderSettingsPanel from '../components/ReaderSettingsPanel'

interface ChapterWithManga extends Omit<LocalChapter, 'mangaId'> {
  mangaTitle?: string
  mangaId?: string | { _id: string; title: string }
}

function getMangaId(mangaId?: string | { _id: string; title: string }): string | undefined {
  if (!mangaId) return undefined
  if (typeof mangaId === 'string') return mangaId
  return mangaId._id
}

export default function LocalReader() {
  const { chapterId } = useParams<{ chapterId: string }>()
  const navigate = useNavigate()
  const { settings, update } = useReaderSettings()
  const { trackProgress, loadSyncedProgress } = useReadingProgress()
  const [showSettings, setShowSettings] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [chapter, setChapter] = useState<ChapterWithManga | null>(null)
  const [allChapters, setAllChapters] = useState<LocalChapter[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const chapterRef = useRef<ChapterWithManga | null>(null)
  const preloadedRef = useRef<Set<number>>(new Set())
  chapterRef.current = chapter

  useEffect(() => {
    if (!chapterId) return
    setLoading(true)
    axios.get(`/api/local-manga/chapter/${chapterId}`)
      .then(async res => {
        const ch: ChapterWithManga = res.data
        setChapter(ch)
        const savedPage = await loadSyncedProgress(chapterId)
        setPage(Math.min(savedPage, (ch.pages?.length || 1) - 1))
        const mid = getMangaId(ch.mangaId)
        if (mid) {
          const chaptersRes = await axios.get(`/api/local-manga/${mid}/chapters`)
          setAllChapters(chaptersRes.data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [chapterId])

  const currentIndex = allChapters.findIndex(c => c._id === chapterId)
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null
  const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null
  const pages = chapter?.pages || []

  const goToPage = useCallback((p: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, p))
    setPage(clamped)
    const mid = getMangaId(chapterRef.current?.mangaId)
    if (chapterId && mid) trackProgress(mid, chapterId, clamped, true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // Preload next 3 pages
    for (let i = 1; i <= 3; i++) {
      const next = clamped + i
      if (next < pages.length && !preloadedRef.current.has(next)) {
        preloadedRef.current.add(next)
        const img = new Image(); img.src = mediaUrl(pages[next])
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
    <div className={`min-h-screen ${bgClass}`}>
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${showControls || settings.layout === 'webtoon' ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className={`p-3 flex items-center justify-between backdrop-blur-xl ${isLight ? 'bg-white/95 border-b border-black/10' : 'bg-black/90 border-b border-white/5'}`}>
          <Link to={getMangaId(chapter.mangaId) ? `/local/${getMangaId(chapter.mangaId)}` : '/catalog'}
            className={`flex items-center gap-2 text-sm font-body transition-colors ${isLight ? 'text-gray-500 hover:text-black' : 'text-white/70 hover:text-primary'}`}>
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="text-center">
            <p className={`text-sm font-body ${textColor}`}>
              Chapter {chapter.chapterNumber}{chapter.title ? ` — ${chapter.title}` : ''}
            </p>
            <p className={`text-xs ${mutedColor}`}>
              {settings.layout === 'single' ? `Page ${page + 1} / ${pages.length}` : `${pages.length} pages`}
            </p>
          </div>
          <div className="relative">
            <button onClick={() => setShowSettings(v => !v)}
              className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'text-primary bg-primary/10' : `${mutedColor} hover:${textColor}`}`}>
              <Settings size={16} />
            </button>
            {showSettings && <ReaderSettingsPanel settings={settings} update={update} onClose={() => setShowSettings(false)} />}
          </div>
        </div>
      </div>

      {settings.layout === 'webtoon' && (
        <div className="flex flex-col items-center pt-14 pb-4 gap-1">
          {pages.length === 0 ? (
            <div className="flex items-center justify-center text-white/50" style={{ minHeight: '80vh' }}>
              <p className="text-sm font-body">No pages available.</p>
            </div>
          ) : (
            pages.map((src, i) => (
              <img key={i} src={mediaUrl(src)} alt={`Page ${i + 1}`} className="block w-full max-w-3xl" loading="lazy" />
            ))
          )}
          {chapterId && chapter && (
            <div className="w-full max-w-3xl px-4">
              <ChapterComments chapterId={chapterId} mangaId={getMangaId(chapter.mangaId) || ''} />
            </div>
          )}
          <div className="flex gap-3 mt-6">
            {prevChapter && (
              <button onClick={() => navigate(`/read/local/${prevChapter._id}`)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body transition-colors ${isLight ? 'bg-black/10 hover:bg-black/20 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                <ChevronLeft size={16} /> Ch. {prevChapter.chapterNumber}
              </button>
            )}
            {nextChapter && (
              <button onClick={() => navigate(`/read/local/${nextChapter._id}`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl text-sm font-body border border-primary/30">
                Ch. {nextChapter.chapterNumber} <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {settings.layout === 'single' && (
        <>
          <div className="flex justify-center items-start min-h-screen pt-14 pb-20 cursor-pointer"
            onClick={e => {
              if (showSettings) { setShowSettings(false); return }
              setShowControls(v => !v)
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const mid = rect.left + rect.width / 2
              if (settings.direction === 'rtl') {
                e.clientX < mid ? goToPage(page + 1) : goToPage(page - 1)
              } else {
                e.clientX > mid ? goToPage(page + 1) : goToPage(page - 1)
              }
            }}>
            {pages[page] && (
              <img src={mediaUrl(pages[page])} alt={`Page ${page + 1}`}
                className={`object-contain ${
                  settings.fit === 'width' ? 'w-full max-w-3xl' :
                  settings.fit === 'height' ? 'h-[calc(100vh-120px)] w-auto' :
                  'max-w-full'
                }`} />
            )}
          </div>
          <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
            <div className={`p-3 backdrop-blur-xl ${isLight ? 'bg-white/95 border-t border-black/10' : 'bg-black/90 border-t border-white/5'}`}
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
                  <button onClick={() => { navigate(`/read/local/${prevChapter._id}`); setPage(0) }}
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
                  <button onClick={() => { navigate(`/read/local/${nextChapter._id}`); setPage(0) }}
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