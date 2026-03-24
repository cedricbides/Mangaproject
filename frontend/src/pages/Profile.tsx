import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { User, Heart, Clock, BookOpen, Star, LogOut, Camera, Edit3, Check, X, Trash2, Settings, List, Plus, Lock, Globe, MoreVertical, Pencil, Search, TrendingUp } from 'lucide-react'

import axios from 'axios'
import { useAuth } from '@/context/AuthContext'
import type { Manga, LocalManga } from '@/types'
import { getCoverUrl, getMangaTitle } from '@/utils/manga'

const MD = 'https://api.mangadex.org'


const DEFAULT_CAT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1e1e30"/><stop offset="100%" stop-color="#0d0d14"/></radialGradient><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e8394d" stop-opacity="0.2"/><stop offset="100%" stop-color="#e8394d" stop-opacity="0"/></radialGradient><clipPath id="circ"><circle cx="100" cy="100" r="100"/></clipPath></defs><circle cx="100" cy="100" r="100" fill="url(#bg)"/><circle cx="100" cy="120" r="75" fill="url(#glow)"/><g clip-path="url(#circ)"><rect x="52" y="158" width="96" height="50" fill="#e8900a"/><ellipse cx="100" cy="158" rx="48" ry="20" fill="#e8900a"/><path d="M 52 165 Q 20 160 18 185 Q 16 200 38 198 Q 50 196 55 185" fill="#e8900a"/><path d="M 22 178 Q 18 185 22 190" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M 24 188 Q 20 193 25 196" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="110" rx="42" ry="40" fill="#f0a012"/><polygon points="68,80 58,55 85,74" fill="#f0a012"/><polygon points="132,80 142,55 115,74" fill="#f0a012"/><polygon points="72,78 64,60 84,74" fill="#c06a20" opacity="0.5"/><polygon points="128,78 136,60 116,74" fill="#c06a20" opacity="0.5"/><path d="M 82 108 Q 87 104 92 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 108 108 Q 113 104 118 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 87 113 Q 87 119 92 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M 113 113 Q 113 119 108 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="100" cy="122" r="3" fill="#7a4a00"/><path d="M 100 125 Q 96 130 100 132 Q 104 130 100 125" fill="#7a4a00"/><ellipse cx="80" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/><ellipse cx="120" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/></g><circle cx="100" cy="100" r="97" fill="none" stroke="#e8394d" stroke-width="1.5" opacity="0.4"/></svg>')}`

