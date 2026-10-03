import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Star, ChevronLeft, ChevronRight, Lock, Sparkles } from 'lucide-react'
import axios from 'axios'
import { motion } from 'framer-motion'
import { API_BASE } from '@/utils/manga'

// Front page for visitors who are NOT logged in.
// Every manga link points to a protected route, so clicking anything sends
// the visitor to Sign In (with Register one click away) and then returns them
// to the page they clicked after they log in.

interface CardItem { id: string; title: string; cover: string; year: number | null; status: string }
interface HeroItem { id: string; title: string; description: string; cover: string; tags: string[] }
interface LatestItem {
  id: string; title: string; cover: string; group: string
  chapters: { num: string | null; title: string | null; publishAt: string | null }[]
}
interface HomeData {
  hero: HeroItem[]
  trending: CardItem[]
  recommended: CardItem[]
  seasonal: CardItem[]
  recentlyAdded: CardItem[]
  latest: LatestItem[]
  genres?: { action: CardItem[]; romance: CardItem[]; sliceOfLife: CardItem[] }
}

// ── Promo copy: edit these to change the landing page messaging ──────────────
const PROMO = {
  tagline: 'Your adventure begins now. Thousands of chapters. Updated daily.',
  railText: 'Join free \u2022 Read \u2022 Track \u2022 Follow',
  cardRibbon: 'Sign in to read',
  sidePanelTitle: 'Fresh Chapters',
  sidePanelSub: 'Free with an account',
}

const img = (path: string) => (path ? `${API_BASE}${path}` : '')
const mangaLink = (id: string) => `/manga/${id}`

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (isNaN(diff) || diff < 0) return 'Just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

function Carousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  return (
    <div className="relative group/carousel">
      <button
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -translate-x-3 w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-[var(--muted)] shadow-xl"
      >
        <ChevronLeft size={14} />
      </button>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 translate-x-3 w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-[var(--muted)] shadow-xl"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

function CoverCard({ item }: { item: CardItem }) {
  const statusColor: Record<string, string> = {
    ongoing: '#22c55e', completed: '#3b82f6', hiatus: '#f59e0b', cancelled: '#ef4444',
  }
  return (
    <Link to={mangaLink(item.id)} className="flex-shrink-0 w-[120px] group/card">
      <div className="relative rounded-lg overflow-hidden bg-[var(--muted)]" style={{ aspectRatio: '2/3' }}>
        {item.cover && (
          <img
            src={img(item.cover)}
            alt={item.title}
            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        )}
        {item.status && (
          <div className="absolute bottom-1.5 right-1.5">
            <span className="w-2 h-2 rounded-full block" style={{ background: statusColor[item.status] || '#6b7280' }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex items-end justify-center pb-2">
          <span className="flex items-center gap-1 text-[10px] text-white font-body"><Lock size={10} /> Sign in to read</span>
        </div>
      </div>
      <p className="text-xs text-[var(--text)] font-body mt-1.5 line-clamp-2 leading-tight">{item.title}</p>
      {item.year && <p className="text-[10px] text-[#6b7280] font-mono mt-0.5">{item.year}</p>}
    </Link>
  )
}

function SectionHeader({ title, href, icon }: { title: string; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold text-[var(--text)] tracking-wide">{title}</h2>
      </div>
      {href && (
        <Link to={href} className="flex items-center gap-1 text-xs text-[#7c6af7] hover:text-[#9d8fff] transition-colors font-body">
          View More <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}

function CardRow({ title, items, href, icon }: { title: string; items: CardItem[]; href?: string; icon?: React.ReactNode }) {
  if (!items.length) return null
  return (
    <section>
      <SectionHeader title={title} href={href} icon={icon} />
      <Carousel>
        {items.map(m => <CoverCard key={m.id} item={m} />)}
      </Carousel>
    </section>
  )
}

export default function GuestHome() {
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState(false)
  const location = useLocation()

  // Lets index.css adapt the navbar wordmark (the guest hero is light in light mode)
  useEffect(() => {
    document.body.classList.add('guest-page')
    return () => document.body.classList.remove('guest-page')
  }, [])

  useEffect(() => {
    axios.get('/api/public/home')
      .then(res => setData(res.data))
      .catch(() => setError(true))
  }, [])

  // Covers for the tilted banner strip (trending first, then fall back to other lists)
  const stripItems: CardItem[] = data
    ? [...data.trending, ...data.recommended, ...data.recentlyAdded]
        .filter((m, i, arr) => m.cover && arr.findIndex(x => x.id === m.id) === i)
        .slice(0, 9)
    : []
  const mid = (stripItems.length - 1) / 2
  const trendingGrid = (data?.trending ?? []).slice(0, 8)
  const fresh = (data?.latest ?? []).slice(0, 8)
  const bgCover = stripItems[0]?.cover

  return (
    <div className="bg-[var(--bg)] min-h-screen relative overflow-hidden">

      {/* Atmosphere: manga-panel glow + blurred cover backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px]">
        {bgCover && (
          <div className="absolute inset-0 opacity-[0.18]"
            style={{ backgroundImage: `url(${img(bgCover)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(50px) saturate(1.4)' }} />
        )}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 15% 30%, rgba(232,57,77,0.22), transparent 70%), radial-gradient(ellipse 60% 50% at 90% 10%, rgba(232,57,77,0.14), transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ color: 'var(--text)', backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.2px)', backgroundSize: '9px 9px' }} />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 0%, transparent 35%, var(--bg) 100%)' }} />
      </div>

      {/* TILTED COVER STRIP */}
      {stripItems.length > 0 && (
        <section className="relative pt-20 md:pt-24 overflow-hidden" style={{ perspective: '1400px' }}>
          <div className="flex justify-center items-end gap-3 md:gap-4 px-2 -mx-8 md:mx-0 h-[190px] md:h-[250px]">
            {stripItems.map((m, i) => {
              const d = i - mid
              const abs = Math.abs(d)
              // hide the outermost cards on small screens
              const hideMobile = abs > 2.5 ? 'hidden sm:block' : ''
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                  className={`flex-shrink-0 ${hideMobile}`}
                  style={{ transform: `rotateY(${-d * 7}deg) translateY(${abs * abs * 2.2}px) rotateZ(${d * 1.2}deg)`, transformStyle: 'preserve-3d' }}
                >
                  <Link to={mangaLink(m.id)} className="block group/strip">
                    <div className="relative w-[96px] sm:w-[110px] md:w-[130px] rounded-xl overflow-hidden ring-1 ring-black/10 shadow-2xl shadow-black/40 group-hover/strip:-translate-y-2 group-hover/strip:ring-primary/60 transition-all duration-300 bg-[var(--muted)]"
                      style={{ aspectRatio: '2/3' }}>
                      <img src={img(m.cover)} alt={m.title} className="w-full h-full object-cover" loading={i < 5 ? 'eager' : 'lazy'} />
                      <div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="font-body text-[10px] md:text-[11px] font-semibold text-white leading-tight line-clamp-2">{m.title}</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* WELCOME */}
      <section className={`relative text-center px-5 ${stripItems.length ? 'pt-8 md:pt-10' : 'pt-32 md:pt-40'} pb-10`}>
        <motion.h1
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="font-display text-5xl sm:text-6xl md:text-7xl text-[var(--text)] tracking-wide leading-none"
          style={{ textShadow: '0 4px 30px rgba(232,57,77,0.25)' }}>
          Welcome to MangaVerse
        </motion.h1>
        <p className="font-display text-base sm:text-lg md:text-xl text-[var(--text-muted)] tracking-wider mt-3 max-w-2xl mx-auto uppercase">
          {PROMO.tagline}
        </p>
        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          <Link to="/register" state={location.state}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-body font-semibold text-sm rounded-lg transition-all shadow-lg shadow-primary/30">
            Create Free Account
          </Link>
          <Link to="/login" state={location.state}
            className="px-6 py-2.5 bg-[var(--surface)] hover:bg-[var(--muted)] text-[var(--text)] font-body text-sm rounded-lg border border-[var(--border)] transition-colors">
            Sign In
          </Link>
        </div>
      </section>

      <div className="relative max-w-6xl mx-auto px-5 pb-10 space-y-12">

        {/* Loading skeleton */}
        {!data && !error && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse bg-[var(--muted)] rounded-lg" style={{ aspectRatio: '2/3' }} />
              ))}
            </div>
            <div className="hidden lg:block animate-pulse bg-[var(--muted)] rounded-2xl h-[420px]" />
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-text-muted font-body py-10">
            Couldn't load the library preview right now. You can still{' '}
            <Link to="/login" className="text-primary hover:underline">sign in</Link> or{' '}
            <Link to="/register" className="text-primary hover:underline">register</Link>.
          </p>
        )}

        {data && (
          <>
            {/* NEW & TRENDING + FRESH CHAPTERS */}
            <section className="grid lg:grid-cols-[1fr_320px] gap-6">
              <div>
                <h2 className="font-display text-2xl text-[var(--text)] tracking-wide mb-3">New &amp; Trending</h2>
                <div className="flex gap-3">
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {trendingGrid.map((m, i) => (
                      <Link key={m.id} to={mangaLink(m.id)} className="group/t block">
                        <div className="relative rounded-xl overflow-hidden ring-1 ring-[var(--border)] group-hover/t:ring-primary/50 transition-all bg-[var(--muted)]" style={{ aspectRatio: '2/3' }}>
                          <img src={img(m.cover)} alt={m.title} className="w-full h-full object-cover group-hover/t:scale-105 transition-transform duration-300" loading="lazy" />
                          {i < 3 && (
                            <span className="absolute top-2 left-2 text-[9px] font-mono tracking-wider px-1.5 py-0.5 bg-primary text-white rounded">POPULAR</span>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-8 pb-1.5 px-2">
                            <span className="flex items-center justify-center gap-1 text-[9px] font-mono uppercase tracking-wider text-white/90">
                              <Lock size={9} /> {PROMO.cardRibbon}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text)] font-body font-semibold mt-1.5 truncate">{m.title}</p>
                        {m.year && <p className="text-[10px] text-text-muted font-mono">{m.year}</p>}
                      </Link>
                    ))}
                  </div>
                  {/* Vertical promo rail */}
                  <Link to="/register"
                    className="hidden sm:flex items-center justify-center w-9 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors flex-shrink-0">
                    <span className="font-display text-sm tracking-[0.2em] text-primary uppercase whitespace-nowrap"
                      style={{ writingMode: 'vertical-rl' }}>
                      {PROMO.railText}
                    </span>
                  </Link>
                </div>
              </div>

              {fresh.length > 0 && (
                <aside className="rounded-2xl bg-[var(--surface)] shadow-lg shadow-black/5 border border-[var(--border)] p-4 self-start">
                  <h2 className="font-display text-2xl text-[var(--text)] tracking-wide leading-tight">{PROMO.sidePanelTitle}</h2>
                  <p className="flex items-center gap-1 text-[11px] text-primary font-body mb-3"><Sparkles size={11} /> {PROMO.sidePanelSub}</p>
                  <div className="space-y-2.5">
                    {fresh.map(item => (
                      <Link key={item.id} to={mangaLink(item.id)}
                        className="flex items-center gap-3 group/f">
                        <div className="w-11 h-14 rounded-md overflow-hidden bg-[var(--muted)] flex-shrink-0 ring-1 ring-[var(--border)]">
                          {item.cover && <img src={img(item.cover)} alt={item.title} className="w-full h-full object-cover" loading="lazy" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[var(--text)] font-body font-semibold truncate group-hover/f:text-primary transition-colors">{item.title}</p>
                          <p className="text-[11px] text-text-muted font-mono truncate">
                            Ch. {item.chapters[0]?.num || '?'} {item.chapters[0]?.publishAt && <>&middot; {timeAgo(item.chapters[0].publishAt)}</>}
                          </p>
                        </div>
                        <span className="text-[10px] font-body px-2.5 py-1 rounded bg-[var(--muted)] text-[var(--text)] group-hover/f:bg-primary group-hover/f:text-white transition-colors flex-shrink-0">Read</span>
                      </Link>
                    ))}
                  </div>
                </aside>
              )}
            </section>

            {/* CTA */}
            <div className="mx-auto max-w-md glass rounded-2xl p-3 flex gap-3 justify-center">
              <Link to="/register" className="flex-1 text-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-body font-semibold text-xs uppercase tracking-wide rounded-lg transition-all">
                Create Free Account
              </Link>
              <Link to="/browse" className="flex-1 text-center px-4 py-2.5 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--text)] font-body text-xs uppercase tracking-wide rounded-lg border border-[var(--border)] transition-colors">
                Start Reading
              </Link>
            </div>

            {/* GENRES */}
            {data.genres && (data.genres.action.length > 0 || data.genres.romance.length > 0 || data.genres.sliceOfLife.length > 0) && (
              <section className="grid md:grid-cols-3 gap-6">
                {([
                  ['Action', data.genres.action],
                  ['Romance', data.genres.romance],
                  ['Slice of Life', data.genres.sliceOfLife],
                ] as [string, CardItem[]][]).map(([name, items]) => items.length > 0 && (
                  <div key={name}>
                    <h2 className="font-display text-2xl text-[var(--text)] tracking-wide mb-3">{name}</h2>
                    <div className="grid grid-cols-3 gap-2">
                      {items.slice(0, 6).map(m => (
                        <Link key={m.id} to={mangaLink(m.id)} className="group/g block">
                          <div className="rounded-lg overflow-hidden ring-1 ring-[var(--border)] group-hover/g:ring-primary/50 transition-all bg-[var(--muted)]" style={{ aspectRatio: '2/3' }}>
                            <img src={img(m.cover)} alt={m.title} className="w-full h-full object-cover group-hover/g:scale-105 transition-transform duration-300" loading="lazy" />
                          </div>
                          <p className="text-[10px] text-[var(--text)] font-body mt-1 line-clamp-1">{m.title}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <CardRow title="Recommended" items={data.recommended} href="/browse?sort=rating"
              icon={<Star size={14} className="text-[#f59e0b]" />} />
            <CardRow title={`Seasonal: ${new Date().getFullYear()}`} items={data.seasonal} href="/browse?sort=seasonal" />
            <CardRow title="Recently Added" items={data.recentlyAdded} href="/browse?sort=newest" />
          </>
        )}
      </div>
    </div>
  )
}