import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, Clock, BookOpen, Star, List, Lock, Globe, Clock3, UserPlus, UserCheck, Users } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'
import type { Manga } from '@/types'
import { getCoverUrl, getMangaTitle } from '@/utils/manga'

const MD = 'https://mangaproject.onrender.com/api/mangadex'

const DEFAULT_CAT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1e1e30"/><stop offset="100%" stop-color="#0d0d14"/></radialGradient><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e8394d" stop-opacity="0.2"/><stop offset="100%" stop-color="#e8394d" stop-opacity="0"/></radialGradient><clipPath id="circ"><circle cx="100" cy="100" r="100"/></clipPath></defs><circle cx="100" cy="100" r="100" fill="url(#bg)"/><circle cx="100" cy="120" r="75" fill="url(#glow)"/><g clip-path="url(#circ)"><rect x="52" y="158" width="96" height="50" fill="#e8900a"/><ellipse cx="100" cy="158" rx="48" ry="20" fill="#e8900a"/><path d="M 52 165 Q 20 160 18 185 Q 16 200 38 198 Q 50 196 55 185" fill="#e8900a"/><path d="M 22 178 Q 18 185 22 190" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M 24 188 Q 20 193 25 196" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="110" rx="42" ry="40" fill="#f0a012"/><polygon points="68,80 58,55 85,74" fill="#f0a012"/><polygon points="132,80 142,55 115,74" fill="#f0a012"/><polygon points="72,78 64,60 84,74" fill="#c06a20" opacity="0.5"/><polygon points="128,78 136,60 116,74" fill="#c06a20" opacity="0.5"/><path d="M 82 108 Q 87 104 92 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 108 108 Q 113 104 118 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 87 113 Q 87 119 92 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M 113 113 Q 113 119 108 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="100" cy="122" r="3" fill="#7a4a00"/><path d="M 100 125 Q 96 130 100 132 Q 104 130 100 125" fill="#7a4a00"/><ellipse cx="80" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/><ellipse cx="120" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/></g><circle cx="100" cy="100" r="97" fill="none" stroke="#e8394d" stroke-width="1.5" opacity="0.4"/></svg>')}`

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
  admin:       'bg-red-500/20 border-red-500/30 text-red-400',
  moderator:   'bg-blue-500/20 border-blue-500/30 text-blue-400',
}

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>()
  const { user: me, isStaff } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<'favorites' | 'lists' | 'history'>('favorites')

  // Manga data
  const [favManga, setFavManga]         = useState<Manga[]>([])
  const [historyManga, setHistoryManga] = useState<Manga[]>([])
  const [lists, setLists]               = useState<any[]>([])
  const [listManga, setListManga]       = useState<Record<string, Manga[]>>({})
  const [loadingFavs, setLoadingFavs]       = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingLists, setLoadingLists]     = useState(false)

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)

  // Redirect own profile to /profile
  const isOwn = me?.id === userId

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    axios.get(`/api/auth/user/${userId}`, { withCredentials: true })
      .then(r => {
        setProfile(r.data)
        setIsFollowing(r.data.isFollowing || false)
        setFollowerCount(r.data.followerCount || 0)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [userId])

  // Load favorites
  useEffect(() => {
    if (!profile?.favorites?.length) return
    setLoadingFavs(true)
    const ids = profile.favorites.slice(0, 20)
    axios.get(`${MD}/manga?${ids.map((id: string) => `ids[]=${id}`).join('&')}&includes[]=cover_art&limit=20`)
      .then(r => setFavManga(r.data.data))
      .finally(() => setLoadingFavs(false))
  }, [profile])

  // Load history (staff only — backend already filters, but we check too)
  useEffect(() => {
    if (activeTab !== 'history' || !profile?.readingHistory?.length) return
    setLoadingHistory(true)
    const ids = [...new Set(profile.readingHistory.map((h: any) => h.mangaId))].slice(0, 20) as string[]
    axios.get(`${MD}/manga?${ids.map(id => `ids[]=${id}`).join('&')}&includes[]=cover_art&limit=20`)
      .then(r => setHistoryManga(r.data.data))
      .finally(() => setLoadingHistory(false))
  }, [activeTab, profile])

  // Load public lists
  useEffect(() => {
    if (activeTab !== 'lists' || !userId) return
    setLoadingLists(true)
    axios.get(`/api/lists/user/${userId}`)
      .then(r => {
        setLists(r.data)
        r.data.forEach((list: any) => {
          if (list.mangaIds.length > 0 && !listManga[list._id]) {
            const ids = list.mangaIds.slice(0, 20)
            axios.get(`${MD}/manga?${ids.map((id: string) => `ids[]=${id}`).join('&')}&includes[]=cover_art&limit=20`)
              .then(res => setListManga(prev => ({ ...prev, [list._id]: res.data.data })))
              .catch(() => {})
          }
        })
      })
      .finally(() => setLoadingLists(false))
  }, [activeTab, userId])

  const toggleFollow = async () => {
    if (!me) return window.location.href = '/login'
    setFollowLoading(true)
    try {
      const res = await axios.post(`/api/social/follow/${userId}`, {}, { withCredentials: true })
      setIsFollowing(res.data.following)
      setFollowerCount(res.data.followerCount)
    } catch {}
    setFollowLoading(false)
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto pb-16 animate-pulse">
      <div className="h-52 bg-white/5 rounded-b-2xl" />
      <div className="px-5 mt-4 space-y-3">
        <div className="h-24 w-24 rounded-2xl bg-white/5" />
        <div className="h-6 w-48 rounded-xl bg-white/5" />
      </div>
    </div>
  )

  if (notFound) return (
    <div className="max-w-5xl mx-auto px-5 py-32 text-center">
      <p className="font-display text-2xl text-white mb-2">User not found</p>
      <p className="font-body text-text-muted mb-6">This profile doesn't exist or has been removed.</p>
      <Link to="/" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-body hover:bg-primary/80 transition-all">Go Home</Link>
    </div>
  )

  const tabs = [
    { key: 'favorites', label: 'Favorites', icon: Heart },
    { key: 'lists',     label: 'Lists',     icon: List  },
    ...(isStaff ? [{ key: 'history', label: 'History', icon: Clock }] : []),
  ] as const

  const joinedDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : null

  return (
    <div className="max-w-5xl mx-auto pb-16">

      {/* Banner */}
      <div className="relative h-52 sm:h-64 overflow-hidden">
        {profile.bannerUrl
          ? <img src={profile.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-primary/20 via-purple-900/10 to-surface" />
        }
        <Link to="/" className="absolute top-4 left-4 p-2 bg-black/40 hover:bg-black/60 rounded-xl text-white transition-all backdrop-blur-sm text-sm font-body z-10">← Back</Link>
      </div>

      {/* Header */}
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex items-end justify-between -mt-12 mb-4 flex-wrap gap-4">

          {/* Avatar */}
          <img
            src={profile.avatar || DEFAULT_CAT_AVATAR}
            alt={profile.name}
            className="w-24 h-24 rounded-2xl object-cover ring-4 ring-surface shadow-xl flex-shrink-0"
          />

          {/* Own profile link or Follow button */}
          {isOwn ? (
            <Link to="/profile" className="px-4 py-2 glass border border-white/10 text-text-muted text-sm font-body rounded-xl hover:border-primary/30 hover:text-text transition-colors">
              Edit Profile
            </Link>
          ) : me && (
            <button onClick={toggleFollow} disabled={followLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body transition-all disabled:opacity-50 ${
                isFollowing
                  ? 'glass border border-white/10 text-text-muted hover:border-red-500/30 hover:text-red-400'
                  : 'bg-primary hover:bg-primary/80 text-white'
              }`}>
              {isFollowing ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
            </button>
          )}
        </div>

        {/* Name + role */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="font-display text-2xl text-white">{profile.name}</h1>
          {ROLE_BADGE[profile.role] && (
            <span className={`px-2 py-0.5 rounded-lg text-xs font-body border capitalize ${ROLE_BADGE[profile.role]}`}>
              {profile.role}
            </span>
          )}
        </div>

        {/* Bio */}
        {profile.bio && <p className="font-body text-text-muted text-sm mb-3 max-w-xl">{profile.bio}</p>}

        {/* Join date */}
        {joinedDate && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted font-body mb-4">
            <Clock3 size={11} /> Joined {joinedDate}
          </div>
        )}

        <div className="flex gap-4 flex-wrap mb-6">
          {[
            { icon: Heart,    label: 'Favorites', value: profile.favorites?.length || 0, color: 'text-primary' },
            { icon: BookOpen, label: 'Posts',     value: profile.postCount || 0,          color: 'text-purple-400' },
            { icon: Users,    label: 'Followers', value: followerCount,                   color: 'text-blue-400' },
            { icon: UserCheck,label: 'Following', value: profile.followingCount || 0,     color: 'text-green-400' },
            ...(isStaff && profile.readingHistory ? [
              { icon: Clock, label: 'History', value: profile.readingHistory.length || 0, color: 'text-amber-400' },
            ] : []),
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="glass border border-white/5 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Icon size={13} className={color} />
              <span className="font-display text-sm text-white">{value.toLocaleString()}</span>
              <span className="font-body text-xs text-text-muted">{label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-body transition-all ${activeTab === key ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ── Favorites ── */}
        {activeTab === 'favorites' && (
          loadingFavs ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[3/4] skeleton rounded-xl" />)}
            </div>
          ) : favManga.length === 0 ? (
            <div className="text-center py-20">
              <Heart size={48} className="text-text-muted mx-auto mb-4 opacity-30" />
              <p className="font-body text-text-muted">No favorites yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {favManga.map(m => (
                <Link key={m.id} to={`/manga/${m.id}`} className="group">
                  <div className="aspect-[3/4] overflow-hidden rounded-xl">
                    <img src={getCoverUrl(m, 256)} alt={getMangaTitle(m)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <p className="text-xs font-body text-text-muted mt-1 truncate group-hover:text-text transition-colors">{getMangaTitle(m)}</p>
                </Link>
              ))}
            </div>
          )
        )}

        {/* ── Lists ── */}
        {activeTab === 'lists' && (
          loadingLists ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
          ) : lists.length === 0 ? (
            <div className="text-center py-20">
              <List size={48} className="text-text-muted mx-auto mb-4 opacity-30" />
              <p className="font-body text-text-muted">No public lists yet.</p>
            </div>
          ) : lists.map(list => (
            <div key={list._id} className="glass border border-white/5 rounded-2xl overflow-hidden mb-4">
              <div className="flex items-start justify-between p-4 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base text-white">{list.name}</h3>
                    <Globe size={10} className="text-green-400 opacity-60" />
                  </div>
                  {list.description && <p className="text-xs text-text-muted font-body mt-0.5">{list.description}</p>}
                  <p className="text-xs text-text-muted font-body mt-1">{list.mangaIds.length} manga</p>
                </div>
              </div>
              {list.mangaIds.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-text-muted font-body opacity-60">Empty list</div>
              ) : (
                <div className="flex gap-2 overflow-x-auto p-4 scrollbar-thin">
                  {(listManga[list._id] || []).map(m => (
                    <Link key={m.id} to={`/manga/${m.id}`} className="flex-shrink-0">
                      <img src={getCoverUrl(m, 256)} alt={getMangaTitle(m)}
                        className="w-16 h-24 object-cover rounded-lg hover:scale-105 transition-transform duration-200" />
                    </Link>
                  ))}
                  {list.mangaIds.length > (listManga[list._id]?.length || 0) && (
                    <div className="flex-shrink-0 w-16 h-24 rounded-lg glass border border-white/10 flex items-center justify-center text-xs text-text-muted font-body">
                      +{list.mangaIds.length - (listManga[list._id]?.length || 0)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* ── History (staff only) ── */}
        {activeTab === 'history' && isStaff && (
          loadingHistory ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[3/4] skeleton rounded-xl" />)}
            </div>
          ) : !profile.readingHistory?.length ? (
            <div className="text-center py-20">
              <Clock size={48} className="text-text-muted mx-auto mb-4 opacity-30" />
              <p className="font-body text-text-muted">No reading history.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl w-fit">
                <Star size={12} className="text-amber-400" />
                <span className="text-xs font-body text-amber-400">Staff view — reading history is private to other users</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {historyManga.map(m => {
                  const hist = profile.readingHistory.find((h: any) => h.mangaId === m.id)
                  return (
                    <Link key={m.id} to={`/manga/${m.id}`} className="group">
                      <div className="aspect-[3/4] overflow-hidden rounded-xl relative">
                        <img src={getCoverUrl(m, 256)} alt={getMangaTitle(m)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        {hist?.chapterId && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1 text-[9px] text-text-muted font-body truncate">
                            Ch.{hist.chapterId}
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-body text-text-muted mt-1 truncate group-hover:text-text">{getMangaTitle(m)}</p>
                    </Link>
                  )
                })}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}