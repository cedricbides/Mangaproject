import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, Grid3X3, List, TrendingUp, Star, BookOpen, Zap } from 'lucide-react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import type { Manga, LocalManga } from '@/types'
import { getCoverUrl, getMangaTitle, getMangaTags } from '@/utils/manga'
import { GridSkeleton } from '@/components/Skeleton'
import { motion } from 'framer-motion'
import { QK, fetchLocalManga } from '@/utils/queries'

const MD = 'https://mangaproject.onrender.com/api/mangadex'

const ALL_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Thriller',
  'Psychological', 'Historical', 'Supernatural', 'Isekai', 'Mecha', 'Music',
]


// MangaDex tag UUIDs for genre filtering
const MD_TAG_IDS: Record<string, string> = {
  'Action':        '391b0423-d847-456f-aff0-8b0cfc03066b',
  'Adventure':     '87cc87cd-a395-47af-b27a-93258283bbc6',
  'Comedy':        '4d32cc48-9f00-4cca-9b5a-a839f0764984',
  'Drama':         'b9af3a63-f058-46de-a9a0-e0c13906197a',
  'Fantasy':       'cdc58593-87dd-415e-bbc0-2ec27bf404cc',
  'Horror':        'cdad7e68-1419-41dd-bdce-27753074a640',
  'Mystery':       'ee968100-4191-4968-93d3-f82d72be7e46',
  'Romance':       '423e2eae-a7a2-4a8b-ac03-a8351462d71d',
  'Sci-Fi':        '256c8bd9-4904-4360-bf4f-508a76d67183',
  'Slice of Life': 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
  'Sports':        '69964a64-2f90-4d33-beeb-e3bdcec0025e',
  'Thriller':      '07251805-a27e-4d59-b488-f0bfbec15168',
  'Psychological': '3b60b75c-a2d7-4860-ab56-05f391bb889c',
  'Historical':    '33771934-028e-4cb3-8744-691e866a923e',
  'Supernatural':  'eabc5b4c-6aff-42f3-b657-3e90cbd00b75',
  'Isekai':        'ace04997-f6bd-436e-b261-779182193d3d',
  'Mecha':         'e89d3473-e5f8-40ec-b6c0-7b43e4a65de4',
  'Music':         'f42fbf9e-188a-46cb-be14-8e4d534a66f8',
}


const STATUS_COLORS: Record<string, string> = {
  ongoing: 'text-green-400 bg-green-400/10',
  completed: 'text-blue-400 bg-blue-400/10',
  hiatus: 'text-yellow-400 bg-yellow-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
}

type ViewMode = 'grid' | 'list'
type SortMode = 'popular' | 'latest' | 'newest' | 'az'

