import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, BookOpen, Loader2, TrendingUp, Clock } from 'lucide-react'
import axios from 'axios'

const MD_COVER = (mangaId: string, filename: string) =>
  `/api/proxy/image?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${mangaId}/${filename}.256.jpg`)}` 

interface Result {
  id: string
  title: string
  author: string
  cover: string
  slug?: string
  genres: string[]
  status: string
  source: 'local' | 'mangadex'
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [localResults, setLocalResults] = useState<Result[]>([])
  const [mdxResults, setMdxResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [focused, setFocused] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load recent searches
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mv_recent_searches') || '[]')
      setRecentSearches(saved.slice(0, 5))
    } catch {}
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setLocalResults([])
      setMdxResults([])
      setFocused(0)
    }
  }, [open])

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const saveRecent = (q: string) => {
    const updated = [q, ...recentSearches.filter(r => r !== q)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('mv_recent_searches', JSON.stringify(updated))
  }

  const allResults = [...localResults, ...mdxResults]

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, allResults.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === 'Enter' && allResults[focused]) {
        goToResult(allResults[focused])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, allResults, focused])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setLocalResults([]); setMdxResults([]); return }
    setLoading(true)
    try {
      // Parallel: local + MangaDex
      const [localRes, mdxRes] = await Promise.allSettled([
        axios.get(`/api/search?q=${encodeURIComponent(q)}&limit=4`),
        axios.get(`/api/mangadex/manga?title=${encodeURIComponent(q)}&limit=4&includes[]=cover_art&contentRating[]=safe&hasAvailableChapters=true`)
      ])

      if (localRes.status === 'fulfilled') {
        setLocalResults(localRes.value.data.local || [])
      }

      if (mdxRes.status === 'fulfilled') {
        const mdx = mdxRes.value.data.data || []
        setMdxResults(mdx.map((m: any) => {
          const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
          const cover = coverRel?.attributes?.fileName
            ? MD_COVER(m.id, coverRel.attributes.fileName)
            : ''
          const authorRel = m.relationships?.find((r: any) => r.type === 'author')
          return {
            id: m.id,
            title: m.attributes.title?.en || Object.values(m.attributes.title)[0] || 'Unknown',
            author: authorRel?.attributes?.name || '',
            cover,
            genres: (m.attributes.tags || []).filter((t: any) => t.attributes.group === 'genre').slice(0, 2).map((t: any) => t.attributes.name.en),
            status: m.attributes.status || '',
            source: 'mangadex' as const,
          }
        }))
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const goToResult = (r: Result) => {
    saveRecent(r.title)
    onClose()
    if (r.source === 'local') navigate(`/manga/${r.slug}`)
    else navigate(`/manga/mangadex/${r.id}`)
  }

  const goToSearch = (q: string) => {
    if (!q.trim()) return
    saveRecent(q)
    onClose()
    navigate(`/browse?q=${encodeURIComponent(q)}`)
  }

  if (!open) return null

  const hasResults = localResults.length > 0 || mdxResults.length > 0
  const showEmpty = query.length > 1 && !loading && !hasResults

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          {loading
            ? <Loader2 size={18} className="text-primary animate-spin flex-shrink-0" />
            : <Search size={18} className="text-text-muted flex-shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setFocused(0) }}
            onKeyDown={e => { if (e.key === 'Enter' && query && !allResults.length) goToSearch(query) }}
            placeholder="Search manga titles, authors…"
            className="flex-1 bg-transparent text-white text-sm font-body placeholder-text-muted outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setLocalResults([]); setMdxResults([]) }}
              className="text-text-muted hover:text-text transition-colors">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-body text-text-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">

          {/* Recent searches (no query) */}
          {!query && recentSearches.length > 0 && (
            <div className="p-3">
              <p className="text-[10px] font-body text-text-muted uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
                <Clock size={10} /> Recent
              </p>
              {recentSearches.map((r, i) => (
                <button key={i} onClick={() => { setQuery(r) }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all text-left group">
                  <Search size={13} className="text-text-muted" />
                  <span className="text-sm font-body text-text-muted group-hover:text-text transition-colors">{r}</span>
                </button>
              ))}
            </div>
          )}

          {/* No query, no recent */}
          {!query && recentSearches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp size={20} className="text-primary" />
              </div>
              <p className="text-sm font-body text-text-muted">Search across local manga and MangaDex</p>
            </div>
          )}

          {/* Local results */}
          {localResults.length > 0 && (
            <div className="p-3">
              <p className="text-[10px] font-body text-text-muted uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
                <BookOpen size={10} /> Local Library
              </p>
              {localResults.map((r, i) => (
                <ResultRow key={r.id} result={r} focused={focused === i}
                  onHover={() => setFocused(i)} onClick={() => goToResult(r)} />
              ))}
            </div>
          )}

          {/* MangaDex results */}
          {mdxResults.length > 0 && (
            <div className="p-3 border-t border-white/5">
              <p className="text-[10px] font-body text-text-muted uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> MangaDex
              </p>
              {mdxResults.map((r, i) => (
                <ResultRow key={r.id} result={r} focused={focused === localResults.length + i}
                  onHover={() => setFocused(localResults.length + i)} onClick={() => goToResult(r)} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <p className="text-sm font-body text-text-muted">No results for <span className="text-white">"{query}"</span></p>
            </div>
          )}

          {/* Browse all footer */}
          {query && hasResults && (
            <button onClick={() => goToSearch(query)}
              className="w-full flex items-center justify-center gap-2 py-3 border-t border-white/5 text-xs font-body text-primary hover:bg-primary/5 transition-all">
              <Search size={12} />
              Browse all results for "{query}"
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultRow({ result, focused, onHover, onClick }: {
  result: Result
  focused: boolean
  onHover: () => void
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${focused ? 'bg-white/10' : 'hover:bg-white/5'}`}
    >
      {/* Cover */}
      <div className="w-9 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
        {result.cover
          ? <img src={result.cover} alt={result.title} className="w-full h-full object-cover"  loading="lazy"/>
          : <div className="w-full h-full flex items-center justify-center"><BookOpen size={14} className="text-text-muted" /></div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-body text-white truncate font-medium">{result.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {result.author && <span className="text-[11px] font-body text-text-muted truncate">{result.author}</span>}
          {result.genres.slice(0, 1).map(g => (
            <span key={g} className="text-[10px] font-body text-text-muted bg-white/5 px-1.5 py-0.5 rounded-md">{g}</span>
          ))}
        </div>
      </div>

      {/* Source badge */}
      <span className={`text-[10px] font-body px-2 py-0.5 rounded-full flex-shrink-0 ${
        result.source === 'local'
          ? 'bg-primary/15 text-primary'
          : 'bg-orange-400/15 text-orange-400'
      }`}>
        {result.source === 'local' ? 'Local' : 'MDX'}
      </span>
    </button>
  )
}