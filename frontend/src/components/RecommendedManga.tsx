// frontend/src/components/RecommendedManga.tsx
// Shows genre-based recommendations. Works for both local and MangaDex manga.
import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Star, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import axios from 'axios'

const MD = '/api/mangadex'

interface RecItem {
  id: string
  title: string
  cover: string
  year?: number
  slug?: string        // local only
  source: 'local' | 'mangadex'
}

interface Props {
  // For MangaDex manga — pass id + tags
  mangadexId?: string
  tags?: string[]        // genre tag IDs from MangaDex
  // For local manga — pass genres + currentId to exclude self
  localGenres?: string[]
  excludeId?: string
}

export default function RecommendedManga({ mangadexId, tags, localGenres, excludeId }: Props) {
  const [items, setItems] = useState<RecItem[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setItems([])

    if (mangadexId && tags && tags.length > 0) {
      fetchMangaDex()
    } else if (localGenres && localGenres.length > 0) {
      fetchLocal()
    } else {
      setLoading(false)
    }
  }, [mangadexId, tags?.join(','), localGenres?.join(',')])

  async function fetchMangaDex() {
    try {
      // Use top 3 genre tags to find similar manga
      const topTags = tags!.slice(0, 3)
      const params = new URLSearchParams()
      params.set('limit', '12')
      params.set('includes[]', 'cover_art')
      params.set('contentRating[]', 'safe')
      params.set('hasAvailableChapters', 'true')
      params.set('order[followedCount]', 'desc')
      topTags.forEach(t => params.append('includedTags[]', t))

      const res = await axios.get(`${MD}/manga?${params}`)
      const data = res.data.data || []

      setItems(
        data
          .filter((m: any) => m.id !== mangadexId) // exclude current
          .slice(0, 10)
          .map((m: any) => {
            const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
            const cover = coverRel?.attributes?.fileName
              ? `/api/proxy/image?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg`)}` 
              : ''
            return {
              id: m.id,
              title: m.attributes.title?.en || Object.values(m.attributes.title)[0] || 'Unknown',
              cover,
              year: m.attributes.year,
              source: 'mangadex' as const,
            }
          })
      )
    } catch {} finally {
      setLoading(false)
    }
  }

  async function fetchLocal() {
    try {
      // Search local DB for manga with matching genres
      const res = await axios.get('/api/local-manga', {
        params: { limit: 20 },
      })
      const all = res.data.manga || res.data || []
      const filtered = all
        .filter((m: any) => {
          if (excludeId && m._id === excludeId) return false
          const mGenres: string[] = m.genres || []
          return mGenres.some(g => localGenres!.includes(g))
        })
        .sort((a: any, b: any) => {
          // Sort by number of matching genres
          const aMatch = (a.genres || []).filter((g: string) => localGenres!.includes(g)).length
          const bMatch = (b.genres || []).filter((g: string) => localGenres!.includes(g)).length
          return bMatch - aMatch
        })
        .slice(0, 10)
        .map((m: any) => ({
          id: m._id,
          title: m.title,
          cover: m.coverUrl || '',
          year: m.year,
          slug: m.slug,
          source: 'local' as const,
        }))

      setItems(filtered)
    } catch {} finally {
      setLoading(false)
    }
  }

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Star size={16} className="text-amber-400" />
          <span className="font-display text-sm text-white tracking-wide">MORE LIKE THIS</span>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-28">
              <div className="w-28 h-40 skeleton rounded-xl mb-2" />
              <div className="h-3 skeleton rounded w-20 mb-1" />
              <div className="h-3 skeleton rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-400" />
          <span className="font-display text-sm text-white tracking-wide">MORE LIKE THIS</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => scroll('left')}
            className="w-7 h-7 glass border border-white/10 rounded-lg flex items-center justify-center text-text-muted hover:text-text transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => scroll('right')}
            className="w-7 h-7 glass border border-white/10 rounded-lg flex items-center justify-center text-text-muted hover:text-text transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Scroll row */}
      <div ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {items.map(item => (
          <Link
            key={item.id}
            to={item.source === 'local' ? `/manga/${item.slug}` : `/manga/${item.id}`}
            className="flex-shrink-0 w-28 group"
          >
            {/* Cover */}
            <div className="w-28 h-40 rounded-xl overflow-hidden bg-white/5 border border-white/5 mb-2 relative">
              {item.cover
                ? <img src={item.cover} alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"  loading="lazy"/>
                : <div className="w-full h-full flex items-center justify-center">
                    <BookOpen size={24} className="text-text-muted opacity-30" />
                  </div>
              }

            </div>

            {/* Info */}
            <p className="text-xs font-body text-text group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {item.title}
            </p>
            {item.year && (
              <p className="text-[11px] font-body text-text-muted mt-0.5">{item.year}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}