export default function Catalog() {
  const [mdManga, setMdManga] = useState<Manga[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [sort, setSort] = useState<SortMode>('popular')
  const [view, setView] = useState<ViewMode>('grid')
  const [activeTab, setActiveTab] = useState<'all' | 'local'>('all')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 500)
    return () => clearTimeout(t)
  }, [query])

  // Local manga cached
  const { data: localMangaRaw = [] } = useQuery({ queryKey: QK.localManga(), queryFn: fetchLocalManga })
  const localManga: LocalManga[] = localMangaRaw as LocalManga[]

  // Build query string for cache key
  const qp = new URLSearchParams()
  qp.set('limit', '24'); qp.set('offset', String(page * 24))
  qp.set('includes[]', 'cover_art'); qp.set('contentRating[]', 'safe'); qp.set('hasAvailableChapters', 'true')
  if (debouncedQuery) qp.set('title', debouncedQuery)
  if (selectedStatus) qp.set('status[]', selectedStatus)
  if (selectedGenre && MD_TAG_IDS[selectedGenre]) qp.set('includedTags[]', MD_TAG_IDS[selectedGenre])
  if (sort === 'latest') qp.set('order[latestUploadedChapter]', 'desc')
  else if (sort === 'newest') qp.set('order[createdAt]', 'desc')
  else if (sort === 'az') qp.set('order[title]', 'asc')
  else qp.set('order[followedCount]', 'desc')

  const { data: catalogData, isLoading: loading } = useQuery({
    queryKey: QK.catalog(qp.toString()),
    queryFn: async () => { const res = await axios.get(`${MD}/manga?${qp}`); return { data: res.data.data, total: res.data.total } },
    placeholderData: (prev: any) => prev,
  })

  useEffect(() => { if (catalogData) { setMdManga(catalogData.data); setTotal(catalogData.total) } }, [catalogData])

  const handlePageChange = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const filteredLocal = localManga.filter(m =>
    (!query || m.title.toLowerCase().includes(query.toLowerCase())) &&
    (!selectedStatus || m.status === selectedStatus) &&
    (!selectedGenre || m.genres.includes(selectedGenre))
  )

  return (
    <div className="max-w-7xl mx-auto px-5 pt-28 pb-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={22} className="text-primary" />
          <h1 className="font-display text-4xl text-white tracking-wide">MANGA CATALOG</h1>
        </div>
        <p className="font-body text-text-muted text-sm">
          Thousands of titles from MangaDex + exclusive releases
        </p>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-2 mb-6">
        {[['all', 'All Manga', TrendingUp], ['local', 'Site Exclusives', Star]].map(([tab, label, Icon]: any) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-body transition-all ${
              activeTab === tab
                ? 'bg-primary text-white shadow-[0_0_20px_rgba(232,57,77,0.3)]'
                : 'glass text-text-muted hover:text-text'
            }`}>
            <Icon size={14} />
            {label}
            {tab === 'local' && localManga.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500/30 text-amber-400 text-xs rounded-full">
                {localManga.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search & Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 flex items-center gap-2 glass rounded-xl px-4 py-2.5">
          <Search size={15} className="text-text-muted flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title..."
            className="bg-transparent text-sm text-text placeholder-text-muted outline-none flex-1 font-body"
          />
          {query && <button onClick={() => setQuery('')}><X size={14} className="text-text-muted" /></button>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(v => v === 'grid' ? 'list' : 'grid')}
            className="p-2.5 glass rounded-xl text-text-muted hover:text-text transition-colors">
            {view === 'grid' ? <List size={16} /> : <Grid3X3 size={16} />}
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Sort */}
        <div className="flex items-center gap-1.5 glass rounded-xl px-3 py-2">
          <Zap size={12} className="text-text-muted" />
          {([['popular', 'Popular'], ['latest', 'Latest'], ['newest', 'Newest'], ['az', 'A–Z']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setSort(v)}
              className={`text-xs font-body px-2.5 py-1 rounded-lg transition-colors ${sort === v ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          {(['', 'ongoing', 'completed', 'hiatus'] as const).map((s) => (
            <button key={s} onClick={() => setSelectedStatus(s === selectedStatus ? '' : s)}
              className={`text-xs font-body px-3 py-1.5 rounded-xl border transition-colors capitalize ${
                selectedStatus === s && s !== ''
                  ? 'bg-primary/20 border-primary/40 text-primary'
                  : 'glass border-white/10 text-text-muted hover:text-text'
              } ${s === '' ? 'hidden' : ''}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Genre pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button onClick={() => setSelectedGenre('')}
          className={`text-xs font-body px-3 py-1.5 rounded-full border transition-colors ${
            !selectedGenre ? 'bg-primary/20 border-primary/40 text-primary' : 'glass border-white/10 text-text-muted hover:text-text'
          }`}>
          All Genres
        </button>
        {ALL_GENRES.map(g => (
          <button key={g} onClick={() => setSelectedGenre(selectedGenre === g ? '' : g)}
            className={`text-xs font-body px-3 py-1.5 rounded-full border transition-colors ${
              selectedGenre === g ? 'bg-accent/20 border-accent/40 text-accent' : 'glass border-white/10 text-text-muted hover:text-text'
            }`}>
            {g}
          </button>
        ))}
      </div>

      {/* Results */}
      {activeTab === 'local' ? (
        <div>
          <p className="text-sm text-text-muted font-body mb-4">{filteredLocal.length} exclusive titles</p>
          {filteredLocal.length === 0 ? (
            <div className="text-center py-24">
              <BookOpen size={48} className="text-text-muted mx-auto mb-4 opacity-30" />
              <p className="font-body text-text-muted">No exclusive manga yet. Check back soon!</p>
            </div>
          ) : (
            <div className={view === 'grid'
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              : "flex flex-col gap-3"}>
              {filteredLocal.map((m, i) => (
                <LocalMangaCard key={m._id} manga={m} index={i} view={view} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-text-muted font-body mb-4">{total.toLocaleString()} titles found</p>
          {loading
            ? <GridSkeleton count={24} />
            : <>
                {view === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {mdManga.map((m, i) => <MDMangaCard key={m.id} manga={m} index={i} />)}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {mdManga.map((m, i) => <MDMangaListCard key={m.id} manga={m} index={i} />)}
                  </div>
                )}
                {mdManga.length === 0 && (
                  <div className="text-center py-24">
                    <p className="font-body text-text-muted">No manga found.</p>
                    <button onClick={() => { setQuery(''); setSelectedGenre(''); setSelectedStatus('') }}
                      className="mt-4 text-primary text-sm hover:underline">Clear filters</button>
                  </div>
                )}
                {/* Pagination */}
                {total > 24 && (
                  <div className="flex justify-center gap-2 mt-10">
                    <button onClick={() => handlePageChange(Math.max(0, page - 1))} disabled={page === 0}
                      className="px-4 py-2 glass rounded-xl text-sm font-body text-text-muted disabled:opacity-30 hover:text-text transition-colors">
                      ← Prev
                    </button>
                    {Array.from({ length: Math.min(7, Math.ceil(total / 24)) }, (_, i) => i + Math.max(0, page - 3)).filter(p => p < Math.ceil(total / 24)).map(p => (
                      <button key={p} onClick={() => handlePageChange(p)}
                        className={`w-9 h-9 rounded-xl text-sm font-body transition-colors ${page === p ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
                        {p + 1}
                      </button>
                    ))}
                    <button onClick={() => handlePageChange(page + 1)} disabled={(page + 1) * 24 >= total}
                      className="px-4 py-2 glass rounded-xl text-sm font-body text-text-muted disabled:opacity-30 hover:text-text transition-colors">
                      Next →
                    </button>
                  </div>
                )}
              </>
          }
        </>
      )}
    </div>
  )
}

