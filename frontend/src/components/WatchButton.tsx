import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

interface Props {
  mangaId: string
}

export default function WatchButton({ mangaId }: Props) {
  const { user } = useAuth()
  const [watching, setWatching] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    axios.get(`/api/social/watch/${mangaId}`, { withCredentials: true })
      .then(res => setWatching(res.data.watching))
      .catch(() => {})
  }, [user, mangaId])

  const toggle = async () => {
    if (!user) { window.location.href = '/login'; return }
    setLoading(true)
    try {
      const res = await axios.post(`/api/social/watch/${mangaId}`, {}, { withCredentials: true })
      setWatching(res.data.watching)
    } catch {} finally { setLoading(false) }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={watching ? 'Stop notifications' : 'Get notified when new chapters drop'}
      className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-body border transition-all disabled:opacity-50 ${
        watching
          ? 'bg-primary/20 border-primary/40 text-primary'
          : 'glass border-white/10 text-text-muted hover:border-primary/30 hover:text-text'
      }`}
    >
      {watching ? <Bell size={15} fill="currentColor" /> : <Bell size={15} />}
      {watching ? 'Watching' : 'Watch'}
    </button>
  )
}