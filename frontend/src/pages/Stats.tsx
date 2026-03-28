import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { BookOpen, Clock, Star, TrendingUp, Calendar, Award, ArrowLeft } from 'lucide-react'
import axios from 'axios'

interface StatCard { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }

function Card({ label, value, sub, icon, color }: StatCard) {
  return (
    <div className="glass rounded-2xl p-5 border border-white/5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>{icon}</div>
      <p className="font-display text-3xl text-white font-bold">{value}</p>
      <p className="font-body text-sm text-text-muted mt-1">{label}</p>
      {sub && <p className="font-body text-xs text-text-muted/60 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Stats() {
  const { user } = useAuth()
  const [genreMap, setGenreMap] = useState<Record<string, number>>({})
  const [loadingGenres, setLoadingGenres] = useState(false)

  const history: any[] = user?.readingHistory ?? []
  const mdxHistory = history.filter(h => !h.isLocal)
  const uniqueManga = new Set(history.map(h => h.mangaId)).size
  const chaptersRead = history.length

  // Estimate reading time: avg 8 min per chapter
  const estimatedMinutes = chaptersRead * 8
  const hours = Math.floor(estimatedMinutes / 60)
  const mins = estimatedMinutes % 60
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  // Streak: consecutive days with reading activity
  const readingDays = new Set(history.map(h => new Date(h.updatedAt).toDateString()))
  const streak = readingDays.size

  // Recent activity by month
  const byMonth: Record<string, number> = {}
  history.forEach(h => {
    const key = new Date(h.updatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    byMonth[key] = (byMonth[key] || 0) + 1
  })
  const monthEntries = Object.entries(byMonth).slice(-6).reverse()

  // Top genres from MangaDex
  useEffect(() => {
    if (!mdxHistory.length) return
    setLoadingGenres(true)
    const mangaIds = [...new Set(mdxHistory.map(h => h.mangaId))].slice(0, 20)
    axios.get(`https://mangaproject.onrender.com/api/mangadex/manga?ids[]=${mangaIds.join('&ids[]=')}&limit=20`)
      .then(res => {
        const counts: Record<string, number> = {}
        for (const m of res.data.data) {
          const tags: any[] = m.attributes?.tags ?? []
          tags.forEach((t: any) => {
            const name = t.attributes?.name?.en
            if (name) counts[name] = (counts[name] || 0) + 1
          })
        }
        setGenreMap(counts)
      })
      .catch(() => {})
      .finally(() => setLoadingGenres(false))
  }, [user])

  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxGenreCount = topGenres[0]?.[1] ?? 1

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="font-body text-text-muted mb-4">Log in to see your reading stats.</p>
          <Link to="/login" className="px-5 py-2 bg-primary text-white rounded-xl font-body text-sm">Log in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-28 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/profile" className="p-2 glass rounded-xl text-text-muted hover:text-text transition-all"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="font-display text-3xl text-white tracking-wide">Reading Stats</h1>
          <p className="font-body text-sm text-text-muted">Your Mangaverse reading journey</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card label="Chapters Read" value={chaptersRead} icon={<BookOpen size={18} />} color="bg-primary/20 text-primary" />
        <Card label="Unique Series" value={uniqueManga} icon={<Star size={18} />} color="bg-amber-500/20 text-amber-400" />
        <Card label="Est. Read Time" value={timeStr} sub="~8 min/chapter" icon={<Clock size={18} />} color="bg-sky-500/20 text-sky-400" />
        <Card label="Days Active" value={streak} icon={<Calendar size={18} />} color="bg-green-500/20 text-green-400" />
      </div>

      {/* Top genres */}
      <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-primary" />
          <h2 className="font-display text-lg text-white">Favourite Genres</h2>
        </div>
        {loadingGenres ? (
          <div className="space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-6 bg-white/5 rounded-lg animate-pulse" />)}</div>
        ) : topGenres.length === 0 ? (
          <p className="font-body text-sm text-text-muted">Read more manga to see your genre breakdown!</p>
        ) : (
          <div className="space-y-3">
            {topGenres.map(([genre, count]) => (
              <div key={genre} className="flex items-center gap-3">
                <span className="font-body text-sm text-text w-28 flex-shrink-0">{genre}</span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${(count / maxGenreCount) * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-text-muted w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly activity */}
      {monthEntries.length > 0 && (
        <div className="glass rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-2 mb-5">
            <Award size={16} className="text-amber-400" />
            <h2 className="font-display text-lg text-white">Monthly Activity</h2>
          </div>
          <div className="space-y-2">
            {monthEntries.map(([month, count]) => (
              <div key={month} className="flex items-center gap-3">
                <span className="font-body text-sm text-text-muted w-24 flex-shrink-0">{month}</span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${Math.min((count / Math.max(...monthEntries.map(e => e[1]))) * 100, 100)}%` }} />
                </div>
                <span className="font-mono text-xs text-text-muted w-8 text-right">{count} ch</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {chaptersRead === 0 && (
        <div className="text-center py-16">
          <BookOpen size={40} className="text-white/10 mx-auto mb-4" />
          <p className="font-body text-text-muted">You haven't read any chapters yet.</p>
          <Link to="/browse" className="mt-4 inline-block text-primary text-sm hover:underline font-body">Start reading →</Link>
        </div>
      )}
    </div>
  )
}