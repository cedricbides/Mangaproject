import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Shield, Plus, Edit3, Trash2, BookOpen, Users, Layers,
  ChevronDown, ChevronUp, X, Check, AlertCircle, Image, List,
  TrendingUp, Eye, Heart, BarChart2, RefreshCw, Clock, ArrowUpDown,
  CalendarDays, Activity, Radio,
  Star, Layout, Tag, GripVertical, Globe, Search, Settings,
  Ban, UserX, MessageSquare, FileText, ChevronRight, AlertTriangle,
  BookMarked, ExternalLink, Loader2, CheckCircle, XCircle, BookCheck, Bell, ChevronLeft

} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend, AreaChart, Area
} from 'recharts'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

import type { LocalManga, LocalChapter, Manga } from '@/types'
import { getCoverUrl, getMangaTitle, getMangaTags } from '@/utils/manga'
import AdminBulkManager from '@/components/admin/AdminBulkManager'
import AdminChapterScheduler from '@/components/admin/AdminChapterScheduler'
import AdminActivityLog from '@/components/admin/AdminActivityLog'
import AdminVisitorTracker from '@/components/admin/AdminVisitorTracker'
import AdminExportAnalytics from '@/components/admin/AdminExportAnalytics'
import AdminAnnouncementScheduler from '@/components/admin/AdminAnnouncementScheduler'
import AdminSEOEditor from '@/components/admin/AdminSEOEditor'
import AdminBackupRestore from '@/components/admin/AdminBackupRestore'
import AdminPermissionManager from '@/components/admin/AdminPermissionManager'
import { mediaUrl } from '@/utils/mediaUrl'

const MD = '/api/mangadex'


const GENRES = [
  'Action','Adventure','Comedy','Drama','Fantasy','Horror','Mystery',
  'Romance','Sci-Fi','Slice of Life','Sports','Thriller','Psychological',
  'Historical','Supernatural','Isekai','Mecha','Music','School Life'
]

const CHART_COLORS = ['#e8394d','#7c6af7','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']
const STATUS_COLORS: Record<string, string> = {
  ongoing: '#10b981', completed: '#3b82f6', hiatus: '#f59e0b', cancelled: '#ef4444'
}



const TooltipStyle = {
  contentStyle: { background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, fontFamily: 'var(--font-body)' },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#e2e8f0' },
}

interface AnalyticsData {

  topManga: { title: string; fullTitle: string; views: number; saves: number; coverUrl: string; source: string }[]
  topSaved: { title: string; fullTitle: string; saves: number; coverUrl: string }[]
  mostCommented: { title: string; count: number }[]

  genreData: { name: string; value: number }[]
  statusData: { name: string; value: number }[]
  userGrowthData: { date: string; count: number }[]
  activityData: { date: string; reads: number }[]

  dauData: { date: string; dau: number }[]
  summary: {
    totalViews: number
    totalSaves: number
    newUsersThisWeek: number
    totalFavorites: number
    totalManga: number
    localMangaCount: number
    mdxMangaCount: number
    totalChapters: number
    mdxImportedChapters: number
    comickChapters: number
    manualChapters: number
    totalComments30d: number
    totalReviews30d: number
    avgRating30d: string | null
    retentionRate: number | null
    cohortSize: number

  }
}

