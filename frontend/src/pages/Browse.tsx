import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { QK, fetchBrowse } from '@/utils/queries'
import type { Manga } from '@/types'
import MangaCard from '@/components/MangaCard'
import { GridSkeleton } from '@/components/Skeleton'

const GENRES = [
  'Action','Adventure','Comedy','Drama','Fantasy','Horror','Mystery',
  'Romance','Sci-Fi','Slice of Life','Sports','Thriller','Psychological',
  'Historical','Mecha','Music','Cooking','Medical','Survival','Isekai',
]
const DEMOGRAPHICS = ['shounen','shoujo','seinen','josei','none']
const FORMATS      = ['manga','manhwa','manhua','novel','one-shot','doujinshi']
const STATUSES     = ['ongoing','completed','hiatus','cancelled']

export default function Browse() {
  const [params, setParams] = useSearchParams()

  const query  = params.get('q') || ''
  const status = params.get('status') || ''
  const sort   = params.get('sort') || 'popular'
  const demog  = params.get('demographic') || ''
  const format = params.get('format') || ''
  const selectedGenres = params.get('genres') ? params.get('genres')!.split(',').filter(Boolean) : []
  const activeFilterCount = [status, demog, format].filter(Boolean).length + selectedGenres.length

  // Build query string for cache key
  const qp = new URLSearchParams()
  qp.set('limit', '24')
  qp.set('offset', '0')
  qp.set('includes[]', 'cover_art')
  qp.set('contentRating[]', 'safe')
  qp.set('hasAvailableChapters', 'true')
  if (query)  qp.set('title', query)
  if (status) qp.set('status[]', status)
  if (demog)  qp.set('publicationDemographic[]', demog)
  if (format) qp.append('includedTags[]', format)
  selectedGenres.forEach(g => qp.append('includedTags[]', g))
  if (sort === 'latest')  qp.set('order[latestUploadedChapter]', 'desc')
  else if (sort === 'newest') qp.set('order[createdAt]', 'desc')
  else if (sort === 'az') qp.set('order[title]', 'asc')
  else qp.set('order[followedCount]', 'desc')

  const queryString = qp.toString()

  // react-query — cached for 5 min, same params = no refetch
  const { data, isLoading } = useQuery({
    queryKey: QK.browse(queryString),
    queryFn: () => fetchBrowse(queryString),
    placeholderData: (prev) => prev, // keep old data while loading new
  })

  const manga: Manga[] = data?.data || []
  const total: number  = data?.total || 0

  const toggleGenre = (g: string) => {
    const next = new URLSearchParams(params)
    const current = selectedGenres.includes(g)
      ? selectedGenres.filter(x => x !== g)
      : [...selectedGenres, g]
    if (current.length) next.set('genres', current.join(','))
    else next.delete('genres')
    setParams(next)
  }

  const setParam = (key: string, val: string) => {
    const next = new URLSearchParams(params)
    if (val) next.set(key, val); else next.delete(key)
    setParams(next)
  }

  const clearFilters = () => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (sort !== 'popular') next.set('sort', sort)
    setParams(next)
  }

  return (
    <div className="max-w-7xl mx-auto px-5 pt-28 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-white tracking-wide mb-2">BROWSE MANGA</h1>
        <p className="font-body text-text-muted text-sm">{total.toLocaleString()} titles found</p>
      </div>

      {/* Search + filter toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 glass rounded-xl px-4 py-2.5">
          <Search size={15} className="text-text-muted flex-shrink-0" />
          <input value={query} onChange={e => setParam('q', e.target.value)}
            placeholder="Search by title..."
            className="bg-transparent text-sm text-text placeholder-text-muted outline-none flex-1 font-body" />
          {query && <button onClick={() => setParam('q', '')}><X size={14} className="text-text-muted" /></button>}
        </div>
        <button onClick={() => setParam('showFilters', params.get('showFilters') ? '' : '1')}
          className={`flex items-center gap-2 px-4 py-2.5 glass rounded-xl text-sm font-body transition-colors ${params.get('showFilters') ? 'text-primary border-primary/40' : 'text-text-muted'}`}>
          <SlidersHorizontal size={15} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded-full font-mono">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {params.get('showFilters') && (
        <div className="glass rounded-2xl p-5 mb-6 space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <p className="font-mono text-xs text-text-muted mb-2 tracking-widest">SORT BY</p>
              <div className="flex flex-wrap gap-2">
                {[['popular','Popular'],['latest','Latest'],['newest','Newest'],['az','A–Z']].map(([v,l]) => (
                  <button key={v} onClick={() => setParam('sort', v)}
                    className={`badge border transition-colors ${sort === v ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-text-muted hover:text-text'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-xs text-text-muted mb-2 tracking-widest">STATUS</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => setParam('status', status === s ? '' : s)}
                    className={`badge border transition-colors capitalize ${status === s ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-text-muted hover:text-text'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-xs text-text-muted mb-2 tracking-widest">DEMOGRAPHIC</p>
              <div className="flex flex-wrap gap-2">
                {DEMOGRAPHICS.map(d => (
                  <button key={d} onClick={() => setParam('demographic', demog === d ? '' : d)}
                    className={`badge border transition-colors capitalize ${demog === d ? 'bg-accent/20 border-accent/50 text-accent' : 'bg-white/5 border-white/10 text-text-muted hover:text-text'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-xs text-text-muted mb-2 tracking-widest">FORMAT</p>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(f => (
                  <button key={f} onClick={() => setParam('format', format === f ? '' : f)}
                    className={`badge border transition-colors capitalize ${format === f ? 'bg-violet-400/20 border-violet-400/50 text-violet-400' : 'bg-white/5 border-white/10 text-text-muted hover:text-text'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-xs text-text-muted tracking-widest">GENRES <span className="text-primary">(multi-select)</span></p>
              {selectedGenres.length > 0 && (
                <button onClick={() => { const n = new URLSearchParams(params); n.delete('genres'); setParams(n) }}
                  className="text-xs text-text-muted hover:text-red-400 transition-colors">clear genres</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => {
                const active = selectedGenres.includes(g)
                return (
                  <button key={g} onClick={() => toggleGenre(g)}
                    className={`badge border transition-colors ${active ? 'bg-accent/20 border-accent/50 text-accent' : 'bg-white/5 border-white/10 text-text-muted hover:text-text'}`}>
                    {active && <span className="mr-1">✓</span>}{g}
                  </button>
                )
              })}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-red-400 hover:text-red-300 transition-colors font-body">
              ✕ Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {isLoading
        ? <GridSkeleton count={24} />
        : <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {manga.map((m, i) => <MangaCard key={m.id} manga={m} index={i} />)}
            </div>
            {manga.length === 0 && (
              <div className="text-center py-24">
                <p className="font-body text-text-muted text-lg">No manga found.</p>
                <button onClick={clearFilters} className="mt-4 text-primary text-sm hover:underline">Clear filters</button>
              </div>
            )}
          </>
      }
    </div>
  )
}