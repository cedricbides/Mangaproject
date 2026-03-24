import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle, Clock, XCircle, PauseCircle, Trash2 } from 'lucide-react'
import { useReadingList, type ReadingStatus, type ReadingEntry } from '@/hooks/useReadingList'
import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router-dom'
import axios from 'axios'

const STATUS_CONFIG: Record<ReadingStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  reading:      { label: 'Reading',      icon: BookOpen,     color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  completed:    { label: 'Completed',    icon: CheckCircle,  color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  plan_to_read: { label: 'Plan to Read', icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  on_hold:      { label: 'On Hold',      icon: PauseCircle,  color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  dropped:      { label: 'Dropped',      icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
}

const STATUS_ORDER: ReadingStatus[] = ['reading', 'plan_to_read', 'completed', 'on_hold', 'dropped']

interface MangaInfo {
  id: string
  title: string
  cover: string
}

function MangaCard({ entry, onRemove }: { entry: ReadingEntry; onRemove: () => void }) {
  const [manga, setManga] = useState<MangaInfo | null>(null)

  useEffect(() => {
    // Fetch manga info from MangaDex
    axios.get(`/api/mangadex/manga/${entry.mangaId}?includes[]=cover_art`)
      .then(res => {
        const data = res.data.data
        const title = data.attributes.title.en || Object.values(data.attributes.title)[0] || 'Unknown'
        const cover = data.relationships.find((r: any) => r.type === 'cover_art')
        const fileName = cover?.attributes?.fileName
        const coverUrl = fileName
          ? `/api/proxy/image?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${entry.mangaId}/${fileName}.256.jpg`)}` 
          : '/no-cover.png'
        setManga({ id: entry.mangaId, title: title as string, cover: coverUrl })
      })
      .catch(() => setManga({ id: entry.mangaId, title: 'Unknown Manga', cover: '/no-cover.png' }))
  }, [entry.mangaId])

  return (
    <div className="relative group flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
      <Link to={`/manga/${entry.mangaId}`} className="flex items-center gap-3 flex-1 min-w-0">
        <img
          src={manga?.cover || '/no-cover.png'}
          alt={manga?.title}
          className="w-12 h-16 object-cover rounded-lg flex-shrink-0 bg-white/5"
         loading="lazy"/>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text truncate">
            {manga?.title || 'Loading...'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {new Date(entry.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </Link>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function MyList() {
  const { list, setStatus, loading } = useReadingList()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<ReadingStatus>('reading')

  const grouped = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = list.filter(e => e.status === status)
    return acc
  }, {} as Record<ReadingStatus, ReadingEntry[]>)

  const activeList = grouped[activeTab] || []

  return (
    <div className="min-h-screen bg-bg pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-display font-bold text-text">My Reading List</h1>
          <p className="text-text-muted text-sm mt-1">
            {list.length} manga tracked
            {!user && (
              <span className="ml-2 text-yellow-400">
                · <Link to="/login" className="underline">Log in</Link> to sync across devices
              </span>
            )}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_ORDER.map(status => {
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon
            const count = grouped[status]?.length || 0
            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body border transition-all ${
                  activeTab === status
                    ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                    : 'bg-white/5 border-white/10 text-text-muted hover:text-text hover:border-white/20'
                }`}
              >
                <Icon size={14} />
                {cfg.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === status ? cfg.bg : 'bg-white/10'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : activeList.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p>No manga in {STATUS_CONFIG[activeTab].label} yet</p>
            <Link to="/browse" className="mt-3 inline-block text-sm text-primary hover:underline">
              Browse manga →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeList.map(entry => (
              <MangaCard
                key={entry.mangaId}
                entry={entry}
                onRemove={() => setStatus(entry.mangaId, null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}