import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Star, Flame, ChevronLeft, ChevronRight, BookOpen, Lock } from 'lucide-react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
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
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -translate-x-3 w-8 h-8 rounded-full bg-[var(--surface)] border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-[var(--muted)] shadow-xl"
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
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 translate-x-3 w-8 h-8 rounded-full bg-[var(--surface)] border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-[var(--muted)] shadow-xl"
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
      <div className="relative rounded-lg overflow-hidden bg-white/5" style={{ aspectRatio: '2/3' }}>
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
      <p className="text-xs text-[#c9d1d9] font-body mt-1.5 line-clamp-2 leading-tight">{item.title}</p>
      {item.year && <p className="text-[10px] text-[#6b7280] font-mono mt-0.5">{item.year}</p>}
    </Link>
  )
}

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
  const [activeIdx, setActiveIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const location = useLocation()

  useEffect(() => {
    axios.get('/api/public/home')
      .then(res => setData(res.data))
      .catch(() => setError(true))
  }, [])

  const slides = data?.hero ?? []
  const hero = slides[activeIdx] ?? null

  const startAutoplay = useCallback((count: number) => {
    if (autoplayRef.current) clearInterval(autoplayRef.current)
    if (count < 2) return
    autoplayRef.current = setInterval(() => {
      setDirection(1)
      setActiveIdx(i => (i + 1) % count)
    }, 6000)
  }, [])

  useEffect(() => {
    startAutoplay(slides.length)
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current) }
  }, [slides.length, startAutoplay])

  const go = (delta: number) => {
    setDirection(delta)
    setActiveIdx(i => (i + delta + slides.length) % slides.length)
    startAutoplay(slides.length)
  }

  return (
    <div className="bg-[var(--bg)] min-h-screen">

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
                style={{ backgroundImage: `url(${img(hero.cover)})`, filter: 'blur(30px) brightness(0.2) saturate(1.6)' }} />
              <div className="absolute inset-y-0 right-0 w-1/2 hidden md:block"
                style={{ backgroundImage: `url(${img(hero.cover)})`, backgroundSize: 'cover', backgroundPosition: 'center top' }} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f17] via-[#0f0f17]/85 to-[#0f0f17]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f17] via-transparent to-transparent" />

        <div className="relative z-10 h-full max-w-6xl mx-auto px-5 flex items-end pb-10">
          {hero ? (
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={activeIdx}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -40 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-end gap-6 w-full"
              >
                <Link to={mangaLink(hero.id)} className="hidden md:block flex-shrink-0">
                  <img src={img(hero.cover)} alt={hero.title}
                    className="w-32 rounded-xl shadow-2xl ring-1 ring-white/10 hover:scale-105 transition-transform"
                    style={{ aspectRatio: '2/3', objectFit: 'cover' }} loading="lazy" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame size={12} className="text-[#e8394d]" />
                    <span className="text-[10px] font-mono text-[#e8394d] tracking-widest uppercase">Trending</span>
                  </div>
                  <h1 className="font-display text-3xl md:text-5xl text-white mb-2 leading-tight line-clamp-2">{hero.title}</h1>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {hero.tags.map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-[#9ca3af] border border-white/10 font-body">{t}</span>
                    ))}
                  </div>
                  <p className="font-body text-[#6b7280] text-xs leading-relaxed max-w-lg mb-4 line-clamp-2">{hero.description}</p>
                  <div className="flex gap-3 items-center flex-wrap">
                    <Link to={mangaLink(hero.id)}
                      className="px-5 py-2 bg-[#e8394d] hover:bg-[#d42e42] text-white font-body text-sm rounded-lg transition-colors">
                      Read Now
                    </Link>
                    <Link to="/login" state={location.state}
                      className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white font-body text-sm rounded-lg transition-colors border border-white/10">
                      Sign In
                    </Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : !error ? (
            <div className="w-full space-y-3 animate-pulse">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-10 w-2/3 bg-white/10 rounded" />
              <div className="h-3 w-1/2 bg-white/5 rounded" />
            </div>
          ) : (
            <div className="w-full">
              <h1 className="font-display text-3xl md:text-5xl text-white mb-3">Welcome to MANGAVERSE</h1>
              <p className="font-body text-[#6b7280] text-sm mb-4">Sign in to start reading.</p>
              <div className="flex gap-3">
                <Link to="/login" className="px-5 py-2 bg-[#e8394d] hover:bg-[#d42e42] text-white font-body text-sm rounded-lg">Sign In</Link>
                <Link to="/register" className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white font-body text-sm rounded-lg border border-white/10">Register</Link>
              </div>
            </div>
          )}
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

      <div className="max-w-6xl mx-auto px-5 py-6 space-y-10">

        {/* Sign-up strip */}
        <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border border-white/10">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Lock size={15} className="text-primary" />
            </div>
            <p className="text-sm text-text-muted font-body">
              <span className="text-white font-semibold">Free account required.</span> Sign in or register to read chapters, build your list and follow series.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link to="/login" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-body font-semibold text-sm rounded-lg transition-all">Sign In</Link>
            <Link to="/register" className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-body text-sm rounded-lg border border-white/10 transition-colors">Register</Link>
          </div>
        </div>

        {/* Loading skeleton */}
        {!data && !error && (
          <div className="space-y-10">
            {[0, 1, 2].map(r => (
              <div key={r} className="flex gap-3 overflow-hidden">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[120px]">
                    <div className="animate-pulse bg-white/10 rounded-lg" style={{ aspectRatio: '2/3' }} />
                    <div className="mt-2 h-3 bg-white/5 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
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
            {/* LATEST UPDATES */}
            {data.latest.length > 0 && (
              <section>
                <SectionHeader title="Latest Updates" href="/browse?sort=latest" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/5">
                  {data.latest.map(item => (
                    <Link key={item.id} to={mangaLink(item.id)}
                      className="flex items-center gap-3 bg-[var(--surface)] hover:bg-[var(--card)] transition-colors px-3 py-2.5">
                      <div className="w-9 h-12 rounded overflow-hidden bg-white/10 flex-shrink-0">
                        {item.cover && <img src={img(item.cover)} alt={item.title} className="w-full h-full object-cover" loading="lazy" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#c9d1d9] font-body font-medium truncate">{item.title}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {item.chapters.map((ch, i) => (
                            <span key={i} className="flex items-center gap-2">
                              <span className="text-xs text-[#7c6af7] font-mono">
                                Ch. {ch.num || '?'}
                                {ch.title && <span className="text-[#4b5563] ml-1 font-body font-normal"> - {ch.title.slice(0, 20)}</span>}
                              </span>
                              <span className="text-[10px] text-[#4b5563] font-body">{timeAgo(ch.publishAt)}</span>
                            </span>
                          ))}
                        </div>
                        {item.group && (
                          <p className="text-[10px] text-[#4b5563] font-body mt-0.5 flex items-center gap-1">
                            <BookOpen size={9} /> {item.group}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <CardRow title="Recommended" items={data.recommended} href="/browse?sort=rating"
              icon={<Star size={14} className="text-[#f59e0b]" />} />
            <CardRow title={`Seasonal: ${new Date().getFullYear()}`} items={data.seasonal} href="/browse?sort=seasonal" />
            <CardRow title="Trending" items={data.trending} href="/trending" />
            <CardRow title="Recently Added" items={data.recentlyAdded} href="/browse?sort=newest" />
          </>
        )}
      </div>
    </div>
  )
}