const ROLE_BADGES: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  superadmin: { label: 'Super Admin', emoji: '👑', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-400/40' },
  admin:      { label: 'Admin',       emoji: '🛡️', color: 'text-red-300',   bg: 'bg-red-500/20 border-red-400/40'   },
  moderator:  { label: 'Moderator',   emoji: '⚔️', color: 'text-blue-300',  bg: 'bg-blue-500/20 border-blue-400/40' },
}
const TIERS = [
  { label: 'Newcomer', emoji: '🌱', color: 'text-slate-400',  bg: 'bg-slate-500/15 border-slate-500/25',   minPosts: 0   },
  { label: 'Reader',   emoji: '📖', color: 'text-sky-400',    bg: 'bg-sky-500/15 border-sky-500/25',       minPosts: 5   },
  { label: 'Regular',  emoji: '⭐', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/25', minPosts: 20  },
  { label: 'Veteran',  emoji: '🔥', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/25', minPosts: 60  },
  { label: 'Elite',    emoji: '💎', color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/25', minPosts: 150 },
  { label: 'Legend',   emoji: '👑', color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-400/30',   minPosts: 400 },
]
function getTier(n = 0) { return [...TIERS].reverse().find(t => n >= t.minPosts) ?? TIERS[0] }

function RoleBadge({ role, postCount }: { role?: string; postCount?: number }) {
  const rb = role ? ROLE_BADGES[role] : null
  if (rb) return <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold ${rb.color} ${rb.bg}`}>{rb.emoji} {rb.label}</span>
  const tier = getTier(postCount)
  return <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold ${tier.color} ${tier.bg}`}>{tier.emoji} {tier.label}</span>
}

function ImageMenu({ onUpload, onDelete, label, canDelete, uploading }: {
  onUpload: () => void; onDelete: () => void; label: string; canDelete: boolean; uploading: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-body rounded-xl border border-white/20 backdrop-blur-sm transition-all disabled:opacity-50">
        <Camera size={12} />{uploading ? 'Uploading…' : label}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-surface border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[155px]">
          <button onClick={() => { onUpload(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-muted hover:bg-white/5 hover:text-text transition-all font-body">
            <Camera size={13} /> Upload new
          </button>
          {canDelete && (
            <button onClick={() => { onDelete(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all font-body">
              <Trash2 size={13} /> Remove
            </button>

          )}
        </div>
      )}
    </div>
  )
}


export default function Profile() {
  const { user, logout, updateProfile } = useAuth()
  const [favManga, setFavManga] = useState<Manga[]>([])
  const [historyManga, setHistoryManga] = useState<Manga[]>([])
  const [localHistoryManga, setLocalHistoryManga] = useState<LocalManga[]>([])
  const [loadingFavs, setLoadingFavs] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activeTab, setActiveTab] = useState<'favorites' | 'history' | 'lists'>('favorites')

  // Lists state
  const [lists, setLists] = useState<any[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [showCreateList, setShowCreateList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDesc, setNewListDesc] = useState('')
  const [newListPublic, setNewListPublic] = useState(true)
  const [creatingList, setCreatingList] = useState(false)
  const [newListMangaIds, setNewListMangaIds] = useState<string[]>([])
  const [newListMangaObjs, setNewListMangaObjs] = useState<Manga[]>([])
  const [mangaSearchQuery, setMangaSearchQuery] = useState('')
  const [mangaSearchResults, setMangaSearchResults] = useState<Manga[]>([])
  const [searchingManga, setSearchingManga] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingList, setEditingList] = useState<any | null>(null)
  const [listManga, setListManga] = useState<Record<string, Manga[]>>({})
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingBio, setEditingBio] = useState(false)
  const [bioText, setBioText] = useState('')
  const [savingBio, setSavingBio] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) setBioText(user.bio ?? '') }, [user])


  useEffect(() => {
    if (!user) return
    if (user.favorites.length) {
      setLoadingFavs(true)
      axios.get(`${MD}/manga?${user.favorites.slice(0,20).map(id=>`ids[]=${id}`).join('&')}&includes[]=cover_art&limit=20`)
        .then(r => setFavManga(r.data.data)).finally(() => setLoadingFavs(false))
    }
    if (user.readingHistory?.length) {
      setLoadingHistory(true)
      const mdxEntries = user.readingHistory.filter((h:any) => !h.isLocal)
      const localEntries = user.readingHistory.filter((h:any) => h.isLocal)

      const fetches: Promise<any>[] = []

      if (mdxEntries.length) {
        const ids = [...new Set(mdxEntries.map((h:any) => h.mangaId))].slice(0, 20)
        fetches.push(
          axios.get(`${MD}/manga?${ids.map(id=>`ids[]=${id}`).join('&')}&includes[]=cover_art&limit=20`)
            .then(r => setHistoryManga(r.data.data))
        )
      }

      if (localEntries.length) {
        const localIds = [...new Set(localEntries.map((h:any) => h.mangaId))].slice(0, 20)
        fetches.push(
          axios.get('/api/local-manga', { withCredentials: true })
            .then(r => {
              const all: LocalManga[] = r.data.manga || r.data || []
              setLocalHistoryManga(all.filter(m => localIds.includes(m._id)))
            })
        )
      }

      Promise.allSettled(fetches).finally(() => setLoadingHistory(false))
    }
  }, [user])

  // Load lists when tab is selected
  useEffect(() => {
    if (activeTab !== 'lists' || !user) return
    setLoadingLists(true)
    axios.get('/api/lists/mine', { withCredentials: true })
      .then(r => {
        setLists(r.data)
        // fetch manga covers for each list
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
  }, [activeTab, user])

  function handleMangaSearch(q: string) {
    setMangaSearchQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!q.trim()) { setMangaSearchResults([]); return }
    setSearchingManga(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const r = await axios.get(`${MD}/manga?title=${encodeURIComponent(q)}&limit=8&includes[]=cover_art&order[relevance]=desc`)
        setMangaSearchResults(r.data.data)
      } catch {} finally { setSearchingManga(false) }
    }, 400)
  }

  function addMangaToNewList(manga: Manga) {
    if (newListMangaIds.includes(manga.id)) return
    setNewListMangaIds(prev => [...prev, manga.id])
    setNewListMangaObjs(prev => [...prev, manga])
    setMangaSearchQuery('')
    setMangaSearchResults([])
  }

  function removeMangaFromNewList(id: string) {
    setNewListMangaIds(prev => prev.filter(m => m !== id))
    setNewListMangaObjs(prev => prev.filter(m => m.id !== id))
  }

  async function createList() {
    if (!newListName.trim()) return
    setCreatingList(true)
    try {
      const res = await axios.post('/api/lists', { name: newListName, description: newListDesc, isPublic: newListPublic }, { withCredentials: true })
      // add pre-selected manga
      let finalList = res.data
      for (const mangaId of newListMangaIds) {
        const r = await axios.post(`/api/lists/${finalList._id}/manga`, { mangaId }, { withCredentials: true })
        finalList = r.data
      }
      setLists(prev => [finalList, ...prev])
      if (newListMangaObjs.length > 0) setListManga(prev => ({ ...prev, [finalList._id]: newListMangaObjs }))
      setNewListName(''); setNewListDesc(''); setNewListMangaIds([]); setNewListMangaObjs([])
      setMangaSearchQuery(''); setShowCreateList(false)
    } catch (err: any) { alert(err?.response?.data?.error || 'Failed to create list') }
    finally { setCreatingList(false) }
  }

  async function deleteList(id: string) {
    if (!confirm('Delete this list?')) return
    try {
      await axios.delete(`/api/lists/${id}`, { withCredentials: true })
      setLists(prev => prev.filter(l => l._id !== id))
      setListManga(prev => { const n = { ...prev }; delete n[id]; return n })
    } catch {}
  }

  async function saveEditList() {
    if (!editingList || !editingList.name.trim()) return
    try {
      const res = await axios.patch(`/api/lists/${editingList._id}`, {
        name: editingList.name, description: editingList.description, isPublic: editingList.isPublic
      }, { withCredentials: true })
      setLists(prev => prev.map(l => l._id === res.data._id ? res.data : l))
      setEditingList(null)
    } catch {}
  }

  async function removeMangaFromList(listId: string, mangaId: string) {
    try {
      await axios.delete(`/api/lists/${listId}/manga/${mangaId}`, { withCredentials: true })
      setLists(prev => prev.map(l => l._id === listId ? { ...l, mangaIds: l.mangaIds.filter((id: string) => id !== mangaId) } : l))
      setListManga(prev => ({ ...prev, [listId]: (prev[listId] || []).filter(m => m.id !== mangaId) }))
    } catch {}
  }

  async function uploadMedia(file: File) {
    const fd = new FormData(); fd.append('image', file)
    try { const r = await axios.post('/api/upload/image', fd, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } }); return r.data.url as string }
    catch { return null }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 10*1024*1024) return alert('File must be under 10 MB')
    setUploadingBanner(true)
    const url = await uploadMedia(file)
    if (url) await updateProfile({ bannerUrl: url })
    setUploadingBanner(false)
    if (bannerInputRef.current) bannerInputRef.current.value = ''
  }

  async function handleBannerDelete() {
    if (!confirm('Remove your banner?')) return
    await updateProfile({ bannerUrl: '' })
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5*1024*1024) return alert('Avatar must be under 5 MB')
    setUploadingAvatar(true)
    const url = await uploadMedia(file)
    if (url) await updateProfile({ avatar: url })
    setUploadingAvatar(false)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  async function handleAvatarDelete() {
    if (!confirm('Remove profile photo? The default cat will be used.')) return
    await updateProfile({ avatar: '' })
  }

  async function saveBio() {
    setSavingBio(true)
    try { await updateProfile({ bio: bioText }); setEditingBio(false) }
    catch {} finally { setSavingBio(false) }
  }

  if (!user) return (
    <div className="max-w-2xl mx-auto px-5 pt-40 pb-16 text-center">
      <User size={64} className="text-text-muted mx-auto mb-6 opacity-30" />
      <h1 className="font-display text-3xl text-white mb-3">Sign In Required</h1>
      <p className="font-body text-text-muted mb-8">You need to sign in to view your profile.</p>
      <Link to="/login" className="px-6 py-3 bg-primary text-white font-body rounded-xl hover:bg-primary/90 transition-colors">Sign In</Link>
    </div>
  )

  const displayBanner = user.bannerUrl ?? ''
  const displayAvatar = user.avatar ?? ''

  const stats = [
    { icon: Heart,    label: 'Favorites', value: user.favorites.length,                                    color: 'text-red-400'   },
    { icon: Clock,    label: 'History',   value: user.readingHistory?.length || 0,                         color: 'text-blue-400'  },
    { icon: BookOpen, label: 'Reading',   value: user.readingHistory?.filter((h:any) => h.page > 0).length || 0, color: 'text-green-400' },
  ]

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <input ref={bannerInputRef} type="file" accept="image/*,image/gif" className="hidden" onChange={handleBannerUpload} />
      <input ref={avatarInputRef} type="file" accept="image/*,image/gif" className="hidden" onChange={handleAvatarUpload} />

      {/* ── Banner ── */}
      <div className="relative h-52 sm:h-64 overflow-hidden group">
        {displayBanner
          ? <img src={displayBanner} alt="Banner" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-primary/20 via-purple-900/10 to-surface" />
        }
        {/* Dark overlay — CSS only, no JS */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all duration-200 pointer-events-none" />
        {/* Pen hint top-right */}
        <div className="absolute top-3 right-3 p-1.5 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <Edit3 size={13} className="text-white" />
        </div>
        {/* Action buttons — sit inside the banner, shown on hover */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="flex items-center gap-1.5 px-4 py-2 bg-black/80 hover:bg-black text-white text-xs font-body rounded-xl border border-white/20 backdrop-blur-sm transition-all disabled:opacity-50"
          >
            <Camera size={13} /> {uploadingBanner ? 'Uploading…' : 'Change Banner'}
          </button>
          {!!displayBanner && (
            <button
              onClick={handleBannerDelete}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-900/80 hover:bg-red-900 text-red-300 text-xs font-body rounded-xl border border-red-500/30 backdrop-blur-sm transition-all"
            >
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
        <Link to="/" className="absolute top-4 left-4 p-2 bg-black/40 hover:bg-black/60 rounded-xl text-white transition-all backdrop-blur-sm text-sm font-body z-10">← Back</Link>
      </div>

      {/* ── Profile header ── */}
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex items-end justify-between -mt-12 mb-4 flex-wrap gap-4">

          {/* Avatar */}
          <div className="relative flex-shrink-0 group w-24 h-24">
            <img
              src={displayAvatar || DEFAULT_CAT_AVATAR}
              alt={user.name}
              className="w-24 h-24 rounded-2xl object-cover ring-4 ring-surface shadow-xl"
            />
            {/* Hover overlay — CSS only */}
            <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/60 transition-all duration-200 flex flex-col items-center justify-center gap-1.5">
              <Edit3 size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              {/* Buttons visible on hover */}
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="flex items-center gap-1 px-2 py-1 bg-black/80 hover:bg-black text-white text-[10px] font-body rounded-lg border border-white/20 transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  <Camera size={10} /> {uploadingAvatar ? '…' : 'Upload'}
                </button>
                {!!displayAvatar && (
                  <button
                    onClick={handleAvatarDelete}
                    className="flex items-center gap-1 px-2 py-1 bg-red-900/80 hover:bg-red-900 text-red-300 text-[10px] font-body rounded-lg border border-red-500/30 transition-all whitespace-nowrap"
                  >
                    <Trash2 size={10} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pb-1">
            {(user.role === 'admin' || user.role === 'superadmin') && (
              <Link to="/admin" className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-body rounded-xl hover:bg-amber-500/30 transition-colors flex items-center gap-1.5">
                <Star size={14} /> Admin Panel
              </Link>
            )}
            <Link to="/settings" className="px-4 py-2 glass border border-white/10 text-text-muted text-sm font-body rounded-xl hover:border-primary/30 hover:text-text transition-colors flex items-center gap-1.5">
              <Settings size={14} /> Settings
            </Link>
            <button onClick={logout} className="px-4 py-2 glass border border-white/10 text-text-muted text-sm font-body rounded-xl hover:border-primary/30 transition-colors flex items-center gap-1.5">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* Name + badge + bio */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="font-display text-2xl text-white">{user.name}</h1>
            <RoleBadge role={user.role} postCount={user.postCount} />
          </div>
          <p className="text-sm text-text-muted font-body mb-3">{user.email}</p>
          {editingBio ? (
            <div className="flex gap-2 items-start max-w-lg">
              <textarea value={bioText} onChange={e => setBioText(e.target.value.slice(0,300))} rows={2} placeholder="Write a short bio…"
                className="flex-1 bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none resize-none" />
              <div className="flex flex-col gap-1.5">
                <button onClick={saveBio} disabled={savingBio} className="p-2 bg-primary rounded-lg text-white hover:bg-primary/80 disabled:opacity-40 transition-all"><Check size={14} /></button>
                <button onClick={() => { setEditingBio(false); setBioText(user.bio ?? '') }} className="p-2 glass rounded-lg text-text-muted hover:text-text transition-all"><X size={14} /></button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 group max-w-lg">
              <p className="text-sm text-text-muted font-body flex-1">{user.bio || <span className="opacity-40 italic">No bio yet</span>}</p>
              <button onClick={() => setEditingBio(true)} title="Edit bio"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 glass rounded-lg text-text-muted hover:text-text flex-shrink-0">
                <Edit3 size={12} />
              </button>
            </div>
          )}
          <div className="flex gap-6 mt-4">
            {stats.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`flex items-center gap-1 font-display text-xl ${color}`}><Icon size={14} />{value}</div>
                <p className="text-xs text-text-muted font-body">{label}</p>
              </div>
            ))}
            {(user.postCount ?? 0) > 0 && (
              <div className="text-center">
                <div className="font-display text-xl text-purple-400">{user.postCount}</div>
                <p className="text-xs text-text-muted font-body">Posts</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {([['favorites','My Favorites',Heart],['lists','Lists',List],['history','Reading History',Clock]] as const).map(([tab,label,Icon]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-body transition-all ${activeTab===tab ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
              <Icon size={14}/>{label}
            </button>
          ))}
          <Link to="/stats"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-body glass text-text-muted hover:text-text transition-all">
            <TrendingUp size={14}/> My Stats
          </Link>
        </div>

        {/* ── Lists Tab ── */}
        {activeTab==='lists' && (
          <div className="space-y-4">
            {/* Create list button / form */}
            {!showCreateList ? (
              <button onClick={() => setShowCreateList(true)}
                className="flex items-center gap-2 px-4 py-2.5 glass border border-dashed border-white/20 hover:border-primary/40 text-text-muted hover:text-text rounded-xl text-sm font-body transition-all w-full justify-center">
                <Plus size={15} /> Create new list
              </button>
            ) : (
              <div className="glass border border-primary/20 rounded-2xl p-4 space-y-3">
                <h3 className="font-display text-sm text-text">New List</h3>

                {/* Name */}
                <input value={newListName} onChange={e => setNewListName(e.target.value.slice(0,100))}
                  placeholder="List name *" maxLength={100} autoFocus
                  className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none" />

                {/* Description */}
                <textarea value={newListDesc} onChange={e => setNewListDesc(e.target.value.slice(0,500))}
                  placeholder="Description (optional)" rows={2}
                  className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none resize-none" />

                {/* Manga search */}
                <div className="space-y-2">
                  <p className="text-xs text-text-muted font-body">Add manga to this list</p>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      value={mangaSearchQuery}
                      onChange={e => handleMangaSearch(e.target.value)}
                      placeholder="Search manga title…"
                      className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl pl-8 pr-3 py-2 text-sm text-text font-body outline-none"
                    />
                    {searchingManga && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {/* Search results dropdown */}
                    {mangaSearchResults.length > 0 && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-surface border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden max-h-64 overflow-y-auto">
                        {mangaSearchResults.map(m => {
                          const alreadyAdded = newListMangaIds.includes(m.id)
                          return (
                            <button key={m.id} onClick={() => addMangaToNewList(m)} disabled={alreadyAdded}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-all text-left disabled:opacity-40">
                              <img src={getCoverUrl(m, 256)} alt={getMangaTitle(m)} className="w-8 h-11 object-cover rounded-md flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-body text-text truncate">{getMangaTitle(m)}</p>
                              </div>
                              {alreadyAdded
                                ? <Check size={12} className="text-primary flex-shrink-0" />
                                : <Plus size={12} className="text-text-muted flex-shrink-0" />
                              }
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selected manga chips */}
                  {newListMangaObjs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newListMangaObjs.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-white/5 border border-white/10 rounded-lg">
                          <img src={getCoverUrl(m, 256)} alt="" className="w-5 h-7 object-cover rounded" />
                          <span className="text-xs font-body text-text max-w-[100px] truncate">{getMangaTitle(m)}</span>
                          <button onClick={() => removeMangaFromNewList(m.id)} className="text-text-muted hover:text-red-400 transition-colors ml-0.5">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => setNewListPublic(p => !p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body border transition-all ${newListPublic ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-text-muted'}`}>
                    {newListPublic ? <><Globe size={11}/> Public</> : <><Lock size={11}/> Private</>}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowCreateList(false); setNewListName(''); setNewListDesc(''); setNewListMangaIds([]); setNewListMangaObjs([]); setMangaSearchQuery(''); setMangaSearchResults([]) }}
                      className="px-4 py-1.5 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-all">
                      Cancel
                    </button>
                    <button onClick={createList} disabled={!newListName.trim() || creatingList}
                      className="px-4 py-1.5 bg-primary text-white text-xs font-body rounded-xl hover:bg-primary/80 disabled:opacity-40 transition-all">
                      {creatingList ? 'Creating…' : `Create${newListMangaIds.length > 0 ? ` (${newListMangaIds.length})` : ''}`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingLists ? (
              <div className="space-y-4">{Array.from({length:3}).map((_,i) => <div key={i} className="skeleton h-32 rounded-2xl"/>)}</div>
            ) : lists.length === 0 ? (
              <div className="text-center py-20">
                <List size={48} className="text-text-muted mx-auto mb-4 opacity-30"/>
                <p className="font-body text-text-muted">No lists yet. Create one to organize your manga!</p>
              </div>
            ) : lists.map(list => (
              <div key={list._id} className="glass border border-white/5 rounded-2xl overflow-hidden">
                {/* List header */}
                {editingList?._id === list._id ? (
                  <div className="p-4 space-y-2 border-b border-white/5">
                    <input value={editingList.name} onChange={e => setEditingList({...editingList, name: e.target.value.slice(0,100)})}
                      className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none"/>
                    <textarea value={editingList.description || ''} onChange={e => setEditingList({...editingList, description: e.target.value.slice(0,500)})}
                      rows={2} placeholder="Description"
                      className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none resize-none"/>
                    <div className="flex items-center justify-between">
                      <button onClick={() => setEditingList({...editingList, isPublic: !editingList.isPublic})}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body border transition-all ${editingList.isPublic ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-text-muted'}`}>
                        {editingList.isPublic ? <><Globe size={11}/> Public</> : <><Lock size={11}/> Private</>}
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingList(null)} className="px-3 py-1.5 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-all">Cancel</button>
                        <button onClick={saveEditList} className="px-3 py-1.5 bg-primary text-white text-xs font-body rounded-xl hover:bg-primary/80 transition-all">Save</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between p-4 border-b border-white/5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base text-white">{list.name}</h3>
                        {!list.isPublic && <span className="flex items-center gap-1 text-[10px] text-text-muted font-body"><Lock size={9}/> Private</span>}
                      </div>
                      {list.description && <p className="text-xs text-text-muted font-body mt-0.5 line-clamp-1">{list.description}</p>}
                      <p className="text-xs text-text-muted font-body mt-1">{list.mangaIds.length} manga</p>
                    </div>
                    <div className="relative">
                      <button onClick={() => setOpenMenuId(openMenuId === list._id ? null : list._id)}
                        className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-white/5 transition-all">
                        <MoreVertical size={15}/>
                      </button>
                      {openMenuId === list._id && (
                        <div className="absolute right-0 top-full mt-1 bg-surface border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden min-w-[130px]">
                          <button onClick={() => { setEditingList({...list}); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-muted hover:bg-white/5 hover:text-text font-body transition-all">
                            <Pencil size={12}/> Edit
                          </button>
                          <button onClick={() => { deleteList(list._id); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 font-body transition-all">
                            <Trash2 size={12}/> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Manga covers scroll */}
                {list.mangaIds.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-text-muted font-body opacity-60">
                    No manga yet — add some from any manga page
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto p-4 scrollbar-thin">
                    {(listManga[list._id] || []).map(m => (
                      <div key={m.id} className="relative flex-shrink-0 group/cover">
                        <Link to={`/manga/${m.id}`}>
                          <img src={getCoverUrl(m, 256)} alt={getMangaTitle(m)}
                            className="w-16 h-24 object-cover rounded-lg hover:scale-105 transition-transform duration-200"/>
                        </Link>
                        <button onClick={() => removeMangaFromList(list._id, m.id)}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-black/80 rounded-md text-red-400 opacity-0 group-hover/cover:opacity-100 transition-opacity">
                          <X size={10}/>
                        </button>
                      </div>
                    ))}
                    {list.mangaIds.length > (listManga[list._id]?.length || 0) && (
                      <div className="flex-shrink-0 w-16 h-24 rounded-lg glass border border-white/10 flex items-center justify-center text-xs text-text-muted font-body">
                        +{list.mangaIds.length - (listManga[list._id]?.length || 0)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab==='favorites' && (
          loadingFavs ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {Array.from({length:12}).map((_,i)=><div key={i} className="skeleton rounded-xl" style={{aspectRatio:'2/3'}}/>)}
            </div>
          ) : favManga.length===0 ? (
            <div className="text-center py-20">
              <Heart size={48} className="text-text-muted mx-auto mb-4 opacity-30"/>
              <p className="font-body text-text-muted">No favorites yet. Start adding manga you love!</p>
              <Link to="/catalog" className="mt-4 inline-block text-primary text-sm hover:underline">Browse Catalog</Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {favManga.map(m=>(
                <Link key={m.id} to={`/manga/${m.id}`} className="group">
                  <div className="relative overflow-hidden rounded-xl" style={{aspectRatio:'2/3'}}>
                    <img src={getCoverUrl(m,256)} alt={getMangaTitle(m)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                  </div>
                  <p className="mt-2 text-xs text-text font-body line-clamp-2 group-hover:text-primary transition-colors px-1">{getMangaTitle(m)}</p>
                </Link>
              ))}
            </div>
          )
        )}

        {activeTab==='history' && (
          loadingHistory ? (
            <div className="flex flex-col gap-3">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton h-20 rounded-xl"/>)}</div>
          ) : historyManga.length===0 && localHistoryManga.length===0 ? (
            <div className="text-center py-20">
              <Clock size={48} className="text-text-muted mx-auto mb-4 opacity-30"/>
              <p className="font-body text-text-muted">No reading history yet. Start reading!</p>
              <Link to="/catalog" className="mt-4 inline-block text-primary text-sm hover:underline">Browse Catalog</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {historyManga.map(m=>{
                const hist=user.readingHistory?.find((h:any)=>h.mangaId===m.id)
                return (
                  <Link key={m.id} to={`/manga/${m.id}`} className="flex items-center gap-4 glass rounded-2xl p-4 hover:border-primary/20 border border-transparent transition-all group">
                    <img src={getCoverUrl(m,256)} alt={getMangaTitle(m)} className="w-12 h-16 object-cover rounded-lg flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-text group-hover:text-primary transition-colors line-clamp-1">{getMangaTitle(m)}</p>
                      {hist && <p className="text-xs text-text-muted mt-1 font-body">Last read: {new Date(hist.updatedAt).toLocaleDateString()}{hist.page>0&&` · Page ${hist.page}`}</p>}
                    </div>
                    <BookOpen size={16} className="text-text-muted group-hover:text-primary transition-colors"/>
                  </Link>
                )
              })}
              {localHistoryManga.map(m=>{
                const hist=user.readingHistory?.find((h:any)=>h.mangaId===m._id && h.isLocal)
                return (
                  <Link key={m._id} to={`/manga/${m.slug}`} className="flex items-center gap-4 glass rounded-2xl p-4 hover:border-primary/20 border border-transparent transition-all group">
                    {m.coverUrl
                      ? <img src={m.coverUrl} alt={m.title} className="w-12 h-16 object-cover rounded-lg flex-shrink-0"/>
                      : <div className="w-12 h-16 bg-white/5 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-text-muted"/></div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-body text-sm text-text group-hover:text-primary transition-colors line-clamp-1">{m.title}</p>
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded font-body flex-shrink-0">Local</span>
                      </div>
                      {hist && <p className="text-xs text-text-muted mt-1 font-body">Last read: {new Date(hist.updatedAt).toLocaleDateString()}{hist.page>0&&` · Page ${hist.page}`}</p>}
                    </div>
                    <BookOpen size={16} className="text-text-muted group-hover:text-primary transition-colors"/>
                  </Link>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}