function MDMangaCard({ manga, index }: { manga: Manga; index: number }) {
  const cover = getCoverUrl(manga, 256)
  const title = getMangaTitle(manga)
  const tags = getMangaTags(manga).slice(0, 2)
  const status = manga.attributes.status

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Link to={`/manga/${manga.id}`} className="block group">
        <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '2/3' }}>
          <img src={cover} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-body capitalize ${STATUS_COLORS[status] || 'text-gray-400 bg-gray-400/10'}`}>
            {status}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <div className="flex flex-wrap gap-1">
              {tags.map(t => <span key={t} className="text-xs px-2 py-0.5 bg-white/10 text-white rounded-full font-body">{t}</span>)}
            </div>
          </div>
        </div>
        <div className="mt-2 px-1">
          <p className="font-body text-sm text-text line-clamp-2 group-hover:text-primary transition-colors">{title}</p>
        </div>
      </Link>
    </motion.div>
  )
}

function MDMangaListCard({ manga, index }: { manga: Manga; index: number }) {
  const cover = getCoverUrl(manga, 256)
  const title = getMangaTitle(manga)
  const tags = getMangaTags(manga).slice(0, 3)
  const desc = manga.attributes.description?.en || ''
  const status = manga.attributes.status

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }}>
      <Link to={`/manga/${manga.id}`} className="flex gap-4 glass rounded-2xl p-4 hover:border-primary/20 border border-transparent transition-all group">
        <img src={cover} alt={title} className="w-16 h-24 rounded-xl object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-body text-base text-text group-hover:text-primary transition-colors line-clamp-1">{title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 font-body ${STATUS_COLORS[status] || ''}`}>{status}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {tags.map(t => <span key={t} className="text-xs px-2 py-0.5 bg-white/5 text-text-muted rounded-full font-body">{t}</span>)}
          </div>
          <p className="text-xs text-text-muted font-body mt-2 line-clamp-2">{desc}</p>
        </div>
      </Link>
    </motion.div>
  )
}

function LocalMangaCard({ manga, index, view }: { manga: LocalManga; index: number; view: ViewMode }) {
  if (view === 'list') {
    return (
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }}>
        <Link to={`/local/${manga._id}`} className="flex gap-4 glass rounded-2xl p-4 hover:border-primary/20 border border-transparent transition-all group">
          <img src={manga.coverUrl} alt={manga.title} className="w-16 h-24 rounded-xl object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-body text-base text-text group-hover:text-primary transition-colors line-clamp-1">{manga.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 font-body ${STATUS_COLORS[manga.status] || ''}`}>{manga.status}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {manga.genres.slice(0, 3).map(g => <span key={g} className="text-xs px-2 py-0.5 bg-white/5 text-text-muted rounded-full font-body">{g}</span>)}
            </div>
            <p className="text-xs text-text-muted font-body mt-2 line-clamp-2">{manga.description}</p>
          </div>
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Link to={`/local/${manga._id}`} className="block group">
        <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '2/3' }}>
          <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500/90 text-black text-xs font-bold rounded-full">NEW</div>
          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-body capitalize ${STATUS_COLORS[manga.status] || ''}`}>
            {manga.status}
          </div>
        </div>
        <div className="mt-2 px-1">
          <p className="font-body text-sm text-text line-clamp-2 group-hover:text-primary transition-colors">{manga.title}</p>
        </div>
      </Link>
    </motion.div>
  )

}