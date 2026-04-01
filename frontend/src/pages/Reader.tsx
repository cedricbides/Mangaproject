import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Home, List, WifiOff, Settings, Languages } from 'lucide-react'
import axios from 'axios'
import { getOfflinePages } from '@/utils/offlineStorage'
import { useAuth } from '@/context/AuthContext'
import { useReadingProgress } from '@/hooks/useReadingProgress'
import { useReaderSettings, BG_CLASSES } from '@/hooks/useReaderSettings'
import ReaderSettingsPanel from '@/components/ReaderSettingsPanel'
import TranslationOverlay from '@/components/TranslationOverlay'

export default function Reader() {
  const { chapterId } = useParams<{ chapterId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { trackProgress, loadSyncedProgress } = useReadingProgress()
  const { settings, update } = useReaderSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [translateEnabled, setTranslateEnabled] = useState(false)
  const [translateLang, setTranslateLang] = useState('en')

  const [pages, setPages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [mangaId, setMangaId] = useState('')
  const [chapterList, setChapterList] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isOffline, setIsOffline] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const objectUrlsRef = useRef<string[]>([])
  const preloadedRef = useRef<Set<number>>(new Set())
  const reloadAttempted = useRef(false)

  useEffect(() => {
    return () => { objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url)) }
  }, [])

  // ── Preload upcoming pages ──────────────────────────────────────────────────
  const preloadPages = useCallback((pageIndex: number, allPages: string[]) => {
    const AHEAD = 3
    for (let i = pageIndex + 1; i <= Math.min(pageIndex + AHEAD, allPages.length - 1); i++) {
      if (!preloadedRef.current.has(i)) {
        preloadedRef.current.add(i)
        const img = new Image()
        img.src = allPages[i]
      }
    }
  }, [])

  useEffect(() => {
    if (!chapterId) return
    setLoading(true)
    setIsOffline(false)
    preloadedRef.current = new Set()
    reloadAttempted.current = false
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    objectUrlsRef.current = []

    const load = async () => {
      const offlinePages = user?.id
        ? await getOfflinePages(user.id, chapterId).catch(() => null)
        : null
      if (offlinePages && offlinePages.length > 0) {
        objectUrlsRef.current = offlinePages
        setPages(offlinePages)
        setIsOffline(true)
        setLoading(false)
        const savedPage = await loadSyncedProgress(chapterId)
        const start = Math.min(savedPage, offlinePages.length - 1)
        setCurrentPage(start)
        preloadPages(start, offlinePages)
        return
      }

      try {
        const [pagesRes, chapterRes] = await Promise.all([
          axios.get(`/api/mangadex/chapter-pages/${chapterId}`),
          axios.get(`/api/mangadex/chapter/${chapterId}`, { params: { 'includes[]': 'manga' } }),
        ])
        const imgs: string[] = pagesRes.data.pages || []
        setPages(imgs)
        const mangaRel = chapterRes.data?.data?.relationships?.find((r: { type: string }) => r.type === 'manga')
        if (mangaRel) setMangaId(mangaRel.id)
        const savedPage = await loadSyncedProgress(chapterId)
        const start = Math.min(savedPage, imgs.length - 1)
        setCurrentPage(start)
        preloadPages(start, imgs)
      } catch (err) {
        console.error('Failed to load chapter pages', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [chapterId])

  useEffect(() => {
    if (!mangaId) return
    axios.get(`/api/mangadex/manga/${mangaId}/feed`, {
      params: { translatedLanguage: ['en'], order: { chapter: 'asc' }, limit: 500 }
    }).then(res => {
      const ids: string[] = res.data.data.map((c: { id: string }) => c.id)
      setChapterList(ids)
      setCurrentIndex(ids.findIndex(id => id === chapterId))
    })
  }, [mangaId, chapterId])

  const prevChapterId = currentIndex > 0 ? chapterList[currentIndex - 1] : null
  const nextChapterId = currentIndex >= 0 && currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1] : null
  const goToChapter = (id: string) => { window.scrollTo(0, 0); navigate(`/read/${id}`) }
  const step = settings.layout === 'double' ? 2 : 1

  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, page))
    setCurrentPage(clamped)
    if (mangaId && chapterId) trackProgress(mangaId, chapterId, clamped, false)
    window.scrollTo(0, 0)
    preloadPages(clamped, pages)
  }, [pages, mangaId, chapterId, trackProgress, preloadPages])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const isWebtoon = settings.layout === 'webtoon'
      if (!isWebtoon) {
        const fwd = settings.direction === 'rtl' ? -step : step
        const bwd = -fwd
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          const next = currentPage + fwd
          if (next >= pages.length && nextChapterId) goToChapter(nextChapterId)
          else goToPage(next)
        }
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          const next = currentPage + bwd
          if (next < 0 && prevChapterId) goToChapter(prevChapterId)
          else goToPage(next)
        }
      }
      if (e.key === ']' && nextChapterId) goToChapter(nextChapterId)
      if (e.key === '[' && prevChapterId) goToChapter(prevChapterId)
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey) setShowSettings(v => !v)
      if (e.key === 'Escape') setShowSettings(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settings, currentPage, pages.length, nextChapterId, prevChapterId, goToPage, step])

  // ── Retry: re-fetch fresh CDN URLs if an image 404s (at-home URLs expire) ───
  const reloadPages = useCallback(() => {
    if (!chapterId) return
    axios.get(`/api/mangadex/chapter-pages/${chapterId}`)
      .then(res => setPages(res.data.pages || []))
      .catch(() => {})
  }, [chapterId])

  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget
    target.dataset.retried = 'true' // prevent this specific img from re-triggering
    if (!reloadAttempted.current) {
      reloadAttempted.current = true // only reload once total across all broken images
      reloadPages()
    }
  }, [reloadPages])

  // ── Render pages ────────────────────────────────────────────────────────────
  const renderPages = () => {
    if (settings.layout === 'webtoon') {
      return pages.map((src, i) => (
        <div key={i} className="relative w-full max-w-2xl mx-auto">
          <img src={src} alt={`Page ${i + 1}`} className="w-full block" loading="lazy"
            onLoad={() => { if (mangaId && chapterId) trackProgress(mangaId, chapterId, i, false) }}
            onError={handleImgError}
          />
          <TranslationOverlay pageUrl={src} targetLang={translateLang} enabled={translateEnabled} />
        </div>
      ))
    }

    if (settings.layout === 'double') {
      // Cover is page 0 shown alone; rest are paired
      const pairs: [string, string | null][] = [[pages[0], null]]
      for (let i = 1; i < pages.length; i += 2) pairs.push([pages[i], pages[i + 1] ?? null])
      const pairIdx = currentPage === 0 ? 0 : Math.ceil(currentPage / 2)
      const safe = Math.min(pairIdx, pairs.length - 1)
      const [a, b] = pairs[safe]
      const [left, right] = settings.direction === 'rtl' ? [b, a] : [a, b]
      return (
        <div className="flex justify-center items-start gap-0.5 w-full max-w-5xl mx-auto px-2">
          {left && <img src={left} alt="Page" className="w-1/2 object-contain max-h-[90vh]" onError={handleImgError} />}
          {right && <img src={right} alt="Page" className="w-1/2 object-contain max-h-[90vh]" onError={handleImgError} />}
        </div>
      )
    }

    // Single page
    const src = pages[currentPage]
    return src ? (
      <div className="relative inline-block mx-auto">
        <img src={src} alt={`Page ${currentPage + 1}`}
          style={{ maxHeight: settings.fit === 'height' ? '90vh' : undefined, maxWidth: settings.fit === 'original' ? 'none' : '900px', display: 'block' }}
          className={`${settings.fit === 'width' ? 'w-full' : ''}`}
          onError={handleImgError}
        />
        <TranslationOverlay pageUrl={src} targetLang={translateLang} enabled={translateEnabled} />
      </div>
    ) : null
  }

  const bgClass = BG_CLASSES[settings.bg]
  const isWebtoon = settings.layout === 'webtoon'

  let pageLabel = ''
  if (pages.length > 0 && !loading) {
    if (settings.layout === 'double' && currentPage > 0) {
      const p2 = Math.min(currentPage + 1, pages.length - 1)
      pageLabel = `${currentPage + 1}–${p2 + 1} / ${pages.length}`
    } else if (isWebtoon) {
      pageLabel = `${pages.length} pages`
    } else {
      pageLabel = `${currentPage + 1} / ${pages.length}`
    }
  }

  return (
    <div className={`min-h-screen ${bgClass}`} onClick={() => showSettings && setShowSettings(false)}>
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {mangaId && (
            <Link to={`/manga/${mangaId}`} className="flex items-center gap-1.5 text-text-muted hover:text-white transition-colors text-sm font-body">
              <ChevronLeft size={16} /> Back
            </Link>
          )}
          <Link to="/" className="text-text-muted hover:text-white transition-colors"><Home size={16} /></Link>
        </div>
        <div className="flex items-center gap-3">
          {isOffline && (
            <div className="flex items-center gap-1 px-2 py-1 bg-violet-500/15 border border-violet-500/30 rounded-lg">
              <WifiOff size={10} className="text-violet-400" />
              <span className="font-mono text-[10px] text-violet-300">Offline</span>
            </div>
          )}
          {pageLabel && <span className="font-mono text-xs text-text-muted">{pageLabel}</span>}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {translateEnabled && (
                <select
                  value={translateLang}
                  onChange={e => setTranslateLang(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="bg-black/60 border border-white/10 text-white text-[11px] rounded-md px-1.5 py-0.5 font-mono outline-none focus:border-primary/50"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="pt">Portuguese</option>
                  <option value="id">Indonesian</option>
                  <option value="ru">Russian</option>
                  <option value="ar">Arabic</option>
                  <option value="tr">Turkish</option>
                  <option value="vi">Vietnamese</option>
                  <option value="th">Thai</option>
                  <option value="ko">Korean</option>
                </select>
              )}
              <button
                onClick={e => { e.stopPropagation(); setTranslateEnabled(v => !v) }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors text-xs font-body ${translateEnabled ? 'border-blue-500/60 text-blue-400 bg-blue-500/10' : 'border-white/10 text-text-muted hover:text-white'}`}
                title="Auto-translate page"
              >
                <Languages size={13} /> {translateEnabled ? 'Translating' : 'Translate'}
              </button>
            </div>
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowSettings(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors text-xs font-body ${showSettings ? 'border-primary/50 text-primary bg-primary/10' : 'border-white/10 text-text-muted hover:text-white'}`}>
                <Settings size={13} /> Settings
              </button>
              {showSettings && <ReaderSettingsPanel settings={settings} update={update} onClose={() => setShowSettings(false)} />}
            </div>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className={`flex flex-col items-center py-4 ${isWebtoon ? 'gap-0' : 'gap-2'}`}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton w-full max-w-2xl bg-gray-900 rounded" style={{ height: '600px' }} />
            ))
          : renderPages()
        }
      </div>

      {/* Bottom bar */}
      {!loading && (
        <div className="sticky bottom-0 bg-black/90 backdrop-blur-xl border-t border-white/5 py-3 px-4 flex items-center justify-center gap-4">
          {!isWebtoon && (
            <button onClick={() => goToPage(currentPage - step)} disabled={currentPage <= 0}
              className="p-1.5 rounded-lg text-text-muted hover:text-white disabled:opacity-30 transition-colors">
              <ChevronLeft size={18} />
            </button>
          )}
          <button onClick={() => prevChapterId && goToChapter(prevChapterId)} disabled={!prevChapterId}
            className={`flex items-center gap-1.5 text-sm font-body transition-colors ${prevChapterId ? 'text-text-muted hover:text-white cursor-pointer' : 'text-white/20 cursor-not-allowed'}`}>
            <ChevronLeft size={14} /> Prev Ch
          </button>
          {mangaId && (
            <Link to={`/manga/${mangaId}`} className="flex items-center gap-1.5 text-sm text-primary font-body">
              <List size={14} /> Chapters
            </Link>
          )}
          <button onClick={() => nextChapterId && goToChapter(nextChapterId)} disabled={!nextChapterId}
            className={`flex items-center gap-1.5 text-sm font-body transition-colors ${nextChapterId ? 'text-text-muted hover:text-white cursor-pointer' : 'text-white/20 cursor-not-allowed'}`}>
            Next Ch <ChevronRight size={14} />
          </button>
          {!isWebtoon && (
            <button onClick={() => goToPage(currentPage + step)} disabled={currentPage >= pages.length - 1}
              className="p-1.5 rounded-lg text-text-muted hover:text-white disabled:opacity-30 transition-colors">
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      )}
      {!isWebtoon && !loading && (
        <p className="text-center py-2 text-[10px] text-white/20 font-body">
          ← → pages &nbsp;·&nbsp; [ ] chapters &nbsp;·&nbsp; S settings
        </p>
      )}
    </div>
  )
}