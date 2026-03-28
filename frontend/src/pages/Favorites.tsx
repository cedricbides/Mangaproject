import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import axios from 'axios'
import type { Manga } from '@/types'
import MangaCard from '@/components/MangaCard'
import { GridSkeleton } from '@/components/Skeleton'
import { useAuth } from '@/context/AuthContext'

const MD = 'https://mangaproject.onrender.com/api/mangadex'

export default function Favorites() {
  const { user } = useAuth()
  const [manga, setManga] = useState<Manga[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !user.favorites?.length) return
    setLoading(true)
    const ids = user.favorites.map(id => `ids[]=${id}`).join('&')
    axios.get(`${MD}/manga?${ids}&includes[]=cover_art&limit=100`)
      .then(res => setManga(res.data.data))
      .finally(() => setLoading(false))
  }, [user])

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-5">
      <Heart size={48} className="text-primary mb-4 opacity-50" />
      <h2 className="font-display text-3xl text-white mb-2">Sign In to See Favorites</h2>
      <p className="font-body text-text-muted mb-6">Save manga you love and read them anytime.</p>
      <Link
        to="/login"
        className="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-body rounded-xl transition-all">
        Sign In
      </Link>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-5 pt-28 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Heart size={22} className="text-primary" fill="currentColor" />
        <h1 className="font-display text-4xl text-white tracking-wide">MY FAVORITES</h1>
        <span className="font-mono text-sm text-text-muted ml-2">({user.favorites?.length || 0})</span>
      </div>

      {loading
        ? <GridSkeleton count={12} />
        : manga.length === 0
          ? (
            <div className="text-center py-24">
              <Heart size={48} className="text-primary/30 mx-auto mb-4" />
              <p className="font-body text-text-muted">No favorites yet. Start saving manga!</p>
            </div>
          )
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {manga.map((m, i) => <MangaCard key={m.id} manga={m} index={i} />)}
            </div>
          )
      }
    </div>
  )
}