export default function Admin() {

  const { user, isAdmin, isSuperAdmin, hasPerm, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'manga' | 'users' | 'analytics' | 'site' | 'moderation' | 'tools' | 'requests'>(() => {
    const t = searchParams.get('tab')
    return (['manga','users','analytics','site','moderation','tools','requests'].includes(t || '') ? t : 'manga') as any
  })

  const [stats, setStats] = useState({ userCount: 0, mangaCount: 0, chapterCount: 0, mdxImportedChapters: 0, manualChapters: 0, comickChapters: 0 })
  const [mangaList, setMangaList] = useState<LocalManga[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [expandedManga, setExpandedManga] = useState<string | null>(null)
  const [chapters, setChapters] = useState<Record<string, LocalChapter[]>>({})
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // Modals
  const [showMangaForm, setShowMangaForm] = useState(false)
  const [editingManga, setEditingManga] = useState<LocalManga | null>(null)
  const [showChapterForm, setShowChapterForm] = useState<string | null>(null)
  const [editingChapter, setEditingChapter] = useState<LocalChapter | null>(null)


  // Live monitoring
  const [liveEnabled, setLiveEnabled] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [newlyDetected, setNewlyDetected] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [secondsSince, setSecondsSince] = useState(0)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [analyticsError, setAnalyticsError] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-az' | 'title-za' | 'most-views'>('newest')
  const [showLog, setShowLog] = useState(true)

  // ── Site Settings state ────────────────────────────────────────────────────
  const [siteSettings, setSiteSettings] = useState<any>(null)
  const [loadingSite, setLoadingSite] = useState(false)
  const [siteSaved, setSiteSaved] = useState(false)
  const [modCounts, setModCounts] = useState({ pendingReports: 0, flaggedComments: 0, flaggedReviews: 0 })

  // Genre manager
  const [genres, setGenres] = useState<string[]>([])
  const [newGenre, setNewGenre] = useState('')
  const [editingGenre, setEditingGenre] = useState<{ old: string; val: string } | null>(null)

  // Featured picks
  const [featuredPicks, setFeaturedPicks] = useState<any[]>([])
  const [featuredSearch, setFeaturedSearch] = useState('')
  const [featuredSearchResults, setFeaturedSearchResults] = useState<any[]>([])
  const [searchingFeatured, setSearchingFeatured] = useState(false)

  // Banner slides
  const [bannerSlides, setBannerSlides] = useState<any[]>([])
  const [editingSlide, setEditingSlide] = useState<any | null>(null)

  // API manga from MangaDex
  const [apiManga, setApiManga] = useState<Manga[]>([])
  const [apiTotal, setApiTotal] = useState(0)
  const [apiPage, setApiPage] = useState(0)
  const [apiSearch, setApiSearch] = useState('')
  const [loadingApi, setLoadingApi] = useState(false)
  const [mangaSource, setMangaSource] = useState<'all' | 'api' | 'local'>('all')
  const [importedOverview, setImportedOverview] = useState<any[]>([])
  const [loadingImported, setLoadingImported] = useState(false)
  const [expandedImported, setExpandedImported] = useState<string | null>(null)
  const [importedMangaIds, setImportedMangaIds] = useState<Set<string>>(new Set())
  const [quickImportId, setQuickImportId] = useState<string | null>(null)

  // Admin notifications
  const [adminNotifOpen, setAdminNotifOpen] = useState(false)
  const [adminUnread, setAdminUnread] = useState(0)
  const [adminNotifs, setAdminNotifs] = useState<any[]>([])
  const adminNotifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAdmin) return
    const fetchCount = () =>
      axios.get('/api/notifications/admin/unread-count', { withCredentials: true })
        .then(r => setAdminUnread(r.data.count || 0)).catch(() => {})
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [isAdmin])

  useEffect(() => {
    if (!adminNotifOpen) return
    axios.get('/api/notifications/admin', { withCredentials: true })
      .then(r => setAdminNotifs(r.data.notifications || [])).catch(() => {})
  }, [adminNotifOpen])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (adminNotifRef.current && !adminNotifRef.current.contains(e.target as Node))
        setAdminNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const adminMarkAllRead = async () => {
    await axios.put('/api/notifications/admin/read-all', {}, { withCredentials: true }).catch(() => {})
    setAdminNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setAdminUnread(0)
  }

  const adminMarkOne = async (id: string) => {
    await axios.put(`/api/notifications/admin/${id}/read`, {}, { withCredentials: true }).catch(() => {})
    setAdminNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
    setAdminUnread(prev => Math.max(0, prev - 1))
  }

  const adminDeleteNotif = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await axios.delete(`/api/notifications/admin/${id}`, { withCredentials: true }).catch(() => {})
    setAdminNotifs(prev => prev.filter(n => n._id !== id))
  }

  const adminNotifIcon: Record<string, string> = {
    new_report: '🚨', new_request: '📋', new_user: '👤', chapter_published: '📖',
  }


  useEffect(() => {
    if (!loading && !isAdmin) navigate('/')
  }, [loading, isAdmin, navigate])

  useEffect(() => {
    if (!isAdmin) return
    axios.get('/api/admin/stats', { withCredentials: true }).then(res => setStats(res.data)).catch(() => {})

    axios.get('/api/admin/moderation/counts', { withCredentials: true }).then(res => setModCounts(res.data)).catch(() => {})
    loadManga()
  }, [isAdmin])

  // Tick counter
  useEffect(() => {
    const tick = setInterval(() => {
      if (lastRefreshed) {
        setSecondsSince(Math.floor((Date.now() - lastRefreshed.getTime()) / 1000))
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [lastRefreshed])

  // Silent background poll
  // Load imported overview when Manually Added tab is shown
  useEffect(() => {
    if ((mangaSource === 'local' || mangaSource === 'all') && importedOverview.length === 0) {
      setLoadingImported(true)
      axios.get('/api/admin/mangadex/imported-overview', { withCredentials: true })
        .then(r => setImportedOverview(r.data))
        .catch(() => {})
        .finally(() => setLoadingImported(false))
    }
  }, [mangaSource])

  const silentRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const [mangaRes, statsRes] = await Promise.all([
        axios.get('/api/admin/manga', { withCredentials: true }),
        axios.get('/api/admin/stats', { withCredentials: true }),
      ])
      const freshList: LocalManga[] = mangaRes.data
      const freshIds = new Set(freshList.map(m => m._id))

      const added = freshList.filter(m => !prevIdsRef.current.has(m._id)).map(m => m._id)
      if (added.length > 0) {
        setNewlyDetected(prev => new Set([...prev, ...added]))
        setTimeout(() => {
          setNewlyDetected(prev => {
            const next = new Set(prev)
            added.forEach(id => next.delete(id))
            return next
          })
        }, 8000)
      }

      prevIdsRef.current = freshIds
      setMangaList(freshList)
      setStats(statsRes.data)
      setLastRefreshed(new Date())
      setSecondsSince(0)
    } catch (_) {}
    setRefreshing(false)
  }, [refreshing])

  // Start / stop polling interval
  useEffect(() => {
    if (liveEnabled) {
      pollRef.current = setInterval(silentRefresh, 30000)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [liveEnabled, silentRefresh])

  const loadManga = async () => {
    setLoadingData(true)
    const res = await axios.get('/api/admin/manga', { withCredentials: true })
    const list: LocalManga[] = res.data
    prevIdsRef.current = new Set(list.map(m => m._id))
    setMangaList(list)
    setLastRefreshed(new Date())
    setSecondsSince(0)

    setLoadingData(false)
  }

  const loadUsers = async () => {
    setLoadingData(true)
    const res = await axios.get('/api/admin/users', { withCredentials: true })
    setUsers(res.data)
    setLoadingData(false)
  }



  const loadAnalytics = async () => {
    setLoadingAnalytics(true)
    setAnalyticsError('')
    try {
      const res = await axios.get('/api/admin/analytics', { withCredentials: true })
      setAnalytics(res.data)
    } catch (err: any) {
      setAnalyticsError(err.response?.data?.error || err.message || 'Unknown error')
    } finally {
      setLoadingAnalytics(false)
    }
  }


  const loadApiManga = async (page = 0, search = '') => {
    setLoadingApi(true)
    try {
      const qp = new URLSearchParams()
      qp.set('limit', '24')
      qp.set('offset', String(page * 24))
      qp.set('includes[]', 'cover_art')
      qp.set('contentRating[]', 'safe')
      qp.set('hasAvailableChapters', 'true')
      qp.set('order[latestUploadedChapter]', 'desc')
      if (search.trim()) qp.set('title', search.trim())
      const res = await axios.get(`${MD}/manga?${qp}`)
      setApiManga(res.data.data)
      setApiTotal(res.data.total)
    } catch (_) {}
    setLoadingApi(false)
  }

  useEffect(() => {
    if (isAdmin) loadApiManga(apiPage, apiSearch)
  }, [isAdmin, apiPage])

  // Track which MangaDex IDs already have chapters imported
  useEffect(() => {
    if (!isAdmin || apiManga.length === 0) return
    const ids = apiManga.map(m => m.id)
    Promise.all(ids.map(id =>
      axios.get(`/api/local-manga/manual-chapters/${id}`, { withCredentials: true })
        .then(r => r.data?.length > 0 ? id : null)
        .catch(() => null)
    )).then(results => {
      setImportedMangaIds(new Set(results.filter(Boolean) as string[]))
    })
  }, [apiManga, isAdmin])

  // Debounced API search
  useEffect(() => {
    const t = setTimeout(() => { setApiPage(0); loadApiManga(0, apiSearch) }, 500)
    return () => clearTimeout(t)
  }, [apiSearch])


  const loadChapters = async (mangaId: string) => {
    if (chapters[mangaId]) return
    const res = await axios.get(`/api/admin/manga/${mangaId}/chapters`, { withCredentials: true })
    setChapters(prev => ({ ...prev, [mangaId]: res.data }))
  }

  const toggleExpand = (id: string) => {
    if (expandedManga === id) { setExpandedManga(null) }
    else { setExpandedManga(id); loadChapters(id) }
  }

  const deleteManga = async (id: string) => {
    if (!confirm('Delete this manga and all its chapters?')) return
    await axios.delete(`/api/admin/manga/${id}`, { withCredentials: true })
    setMangaList(prev => prev.filter(m => m._id !== id))
    setStats(s => ({ ...s, mangaCount: s.mangaCount - 1 }))
  }

  const deleteChapter = async (mangaId: string, chapterId: string) => {
    if (!confirm('Delete this chapter?')) return
    await axios.delete(`/api/admin/chapters/${chapterId}`, { withCredentials: true })
    setChapters(prev => ({ ...prev, [mangaId]: prev[mangaId].filter(c => c._id !== chapterId) }))
    setStats(s => ({ ...s, chapterCount: s.chapterCount - 1 }))
  }


  const handleTabChange = (tab: 'manga' | 'users' | 'analytics' | 'site' | 'moderation' | 'requests') => {
    setActiveTab(tab)
    if (tab === 'users' && users.length === 0) loadUsers()
    if (tab === 'analytics' && !analytics) loadAnalytics()
    if (tab === 'site' && !siteSettings) loadSiteSettings()
  }

  const loadSiteSettings = async () => {
    setLoadingSite(true)
    try {
      const res = await axios.get('/api/admin/site-settings', { withCredentials: true })
      setSiteSettings(res.data)
      setGenres(res.data.genres || [])
      setFeaturedPicks(res.data.featuredPicks || [])
      setBannerSlides(res.data.bannerSlides || [])
    } catch {}
    finally { setLoadingSite(false) }
  }

  const saveFeatured = async (picks: any[]) => {
    await axios.put('/api/admin/site-settings/featured', { picks }, { withCredentials: true })
    setSiteSaved(true); setTimeout(() => setSiteSaved(false), 2000)
  }

  const saveBanner = async (slides: any[]) => {
    await axios.put('/api/admin/site-settings/banner', { slides }, { withCredentials: true })
    setSiteSaved(true); setTimeout(() => setSiteSaved(false), 2000)
  }

  const saveGenres = async (g: string[]) => {
    await axios.put('/api/admin/site-settings/genres', { genres: g }, { withCredentials: true })
    setSiteSaved(true); setTimeout(() => setSiteSaved(false), 2000)
  }

  const renameGenre = async (oldName: string, newName: string) => {
    await axios.post('/api/admin/site-settings/genres/rename', { oldName, newName }, { withCredentials: true })
    const updated = genres.map(g => g === oldName ? newName : g)
    setGenres(updated)
    setEditingGenre(null)
    setSiteSaved(true); setTimeout(() => setSiteSaved(false), 2000)
  }

  const deleteGenre = async (name: string) => {
    if (!confirm(`Remove genre "${name}" from all manga?`)) return
    await axios.delete(`/api/admin/site-settings/genres/${encodeURIComponent(name)}`, { withCredentials: true })
    setGenres(g => g.filter(x => x !== name))
  }

  const searchForFeatured = async (q: string) => {
    if (!q.trim()) return setFeaturedSearchResults([])
    setSearchingFeatured(true)
    try {
      const [localRes, mdxRes] = await Promise.all([
        axios.get(`/api/local-manga?search=${encodeURIComponent(q)}&limit=5`, { withCredentials: true }),
        axios.get(`/api/mangadex/manga?title=${encodeURIComponent(q)}&limit=5&includes[]=cover_art`),
      ])
      const locals = (localRes.data.data || localRes.data || []).map((m: any) => ({
        id: m._id, title: m.title, coverUrl: m.coverUrl, type: 'local'
      }))
      const mdx = (mdxRes.data.data || []).map((m: any) => {
        const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
        const coverFile = coverRel?.attributes?.fileName
        const cover = coverFile ? `/api/proxy/image?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${m.id}/${coverFile}.256.jpg`)}`  : ''
        const titles = m.attributes?.title || {}
        return { id: m.id, title: titles.en || Object.values(titles)[0] || 'Unknown', coverUrl: cover, type: 'mangadex' }
      })
      setFeaturedSearchResults([...locals, ...mdx])
    } finally { setSearchingFeatured(false) }

  }

  if (loading) return <div className="pt-32 text-center text-text-muted font-body">Loading...</div>
  if (!isAdmin) return null

  return (

    <div className="max-w-6xl mx-auto px-5 pt-20 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-600/20 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Shield size={20} className="text-amber-400" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0d0d18]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl text-white tracking-widest uppercase">Admin Dashboard</h1>
              <span className="text-[9px] px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-full font-mono uppercase tracking-widest">{user?.role}</span>
            </div>
            <p className="text-text-muted text-xs font-body mt-0.5">Logged in as <span className="text-amber-400/80">{user?.name}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Admin notification bell */}
          <div className="relative" ref={adminNotifRef}>
            <button onClick={() => setAdminNotifOpen(v => !v)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              <Bell size={16} className="text-amber-400" />
              {adminUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-primary rounded-full text-[9px] text-white font-body font-bold flex items-center justify-center">
                  {adminUnread > 99 ? '99+' : adminUnread}
                </span>
              )}
            </button>

            {adminNotifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-surface border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[420px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                  <span className="font-display text-sm text-white">Admin Notifications</span>
                  {adminUnread > 0 && (
                    <button onClick={adminMarkAllRead} className="text-xs font-body text-primary hover:text-primary/80 transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {adminNotifs.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell size={28} className="text-text-muted mx-auto mb-2 opacity-30" />
                      <p className="text-xs text-text-muted font-body">No notifications</p>
                    </div>
                  ) : adminNotifs.map(n => (
                    <div key={n._id}
                      onClick={() => {
                        adminMarkOne(n._id)
                        setAdminNotifOpen(false)
                        if (n.link) {
                          const tabMatch = n.link.match(/tab=(\w+)/)
                          if (tabMatch) setActiveTab(tabMatch[1] as any)
                          else navigate(n.link)
                        }
                      }}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${!n.read ? 'bg-amber-500/5' : ''}`}>
                      <span className="text-base flex-shrink-0 mt-0.5">{adminNotifIcon[n.type] || '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-body ${!n.read ? 'text-white font-medium' : 'text-text-muted'}`}>{n.title}</p>
                        <p className="text-[11px] text-text-muted font-body mt-0.5 line-clamp-2">{n.body}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-text-muted/50 font-body">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </p>
                          {n.link && <span className="text-[10px] text-amber-400/60 font-body">tap to view →</span>}
                        </div>
                      </div>
                      <button onClick={(e) => adminDeleteNotif(e, n._id)}
                        className="flex-shrink-0 p-1 text-text-muted/40 hover:text-red-400 transition-colors mt-0.5">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link to="/" className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm font-body text-text-muted hover:text-text border border-white/8 hover:border-white/15 transition-all">
            <ChevronRight size={14} className="rotate-180 opacity-60" />
            Back to Site
          </Link>
        </div>

      </div>

      {/* ── Row 1: Main Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-3">
        {[
          { icon: Users,       label: 'Users',        value: stats.userCount,    color: 'text-blue-400',    border: 'border-blue-500/25',    glow: 'from-blue-500/15 to-transparent',    tab: 'users' },
          { icon: BookOpen,    label: 'Local Manga',  value: stats.mangaCount,   color: 'text-green-400',   border: 'border-green-500/25',   glow: 'from-green-500/15 to-transparent',   tab: 'manga' },
          { icon: Layers,      label: 'Chapters',     value: stats.chapterCount, color: 'text-purple-400',  border: 'border-purple-500/25',  glow: 'from-purple-500/15 to-transparent',  tab: 'manga' },
          { icon: Check,       label: 'Published',    value: mangaList.filter(m => m.status === 'ongoing' || m.status === 'completed').length, color: 'text-emerald-400', border: 'border-emerald-500/25', glow: 'from-emerald-500/15 to-transparent', tab: 'manga' },
          { icon: AlertCircle, label: 'Drafts',       value: mangaList.filter(m => m.status === 'hiatus'   || m.status === 'cancelled').length,  color: 'text-yellow-400',  border: 'border-yellow-500/25',  glow: 'from-yellow-500/15 to-transparent',  tab: 'manga' },
          { icon: TrendingUp,  label: 'Manual',       value: mangaList.length,   color: 'text-amber-400',   border: 'border-amber-500/25',   glow: 'from-amber-500/15 to-transparent',   tab: 'manga' },
          { icon: Eye,         label: 'MangaDex',     value: apiTotal,           color: 'text-cyan-400',    border: 'border-cyan-500/25',    glow: 'from-cyan-500/15 to-transparent',    tab: 'manga' },
        ].map(({ icon: Icon, label, value, color, border, glow, tab }) => (
          <button key={label} onClick={() => handleTabChange(tab as any)}
            className={`group relative overflow-hidden glass rounded-2xl p-3.5 flex flex-col gap-2 cursor-pointer border ${border} hover:scale-[1.03] hover:brightness-110 transition-all duration-200 text-left`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${glow} opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none`} />
            <div className="relative z-10 flex items-center justify-between">
              <div className={`w-7 h-7 rounded-lg bg-black/25 flex items-center justify-center ${color}`}>
                <Icon size={13} />
              </div>
              <div className={`w-1.5 h-1.5 rounded-full opacity-50 ${color.replace('text-', 'bg-')}`} />
            </div>
            <div className="relative z-10">
              <p className={`font-display text-2xl font-bold ${color} leading-none tabular-nums`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
              <p className="text-text-muted text-[10px] font-body mt-1 uppercase tracking-widest opacity-70">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Row 2: Chapter Sources Panel ─────────────────────────────────────── */}
      <div className="glass rounded-2xl border border-white/8 mb-6 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-white/5">
          {[
            {
              icon: BookCheck, badge: 'MANGADEX', label: 'Imported Chapters',
              value: stats.mdxImportedChapters, sub: 'From MangaDex API',
              color: 'text-blue-400', badgeClass: 'bg-blue-500/20 border-blue-500/30 text-blue-400', glow: 'from-blue-500/10',
            },
            {
              icon: Globe, badge: 'COMICK', label: 'Gap-fill Chapters',
              value: stats.comickChapters, sub: 'ComicK auto-filled',
              color: 'text-green-400', badgeClass: 'bg-green-500/20 border-green-500/30 text-green-400', glow: 'from-green-500/10',
            },
            {
              icon: FileText, badge: 'MANUAL', label: 'Manual Chapters',
              value: stats.manualChapters, sub: 'Uploaded by admins',
              color: 'text-amber-400', badgeClass: 'bg-amber-500/20 border-amber-500/30 text-amber-400', glow: 'from-amber-500/10',
            },
          ].map(({ icon: Icon, badge, label, value, sub, color, badgeClass, glow }) => {
            const total = (stats.mdxImportedChapters || 0) + (stats.comickChapters || 0) + (stats.manualChapters || 0)
            const pct   = total > 0 ? Math.round(((value || 0) / total) * 100) : 0
            return (
              <div key={badge} className={`relative overflow-hidden flex items-center gap-4 px-5 py-4`}>
                <div className={`absolute inset-0 bg-gradient-to-r ${glow} to-transparent opacity-40 pointer-events-none`} />
                {/* Icon */}
                <div className={`relative z-10 w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon size={16} />
                </div>
                {/* Info */}
                <div className="relative z-10 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${badgeClass}`}>{badge}</span>
                    <span className="text-[10px] text-text-muted font-body">{sub}</span>
                  </div>
                  <p className={`font-display text-2xl font-bold ${color} leading-none tabular-nums`}>{(value || 0).toLocaleString()}</p>
                  <p className="text-text-muted text-[10px] font-body mt-0.5">{label}</p>
                </div>
                {/* Percentage pill */}
                <div className="relative z-10 flex-shrink-0 text-right">
                  <p className={`font-display text-lg font-bold ${color} tabular-nums`}>{pct}%</p>
                  <p className="text-[9px] text-text-muted font-body">of total</p>
                </div>
              </div>
            )
          })}
        </div>
        {/* Progress bar across full width */}
        {(() => {
          const total  = (stats.mdxImportedChapters || 0) + (stats.comickChapters || 0) + (stats.manualChapters || 0)
          if (total === 0) return null
          const mdxPct    = Math.round(((stats.mdxImportedChapters || 0) / total) * 100)
          const comickPct = Math.round(((stats.comickChapters || 0)       / total) * 100)
          const manualPct = 100 - mdxPct - comickPct
          return (
            <div className="border-t border-white/5 px-5 py-2.5 flex items-center gap-3">
              <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest flex-shrink-0">Chapter breakdown</span>
              <div className="flex-1 flex rounded-full overflow-hidden h-1.5 gap-px">
                {mdxPct    > 0 && <div className="bg-blue-400  transition-all" style={{ width: `${mdxPct}%`    }} />}
                {comickPct > 0 && <div className="bg-green-400 transition-all" style={{ width: `${comickPct}%` }} />}
                {manualPct > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${manualPct}%` }} />}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="flex items-center gap-1 text-[9px] text-blue-400/70 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />{mdxPct}%</span>
                <span className="flex items-center gap-1 text-[9px] text-green-400/70 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />{comickPct}%</span>
                <span className="flex items-center gap-1 text-[9px] text-amber-400/70 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{manualPct}%</span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 p-1.5 glass rounded-2xl border border-white/8 overflow-x-auto">
        {([
          ['manga', 'Manga Management', BookOpen],
          ['users', 'Users', Users],
          ['analytics', 'Analytics', BarChart2],
          ['site', 'Site Settings', Settings],
          ['moderation', 'Moderation', AlertTriangle],
          ['requests', 'Requests', BookMarked],
          ['tools', 'Admin Tools', Shield],
        ] as const).map(([tab, label, Icon]: any) => {
          const permMap: Record<string, string> = {
            manga: 'manga', users: 'users', analytics: 'analytics',
            site: 'site', moderation: 'moderation', tools: 'tools.visitors', requests: 'moderation',
          }
          const locked = !isSuperAdmin && tab !== 'manga' && !hasPerm(permMap[tab] || tab)
          const isActive = activeTab === tab
          return (
          <button key={tab} onClick={() => !locked && handleTabChange(tab)}
            title={locked ? "You don't have permission for this tab" : undefined}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-body transition-all whitespace-nowrap flex-shrink-0 ${
              isActive ? 'bg-primary text-white shadow-lg shadow-primary/30 font-medium' :
              locked ? 'text-text-muted/25 cursor-not-allowed' :
              'text-text-muted hover:text-text hover:bg-white/6'
            }`}>
            <Icon size={13} className={isActive ? 'opacity-100' : 'opacity-60'} />
            {label}
            {locked && <span className="ml-0.5 text-[9px] opacity-50">🔒</span>}
            {tab === 'moderation' && !locked && (modCounts.pendingReports + modCounts.flaggedComments + modCounts.flaggedReviews) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-mono rounded-full flex items-center justify-center">
                {modCounts.pendingReports + modCounts.flaggedComments + modCounts.flaggedReviews}
              </span>
            )}
          </button>
          )
        })}

      </div>

      {/* ── MANGA TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === 'manga' && (
        <div>

          {/* ── LIVE MONITOR BAR ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between glass rounded-2xl px-4 py-3 mb-4 border border-white/5">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center gap-2">
                {liveEnabled ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                    </span>
                    <span className="text-xs font-body text-emerald-400 font-semibold tracking-widest uppercase">Live</span>
                  </>
                ) : (
                  <>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-text-muted opacity-40" />
                    <span className="text-xs font-body text-text-muted tracking-widest uppercase">Paused</span>
                  </>
                )}
              </div>
              <div className="w-px h-4 bg-white/10" />
              <span className="text-xs text-text-muted font-body">
                {lastRefreshed ? (secondsSince < 5 ? <span className="text-emerald-400">Just refreshed</span> : `Updated ${secondsSince}s ago`) : 'Loading...'}
              </span>
              <button onClick={silentRefresh} disabled={refreshing} className="p-1 text-text-muted hover:text-text transition-colors disabled:opacity-40">
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-body">Auto-refresh 30s</span>
              <button onClick={() => setLiveEnabled(v => !v)} className={`relative w-9 h-5 rounded-full transition-colors ${liveEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${liveEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* ── SOURCE FILTER + ACTIONS ──────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Source tabs */}
            <div className="flex gap-1 glass rounded-xl p-1 border border-white/10">
              {([
                ['all', 'All on Site'],
                ['api', 'MangaDex API'],
                ['local', 'Manually Added'],
              ] as const).map(([src, label]) => (
                <button key={src} onClick={() => {
                    setMangaSource(src)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-body transition-all ${mangaSource === src ? 'bg-primary text-white' : 'text-text-muted hover:text-text'}`}>
                  {label}
                  {src === 'api' && apiTotal > 0 && <span className="ml-1 opacity-60">{apiTotal.toLocaleString()}</span>}
                  {src === 'local' && mangaList.length > 0 && <span className="ml-1 opacity-60">{mangaList.length}</span>}
                </button>
              ))}
            </div>

            {/* MangaDex search — only when API view is active */}
            {mangaSource !== 'local' && (
              <input
                value={apiSearch}
                onChange={e => setApiSearch(e.target.value)}
                placeholder="Search MangaDex titles..."
                className="flex-1 min-w-[160px] bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-text font-body outline-none focus:border-primary/40 placeholder:text-text-muted"
              />
            )}

            {/* Sort — only for local/all views */}
            {mangaSource !== 'api' && (
              <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 border border-white/10">
                <ArrowUpDown size={13} className="text-text-muted" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-transparent text-sm font-body text-text-muted outline-none cursor-pointer">
                  <option value="newest">Newest Added</option>
                  <option value="oldest">Oldest Added</option>
                  <option value="title-az">Title A → Z</option>
                  <option value="title-za">Title Z → A</option>
                  <option value="most-views">Most Views</option>
                </select>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Add Manga — single canonical button, hidden in API-only view */}
            {mangaSource !== 'api' && (
              <button onClick={() => { setEditingManga(null); setShowMangaForm(true) }}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl transition-all shadow-sm">
                <Plus size={15} /> Add Manga
              </button>
            )}
          </div>

          {/* ── ACTIVITY LOG ─────────────────────────────────────────────── */}
          {showLog && mangaList.length > 0 && (
            <div className="glass rounded-2xl p-5 mb-5 border border-purple-500/15">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <CalendarDays size={13} className="text-purple-400" />
                </div>
                <h3 className="font-display text-sm text-white tracking-widest uppercase">Recently Added Log</h3>
                <span className="text-xs text-text-muted font-body">{mangaList.length} entries</span>
                <button onClick={() => setShowLog(false)} className="ml-auto p-1 text-text-muted hover:text-text transition-colors rounded-lg hover:bg-white/5">
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
                {[...mangaList]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(manga => {
                    const d = new Date(manga.createdAt)
                    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    const isToday = new Date().toDateString() === d.toDateString()
                    return (
                      <div key={manga._id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        </div>
                        <img src={mediaUrl(manga.coverUrl)} alt="" className="w-7 h-9 object-cover rounded-lg flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                          loading="lazy" onError={e => (e.currentTarget.src = 'https://placehold.co/28x36/1a1a2e/white?text=?')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text font-body truncate">{manga.title}</p>
                          <p className="text-xs text-text-muted font-body">{manga.author || 'Unknown author'} · {manga.status}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {isToday
                            ? <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-body">Today</span>
                            : <span className="text-xs text-text-muted font-body">{dateStr}</span>}
                          <p className="text-xs text-text-muted font-body mt-0.5 opacity-60">{timeStr}</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* ── MANGADEX API LIST ─────────────────────────────────────────── */}
          {mangaSource !== 'local' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs font-body text-blue-400 uppercase tracking-widest font-semibold">MangaDex API</span>
                <span className="text-xs text-text-muted font-body ml-1">— {apiTotal.toLocaleString()} titles on your site</span>
              </div>
              {loadingApi ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-52 rounded-xl" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {apiManga.map(m => {
                      const title = getMangaTitle(m)
                      const cover = getCoverUrl(m, 256)
                      const tags = getMangaTags(m).slice(0, 2)
                      const status = m.attributes.status
                      return (
                        <div key={m.id} className="glass rounded-xl overflow-hidden group hover:ring-1 hover:ring-blue-400/30 transition-all relative">
                          <div className="relative">
                            <img src={cover} alt={title} className="w-full h-36 object-cover"
                              loading="lazy" onError={e => (e.currentTarget.src = 'https://placehold.co/120x180/1a1a2e/white?text=No+Cover')} />
                            <div className="absolute top-1.5 left-1.5">
                              <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/80 text-white rounded font-body backdrop-blur-sm">MangaDex</span>
                            </div>
                            <div className="absolute top-1.5 right-1.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-body backdrop-blur-sm"
                                style={{ background: `${STATUS_COLORS[status]}cc`, color: '#fff' }}>{status}</span>
                            </div>
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Link to={`/manga/${m.id}`} className="px-3 py-1.5 bg-primary text-white text-[10px] font-body rounded-lg hover:bg-primary/90 transition-colors">View</Link>
                              <button onClick={e => { e.preventDefault(); setQuickImportId(m.id) }}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-body rounded-lg hover:bg-emerald-500 transition-colors">+ Import</button>
                            </div>
                            {importedMangaIds.has(m.id) && (
                              <div className="absolute bottom-1.5 left-1.5">
                                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/80 text-white rounded font-body backdrop-blur-sm flex items-center gap-1">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                                  Imported
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs text-text font-body line-clamp-2 leading-tight mb-1">{title}</p>
                            <p className="text-[10px] text-text-muted font-body truncate">{tags.join(', ') || '—'}</p>
                            {m.attributes.year && <p className="text-[10px] text-text-muted font-body opacity-50">{m.attributes.year}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
                    <span className="text-xs text-text-muted font-body">
                      Showing {apiPage * 24 + 1}–{Math.min((apiPage + 1) * 24, apiTotal)} of {apiTotal.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <button disabled={apiPage === 0} onClick={() => setApiPage(p => p - 1)}
                        className="px-3 py-1.5 glass rounded-lg text-xs font-body text-text-muted hover:text-text disabled:opacity-30 transition-colors">← Prev</button>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-text-muted font-body">Page</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.ceil(apiTotal / 24)}
                          defaultValue={apiPage + 1}
                          key={apiPage}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const val = parseInt((e.target as HTMLInputElement).value)
                              const max = Math.ceil(apiTotal / 24)
                              if (!isNaN(val) && val >= 1 && val <= max) setApiPage(val - 1)
                            }
                          }}
                          className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-text font-body text-center outline-none focus:border-primary/50"
                        />
                        <span className="text-xs text-text-muted font-body">of {Math.ceil(apiTotal / 24).toLocaleString()}</span>
                      </div>
                      <button disabled={(apiPage + 1) * 24 >= apiTotal} onClick={() => setApiPage(p => p + 1)}
                        className="px-3 py-1.5 glass rounded-lg text-xs font-body text-text-muted hover:text-text disabled:opacity-30 transition-colors">Next →</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── LOCALLY ADDED LIST ────────────────────────────────────────── */}
          {mangaSource !== 'api' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-body text-amber-400 uppercase tracking-widest font-semibold">Manually Added</span>
                <span className="text-xs text-text-muted font-body ml-1">— {mangaList.length + importedOverview.length} title{(mangaList.length + importedOverview.length) !== 1 ? 's' : ''} with manually added chapters</span>
                {mangaList.length > 0 && (
                  <button onClick={() => setShowLog(v => !v)}
                    className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-body border transition-all ${showLog ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'glass border-white/10 text-text-muted hover:text-text'}`}>
                    <Activity size={11} /> Activity Log
                  </button>
                )}

              {/* Quick Add Chapter shortcut */}
              {mangaList.length > 0 && (
                <div className="mt-3 flex items-center gap-2 p-3 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={13} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-body text-amber-300 font-medium">Quick Add Chapter</p>
                    <p className="text-[10px] text-text-muted font-body truncate">Select a manga below and tap <span className="text-amber-400">Add Chapter</span> to upload pages</p>
                  </div>
                  <select
                    onChange={e => { if (e.target.value) setShowChapterForm(e.target.value) }}
                    defaultValue=""
                    className="text-xs font-body bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl px-3 py-1.5 outline-none cursor-pointer hover:bg-amber-500/20 transition-colors max-w-[180px] truncate"
                  >
                    <option value="" disabled>Pick manga...</option>
                    {mangaList.map(m => (
                      <option key={m._id} value={m._id}>{m.title}</option>
                    ))}
                  </select>
                </div>
              )}
              </div>
              {loadingData ? (
                <div className="flex flex-col gap-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
              ) : mangaList.length === 0 ? (
                <div className="flex items-center gap-3 glass rounded-xl px-4 py-3 border border-white/5">
                  <BookOpen size={14} className="text-text-muted opacity-40 flex-shrink-0" />
                  <p className="text-xs text-text-muted font-body">No manga manually added yet. Use <span className="text-primary font-medium">+ Add Manga</span> above to get started.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {[...mangaList]
                    .sort((a, b) => {
                      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                      if (sortBy === 'title-az') return a.title.localeCompare(b.title)
                      if (sortBy === 'title-za') return b.title.localeCompare(a.title)
                      if (sortBy === 'most-views') return b.views - a.views
                      return 0
                    })
                    .map(manga => {
                      const addedDate = new Date(manga.createdAt)
                      const isToday = new Date().toDateString() === addedDate.toDateString()
                      const dateLabel = isToday ? 'Added today' : `Added ${addedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      return (
                        <div key={manga._id} className={`glass rounded-2xl overflow-hidden transition-all duration-700 border ${newlyDetected.has(manga._id) ? 'ring-1 ring-emerald-400/40 bg-emerald-500/5 border-emerald-500/20' : 'border-white/5 hover:border-white/10'}`}>
                          <div className="flex items-center gap-4 p-4">
                            <div className="relative flex-shrink-0">
                              <img src={mediaUrl(manga.coverUrl)} alt={manga.title} className="w-12 h-16 object-cover rounded-xl"
                                loading="lazy" onError={e => (e.currentTarget.src = 'https://placehold.co/48x64/1a1a2e/white?text=No+Cover')} />
                              <span className="absolute -top-1 -left-1 text-[8px] px-1 py-0.5 bg-amber-500/90 text-white rounded font-body">Manual</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-body text-text font-medium line-clamp-1">{manga.title}</h3>
                                {manga.featured && <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">Featured</span>}
                                {newlyDetected.has(manga._id) && (
                                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-body animate-pulse">● NEW</span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted font-body mt-0.5">
                                {manga.status} · {manga.genres.slice(0, 3).join(', ')} · {manga.views} views
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock size={10} className={isToday ? 'text-emerald-400' : 'text-text-muted'} />
                                <span className={`text-xs font-body ${isToday ? 'text-emerald-400' : 'text-text-muted opacity-60'}`}>{dateLabel}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => setShowChapterForm(manga._id)}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500/25 to-orange-500/15 border border-amber-500/40 text-amber-400 text-xs font-body rounded-xl hover:from-amber-500/35 hover:to-orange-500/25 hover:border-amber-500/60 hover:text-amber-300 transition-all shadow-sm shadow-amber-500/10 font-medium">
                                <Plus size={13} /> Add Chapter
                              </button>
                              <button onClick={() => { setEditingManga(manga); setShowMangaForm(true) }}
                                className="p-2 glass rounded-lg text-text-muted hover:text-text transition-colors">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => deleteManga(manga._id)}
                                className="p-2 glass rounded-lg text-text-muted hover:text-red-400 transition-colors">
                                <Trash2 size={14} />
                              </button>
                              <button onClick={() => toggleExpand(manga._id)}
                                className="p-2 glass rounded-lg text-text-muted hover:text-text transition-colors">
                                {expandedManga === manga._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                          </div>
                          {expandedManga === manga._id && (
                            <div className="border-t border-white/5 bg-black/20 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center">
                                  <Layers size={11} className="text-text-muted" />
                                </div>
                                <p className="text-xs text-text-muted font-body uppercase tracking-widest">Chapters</p>
                                <span className="text-xs px-2 py-0.5 bg-white/5 rounded-full font-mono text-text-muted">{chapters[manga._id]?.length || 0}</span>
                              </div>
                                <button onClick={() => setShowChapterForm(manga._id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-body rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors">
                                  <Plus size={11} /> Add Chapter
                                </button>
                              </div>
                              {!chapters[manga._id] ? (
                                <p className="text-xs text-text-muted font-body">Loading...</p>
                              ) : chapters[manga._id].length === 0 ? (
                                <p className="text-xs text-text-muted font-body">No chapters yet.</p>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {chapters[manga._id].map(ch => (
                                    <div key={ch._id} className="rounded-xl overflow-hidden">
                                      <div className="flex items-center justify-between bg-white/5 px-4 py-2.5">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm text-text font-body">
                                              {ch.volume && `Vol.${ch.volume} `}Ch.{ch.chapterNumber}
                                              {ch.title && <span className="text-text-muted"> — {ch.title}</span>}
                                            </span>
                                            {ch.externalUrl ? (
                                              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 rounded font-mono">
                                                <Globe size={8} /> OFFICIAL
                                              </span>
                                            ) : (
                                              <span className="text-xs text-text-muted">{ch.pages.length} pages</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          {ch.externalUrl ? (
                                            <a href={ch.externalUrl} target="_blank" rel="noopener noreferrer"
                                              className="text-xs text-orange-400 hover:underline font-body flex items-center gap-1">
                                              <Globe size={10} /> Open
                                            </a>
                                          ) : (
                                            <Link to={`/read/local/${ch._id}`} className="text-xs text-accent hover:underline font-body">Preview</Link>
                                          )}
                                          <button
                                            onClick={() => setEditingChapter(editingChapter?._id === ch._id ? null : ch)}
                                            className={`p-1.5 rounded-lg transition-colors ${editingChapter?._id === ch._id ? 'text-amber-400 bg-amber-500/15' : 'text-text-muted hover:text-amber-400 hover:bg-amber-500/10'}`}
                                            title="Edit chapter">
                                            <Edit3 size={12} />
                                          </button>
                                          <button onClick={() => deleteChapter(manga._id, ch._id)} className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                      {/* Inline edit form */}
                                      {editingChapter?._id === ch._id && (
                                        <ChapterEditForm
                                          chapter={ch}
                                          onClose={() => setEditingChapter(null)}
                                          onSave={async (data) => {
                                            const res = await axios.patch(`/api/admin/chapters/${ch._id}`, data, { withCredentials: true })
                                            setChapters(prev => ({
                                              ...prev,
                                              [manga._id]: prev[manga._id].map(c => c._id === ch._id ? res.data : c)
                                            }))
                                            setEditingChapter(null)
                                          }}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}

              {/* ── MANGADEX IMPORTED CARDS ─────────────────────────────── */}
              {importedOverview.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                    <span className="text-xs font-body text-violet-400 uppercase tracking-widest font-semibold">MangaDex Imported</span>
                    <span className="text-xs text-text-muted font-body ml-1">— {importedOverview.length} manga with imported chapters</span>
                    <button onClick={() => {
                      setLoadingImported(true)
                      axios.get('/api/admin/mangadex/imported-overview', { withCredentials: true })
                        .then(r => setImportedOverview(r.data)).catch(() => {}).finally(() => setLoadingImported(false))
                    }} className="ml-2 p-1 text-text-muted hover:text-text transition-colors">
                      <RefreshCw size={12} className={loadingImported ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {importedOverview.map((item: any) => (
                      <div key={item.mangaDexId} className="glass rounded-2xl overflow-hidden border border-violet-500/15 hover:border-violet-500/30 transition-all">
                        <div className="flex items-center gap-4 p-4">
                          {item.coverUrl ? (
                            <img src={mediaUrl(item.coverUrl)} alt={item.title}
                              className="w-10 h-14 object-cover rounded-xl flex-shrink-0"
                              loading="lazy" onError={e => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <div className="w-10 h-14 bg-white/5 rounded-xl flex-shrink-0 flex items-center justify-center">
                              <BookOpen size={12} className="text-text-muted" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-body text-sm text-text font-semibold truncate">{item.title}</h3>
                              <span className="text-[9px] px-1.5 py-0.5 bg-violet-500/20 border border-violet-500/30 text-violet-400 rounded font-mono">MDX</span>
                              <span className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-white/10 text-text-muted rounded font-mono capitalize">{item.status}</span>
                            </div>
                            <p className="text-xs text-text-muted font-body mt-1">{item.chapterCount} imported chapter{item.chapterCount !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Link to={`/manga/${item.mangaDexId}`}
                              className="px-3 py-1.5 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-colors">
                              View Page
                            </Link>
                            <button onClick={() => setExpandedImported(expandedImported === item.mangaDexId ? null : item.mangaDexId)}
                              className="p-2 glass rounded-xl text-text-muted hover:text-text transition-colors">
                              {expandedImported === item.mangaDexId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>
                        {expandedImported === item.mangaDexId && (
                          <div className="border-t border-white/5 bg-black/20 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Layers size={11} className="text-text-muted" />
                              <span className="text-xs text-text-muted font-body uppercase tracking-widest">Chapters</span>
                              <span className="text-xs px-2 py-0.5 bg-white/5 rounded-full font-mono text-text-muted">{item.chapters.length}</span>
                            </div>
                            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                              {[...item.chapters].sort((a: any, b: any) => parseFloat(a.chapterNumber) - parseFloat(b.chapterNumber)).map((ch: any) => (
                                <div key={ch._id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5">
                                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                    <span className="text-sm text-text font-body">
                                      {ch.volume ? `Vol.${ch.volume} ` : ''}Ch.{ch.chapterNumber}
                                      {ch.title && <span className="text-text-muted"> — {ch.title}</span>}
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                                      ch.source === 'mangadex'
                                        ? 'bg-blue-500/15 border-blue-500/25 text-blue-400'
                                        : 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                                    }`}>
                                      {ch.source === 'mangadex' ? 'MANGADEX' : 'MANUAL'}
                                    </span>
                                    {ch.published === false && (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 rounded font-mono">draft</span>
                                    )}
                                    {ch.publishAt && (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/25 text-blue-400 rounded font-mono flex items-center gap-1">
                                        <Clock size={8} /> {new Date(ch.publishAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-xs text-text-muted font-body">{ch.pages?.length || 0}p</span>
                                    <button onClick={async () => {
                                      if (!confirm(`Delete Ch.${ch.chapterNumber}?`)) return
                                      await axios.delete(`/api/admin/mangadex/chapters/${ch._id}`, { withCredentials: true })
                                      setImportedOverview(prev => prev.map((m: any) =>
                                        m.mangaDexId === item.mangaDexId
                                          ? { ...m, chapters: m.chapters.filter((c: any) => c._id !== ch._id), chapterCount: m.chapterCount - 1 }
                                          : m
                                      ).filter((m: any) => m.chapterCount > 0))
                                    }} className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── USERS TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (

        <div className="space-y-8">
          <UserManagementTab
            users={users}
            loadingData={loadingData}
            currentUserId={user?.id}
            onUsersChange={setUsers}
          />
          {isSuperAdmin && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-yellow-500/20 text-yellow-400">SUPER ADMIN ONLY</span>
              </div>
              <AdminPermissionManager />

            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div>
          {loadingAnalytics ? (
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-64 rounded-2xl" />)}
            </div>
          ) : !analytics ? (
            <div className="text-center py-20">
              <p className="text-text-muted font-body mb-1">Failed to load analytics.</p>
              {analyticsError && <p className="text-red-400 text-xs font-mono mb-4 bg-red-400/10 px-4 py-2 rounded-xl inline-block">{analyticsError}</p>}
              <div>
                <button onClick={loadAnalytics} className="mt-2 px-4 py-2 glass rounded-xl text-sm font-body text-text-muted hover:text-text">Retry</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">



              <div className="flex justify-end">
                <button onClick={loadAnalytics}
                  className="flex items-center gap-2 px-3 py-1.5 glass rounded-xl text-xs font-body text-text-muted hover:text-text transition-colors">
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>


              {/* Summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Eye, label: 'Total Views', value: analytics.summary.totalViews.toLocaleString(), color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
                  { icon: Heart, label: 'Total Saves', value: analytics.summary.totalSaves.toLocaleString(), color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
                  { icon: Users, label: 'New This Week', value: `+${analytics.summary.newUsersThisWeek}`, color: 'text-green-400 bg-green-400/10 border-green-400/20' },
                  { icon: Layers, label: 'Total Manga', value: analytics.summary.totalManga.toLocaleString(), sub: `${analytics.summary.localMangaCount} local · ${analytics.summary.mdxMangaCount} MangaDex`, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
                ].map(({ icon: Icon, label, value, color, sub }: any) => (

                  <div key={label} className={`glass rounded-2xl p-4 border ${color.split(' ')[2]}`}>
                    <div className={`w-8 h-8 rounded-xl ${color.split(' ')[1]} ${color.split(' ')[2]} border flex items-center justify-center mb-2`}>
                      <Icon size={14} className={color.split(' ')[0]} />
                    </div>
                    <p className={`font-display text-2xl ${color.split(' ')[0]}`}>{value}</p>
                    <p className="text-text-muted text-xs font-body mt-0.5">{label}</p>

                    {sub && <p className="text-text-muted/60 text-[10px] font-body mt-0.5">{sub}</p>}

                  </div>
                ))}
              </div>

              {/* Chapter Source Breakdown */}
              <div className="glass rounded-2xl p-4 border border-white/8">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={13} className="text-text-muted" />
                  <span className="text-xs font-body text-text-muted uppercase tracking-widest font-semibold">Chapter Sources</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-[10px] font-mono text-blue-400 uppercase">MangaDex</span>
                    </div>
                    <p className="font-display text-xl text-blue-400">{(analytics.summary.mdxImportedChapters ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-text-muted font-body">Imported</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-[10px] font-mono text-green-400 uppercase">ComicK</span>
                    </div>
                    <p className="font-display text-xl text-green-400">{(analytics.summary.comickChapters ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-text-muted font-body">Gap-fills</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-[10px] font-mono text-amber-400 uppercase">Manual</span>
                    </div>
                    <p className="font-display text-xl text-amber-400">{(analytics.summary.manualChapters ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-text-muted font-body">Uploaded</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-violet-400" />
                      <span className="text-[10px] font-mono text-violet-400 uppercase">Total</span>
                    </div>
                    <p className="font-display text-xl text-violet-400">{((analytics.summary.mdxImportedChapters ?? 0) + (analytics.summary.comickChapters ?? 0) + (analytics.summary.manualChapters ?? 0)).toLocaleString()}</p>
                    <p className="text-[10px] text-text-muted font-body">All stored</p>
                  </div>
                </div>
                {(() => {
                  const mdx    = analytics.summary.mdxImportedChapters ?? 0
                  const comick = analytics.summary.comickChapters ?? 0
                  const manual = analytics.summary.manualChapters ?? 0
                  const total  = mdx + comick + manual
                  if (total === 0) return null
                  const mdxPct    = Math.round((mdx    / total) * 100)
                  const comickPct = Math.round((comick / total) * 100)
                  const manualPct = 100 - mdxPct - comickPct
                  return (
                    <div className="mt-3">
                      <div className="flex rounded-full overflow-hidden h-1.5 gap-0.5">
                        {mdxPct    > 0 && <div className="bg-blue-400  rounded-full transition-all" style={{ width: `${mdxPct}%`    }} />}
                        {comickPct > 0 && <div className="bg-green-400 rounded-full transition-all" style={{ width: `${comickPct}%` }} />}
                        {manualPct > 0 && <div className="bg-amber-400 rounded-full transition-all" style={{ width: `${manualPct}%` }} />}
                      </div>
                      <div className="flex justify-between mt-1 flex-wrap gap-1">
                        <span className="text-[9px] text-blue-400/60 font-mono">{mdxPct}% MangaDex</span>
                        <span className="text-[9px] text-green-400/60 font-mono">{comickPct}% ComicK</span>
                        <span className="text-[9px] text-amber-400/60 font-mono">{manualPct}% Manual</span>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Engagement row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass rounded-2xl p-4 border border-amber-400/20">
                  <p className="text-text-muted text-xs font-body mb-1">Comments (30d)</p>
                  <p className="font-display text-2xl text-amber-400">{analytics.summary.totalComments30d.toLocaleString()}</p>
                </div>
                <div className="glass rounded-2xl p-4 border border-cyan-400/20">
                  <p className="text-text-muted text-xs font-body mb-1">Reviews (30d)</p>
                  <p className="font-display text-2xl text-cyan-400">{analytics.summary.totalReviews30d.toLocaleString()}</p>
                  {analytics.summary.avgRating30d && (
                    <p className="text-text-muted/60 text-[10px] font-body mt-0.5">avg {analytics.summary.avgRating30d}/10</p>
                  )}
                </div>
                <div className="glass rounded-2xl p-4 border border-orange-400/20">
                  <p className="text-text-muted text-xs font-body mb-1">User Retention</p>
                  {analytics.summary.retentionRate !== null ? (
                    <>
                      <p className="font-display text-2xl text-orange-400">{analytics.summary.retentionRate}%</p>
                      <p className="text-text-muted/60 text-[10px] font-body mt-0.5">of {analytics.summary.cohortSize} users came back</p>
                    </>
                  ) : (
                    <p className="font-display text-2xl text-text-muted">—</p>
                  )}
                </div>
                <div className="glass rounded-2xl p-4 border border-indigo-400/20">
                  <p className="text-text-muted text-xs font-body mb-1">Total Chapters</p>
                  <p className="font-display text-2xl text-indigo-400">{analytics.summary.totalChapters.toLocaleString()}</p>
                </div>
              </div>

              {/* Reading Activity + DAU */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="glass rounded-2xl p-5">
                  <h3 className="font-display text-sm text-white tracking-widest mb-4 uppercase">Reading Activity (30d)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={analytics.activityData}>
                      <defs>
                        <linearGradient id="readsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e8394d" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#e8394d" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />

                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} interval={6} axisLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip {...TooltipStyle} />
                      <Area type="monotone" dataKey="reads" stroke="#e8394d" strokeWidth={2} fill="url(#readsGrad)" dot={false} />

                    </AreaChart>
                  </ResponsiveContainer>
                </div>


                <div className="glass rounded-2xl p-5">
                  <h3 className="font-display text-sm text-white tracking-widest mb-4 uppercase">Daily Active Users (14d)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={analytics.dauData}>
                      <defs>
                        <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} interval={3} axisLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip {...TooltipStyle} />
                      <Area type="monotone" dataKey="dau" stroke="#f59e0b" strokeWidth={2} fill="url(#dauGrad)" dot={false} />

                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>


              {/* New Users */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display text-sm text-white tracking-widest mb-4 uppercase">New Users (30d)</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={analytics.userGrowthData}>
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c6af7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c6af7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} interval={6} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip {...TooltipStyle} />
                    <Area type="monotone" dataKey="count" stroke="#7c6af7" strokeWidth={2} fill="url(#userGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top by Views + Top by Saves */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-display text-sm text-white tracking-widest mb-4 uppercase">Top by Views</h3>
                  {analytics.topManga.length === 0 ? (
                    <p className="text-text-muted text-sm font-body text-center py-8">No data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.topManga} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="title" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                        <Tooltip {...TooltipStyle} formatter={(v) => [v, 'Views']} />
                        <Bar dataKey="views" radius={[0, 6, 6, 0]}>
                          {analytics.topManga.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="glass rounded-2xl p-5">
                  <h3 className="font-display text-sm text-white tracking-widest mb-4 uppercase">Top by Saves</h3>
                  {analytics.topSaved.length === 0 ? (
                    <p className="text-text-muted text-sm font-body text-center py-8">No save data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.topSaved} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="title" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                        <Tooltip {...TooltipStyle} formatter={(v) => [v, 'Saves']} />
                        <Bar dataKey="saves" radius={[0, 6, 6, 0]}>
                          {analytics.topSaved.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Most Commented */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display text-sm text-white tracking-widest mb-4 uppercase">Most Commented (30d)</h3>
                {analytics.mostCommented.length === 0 ? (
                  <p className="text-text-muted text-sm font-body text-center py-8">No comments yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.mostCommented} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="title" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                      <Tooltip {...TooltipStyle} formatter={(v) => [v, 'Comments']} />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {analytics.mostCommented.map((_, i) => (

                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>


              {/* Genre Distribution */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-display text-sm text-white tracking-widest mb-4 uppercase">Genre Distribution</h3>
                {analytics.genreData.length === 0 ? (
                  <p className="text-text-muted text-sm font-body text-center py-8">No genre data</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={180}>
                      <PieChart>
                        <Pie data={analytics.genreData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                          {analytics.genreData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...TooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {analytics.genreData.slice(0, 6).map((g, i) => (
                        <div key={g.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-xs text-text-muted font-body">{g.name}</span>
                          </div>
                          <span className="text-xs text-text font-mono">{g.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}
        </div>
      )}


      {/* ── SITE SETTINGS TAB ──────────────────────────────────────────────── */}
      {activeTab === 'site' && (
        <SiteSettingsTab
          siteSettings={siteSettings}
          loadingSite={loadingSite}
          genres={genres}
          setGenres={setGenres}
          featuredPicks={featuredPicks}
          setFeaturedPicks={setFeaturedPicks}
          bannerSlides={bannerSlides}
          setBannerSlides={setBannerSlides}
          saveFeatured={saveFeatured}
          saveBanner={saveBanner}
          siteSaved={siteSaved}
        />
      )}


      {/* ── MODERATION TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'moderation' && (
        <ModerationTab modCounts={modCounts} onCountsChange={setModCounts} />
      )}

      {/* ── REQUESTS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <AdminRequestsTab />
      )}

      {/* ── ADMIN TOOLS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'tools' && (
        <AdminToolsTab />
      )}

      {/* QUICK IMPORT MODAL */}
      {quickImportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#13131a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={20} className="text-emerald-400" />
            </div>
            <h3 className="font-display text-lg text-white mb-2">Quick Import</h3>
            <p className="text-xs text-text-muted font-body mb-5">Go to the manga detail page to import chapters from MangaDex.</p>
            <div className="flex gap-3">
              <button onClick={() => setQuickImportId(null)}
                className="flex-1 px-4 py-2 glass rounded-xl text-sm font-body text-text-muted hover:text-text transition-colors">
                Cancel
              </button>
              <Link to={`/manga/${quickImportId}`}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-body rounded-xl transition-colors text-center">
                Go to Manga
              </Link>
            </div>
          </div>
        </div>
      )}


      {/* MANGA FORM MODAL */}
      {showMangaForm && (
        <MangaFormModal
          manga={editingManga}
          onClose={() => { setShowMangaForm(false); setEditingManga(null) }}
          onSave={async (data) => {
            if (editingManga) {
              const res = await axios.put(`/api/admin/manga/${editingManga._id}`, data, { withCredentials: true })
              setMangaList(prev => prev.map(m => m._id === editingManga._id ? res.data : m))
            } else {
              const res = await axios.post('/api/admin/manga', data, { withCredentials: true })
              setMangaList(prev => [res.data, ...prev])
              setStats(s => ({ ...s, mangaCount: s.mangaCount + 1 }))
            }
            setShowMangaForm(false)
            setEditingManga(null)
          }}
        />
      )}

      {/* CHAPTER FORM MODAL */}
      {showChapterForm && (
        <ChapterFormModal
          mangaId={showChapterForm}
          existingChapters={chapters[showChapterForm] || []}
          onClose={() => setShowChapterForm(null)}
          onSave={async (data) => {
            const res = await axios.post(`/api/admin/manga/${showChapterForm}/chapters`, data, { withCredentials: true })
            setChapters(prev => ({ ...prev, [showChapterForm]: [...(prev[showChapterForm] || []), res.data] }))
            if (expandedManga !== showChapterForm) setExpandedManga(showChapterForm)
            setStats(s => ({ ...s, chapterCount: s.chapterCount + 1 }))
            setShowChapterForm(null)
          }}
        />
      )}
    </div>
  )
}




// ─── Moderation Tab ───────────────────────────────────────────────────────────
function ModerationTab({ modCounts, onCountsChange }: {
  modCounts: { pendingReports: number; flaggedComments: number; flaggedReviews: number }
  onCountsChange: (c: any) => void
}) {
  const [modTab, setModTab] = useState<'reports' | 'comments' | 'reviews'>('reports')
  const [reportFilter, setReportFilter] = useState<'pending' | 'resolved' | 'dismissed'>('pending')
  const [commentFilter, setCommentFilter] = useState<'all' | 'flagged'>('all')
  const [reviewFilter, setReviewFilter] = useState<'all' | 'flagged'>('all')

  const [reports, setReports] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const [reviewTotal, setReviewTotal] = useState(0)
  const [commentPage, setCommentPage] = useState(0)
  const [reviewPage, setReviewPage] = useState(0)
  const [loading, setLoading] = useState(false)

  const refreshCounts = async () => {
    const res = await axios.get('/api/admin/moderation/counts', { withCredentials: true })
    onCountsChange(res.data)
  }

  const loadReports = async (status = reportFilter) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/admin/moderation/reports?status=${status}`, { withCredentials: true })
      setReports(res.data)
    } finally { setLoading(false) }
  }

  const loadComments = async (page = commentPage, flagged = commentFilter) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/admin/moderation/comments?page=${page}&flagged=${flagged === 'flagged'}`, { withCredentials: true })
      setComments(res.data.comments)
      setCommentTotal(res.data.total)
    } finally { setLoading(false) }
  }

  const loadReviews = async (page = reviewPage, flagged = reviewFilter) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/admin/moderation/reviews?page=${page}&flagged=${flagged === 'flagged'}`, { withCredentials: true })
      setReviews(res.data.reviews)
      setReviewTotal(res.data.total)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadReports() }, [reportFilter])
  useEffect(() => { loadComments(0, commentFilter); setCommentPage(0) }, [commentFilter])
  useEffect(() => { loadReviews(0, reviewFilter); setReviewPage(0) }, [reviewFilter])
  useEffect(() => {
    if (modTab === 'reports') loadReports()
    else if (modTab === 'comments') loadComments()
    else loadReviews()
  }, [modTab])

  const resolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
    await axios.put(`/api/admin/moderation/reports/${id}`, { status }, { withCredentials: true })
    setReports(prev => prev.filter(r => r._id !== id))
    refreshCounts()
  }

  const deleteComment = async (id: string) => {
    if (!confirm('Delete this comment?')) return
    await axios.delete(`/api/admin/comments/${id}`, { withCredentials: true })
    setComments(prev => prev.filter(c => c._id !== id))
    refreshCounts()
  }

  const flagComment = async (id: string, flagged: boolean) => {
    await axios.put(`/api/admin/moderation/comments/${id}/flag`, { flagged }, { withCredentials: true })
    setComments(prev => prev.map(c => c._id === id ? { ...c, flagged } : c))
    refreshCounts()
  }

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review?')) return
    await axios.delete(`/api/admin/reviews/${id}`, { withCredentials: true })
    setReviews(prev => prev.filter(r => r._id !== id))
    refreshCounts()
  }

  const flagReview = async (id: string, flagged: boolean) => {
    await axios.put(`/api/admin/moderation/reviews/${id}/flag`, { flagged }, { withCredentials: true })
    setReviews(prev => prev.map(r => r._id === id ? { ...r, flagged } : r))
    refreshCounts()
  }

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {([
          ['reports', 'Reports', modCounts.pendingReports, AlertTriangle, 'text-red-400'],
          ['comments', 'Comments', modCounts.flaggedComments, MessageSquare, 'text-purple-400'],
          ['reviews', 'Reviews', modCounts.flaggedReviews, FileText, 'text-blue-400'],
        ] as const).map(([t, label, count, Icon, color]: any) => (
          <button key={t} onClick={() => setModTab(t)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body transition-all ${modTab === t ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
            <Icon size={13} className={modTab === t ? '' : color} />
            {label}
            {count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${modTab === t ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-400'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── REPORTS ── */}
      {modTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['pending', 'resolved', 'dismissed'] as const).map(s => (
              <button key={s} onClick={() => setReportFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-body transition-all capitalize ${reportFilter === s ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-text-muted font-body text-sm border border-dashed border-white/10 rounded-2xl">
              {reportFilter === 'pending' ? '✓ No pending reports' : `No ${reportFilter} reports`}
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r: any) => (
                <div key={r._id} className="glass rounded-2xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${r.targetType === 'comment' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {r.targetType.toUpperCase()}
                        </span>
                        <span className="text-xs text-text-muted font-body">by <span className="text-text">{r.targetUserName}</span></span>
                        <span className="text-[10px] text-text-muted/50 font-body">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-text/80 font-body bg-white/5 rounded-lg px-3 py-2 line-clamp-3 italic">
                        "{r.targetBody || '(no content)'}"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text-muted font-body">
                        Reported by <span className="text-text">{r.reportedByName}</span>:
                        <span className="text-red-400 ml-1">"{r.reason}"</span>
                      </p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => resolveReport(r._id, 'resolved')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-body rounded-xl transition-all">
                          <Trash2 size={11} /> Delete Content
                        </button>
                        <button onClick={() => resolveReport(r._id, 'dismissed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 glass border border-white/10 text-text-muted hover:text-text text-xs font-body rounded-xl transition-all">
                          <X size={11} /> Dismiss
                        </button>
                      </div>
                    )}
                    {r.status !== 'pending' && (
                      <span className={`text-xs font-mono px-2 py-1 rounded-lg ${r.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-text-muted'}`}>
                        {r.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── COMMENTS ── */}
      {modTab === 'comments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'flagged'] as const).map(f => (
                <button key={f} onClick={() => setCommentFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-body transition-all capitalize ${commentFilter === f ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
                  {f === 'flagged' ? `⚑ Flagged (${modCounts.flaggedComments})` : 'All Comments'}
                </button>
              ))}
            </div>
            <span className="text-xs text-text-muted font-body">{commentTotal} total</span>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-16 text-text-muted font-body text-sm border border-dashed border-white/10 rounded-2xl">No comments found</div>
          ) : (
            <>
              <div className="space-y-2">
                {comments.map((c: any) => (
                  <div key={c._id} className={`flex items-start gap-3 glass rounded-xl p-3 border ${c.flagged ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'}`}>
                    {c.userAvatar
                      ? <img src={c.userAvatar} className="w-7 h-7 rounded-lg object-cover flex-shrink-0 mt-0.5"  loading="lazy"/>
                      : <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 mt-0.5">{c.userName?.[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs text-text font-body font-medium">{c.userName}</span>
                        {c.flagged && <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-1 rounded">FLAGGED</span>}
                        <span className="text-[10px] text-text-muted/50">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-text-muted font-body line-clamp-2">{c.body}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => flagComment(c._id, !c.flagged)}
                        className={`p-1.5 rounded-lg transition-colors ${c.flagged ? 'text-red-400 hover:text-red-300 bg-red-500/10' : 'text-text-muted hover:text-amber-400'}`}
                        title={c.flagged ? 'Unflag' : 'Flag'}>
                        <AlertTriangle size={11} />
                      </button>
                      <button onClick={() => deleteComment(c._id)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors rounded-lg">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination */}
              {commentTotal > 30 && (
                <div className="flex items-center justify-center gap-3">
                  <button disabled={commentPage === 0} onClick={() => { setCommentPage(p => p-1); loadComments(commentPage-1) }}
                    className="p-2 glass rounded-xl text-text-muted hover:text-text disabled:opacity-30 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-text-muted font-body">Page {commentPage+1} of {Math.ceil(commentTotal/30)}</span>
                  <button disabled={(commentPage+1)*30 >= commentTotal} onClick={() => { setCommentPage(p => p+1); loadComments(commentPage+1) }}
                    className="p-2 glass rounded-xl text-text-muted hover:text-text disabled:opacity-30 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── REVIEWS ── */}
      {modTab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'flagged'] as const).map(f => (
                <button key={f} onClick={() => setReviewFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-body transition-all capitalize ${reviewFilter === f ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
                  {f === 'flagged' ? `⚑ Flagged (${modCounts.flaggedReviews})` : 'All Reviews'}
                </button>
              ))}
            </div>
            <span className="text-xs text-text-muted font-body">{reviewTotal} total</span>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-16 text-text-muted font-body text-sm border border-dashed border-white/10 rounded-2xl">No reviews found</div>
          ) : (
            <>
              <div className="space-y-2">
                {reviews.map((r: any) => (
                  <div key={r._id} className={`flex items-start gap-3 glass rounded-xl p-3 border ${r.flagged ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'}`}>
                    {r.userAvatar
                      ? <img src={r.userAvatar} className="w-7 h-7 rounded-lg object-cover flex-shrink-0 mt-0.5"  loading="lazy"/>
                      : <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 mt-0.5">{r.userName?.[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs text-text font-body font-medium">{r.userName}</span>
                        <span className="text-xs font-mono text-amber-400">★ {r.rating}/10</span>
                        {r.flagged && <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-1 rounded">FLAGGED</span>}
                        <span className="text-[10px] text-text-muted/50">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      {r.body && <p className="text-xs text-text-muted font-body line-clamp-2">{r.body}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => flagReview(r._id, !r.flagged)}
                        className={`p-1.5 rounded-lg transition-colors ${r.flagged ? 'text-red-400 hover:text-red-300 bg-red-500/10' : 'text-text-muted hover:text-amber-400'}`}
                        title={r.flagged ? 'Unflag' : 'Flag'}>
                        <AlertTriangle size={11} />
                      </button>
                      <button onClick={() => deleteReview(r._id)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors rounded-lg">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {reviewTotal > 30 && (
                <div className="flex items-center justify-center gap-3">
                  <button disabled={reviewPage === 0} onClick={() => { setReviewPage(p => p-1); loadReviews(reviewPage-1) }}
                    className="p-2 glass rounded-xl text-text-muted hover:text-text disabled:opacity-30 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-text-muted font-body">Page {reviewPage+1} of {Math.ceil(reviewTotal/30)}</span>
                  <button disabled={(reviewPage+1)*30 >= reviewTotal} onClick={() => { setReviewPage(p => p+1); loadReviews(reviewPage+1) }}
                    className="p-2 glass rounded-xl text-text-muted hover:text-text disabled:opacity-30 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}


// ─── User Management Tab ──────────────────────────────────────────────────────
function UserManagementTab({ users, loadingData, currentUserId, onUsersChange }: {
  users: any[]
  loadingData: boolean
  currentUserId?: string
  onUsersChange: (u: any[]) => void
}) {
  const [search, setSearch] = useState('')
  const [viewingUser, setViewingUser] = useState<any | null>(null)
  const [activity, setActivity] = useState<{ reviews: any[]; comments: any[] } | null>(null)
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [banTarget, setBanTarget] = useState<any | null>(null)
  const [banReason, setBanReason] = useState('')

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const loadActivity = async (u: any) => {
    setViewingUser(u)
    setActivity(null)
    setLoadingActivity(true)
    try {
      const res = await axios.get(`/api/admin/users/${u._id}/activity`, { withCredentials: true })
      setActivity(res.data)
    } finally { setLoadingActivity(false) }
  }

  const toggleBan = async (u: any, ban: boolean, reason?: string) => {
    const res = await axios.put(`/api/admin/users/${u._id}/ban`, { banned: ban, reason }, { withCredentials: true })
    onUsersChange(users.map(x => x._id === u._id ? res.data : x))
    if (viewingUser?._id === u._id) setViewingUser(res.data)
    setBanTarget(null); setBanReason('')
  }

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review?')) return
    await axios.delete(`/api/admin/reviews/${id}`, { withCredentials: true })
    setActivity(prev => prev ? { ...prev, reviews: prev.reviews.filter(r => r._id !== id) } : prev)
  }

  const deleteComment = async (id: string) => {
    if (!confirm('Delete this comment?')) return
    await axios.delete(`/api/admin/comments/${id}`, { withCredentials: true })
    setActivity(prev => prev ? { ...prev, comments: prev.comments.filter(c => c._id !== id) } : prev)
  }

  const changeRole = async (u: any) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    const res = await axios.put(`/api/admin/users/${u._id}/role`, { role: newRole }, { withCredentials: true })
    onUsersChange(users.map(x => x._id === u._id ? res.data : x))
    if (viewingUser?._id === u._id) setViewingUser(res.data)
  }

  return (
    <div className="flex gap-4 h-full">
      {/* User list */}
      <div className={`flex flex-col gap-3 ${viewingUser ? 'w-80 flex-shrink-0' : 'flex-1'}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
          </div>
          <span className="text-xs text-text-muted font-body whitespace-nowrap">{filtered.length} users</span>
        </div>

        {loadingData ? (
          <div className="flex flex-col gap-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[70vh]">
            {filtered.map((u: any) => (
              <div key={u._id}
                onClick={() => loadActivity(u)}
                className={`flex items-center gap-3 glass rounded-2xl p-3 cursor-pointer transition-all hover:border-white/20 border ${
                  viewingUser?._id === u._id ? 'border-primary/40 bg-primary/5' : 'border-white/5'
                } ${u.banned ? 'opacity-60' : ''}`}>
                {u.avatar
                  ? <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0"  loading="lazy"/>
                  : <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">{u.name[0]}</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm text-text font-body truncate">{u.name}</p>
                    {u.role === 'admin' && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded font-mono">ADMIN</span>}
                    {u.banned && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded font-mono">BANNED</span>}
                  </div>
                  <p className="text-xs text-text-muted font-body truncate">{u.email}</p>
                </div>
                <ChevronRight size={13} className="text-text-muted/40 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity panel */}
      {viewingUser && (
        <div className="flex-1 glass rounded-2xl p-5 overflow-y-auto max-h-[80vh] space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {viewingUser.avatar
                ? <img src={viewingUser.avatar} className="w-12 h-12 rounded-xl object-cover"  loading="lazy"/>
                : <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">{viewingUser.name[0]}</div>}
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg text-white">{viewingUser.name}</p>
                  {viewingUser.role === 'admin' && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded font-mono">ADMIN</span>}
                  {viewingUser.banned && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded font-mono">BANNED</span>}
                </div>
                <p className="text-xs text-text-muted font-body">{viewingUser.email}</p>
                {viewingUser.banned && viewingUser.bannedReason && (
                  <p className="text-xs text-red-400/80 font-body mt-0.5">Reason: {viewingUser.bannedReason}</p>
                )}
              </div>
            </div>
            <button onClick={() => setViewingUser(null)} className="text-text-muted hover:text-white"><X size={16} /></button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Favorites', value: viewingUser.favorites?.length || 0 },
              { label: 'Reading List', value: viewingUser.readingList?.length || 0 },
              { label: 'History', value: viewingUser.readingHistory?.length || 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                <p className="font-display text-xl text-white">{value}</p>
                <p className="text-xs text-text-muted font-body">{label}</p>
              </div>
            ))}
          </div>

          {/* Action buttons — hidden for self and superadmins */}
          {currentUserId !== viewingUser._id && viewingUser.role !== 'superadmin' && (
            <div className="flex gap-2 flex-wrap">
              {viewingUser.banned ? (
                <button onClick={() => toggleBan(viewingUser, false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 glass border border-green-500/20 text-green-400 hover:bg-green-500/10 text-xs font-body rounded-xl transition-all">
                  <Check size={12} /> Unban User
                </button>
              ) : (
                <button onClick={() => setBanTarget(viewingUser)}
                  className="flex items-center gap-1.5 px-3 py-1.5 glass border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-body rounded-xl transition-all">
                  <Ban size={12} /> Ban User
                </button>
              )}
            </div>
          )}

          {/* Ban reason modal inline */}
          {banTarget?._id === viewingUser._id && (
            <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-sm text-red-300 font-body font-medium">Ban {viewingUser.name}?</p>
              </div>
              <input value={banReason} onChange={e => setBanReason(e.target.value)}
                placeholder="Reason (optional)…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-red-500/50" />
              <div className="flex gap-2">
                <button onClick={() => toggleBan(viewingUser, true, banReason)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-body rounded-xl transition-all">
                  Confirm Ban
                </button>
                <button onClick={() => { setBanTarget(null); setBanReason('') }}
                  className="px-4 py-2 glass border border-white/10 text-text-muted text-sm font-body rounded-xl">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Activity */}
          {loadingActivity ? (
            <div className="text-center text-text-muted font-body text-sm py-8 animate-pulse">Loading activity…</div>
          ) : activity && (
            <>
              {/* Reviews */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-blue-400" />
                  <h4 className="font-display text-sm text-white tracking-wider">REVIEWS ({activity.reviews.length})</h4>
                </div>
                {activity.reviews.length === 0
                  ? <p className="text-xs text-text-muted font-body">No reviews yet.</p>
                  : <div className="space-y-2">
                    {activity.reviews.map((r: any) => (
                      <div key={r._id} className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-amber-400">★ {r.rating}/10</span>
                            <span className="text-[10px] text-text-muted font-body truncate">{r.mangaId}</span>
                          </div>
                          {r.body && <p className="text-xs text-text-muted font-body line-clamp-2">{r.body}</p>}
                          <p className="text-[10px] text-text-muted/50 font-body mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => deleteReview(r._id)}
                          className="p-1.5 text-text-muted hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                }
              </div>

              {/* Comments */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={14} className="text-purple-400" />
                  <h4 className="font-display text-sm text-white tracking-wider">COMMENTS ({activity.comments.length})</h4>
                </div>
                {activity.comments.length === 0
                  ? <p className="text-xs text-text-muted font-body">No comments yet.</p>
                  : <div className="space-y-2">
                    {activity.comments.map((c: any) => (
                      <div key={c._id} className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text font-body line-clamp-3">{c.body}</p>
                          <p className="text-[10px] text-text-muted/50 font-body mt-1">{new Date(c.createdAt).toLocaleDateString()} · chapter {c.chapterId?.slice(-6)}</p>
                        </div>
                        <button onClick={() => deleteComment(c._id)}
                          className="p-1.5 text-text-muted hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}



// ─── Manga Form Modal ────────────────────────────────────────────────────────

function MangaFormModal({ manga, onClose, onSave }: {
  manga: LocalManga | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [title, setTitle] = useState(manga?.title || '')
  const [altTitle, setAltTitle] = useState(manga?.altTitle || '')
  const [coverUrl, setCoverUrl] = useState(manga?.coverUrl || '')
  const [description, setDescription] = useState(manga?.description || '')
  const [genres, setGenres] = useState<string[]>(manga?.genres || [])
  const [status, setStatus] = useState(manga?.status || 'ongoing')
  const [author, setAuthor] = useState(manga?.author || '')
  const [year, setYear] = useState(manga?.year?.toString() || '')
  const [featured, setFeatured] = useState(manga?.featured || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleGenre = (g: string) => setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])

  const handleSave = async () => {
    if (!title.trim() || !coverUrl.trim()) { setError('Title and cover URL are required'); return }
    setSaving(true)
    try {
      await onSave({ title, altTitle, coverUrl, description, genres, status, author, year: year ? parseInt(year) : undefined, featured })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl glass rounded-3xl p-6 my-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-white tracking-wide">
            {manga ? 'Edit Manga' : 'Add New Manga'}
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40" />
          </div>
          <div>
            <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Alt Title</label>
            <input value={altTitle} onChange={e => setAltTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40" />
          </div>
          <div>
            <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Author</label>
            <input value={author} onChange={e => setAuthor(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Cover Image URL *</label>
            <div className="flex gap-2">
              <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40" />
              {coverUrl && <img src={mediaUrl(coverUrl)} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" loading="lazy" onError={e => e.currentTarget.style.display='none'} />}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40 resize-none" />
          </div>
          <div>
            <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full bg-[#09090f] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40">
              {['ongoing','completed','hiatus','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Year</label>
            <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="2024"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-muted font-body mb-2 block uppercase tracking-widest">Genres</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button key={g} type="button" onClick={() => toggleGenre(g)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-body ${
                    genres.includes(g) ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-white/5 border-white/10 text-text-muted hover:text-text'
                  }`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="button" onClick={() => setFeatured(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-body transition-colors ${
                featured ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'glass border-white/10 text-text-muted'
              }`}>
              {featured ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded border border-current" />}
              Mark as Featured
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm font-body bg-red-400/10 rounded-xl px-4 py-3">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 glass border border-white/10 rounded-xl text-sm font-body text-text-muted hover:text-text transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
            {saving ? 'Saving...' : <><Check size={14} /> {manga ? 'Update Manga' : 'Add Manga'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Chapter Form Modal ──────────────────────────────────────────────────────

function ChapterFormModal({ mangaId, existingChapters = [], onClose, onSave }: {
  mangaId: string
  existingChapters?: { chapterNumber: string }[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  // Auto-increment: find the highest chapter number and suggest next
  const nextChapterNumber = (() => {
    if (!existingChapters.length) return '1'
    const nums = existingChapters
      .map(c => parseFloat(c.chapterNumber))
      .filter(n => !isNaN(n))
    if (!nums.length) return '1'
    const max = Math.max(...nums)
    return String(Math.floor(max) + 1)
  })()

  const [chapterNumber, setChapterNumber] = useState(nextChapterNumber)
  const [title, setTitle] = useState('')
  const [volume, setVolume] = useState('')
  const [pagesText, setPagesText] = useState('')

  const [externalUrl, setExternalUrl] = useState('')
  const [publishAt, setPublishAt] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewMode, setPreviewMode] = useState<'text' | 'grid'>('text')

  const pages = pagesText.split('\n').map(l => l.trim()).filter(Boolean)

  const isExternal = externalUrl.trim().length > 0

  const handleSave = async () => {
    if (!chapterNumber.trim()) { setError('Chapter number is required'); return }
    if (!isExternal && pages.length === 0) { setError('Add at least one page image URL, or set an external link'); return }
    setSaving(true)
    try {
      await onSave({ chapterNumber, title, volume, pages, language: 'en', externalUrl: externalUrl.trim() || undefined, publishAt: publishAt || undefined, draft: !!publishAt })

    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl glass rounded-3xl p-6 my-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-white tracking-wide">Add Chapter</h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Chapter # *</label>
              <div className="relative">
                <input value={chapterNumber} onChange={e => setChapterNumber(e.target.value)}
                  placeholder="1"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40 pr-16" />
                {existingChapters.length > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-emerald-400 font-mono uppercase tracking-wider opacity-70">auto</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Volume</label>
              <input value={volume} onChange={e => setVolume(e.target.value)} placeholder="1"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-xs text-text-muted font-body mb-1 block uppercase tracking-widest">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Optional"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40" />
            </div>
          </div>

          {/* External link */}
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Globe size={13} className="text-orange-400" />
              <label className="text-xs font-body text-orange-400 uppercase tracking-widest font-semibold">External Read Link</label>
              <span className="text-[10px] text-text-muted font-body">(optional — replaces hosted reader)</span>
            </div>
            <input
              value={externalUrl}
              onChange={e => setExternalUrl(e.target.value)}
              placeholder="https://mangaplus.shueisha.co.jp/viewer/..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-orange-500/40"
            />
            {isExternal && (
              <p className="text-[11px] text-orange-400/80 font-body flex items-center gap-1.5">
                <Check size={10} /> Chapter will show an <strong>OFFICIAL</strong> badge and open this URL instead of the reader.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-text-muted font-body uppercase tracking-widest">
                Page Image URLs {isExternal ? <span className="text-text-muted/50 normal-case ml-1">(optional if external link set)</span> : '*'} ({pages.length} pages)

              </label>
              <div className="flex gap-1">
                <button onClick={() => setPreviewMode('text')}
                  className={`p-1.5 rounded-lg transition-colors ${previewMode === 'text' ? 'text-primary' : 'text-text-muted'}`}>
                  <List size={13} />
                </button>
                <button onClick={() => setPreviewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${previewMode === 'grid' ? 'text-primary' : 'text-text-muted'}`}>
                  <Image size={13} />
                </button>
              </div>
            </div>
            {previewMode === 'text' ? (
              <textarea value={pagesText} onChange={e => setPagesText(e.target.value)} rows={8}
                placeholder={"One image URL per line:\nhttps://example.com/page1.jpg\nhttps://example.com/page2.jpg\n..."}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-body outline-none focus:border-primary/40 resize-none font-mono text-xs" />
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 bg-white/5 rounded-xl">
                {pages.length === 0
                  ? <p className="col-span-4 text-xs text-text-muted text-center py-6 font-body">No pages yet</p>
                  : pages.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={mediaUrl(url)} alt={`Page ${i+1}`} className="w-full h-20 object-cover rounded-lg"
                        loading="lazy" onError={e => { e.currentTarget.src = 'https://placehold.co/80x112/1a1a2e/red?text=ERR' }} />
                      <span className="absolute bottom-1 right-1 text-xs bg-black/60 text-white px-1 rounded">{i+1}</span>
                    </div>
                  ))
                }
              </div>
            )}
            <p className="text-xs text-text-muted font-body mt-1.5">Paste one image URL per line. Supports any direct image URL.</p>
          </div>


          {/* Schedule publish */}
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-blue-400" />
              <label className="text-xs font-body text-blue-400 uppercase tracking-widest font-semibold">Schedule Publish</label>
              <span className="text-[10px] text-text-muted font-body">(optional — leave blank to publish now)</span>
            </div>
            <input
              type="datetime-local"
              value={publishAt}
              onChange={e => setPublishAt(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-blue-500/40"
            />
            {publishAt && (
              <p className="text-[11px] text-blue-400/80 font-body flex items-center gap-1.5">
                <Clock size={10} /> Chapter will be saved as a draft and auto-published at the scheduled time.
              </p>
            )}
          </div>

        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm font-body bg-red-400/10 rounded-xl px-4 py-3">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 glass border border-white/10 rounded-xl text-sm font-body text-text-muted hover:text-text transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl disabled:opacity-50 flex items-center gap-2 transition-all">

            {saving ? 'Saving...' : <><Check size={14} /> {isExternal ? 'Add External Chapter' : `Add Chapter (${pages.length} pages)`}</>}

          </button>
        </div>
      </div>
    </div>
  )

}

// ─── Site Settings Tab ────────────────────────────────────────────────────────
function SiteSettingsTab({
  siteSettings, loadingSite,
  genres, setGenres,
  featuredPicks, setFeaturedPicks,
  bannerSlides, setBannerSlides,
  saveFeatured, saveBanner,
  siteSaved,
}: {
  siteSettings: any
  loadingSite: boolean
  genres: string[]
  setGenres: (g: string[]) => void
  featuredPicks: any[]
  setFeaturedPicks: (p: any[]) => void
  bannerSlides: any[]
  setBannerSlides: (s: any[]) => void
  saveFeatured: (p: any[]) => Promise<void>
  saveBanner: (s: any[]) => Promise<void>
  siteSaved: boolean
}) {
  const [siteTab, setSiteTab] = useState<'general' | 'featured' | 'banner' | 'genres' | 'announcements'>('general')

  // ── General settings state
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('We are down for maintenance. Check back soon.')
  const [announcementBanner, setAnnouncementBanner] = useState('')
  const [announcementBannerEnabled, setAnnouncementBannerEnabled] = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [defaultLanguage, setDefaultLanguage] = useState('en')
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [generalSaved, setGeneralSaved] = useState(false)

  // ── Featured search state
  const [featuredSearch, setFeaturedSearch] = useState('')
  const [featuredResults, setFeaturedResults] = useState<any[]>([])
  const [searchingFeatured, setSearchingFeatured] = useState(false)
  const [featuredDuration, setFeaturedDuration] = useState('')  // days, empty = permanent

  // ── Genre state
  const [newGenre, setNewGenre] = useState('')
  const [editingGenre, setEditingGenre] = useState<{ old: string; val: string } | null>(null)
  const [savingGenres, setSavingGenres] = useState(false)

  // ── Banner slide edit state
  const [editSlide, setEditSlide] = useState<any | null>(null)
  const [showSlideForm, setShowSlideForm] = useState(false)

  // Seed general settings from siteSettings prop
  useEffect(() => {
    if (!siteSettings) return
    setMaintenanceMode(siteSettings.maintenanceMode ?? false)
    setMaintenanceMessage(siteSettings.maintenanceMessage ?? 'We are down for maintenance. Check back soon.')
    setAnnouncementBanner(siteSettings.announcementBanner ?? '')
    setAnnouncementBannerEnabled(siteSettings.announcementBannerEnabled ?? false)
    setRegistrationOpen(siteSettings.registrationOpen ?? true)
    setDefaultLanguage(siteSettings.defaultLanguage ?? 'en')
  }, [siteSettings])

  const saveGeneral = async () => {
    setSavingGeneral(true)
    try {
      await axios.put('/api/admin/site-settings/general', {
        maintenanceMode, maintenanceMessage,
        announcementBanner, announcementBannerEnabled,
        registrationOpen, defaultLanguage,
      }, { withCredentials: true })
      setGeneralSaved(true)
      setTimeout(() => setGeneralSaved(false), 2000)
    } finally {
      setSavingGeneral(false)
    }
  }

  const searchFeatured = async (q: string) => {
    if (!q.trim()) return setFeaturedResults([])
    setSearchingFeatured(true)
    try {
      const [localRes, mdxRes] = await Promise.allSettled([
        axios.get(`/api/local-manga?search=${encodeURIComponent(q)}&limit=5`, { withCredentials: true }),
        axios.get(`/api/mangadex/manga?title=${encodeURIComponent(q)}&limit=5&includes[]=cover_art`),
      ])
      const locals = localRes.status === 'fulfilled'
        ? (localRes.value.data || []).map((m: any) => ({ id: m._id, title: m.title, coverUrl: m.coverUrl, type: 'local' }))
        : []
      const mdx = mdxRes.status === 'fulfilled'
        ? (mdxRes.value.data.data || []).map((m: any) => {
            const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art')
            const coverFile = coverRel?.attributes?.fileName
            const cover = coverFile ? `/api/proxy/image?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${m.id}/${coverFile}.256.jpg`)}`  : ''
            const titles = m.attributes?.title || {}
            return { id: m.id, title: titles.en || Object.values(titles)[0] || 'Unknown', coverUrl: cover, type: 'mangadex' }
          })
        : []
      setFeaturedResults([...locals, ...mdx])
    } finally { setSearchingFeatured(false) }
  }

  const addFeatured = async (item: any, expiresAt?: string | null) => {
    if (featuredPicks.find((p: any) => p.mangaId === item.id)) return
    const newPick = {
      type: item.type, mangaId: item.id, title: item.title,
      coverUrl: item.coverUrl, order: featuredPicks.length,
      expiresAt: expiresAt || null,
    }
    const updated = [...featuredPicks, newPick]
    setFeaturedPicks(updated)
    await saveFeatured(updated)
    setFeaturedSearch('')
    setFeaturedResults([])
  }


  const removeFeatured = async (mangaId: string) => {
    const updated = featuredPicks.filter(p => p.mangaId !== mangaId).map((p, i) => ({ ...p, order: i }))
    setFeaturedPicks(updated)
    await saveFeatured(updated)
  }

  const moveFeatured = async (from: number, to: number) => {
    if (to < 0 || to >= featuredPicks.length) return
    const arr = [...featuredPicks]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    const updated = arr.map((p, i) => ({ ...p, order: i }))
    setFeaturedPicks(updated)
    await saveFeatured(updated)
  }

  const saveGenreList = async (g: string[]) => {
    setSavingGenres(true)
    try { await axios.put('/api/admin/site-settings/genres', { genres: g }, { withCredentials: true }) }
    finally { setSavingGenres(false) }
  }

  const addGenre = async () => {
    if (!newGenre.trim() || genres.includes(newGenre.trim())) return
    const updated = [...genres, newGenre.trim()]
    setGenres(updated)
    setNewGenre('')
    await saveGenreList(updated)
  }

  const deleteGenre = async (name: string) => {
    if (!confirm(`Remove genre "${name}" from all manga? This cannot be undone.`)) return
    await axios.delete(`/api/admin/site-settings/genres/${encodeURIComponent(name)}`, { withCredentials: true })
    setGenres(genres.filter(g => g !== name))
  }

  const renameGenre = async () => {
    if (!editingGenre || !editingGenre.val.trim()) return
    await axios.post('/api/admin/site-settings/genres/rename', { oldName: editingGenre.old, newName: editingGenre.val }, { withCredentials: true })
    setGenres(genres.map(g => g === editingGenre.old ? editingGenre.val.trim() : g))
    setEditingGenre(null)
  }

  const saveSlide = async (slide: any) => {
    const updated = editSlide?._id
      ? bannerSlides.map((s, i) => s === editSlide ? { ...slide, order: i } : s)
      : [...bannerSlides, { ...slide, order: bannerSlides.length }]
    setBannerSlides(updated)
    await saveBanner(updated)
    setShowSlideForm(false)
    setEditSlide(null)
  }

  const removeSlide = async (idx: number) => {
    const updated = bannerSlides.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }))
    setBannerSlides(updated)
    await saveBanner(updated)
  }

  if (loadingSite) return <div className="text-center text-text-muted font-body py-16">Loading site settings…</div>

  return (
    <div className="space-y-6">
      {/* Saved toast */}
      {siteSaved && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-green-500/90 text-white text-sm font-body rounded-xl shadow-xl">
          <Check size={14} /> Saved!
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          ['general', 'General', Settings],
          ['featured', 'Featured Picks', Star],
          ['banner', 'Hero Banner', Layout],
          ['genres', 'Genres & Tags', Tag],
          ['announcements', 'Announcements', Radio],
        ] as const).map(([t, label, Icon]: any) => (
          <button key={t} onClick={() => setSiteTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body transition-all ${siteTab === t ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {siteTab === 'general' && (
        <div className="glass rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="font-display text-lg text-white tracking-wide mb-1">General Settings</h3>
            <p className="text-xs text-text-muted font-body">Site-wide controls that take effect immediately.</p>
          </div>

          {/* Maintenance Mode */}
          <div className="border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-body font-medium">Maintenance Mode</p>
                <p className="text-xs text-text-muted font-body mt-0.5">Takes the site offline. Only admins can access it.</p>
              </div>
              <button onClick={() => setMaintenanceMode(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${maintenanceMode ? 'bg-red-500' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${maintenanceMode ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {maintenanceMode && (
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1.5">MAINTENANCE MESSAGE</label>
                <input value={maintenanceMessage} onChange={e => setMaintenanceMessage(e.target.value)}
                  placeholder="Message shown to visitors..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
              </div>
            )}
          </div>

          {/* Announcement Banner */}
          <div className="border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-body font-medium">Announcement Banner</p>
                <p className="text-xs text-text-muted font-body mt-0.5">Shows a notice bar at the top of the site for all users.</p>
              </div>
              <button onClick={() => setAnnouncementBannerEnabled(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${announcementBannerEnabled ? 'bg-primary' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${announcementBannerEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div>
              <label className="font-mono text-xs text-text-muted tracking-widest block mb-1.5">BANNER MESSAGE</label>
              <input value={announcementBanner} onChange={e => setAnnouncementBanner(e.target.value)}
                placeholder="e.g. Site will be down for maintenance on Sunday at 2 AM."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
            </div>
          </div>

          {/* Registration */}
          <div className="border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-body font-medium">User Registration</p>
                <p className="text-xs text-text-muted font-body mt-0.5">When off, new signups are blocked. Existing users can still log in.</p>
              </div>
              <button onClick={() => setRegistrationOpen(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${registrationOpen ? 'bg-green-500' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${registrationOpen ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>

          {/* Default Language */}
          <div className="border border-white/10 rounded-2xl p-5">
            <label className="font-mono text-xs text-text-muted tracking-widest block mb-2">DEFAULT CHAPTER LANGUAGE</label>
            <p className="text-xs text-text-muted font-body mb-3">Used as the default when importing MangaDex chapters.</p>
            <select value={defaultLanguage} onChange={e => setDefaultLanguage(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50">
              {[
                { code: 'en', label: 'English' },
                { code: 'ja', label: 'Japanese' },
                { code: 'ko', label: 'Korean' },
                { code: 'zh', label: 'Chinese (Simplified)' },
                { code: 'zh-hk', label: 'Chinese (Traditional)' },
                { code: 'es', label: 'Spanish' },
                { code: 'es-la', label: 'Spanish (Latin America)' },
                { code: 'fr', label: 'French' },
                { code: 'de', label: 'German' },
                { code: 'pt-br', label: 'Portuguese (Brazil)' },
                { code: 'it', label: 'Italian' },
                { code: 'ru', label: 'Russian' },
                { code: 'ar', label: 'Arabic' },
                { code: 'tr', label: 'Turkish' },
                { code: 'id', label: 'Indonesian' },
                { code: 'vi', label: 'Vietnamese' },
                { code: 'th', label: 'Thai' },
                { code: 'pl', label: 'Polish' },
              ].map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button onClick={saveGeneral} disabled={savingGeneral}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl transition-all disabled:opacity-50">
              {generalSaved ? <><Check size={13} /> Saved</> : savingGeneral ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {siteTab === 'featured' && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="font-display text-lg text-white tracking-wide mb-1">Featured Manga Picks</h3>
            <p className="text-xs text-text-muted font-body">These appear as "Staff Picks" on the homepage. Set an expiry so they auto-remove.</p>
          </div>

          {/* Search + duration row */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={featuredSearch}
                  onChange={e => { setFeaturedSearch(e.target.value); searchFeatured(e.target.value) }}
                  placeholder="Search manga to pin…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
              </div>
              <select value={featuredDuration} onChange={e => setFeaturedDuration(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50">
                <option value="">Permanent</option>
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">2 weeks</option>
                <option value="30">1 month</option>
                <option value="90">3 months</option>
              </select>
            </div>
            {/* Search results dropdown */}
            {featuredResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-[calc(theme(spacing.24)+0.5rem)] mt-1 bg-[#1a1a27] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                {featuredResults.map(item => (
                  <button key={item.id} onClick={() => {
                    const exp = featuredDuration ? new Date(Date.now() + parseInt(featuredDuration) * 86400000).toISOString() : null
                    addFeatured(item, exp)
                  }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0">
                    {item.coverUrl
                      ? <img src={mediaUrl(item.coverUrl)} className="w-8 h-10 rounded object-cover flex-shrink-0"  loading="lazy"/>
                      : <div className="w-8 h-10 rounded bg-white/10 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text font-body truncate">{item.title}</p>
                      <span className={`text-[10px] font-mono ${item.type === 'local' ? 'text-amber-400' : 'text-blue-400'}`}>
                        {item.type === 'local' ? 'LOCAL' : 'MANGADEX'}
                      </span>
                    </div>
                    <Plus size={13} className="text-primary flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {searchingFeatured && <p className="text-xs text-text-muted font-body mt-2">Searching…</p>}
          </div>

          {/* Pinned list */}
          {featuredPicks.length === 0 ? (
            <p className="text-sm text-text-muted font-body text-center py-8 border border-dashed border-white/10 rounded-xl">
              No featured manga pinned yet. Search above to add some.
            </p>
          ) : (
            <div className="space-y-2">
              {featuredPicks.map((pick, i) => {
                const expired = pick.expiresAt && new Date(pick.expiresAt) < new Date()
                const expiresIn = pick.expiresAt ? Math.ceil((new Date(pick.expiresAt).getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={pick.mangaId} className={`flex items-center gap-3 glass px-3 py-2.5 rounded-xl border ${expired ? 'border-red-500/40 opacity-60' : 'border-white/5'}`}>
                    <GripVertical size={14} className="text-text-muted/40 flex-shrink-0" />
                    {pick.coverUrl
                      ? <img src={mediaUrl(pick.coverUrl)} className="w-8 h-10 rounded object-cover flex-shrink-0"  loading="lazy"/>
                      : <div className="w-8 h-10 rounded bg-white/10 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text font-body truncate">{pick.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-mono ${pick.type === 'local' ? 'text-amber-400' : 'text-blue-400'}`}>
                          {pick.type === 'local' ? 'LOCAL' : 'MANGADEX'} · #{i + 1}
                        </span>
                        {expired && <span className="text-[10px] font-mono text-red-400">EXPIRED</span>}
                        {!expired && expiresIn !== null && (
                          <span className="text-[10px] font-mono text-text-muted">
                            expires in {expiresIn}d
                          </span>
                        )}
                        {!expired && expiresIn === null && (
                          <span className="text-[10px] font-mono text-emerald-400/60">permanent</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveFeatured(i, i - 1)} disabled={i === 0}
                        className="p-1.5 text-text-muted hover:text-text transition-colors disabled:opacity-20">
                        <ChevronUp size={13} />
                      </button>
                      <button onClick={() => moveFeatured(i, i + 1)} disabled={i === featuredPicks.length - 1}
                        className="p-1.5 text-text-muted hover:text-text transition-colors disabled:opacity-20">
                        <ChevronDown size={13} />
                      </button>
                      <button onClick={() => removeFeatured(pick.mangaId)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HERO BANNER ── */}
      {siteTab === 'banner' && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-white tracking-wide mb-1">Hero Banner Slides</h3>
              <p className="text-xs text-text-muted font-body">Controls the big hero on the homepage. Each slide can point to a manga or be fully custom.</p>
            </div>
            <button onClick={() => { setEditSlide(null); setShowSlideForm(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl transition-all">
              <Plus size={13} /> Add Slide
            </button>
          </div>

          {bannerSlides.length === 0 ? (
            <p className="text-sm text-text-muted font-body text-center py-8 border border-dashed border-white/10 rounded-xl">
              No banner slides. The homepage will use the default MangaDex trending manga.
            </p>
          ) : (
            <div className="space-y-2">
              {bannerSlides.map((slide, i) => {
                const expired = slide.expiresAt && new Date(slide.expiresAt) < new Date()
                const expiresIn = slide.expiresAt ? Math.ceil((new Date(slide.expiresAt).getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={i} className={`flex items-center gap-3 glass px-4 py-3 rounded-xl border ${expired ? 'border-red-500/40 opacity-60' : 'border-white/5'}`}>
                    <div className="w-10 h-12 rounded bg-white/10 overflow-hidden flex-shrink-0">
                      {slide.customCoverUrl || slide.mangaId
                        ? <img src={slide.customCoverUrl || ''} className="w-full h-full object-cover" loading="lazy" onError={e => (e.currentTarget.style.display = 'none')} />
                        : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text font-body truncate">
                        {slide.customTitle || slide.mangaId || 'Untitled slide'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-mono ${slide.type === 'custom' ? 'text-purple-400' : slide.type === 'local' ? 'text-amber-400' : 'text-blue-400'}`}>
                          {slide.type?.toUpperCase()}
                        </span>
                        {slide.ctaLabel && <span className="text-[10px] text-text-muted font-body">· {slide.ctaLabel}</span>}
                        {expired && <span className="text-[10px] font-mono text-red-400">EXPIRED</span>}
                        {!expired && expiresIn !== null && <span className="text-[10px] font-mono text-orange-400">expires {expiresIn}d</span>}
                        {!expired && expiresIn === null && <span className="text-[10px] font-mono text-emerald-400/60">permanent</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditSlide(slide); setShowSlideForm(true) }}
                        className="p-1.5 text-text-muted hover:text-primary transition-colors">
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => removeSlide(i)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Slide form modal */}
          {showSlideForm && (
            <BannerSlideForm
              slide={editSlide}
              onSave={saveSlide}
              onClose={() => { setShowSlideForm(false); setEditSlide(null) }}
            />
          )}
        </div>
      )}

      {/* ── GENRES & TAGS ── */}
      {siteTab === 'genres' && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="font-display text-lg text-white tracking-wide mb-1">Genres & Tags</h3>
            <p className="text-xs text-text-muted font-body">These are the genres available site-wide. Renaming updates all manga automatically.</p>
          </div>

          {/* Add new */}
          <div className="flex gap-2">
            <input value={newGenre} onChange={e => setNewGenre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGenre()}
              placeholder="New genre name…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
            <button onClick={addGenre} disabled={!newGenre.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl transition-all disabled:opacity-40">
              <Plus size={13} /> Add
            </button>
          </div>

          {/* Genre grid */}
          <div className="flex flex-wrap gap-2">
            {genres.map(genre => (
              <div key={genre} className="group flex items-center gap-1 px-3 py-1.5 glass border border-white/10 rounded-xl">
                {editingGenre?.old === genre ? (
                  <>
                    <input value={editingGenre.val}
                      onChange={e => setEditingGenre({ ...editingGenre, val: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') renameGenre(); if (e.key === 'Escape') setEditingGenre(null) }}
                      autoFocus
                      className="bg-transparent border-b border-primary outline-none text-sm text-text font-body w-28" />
                    <button onClick={renameGenre} className="text-green-400 hover:text-green-300 transition-colors"><Check size={11} /></button>
                    <button onClick={() => setEditingGenre(null)} className="text-text-muted hover:text-text transition-colors"><X size={11} /></button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-text font-body">{genre}</span>
                    <button onClick={() => setEditingGenre({ old: genre, val: genre })}
                      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-primary">
                      <Edit3 size={10} />
                    </button>
                    <button onClick={() => deleteGenre(genre)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-red-400">
                      <X size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted font-body">{genres.length} genres · Hover a genre to rename or delete it</p>
        </div>
      )}

      {/* ── ANNOUNCEMENTS ── */}
      {siteTab === 'announcements' && (
        <div className="glass rounded-2xl p-6">
          <AdminAnnouncementScheduler />
        </div>
      )}
    </div>
  )
}

// ─── Banner Slide Form ─────────────────────────────────────────────────────────
function BannerSlideForm({ slide, onSave, onClose }: { slide: any; onSave: (s: any) => void; onClose: () => void }) {
  const [type, setType] = useState<'mangadex' | 'local' | 'custom'>(slide?.type || 'mangadex')
  const [mangaId, setMangaId] = useState(slide?.mangaId || '')
  const [customTitle, setCustomTitle] = useState(slide?.customTitle || '')
  const [customDescription, setCustomDescription] = useState(slide?.customDescription || '')
  const [customCoverUrl, setCustomCoverUrl] = useState(slide?.customCoverUrl || '')
  const [customBadge, setCustomBadge] = useState(slide?.customBadge || '')
  const [ctaLabel, setCtaLabel] = useState(slide?.ctaLabel || 'Read Now')
  const [ctaUrl, setCtaUrl] = useState(slide?.ctaUrl || '')
  const [duration, setDuration] = useState(() => {
    if (!slide?.expiresAt) return ''
    const days = Math.ceil((new Date(slide.expiresAt).getTime() - Date.now()) / 86400000)
    return days > 0 ? String(days) : ''
  })

  const handleSave = () => {
    const expiresAt = duration ? new Date(Date.now() + parseInt(duration) * 86400000).toISOString() : null
    onSave({ type, mangaId, customTitle, customDescription, customCoverUrl, customBadge, ctaLabel, ctaUrl, expiresAt })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#13131a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-6 pb-4">
          <h3 className="font-display text-xl text-white">{slide ? 'Edit Slide' : 'Add Banner Slide'}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          {/* Type */}
          <div>
            <label className="font-mono text-xs text-text-muted tracking-widest block mb-2">SLIDE TYPE</label>
            <div className="flex gap-2">
              {(['mangadex', 'local', 'custom'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 text-xs font-body rounded-xl border transition-all ${type === t ? 'bg-primary border-primary text-white' : 'border-white/10 text-text-muted hover:text-text'}`}>
                  {t === 'mangadex' ? 'MangaDex' : t === 'local' ? 'Local Manga' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {/* Manga ID (for mangadex/local) */}
          {type !== 'custom' && (
            <div>
              <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">
                {type === 'mangadex' ? 'MANGADEX ID' : 'LOCAL MANGA ID'}
              </label>
              <input value={mangaId} onChange={e => setMangaId(e.target.value)}
                placeholder={type === 'mangadex' ? 'e.g. fa3f1ddb-de65-4f60-84e5-ea7f141eccb5' : 'MongoDB _id'}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
              <p className="text-xs text-text-muted font-body mt-1">The manga's cover and title will be fetched automatically.</p>
            </div>
          )}

          {/* Custom fields */}
          {type === 'custom' && (
            <>
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">TITLE</label>
                <input value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                  placeholder="Banner headline"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">DESCRIPTION</label>
                <textarea value={customDescription} onChange={e => setCustomDescription(e.target.value)}
                  rows={3} placeholder="Short description shown under title"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50 resize-none" />
              </div>
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">COVER IMAGE URL</label>
                <input value={customCoverUrl} onChange={e => setCustomCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">BADGE TEXT</label>
                <input value={customBadge} onChange={e => setCustomBadge(e.target.value)}
                  placeholder="e.g. NEW SEASON · STAFF PICK"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
              </div>
            </>
          )}

          {/* CTA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">CTA LABEL</label>
              <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)}
                placeholder="Read Now"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">CTA URL</label>
              <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)}
                placeholder="/manga/..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">FEATURE DURATION</label>
            <select value={duration} onChange={e => setDuration(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50">
              <option value="">Permanent (no expiry)</option>
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">2 weeks</option>
              <option value="30">1 month</option>
              <option value="90">3 months</option>
            </select>
            {duration && <p className="text-xs text-text-muted font-body mt-1">Slide will auto-hide after {duration} day{parseInt(duration)>1?'s':''}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl transition-all">
              <Check size={14} /> {slide ? 'Save Changes' : 'Add Slide'}
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 glass border border-white/10 text-text-muted text-sm font-body rounded-xl hover:text-text transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Admin Requests Tab ────────────────────────────────────────────────────────
const STATUS_META_ADMIN: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  approved: { label: 'Approved', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  added:    { label: 'Added',    color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  rejected: { label: 'Rejected', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
}

function AdminRequestsTab() {
  const [requests, setRequests] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [noteEditing, setNoteEditing] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  async function loadRequests(status = statusFilter) {
    setLoading(true)
    try {
      const res = await axios.get(`/api/manga-requests/admin/all?status=${status}`, { withCredentials: true })
      setRequests(res.data.requests)
      setTotal(res.data.total)
      setStatusCounts(res.data.statusCounts || {})
    } finally { setLoading(false) }
  }

  useEffect(() => { loadRequests(statusFilter) }, [statusFilter])

  async function updateStatus(id: string, status: string) {
    setActionId(id)
    try {
      const res = await axios.patch(`/api/manga-requests/admin/${id}`, { status }, { withCredentials: true })
      setRequests(prev => prev.map(r => r._id === id ? res.data : r))
    } catch {} finally { setActionId(null) }
  }

  async function saveNote(id: string) {
    try {
      await axios.patch(`/api/manga-requests/admin/${id}`, { adminNote: noteText }, { withCredentials: true })
      setRequests(prev => prev.map(r => r._id === id ? { ...r, adminNote: noteText } : r))
      setNoteEditing(null)
    } catch {}
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-lg text-white">Manga Requests</h2>
        <a href="/requests" target="_blank"
          className="flex items-center gap-1.5 text-xs text-primary font-body hover:underline">
          <ExternalLink size={11} /> View public page
        </a>
      </div>

      {/* Status tabs with counts */}
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'added', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-body border transition-all ${
              statusFilter === s ? STATUS_META_ADMIN[s].color : 'glass border-white/10 text-text-muted hover:text-text'
            }`}>
            {STATUS_META_ADMIN[s].label}
            {statusCounts[s] != null && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-xs">{statusCounts[s]}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-text-muted font-body">No {statusFilter} requests</div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r._id} className="glass border border-white/5 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-base text-white">{r.title}</h3>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-body border ${STATUS_META_ADMIN[r.status].color}`}>
                      {STATUS_META_ADMIN[r.status].label}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-text-muted font-body">
                      <ChevronUp size={11} /> {r.upvotes.length} votes
                    </span>
                  </div>
                  {r.alternativeTitles && <p className="text-xs text-text-muted font-body mt-0.5">{r.alternativeTitles}</p>}
                  {r.notes && <p className="text-xs text-text-muted font-body mt-1 max-w-xl line-clamp-2">{r.notes}</p>}
                  {r.mangadexUrl && (
                    <a href={r.mangadexUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary font-body hover:underline mt-1 w-fit">
                      <ExternalLink size={10} /> MangaDex link
                    </a>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-text-muted font-body">by {r.userName}</span>
                    <span className="text-xs text-text-muted font-body opacity-50">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Admin note */}
                  {noteEditing === r._id ? (
                    <div className="mt-2 flex gap-2">
                      <input value={noteText} onChange={e => setNoteText(e.target.value.slice(0,500))}
                        placeholder="Add a note for the user…"
                        className="flex-1 bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-1.5 text-xs text-text font-body outline-none" />
                      <button onClick={() => saveNote(r._id)}
                        className="px-3 py-1.5 bg-primary text-white text-xs font-body rounded-xl hover:bg-primary/80 transition-all">Save</button>
                      <button onClick={() => setNoteEditing(null)}
                        className="px-3 py-1.5 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-all">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setNoteEditing(r._id); setNoteText(r.adminNote || '') }}
                      className="mt-2 text-xs text-text-muted font-body hover:text-primary transition-colors">
                      {r.adminNote ? `📝 Note: "${r.adminNote}"` : '+ Add staff note'}
                    </button>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                  {r.status !== 'approved' && (
                    <button onClick={() => updateStatus(r._id, 'approved')} disabled={actionId === r._id}
                      className="px-3 py-1.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-body rounded-xl hover:bg-blue-500/25 disabled:opacity-40 transition-all">
                      Approve
                    </button>
                  )}
                  {r.status !== 'added' && (
                    <button onClick={() => updateStatus(r._id, 'added')} disabled={actionId === r._id}
                      className="px-3 py-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-body rounded-xl hover:bg-green-500/25 disabled:opacity-40 transition-all">
                      Mark Added
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button onClick={() => updateStatus(r._id, 'rejected')} disabled={actionId === r._id}
                      className="px-3 py-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-body rounded-xl hover:bg-red-500/25 disabled:opacity-40 transition-all">
                      Reject
                    </button>
                  )}
                  {r.status !== 'pending' && (
                    <button onClick={() => updateStatus(r._id, 'pending')} disabled={actionId === r._id}
                      className="px-3 py-1.5 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text disabled:opacity-40 transition-all">
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Admin Tools Tab ────────────────────────────────────────────────────────────
function AdminToolsTab() {
  const { isSuperAdmin, hasPerm } = useAuth()
  const [toolTab, setToolTab] = useState<
    'bulk' | 'scheduler' | 'visitors' | 'activity' | 'seo' | 'export' | 'backup'
  >('visitors')

  const tabs: { key: typeof toolTab; label: string; perm: string }[] = [
    { key: 'visitors',  label: '🟢 Live Visitors',     perm: 'tools.visitors'  },
    { key: 'bulk',      label: '📦 Bulk Manager',      perm: 'tools.bulk'      },
    { key: 'scheduler', label: '⏰ Scheduler',          perm: 'tools.scheduler' },
    { key: 'activity',  label: '📋 Activity Log',      perm: 'tools.activity'  },
    { key: 'seo',       label: '🔍 SEO Editor',        perm: 'tools.seo'       },
    { key: 'export',    label: '⬇ Export CSV',         perm: 'tools.export'    },
    { key: 'backup',    label: '💾 Backup',             perm: 'tools.backup'    },
  ]

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => {
          const locked = !isSuperAdmin && !hasPerm(t.perm)
          return (
            <button key={t.key} onClick={() => !locked && setToolTab(t.key)}
              title={locked ? "You don't have this permission" : undefined}
              className={`px-3 py-1.5 rounded-xl text-xs font-body transition-all ${
                toolTab === t.key ? 'bg-primary text-white' :
                locked ? 'glass text-text-muted/30 cursor-not-allowed' :
                'glass text-text-muted hover:text-text'
              }`}>
              {t.label}{locked ? ' 🔒' : ''}
            </button>
          )
        })}
      </div>

      {/* Panel */}
      <div>
        {toolTab === 'visitors'  && <AdminVisitorTracker />}
        {toolTab === 'bulk'      && <AdminBulkManager />}
        {toolTab === 'scheduler' && <AdminChapterScheduler />}
        {toolTab === 'activity'  && <AdminActivityLog />}
        {toolTab === 'seo'       && <AdminSEOEditor />}
        {toolTab === 'export'    && <AdminExportAnalytics />}
        {toolTab === 'backup'    && <AdminBackupRestore />}
      </div>
    </div>
  )

}

// ─── Inline Chapter Edit Form ─────────────────────────────────────────────────
function ChapterEditForm({ chapter, onClose, onSave }: {
  chapter: LocalChapter
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [chapterNumber, setChapterNumber] = useState(chapter.chapterNumber)
  const [title, setTitle] = useState(chapter.title || '')
  const [volume, setVolume] = useState(chapter.volume || '')
  const [externalUrl, setExternalUrl] = useState((chapter as any).externalUrl || '')
  const [publishAt, setPublishAt] = useState(() => {
    const pa = (chapter as any).publishAt
    if (!pa) return ''
    return new Date(pa).toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!chapterNumber.trim()) { setError('Chapter number is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        chapterNumber: chapterNumber.trim(),
        title: title.trim() || undefined,
        volume: volume.trim() || undefined,
        externalUrl: externalUrl.trim() || '',
        publishAt: publishAt || null,
      })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="bg-black/30 border-t border-white/8 px-4 py-4 space-y-3">
      <p className="text-[10px] text-amber-400 font-mono uppercase tracking-widest mb-2">Editing Ch.{chapter.chapterNumber}</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-text-muted font-body uppercase tracking-widest block mb-1">Chapter #</label>
          <input value={chapterNumber} onChange={e => setChapterNumber(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-amber-500/40" />
        </div>
        <div>
          <label className="text-[10px] text-text-muted font-body uppercase tracking-widest block mb-1">Volume</label>
          <input value={volume} onChange={e => setVolume(e.target.value)} placeholder="Optional"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-amber-500/40" />
        </div>
        <div>
          <label className="text-[10px] text-text-muted font-body uppercase tracking-widest block mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Optional"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-amber-500/40" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-text-muted font-body uppercase tracking-widest block mb-1 flex items-center gap-1">
            <Globe size={10} className="text-orange-400" /> External URL
          </label>
          <input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-orange-500/40" />
        </div>
        <div>
          <label className="text-[10px] text-text-muted font-body uppercase tracking-widest block mb-1 flex items-center gap-1">
            <Clock size={10} className="text-blue-400" /> Scheduled Publish
          </label>
          <input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-blue-500/40" />
        </div>
      </div>
      {error && <p className="text-xs text-red-400 font-body">{error}</p>}
      {publishAt && (
        <p className="text-[11px] text-blue-400/80 font-body flex items-center gap-1.5">
          <Clock size={10} /> Will be saved as draft and auto-published at the scheduled time.
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-body rounded-xl hover:bg-amber-500/30 transition-all disabled:opacity-50">
          {saving ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Saving...</> : <><Check size={12} /> Save Changes</>}
        </button>
        <button onClick={onClose} className="px-4 py-2 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}