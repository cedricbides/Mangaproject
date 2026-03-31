import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Flame, Star, ChevronLeft, ChevronRight, MessageSquare, BookOpen } from 'lucide-react'
import axios from 'axios'
import type { Manga } from '@/types'
import { getCoverUrl, getMangaTitle, getMangaTags, getMangaDescription } from '@/utils/manga'
import { useAuth } from '@/context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

const MD = '/api/mangadex'
const COVER_INCLUDES = 'includes[]=cover_art&includes[]=author&includes[]=scanlation_group'

async function fetchManga(params: string): Promise<Manga[]> {
  const res = await axios.get(`${MD}/manga?${params}&includes[]=cover_art&includes[]=author`)
  return Array.isArray(res.data.data) ? res.data.data : []
}

async function fetchLatestChapters(): Promise<{ groups: { manga: any; chapters: any[] }[] }> {
  const res = await axios.get(
    `${MD}/chapter?limit=64&translatedLanguage[]=en&order[publishAt]=desc&contentRating[]=safe&includes[]=manga&includes[]=scanlation_group`
  )
  const chapters: any[] = res.data.data

  // Group by manga id, keep up to 3 chapters each
  const grouped: Record<string, { mangaId: string; chapters: any[] }> = {}
  for (const ch of chapters) {
    const mangaRel = ch.relationships?.find((r: any) => r.type === 'manga')
    if (!mangaRel) continue
    const mid = mangaRel.id
    if (!grouped[mid]) grouped[mid] = { mangaId: mid, chapters: [] }
    if (grouped[mid].chapters.length < 3) grouped[mid].chapters.push(ch)
  }

  const mangaIds = Object.keys(grouped).slice(0, 20)
  if (mangaIds.length === 0) return { groups: [] }

  // Batch fetch manga details with cover art
  const mangaRes = await axios.get(
    `${MD}/manga?ids[]=${mangaIds.join('&ids[]=')}&limit=20&includes[]=cover_art`
  )
  const mangaMap: Record<string, any> = {}
  for (const m of mangaRes.data.data) mangaMap[m.id] = m

  const groups = mangaIds
    .filter(id => mangaMap[id])
    .map(id => ({ manga: mangaMap[id], chapters: grouped[id].chapters }))

  return { groups }
}

async function resolveHeroData(item: any): Promise<{
  title: string; description: string; cover: string; tags: string[]; link: string; badge: string; ctaLabel: string
} | null> {
  try {
    if (item.type === 'custom') {
      return {
        title: item.customTitle || '',
        description: item.customDescription || '',
        cover: item.customCoverUrl || '',
        tags: [],
        link: item.ctaUrl || '/',
        badge: item.customBadge || 'FEATURED',
        ctaLabel: item.ctaLabel || 'Read Now',
      }
    }
    if (item.type === 'local') {
      const res = await axios.get(`/api/local-manga/${item.mangaId}`)
      const m = res.data
      return {
        title: m.title, description: m.description || '', cover: m.coverUrl || '',
        tags: m.genres?.slice(0, 4) || [],
        link: `/manga/local/${m._id}`,
        badge: 'FEATURED', ctaLabel: item.ctaLabel || 'Read Now',
      }
    }
    const res = await axios.get(`${MD}/manga/${item.mangaId}?${COVER_INCLUDES}`)
    const m = res.data.data
    const titles = m.attributes?.title || {}
    const title = titles.en || titles['ja-ro'] || Object.values(titles)[0] as string || ''
    const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
    const coverFile = coverRel?.attributes?.fileName
    const cover = coverFile ? `/api/proxy/image?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${m.id}/${coverFile}.512.jpg`)}`  : ''
    const desc = Object.values(m.attributes?.description || {})[0] as string || ''
    const tags = (m.attributes?.tags || []).slice(0, 4).map((t: any) =>
      t.attributes?.name?.en || Object.values(t.attributes?.name || {})[0] || ''
    ).filter(Boolean)
    return { title, description: desc, cover, tags, link: `/manga/${m.id}`, badge: 'FEATURED', ctaLabel: item.ctaLabel || 'Read Now' }
  } catch { return null }
}

function fromMdxManga(m: Manga) {
  return {
    title: getMangaTitle(m),
    description: getMangaDescription(m),
    cover: getCoverUrl(m, 512),
    tags: getMangaTags(m),
    link: `/manga/${m.id}`,
    badge: 'TRENDING',
    ctaLabel: 'Read Now',
  }
}

// FIX 5: Handle null/undefined dates and future dates (MangaDex uses future publishAt for scheduled chapters)
function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (isNaN(diff) || diff < 0) return 'Just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

// Horizontal scroll carousel
function Carousel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }
  return (
    <div className={`relative group/carousel ${className}`}>
      <button
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -translate-x-3 w-8 h-8 rounded-full bg-[var(--surface)] border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-[var(--muted)] shadow-xl"
      >
        <ChevronLeft size={14} />
      </button>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 translate-x-3 w-8 h-8 rounded-full bg-[var(--surface)] border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-[var(--muted)] shadow-xl"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

// Cover card for carousels
function CoverCard({ cover, title, link, year, status, badge }: {
  cover: string; title: string; link: string; year?: number; status?: string; badge?: string
}) {
  const statusColor: Record<string, string> = {
    ongoing: '#22c55e', completed: '#3b82f6', hiatus: '#f59e0b', cancelled: '#ef4444'
  }
  return (
    <Link to={link} className="flex-shrink-0 w-[120px] group/card">
      <div className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '2/3' }}>
        <img
          src={cover}
          alt={title}
          className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).src = `https://placehold.co/120x180/1a1a2e/white?text=?` }}
        />
        {badge && (
          <div className="absolute top-1.5 left-1.5">
            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-primary/90 text-white rounded backdrop-blur-sm">{badge}</span>
          </div>
        )}
        {status && (
          <div className="absolute bottom-1.5 right-1.5">
            <span className="w-2 h-2 rounded-full block" style={{ background: statusColor[status] || '#6b7280' }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
      </div>
      <p className="text-xs text-[#c9d1d9] font-body mt-1.5 line-clamp-2 leading-tight">{title}</p>
      {year && <p className="text-[10px] text-[#6b7280] font-mono mt-0.5">{year}</p>}
    </Link>
  )
}

// Section header
function SectionHeader({ title, href, icon }: { title: string; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold text-white tracking-wide">{title}</h2>
      </div>
      {href && (
        <Link to={href} className="flex items-center gap-1 text-xs text-[#7c6af7] hover:text-[#9d8fff] transition-colors font-body">
          View More <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}

export default function Home() {
  const [slides, setSlides] = useState<any[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [trending, setTrending] = useState<Manga[]>([])
  const [continueReading, setContinueReading] = useState<{ mangaId: string; chapterId: string; title: string; cover: string; chapterNum: string }[]>([])
  const [latestGroups, setLatestGroups] = useState<{ manga: any; chapters: any[] }[]>([])
  const [recommended, setRecommended] = useState<Manga[]>([])
  const [seasonal, setSeasonal] = useState<Manga[]>([])
  const [recentlyAdded, setRecentlyAdded] = useState<Manga[]>([])
  const [selfPublished, setSelfPublished] = useState<any[]>([])
  const [featuredPicks, setFeaturedPicks] = useState<any[]>([])
  const [loadingChapters, setLoadingChapters] = useState(true)
  const [loadingTrending, setLoadingTrending] = useState(true)
  const { user } = useAuth()
  const [maintenance, setMaintenance] = useState<{ on: boolean; message: string }>({ on: false, message: '' })
  const [announcement, setAnnouncement] = useState<{ enabled: boolean; text: string }>({ enabled: false, text: '' })
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hero = slides[activeIdx] ?? null

  const startAutoplay = useCallback((count: number) => {
    if (autoplayRef.current) clearInterval(autoplayRef.current)
    if (count < 2) return
    autoplayRef.current = setInterval(() => {
      setDirection(1)
      setActiveIdx(i => (i + 1) % count)
    }, 6000)
  }, [])

  const go = useCallback((delta: number) => {
    setDirection(delta)
    setActiveIdx(i => (i + delta + slides.length) % slides.length)
    startAutoplay(slides.length)
  }, [slides.length, startAutoplay])

  useEffect(() => {
    startAutoplay(slides.length)
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current) }
  }, [slides.length, startAutoplay])

  useEffect(() => {
    // Site settings + hero — use the public endpoint so guests don't get 401
    axios.get('/api/auth/site-settings').then(async (res) => {
      const settings = res.data
      const bannerSlides: any[] = settings.bannerSlides || []
      const picks: any[] = settings.featuredPicks || []
      setFeaturedPicks(picks)
      setMaintenance({ on: !!settings.maintenanceMode, message: settings.maintenanceMessage || 'We are down for maintenance.' })
      setAnnouncement({ enabled: !!settings.announcementBannerEnabled, text: settings.announcementBanner || '' })
      const sources = [...bannerSlides, ...picks].slice(0, 10)
      if (sources.length > 0) {
        const resolved = await Promise.all(sources.map(s => resolveHeroData(s)))
        const valid = resolved.filter(Boolean) as any[]
        if (valid.length > 0) setSlides(valid)
      }
    }).catch(() => {})

    // Latest chapter updates feed
    fetchLatestChapters()
      .then(({ groups }) => setLatestGroups(groups))
      .finally(() => setLoadingChapters(false))

    // Trending
    fetchManga('limit=18&order[followedCount]=desc&contentRating[]=safe&hasAvailableChapters=true')
      .then(data => {
        setTrending(data)
        setSlides(prev => prev.length > 0 ? prev : data.slice(0, 8).map(fromMdxManga))
      })
      .finally(() => setLoadingTrending(false))

    // Recommended / high rated
    fetchManga('limit=18&order[rating]=desc&contentRating[]=safe&hasAvailableChapters=true')
      .then(setRecommended)

    // Seasonal (current year)
    fetchManga(`limit=18&year=${new Date().getFullYear()}&order[followedCount]=desc&contentRating[]=safe&hasAvailableChapters=true`)
      .then(setSeasonal)

    // Recently added
    fetchManga('limit=18&order[createdAt]=desc&contentRating[]=safe&hasAvailableChapters=true')
      .then(setRecentlyAdded)

    // Self-published / local manga
    axios.get('/api/local-manga?limit=18').then(res => {
      const data = res.data?.data ?? res.data
      setSelfPublished(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }, [])

  // Load "Continue Reading" from reading history when user is available
  useEffect(() => {
    if (!user?.readingHistory?.length) { setContinueReading([]); return }
    const recent = [...user.readingHistory]
      .filter(h => !h.isLocal)
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6)
    if (!recent.length) return

    Promise.all(
      recent.map(async (h: any) => {
        try {
          const [mangaRes, chRes] = await Promise.all([
            axios.get(`/api/mangadex/manga/${h.mangaId}?includes[]=cover_art`),
            axios.get(`/api/mangadex/chapter/${h.chapterId}`),
          ])
          const m = mangaRes.data.data
          const ch = chRes.data.data
          const title = m.attributes?.title?.en || Object.values(m.attributes?.title || {})[0] as string || 'Unknown'
          const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
          const cover = coverRel?.attributes?.fileName
            ? `/api/proxy/image?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg`)}`  : ''
          const chNum = ch.attributes?.chapter ? `Ch. ${ch.attributes.chapter}` : 'Chapter'
          return { mangaId: h.mangaId, chapterId: h.chapterId, title, cover, chapterNum: chNum }
        } catch { return null }
      })
    ).then(results => setContinueReading(results.filter(Boolean) as any[]))
  }, [user])

  const isAdmin = user && ['admin', 'superadmin', 'moderator'].includes((user as any).role)

  return (
    <div className="bg-[var(--bg)] min-h-screen">

      {/* Announcement banner */}
      {announcement.enabled && announcement.text && (
        <div className="w-full bg-[#7c6af7]/90 px-4 py-2 flex items-center justify-center gap-2 text-xs font-body text-white z-40 mt-16">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          {announcement.text}
        </div>
      )}

      {/* HERO */}
      <section className="relative h-[420px] md:h-[500px] overflow-hidden">
        <AnimatePresence initial={false}>
          {hero?.cover && (
            <motion.div
              key={activeIdx + '-bg'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute inset-0"
            >
              <div className="absolute inset-0 bg-cover bg-center scale-105"
                style={{ backgroundImage: `url(${hero.cover})`, filter: 'blur(30px) brightness(0.2) saturate(1.6)' }} />
              <div className="absolute inset-y-0 right-0 w-1/2 hidden md:block"
                style={{ backgroundImage: `url(${hero.cover})`, backgroundSize: 'cover', backgroundPosition: 'center top' }} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f17] via-[#0f0f17]/85 to-[#0f0f17]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f17] via-transparent to-transparent" />

        <div className="relative z-10 h-full max-w-6xl mx-auto px-5 flex items-end pb-10">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {hero && (
              <motion.div
                key={activeIdx}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -40 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-end gap-6 w-full"
              >
                <Link to={hero.link} className="hidden md:block flex-shrink-0">
                  <img src={hero.cover} alt={hero.title}
                    className="w-32 rounded-xl shadow-2xl ring-1 ring-white/10 hover:scale-105 transition-transform"
                    style={{ aspectRatio: '2/3', objectFit: 'cover' }}
                   loading="lazy"/>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame size={12} className="text-[#e8394d]" />
                    <span className="text-[10px] font-mono text-[#e8394d] tracking-widest uppercase">{hero.badge}</span>
                  </div>
                  <h1 className="font-display text-3xl md:text-5xl text-white mb-2 leading-tight line-clamp-2">{hero.title}</h1>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {hero.tags.slice(0, 4).map((t: string) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-[#9ca3af] border border-white/10 font-body">{t}</span>
                    ))}
                  </div>
                  <p className="font-body text-[#6b7280] text-xs leading-relaxed max-w-lg mb-4 line-clamp-2">{hero.description}</p>
                  <div className="flex gap-3 items-center flex-wrap">
                    <Link to={hero.link}
                      className="px-5 py-2 bg-[#e8394d] hover:bg-[#d42e42] text-white font-body text-sm rounded-lg transition-colors">
                      {hero.ctaLabel}
                    </Link>
                    {!user && (
                      <Link to="/login"
                        className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white font-body text-sm rounded-lg transition-colors border border-white/10">
                        Sign In
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {slides.length > 1 && (
          <div className="absolute bottom-4 right-5 flex items-center gap-2 z-10">
            <button onClick={() => go(-1)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
              <ChevronLeft size={13} />
            </button>
            <div className="flex gap-1">
              {slides.map((_, i) => (
                <button key={i} onClick={() => { setDirection(i > activeIdx ? 1 : -1); setActiveIdx(i) }}
                  className={`rounded-full transition-all ${i === activeIdx ? 'w-4 h-1.5 bg-[#e8394d]' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'}`} />
              ))}
            </div>
            <button onClick={() => go(1)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </section>

      {/* MAIN CONTENT */}
      <div className="max-w-6xl mx-auto px-5 py-6 space-y-10">

        {/* CONTINUE READING */}
        {continueReading.length > 0 && (
          <section>
            <SectionHeader title="Continue Reading" />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {continueReading.map(item => (
                <Link key={item.chapterId} to={`/read/${item.chapterId}`}
                  className="group relative rounded-xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all">
                  <div className="aspect-[3/4] relative">
                    {item.cover
                      ? <img src={item.cover} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"  loading="lazy"/>
                      : <div className="w-full h-full bg-white/5" />
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="font-body text-[10px] text-white font-semibold truncate leading-tight">{item.title}</p>
                      <p className="font-mono text-[9px] text-primary mt-0.5">{item.chapterNum}</p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* LATEST UPDATES — dense list layout like the reference */}
        <section>
          <SectionHeader title="Latest Updates" href="/browse?sort=latest" />
          {loadingChapters ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="flex gap-3 p-2 rounded-lg bg-white/3 animate-pulse h-14" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/5">
              {latestGroups.map(({ manga, chapters }) => {
                const attrs = manga.attributes || {}
                const title = attrs.title?.en || Object.values(attrs.title || {})[0] as string || 'Unknown'
                const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art') as any
                const cover = coverRel?.attributes?.fileName
                  ? `/api/proxy/image?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`)}` 
                  : null
                const firstCh = chapters[0]
                const groupRel = firstCh?.relationships?.find((r: any) => r.type === 'scanlation_group')
                const groupName = (groupRel?.attributes as any)?.name || 'No Group'

                return (
                  <div key={manga.id} className="flex items-center gap-3 bg-[var(--surface)] hover:bg-[var(--card)] transition-colors px-3 py-2.5 group/row">
                    {/* Cover */}
                    <Link to={`/manga/${manga.id}`} className="flex-shrink-0">
                      <div className="w-9 h-12 rounded overflow-hidden bg-white/10">
                        {cover
                          ? <img src={cover} alt={title} className="w-full h-full object-cover" loading="lazy" />
                          : <div className="w-full h-full bg-white/10" />}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link to={`/manga/${manga.id}`}>
                        <p className="text-sm text-[#c9d1d9] font-body font-medium truncate hover:text-white transition-colors">{title}</p>
                      </Link>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {chapters.slice(0, 2).map((ch: any) => {
                          const chNum = ch.attributes?.chapter
                          const chTitle = ch.attributes?.title
                          const commentCount = ch.attributes?.externalUrl ? 0 : null
                          return (
                            <Link key={ch.id} to={`/read/${ch.id}`}
                              className="flex items-center gap-2 group/ch">
                              <span className="text-xs text-[#7c6af7] hover:text-[#9d8fff] font-mono transition-colors">
                                {ch.attributes?.volume ? `Vol. ${ch.attributes.volume} ` : ''}
                                Ch. {chNum || '?'}
                                {chTitle && <span className="text-[#4b5563] ml-1 font-body font-normal"> - {chTitle.slice(0, 20)}</span>}
                              </span>
                              {commentCount !== null && (
                                <span className="flex items-center gap-0.5 text-[10px] text-[#4b5563]">
                                  <MessageSquare size={9} /> {commentCount}
                                </span>
                              )}
                              <span className="text-[10px] text-[#4b5563] font-body">{timeAgo(ch.attributes?.publishAt)}</span>
                            </Link>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-[#4b5563] font-body mt-0.5 flex items-center gap-1">
                        <BookOpen size={9} />
                        {groupName}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* RECOMMENDED */}
        <section>
          <SectionHeader title="Recommended"
            href="/browse?sort=rating"
            icon={<Star size={14} className="text-[#f59e0b]" />}
          />
          <Carousel>
            {recommended.map(m => (
              <CoverCard
                key={m.id}
                cover={getCoverUrl(m, 256)}
                title={getMangaTitle(m)}
                link={`/manga/${m.id}`}
                year={m.attributes.year}
                status={m.attributes.status}
              />
            ))}
          </Carousel>
        </section>

        {/* SELF-PUBLISHED / LOCAL MANGA */}
        {selfPublished.length > 0 && (
          <section>
            <SectionHeader title="Self-Published" href="/browse?source=local" />
            <Carousel>
              {selfPublished.map((m: any) => (
                <CoverCard
                  key={m._id}
                  cover={m.coverUrl}
                  title={m.title}
                  link={`/manga/local/${m._id}`}
                  year={m.year}
                  status={m.status}
                  badge="LOCAL"
                />
              ))}
            </Carousel>
          </section>
        )}

        {/* STAFF PICKS */}
        {featuredPicks.length > 0 && (
          <section>
            <SectionHeader title="Staff Picks" icon={<Star size={14} className="text-amber-400" />} />
            <Carousel>
              {featuredPicks.map(pick => (
                <CoverCard
                  key={pick.mangaId}
                  cover={pick.coverUrl}
                  title={pick.title}
                  link={pick.type === 'local' ? `/manga/local/${pick.mangaId}` : `/manga/${pick.mangaId}`}
                  badge="PICK"
                />
              ))}
            </Carousel>
          </section>
        )}

        {/* SEASONAL */}
        <section>
          <SectionHeader
            title={`Seasonal: Winter ${new Date().getFullYear()}`}
            href="/browse?sort=seasonal"
          />
          <Carousel>
            {seasonal.map(m => (
              <CoverCard
                key={m.id}
                cover={getCoverUrl(m, 256)}
                title={getMangaTitle(m)}
                link={`/manga/${m.id}`}
                year={m.attributes.year}
                status={m.attributes.status}
              />
            ))}
          </Carousel>
        </section>

        {/* TRENDING */}
        <section>
          <SectionHeader title="Trending" href="/trending" />
          {loadingTrending ? (
            <div className="flex gap-3 overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[120px]">
                  <div className="animate-pulse bg-white/10 rounded-lg" style={{ aspectRatio: '2/3' }} />
                  <div className="mt-2 h-3 bg-white/5 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <Carousel>
              {trending.map(m => (
                <CoverCard
                  key={m.id}
                  cover={getCoverUrl(m, 256)}
                  title={getMangaTitle(m)}
                  link={`/manga/${m.id}`}
                  year={m.attributes.year}
                  status={m.attributes.status}
                />
              ))}
            </Carousel>
          )}
        </section>

        {/* RECENTLY ADDED */}
        <section>
          <SectionHeader title="Recently Added" href="/browse?sort=newest" />
          <Carousel>
            {recentlyAdded.map(m => (
              <CoverCard
                key={m.id}
                cover={getCoverUrl(m, 256)}
                title={getMangaTitle(m)}
                link={`/manga/${m.id}`}
                year={m.attributes.year}
                status={m.attributes.status}
              />
            ))}
          </Carousel>
        </section>

      </div>
    </div>
  )
}