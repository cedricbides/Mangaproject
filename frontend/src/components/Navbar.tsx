import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Search, Menu, X, BookOpen, LogOut, User, Shield, Heart, Settings, Sun, Moon, BookMarked, WifiOff, Bell, TrendingUp } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'
import type { Theme } from '@/context/AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import SearchModal from '@/components/SearchModal'

// Default cat avatar (matches Profile page)
const DEFAULT_CAT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1e1e30"/><stop offset="100%" stop-color="#0d0d14"/></radialGradient><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e8394d" stop-opacity="0.2"/><stop offset="100%" stop-color="#e8394d" stop-opacity="0"/></radialGradient><clipPath id="circ"><circle cx="100" cy="100" r="100"/></clipPath></defs><circle cx="100" cy="100" r="100" fill="url(#bg)"/><circle cx="100" cy="120" r="75" fill="url(#glow)"/><g clip-path="url(#circ)"><rect x="52" y="158" width="96" height="50" fill="#e8900a"/><ellipse cx="100" cy="158" rx="48" ry="20" fill="#e8900a"/><path d="M 52 165 Q 20 160 18 185 Q 16 200 38 198 Q 50 196 55 185" fill="#e8900a"/><path d="M 22 178 Q 18 185 22 190" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M 24 188 Q 20 193 25 196" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="110" rx="42" ry="40" fill="#f0a012"/><polygon points="68,80 58,55 85,74" fill="#f0a012"/><polygon points="132,80 142,55 115,74" fill="#f0a012"/><polygon points="72,78 64,60 84,74" fill="#c06a20" opacity="0.5"/><polygon points="128,78 136,60 116,74" fill="#c06a20" opacity="0.5"/><path d="M 82 108 Q 87 104 92 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 108 108 Q 113 104 118 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 87 113 Q 87 119 92 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M 113 113 Q 113 119 108 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="100" cy="122" r="3" fill="#7a4a00"/><path d="M 100 125 Q 96 130 100 132 Q 104 130 100 125" fill="#7a4a00"/><ellipse cx="80" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/><ellipse cx="120" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/></g><circle cx="100" cy="100" r="97" fill="none" stroke="#e8394d" stroke-width="1.5" opacity="0.4"/></svg>')}`

const userAvatar = (user: { avatar: string; name: string }) =>
  user.avatar && user.avatar.trim() !== '' ? user.avatar : DEFAULT_CAT_AVATAR


export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const { user, logout, isAdmin, updateProfile, theme, setTheme } = useAuth()
  const isOnline = useOnlineStatus()
  // Ctrl+K / Cmd+K opens search modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchModalOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])


  const location = useLocation()
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [announcement, setAnnouncement] = useState<{ enabled: boolean; text: string } | null>(null)
  const [announcementDismissed, setAnnouncementDismissed] = useState(false)

  // Notification bell state
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    axios.get('/api/auth/site-settings').then(r => {
      setAnnouncement({ enabled: !!r.data.announcementBannerEnabled, text: r.data.announcementBanner || '' })
    }).catch(() => {})
  }, [])

  // Poll unread notification count every 30s for logged-in users
  useEffect(() => {
    if (!user) return
    const fetchCount = () =>
      axios.get('/api/notifications/unread-count', { withCredentials: true })
        .then(r => setUnreadCount(r.data.count || 0)).catch(() => {})
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Load notifications when bell opens
  useEffect(() => {
    if (!notifOpen || !user) return
    setNotifLoading(true)
    axios.get('/api/notifications', { withCredentials: true })
      .then(r => setNotifications(r.data.notifications || []))
      .catch(() => {})
      .finally(() => setNotifLoading(false))
  }, [notifOpen])

  // Click outside to close notif dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await axios.put('/api/notifications/read-all', {}, { withCredentials: true }).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const markOneRead = async (id: string) => {
    await axios.put(`/api/notifications/${id}/read`, {}, { withCredentials: true }).catch(() => {})
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const deleteNotif = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await axios.delete(`/api/notifications/${id}`, { withCredentials: true }).catch(() => {})
    setNotifications(prev => prev.filter(n => n._id !== id))
  }

  const notifIcon: Record<string, string> = {
    new_chapter: '📖', new_follower: '👤', comment_reply: '💬',
    request_approved: '✅', request_denied: '❌', system: '📢',
  }

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setDropdownOpen(false) }, [location])


  const isActive = (path: string) => location.pathname === path

  const navLinks = [
    ['/', 'Home'],
    ['/browse', 'Browse'],
    ['/catalog', 'Catalog'],
    ['/feed', 'Feed'],
    ['/requests', 'Requests'],
  ]

  const themes: { value: Theme; label: string; icon: any }[] = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'dim', label: 'Dim', icon: BookMarked },
    { value: 'light', label: 'Light', icon: Sun },
  ]

  return (

    <>
      {/* ── Announcement Banner ── */}
      {announcement?.enabled && announcement.text && !announcementDismissed && (
        <div className="fixed top-0 left-0 right-0 z-[60] w-full bg-[#7c6af7] px-4 py-2 flex items-center justify-center gap-2 text-xs font-body text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
          </svg>
          <span>{announcement.text}</span>
          <button onClick={() => setAnnouncementDismissed(true)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
            <X size={12} />
          </button>
        </div>
      )}
      <nav className={`fixed left-0 right-0 z-50 transition-all duration-400 ${
        announcement?.enabled && announcement.text && !announcementDismissed ? 'top-8' : 'top-0'
      } ${
        scrolled ? 'py-2.5 bg-bg/95 backdrop-blur-2xl border-b border-white/5' : 'py-4 bg-bg/80 backdrop-blur-xl'
      }`}>

      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_16px_rgba(232,57,77,0.5)]">
            <BookOpen size={16} className="text-white" />
          </div>
          <span className="font-display text-2xl tracking-wider text-text group-hover:text-primary transition-colors">
            MANGAVERSE
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map(([path, label]) => (
            <Link key={path} to={path}
              className={`font-body text-sm transition-colors ${isActive(path) ? 'text-primary' : 'text-text-muted hover:text-text'}`}>
              {label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">

          {/* Search button — opens modal */}
          <button
            onClick={() => setSearchModalOpen(true)}
            title="Search (Ctrl+K)"
            className="flex items-center gap-2 glass border border-white/10 rounded-xl px-3 py-2 text-text-muted hover:text-text hover:border-white/20 transition-all group"
          >
            <Search size={15} />
            <span className="hidden md:flex items-center gap-2 text-xs font-body">
              <span>Search</span>
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px]">⌃K</kbd>
            </span>
          </button>

          {/* Admin badge */}
          {isAdmin && (
            <Link to="/admin" className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-body hover:bg-amber-500/30 transition-colors">
              <Shield size={13} /> Admin
            </Link>
          )}


          {/* Notification Bell */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(v => !v)}
                className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <Bell size={16} className="text-text-muted" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-primary rounded-full text-[9px] text-white font-body font-bold flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-surface border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                    <span className="font-display text-sm text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs font-body text-primary hover:text-primary/80 transition-colors">
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="overflow-y-auto flex-1">
                    {notifLoading ? (
                      <div className="py-8 text-center text-xs text-text-muted font-body">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell size={28} className="text-text-muted mx-auto mb-2 opacity-30" />
                        <p className="text-xs text-text-muted font-body">No notifications yet</p>
                      </div>
                    ) : notifications.map(n => (
                      <div key={n._id}
                        onClick={() => { markOneRead(n._id); setNotifOpen(false); if (n.link) navigate(n.link) }}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}>
                        <span className="text-base flex-shrink-0 mt-0.5">{notifIcon[n.type] || '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-body ${!n.read ? 'text-white font-medium' : 'text-text-muted'}`}>{n.title}</p>
                          <p className="text-[11px] text-text-muted font-body mt-0.5 line-clamp-2">{n.body}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-text-muted/50 font-body">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </p>
                          {n.link && <span className="text-[10px] text-primary/60 font-body">tap to view →</span>}
                        </div>
                        </div>
                        <button onClick={(e) => deleteNotif(e, n._id)}
                          className="flex-shrink-0 p-1 text-text-muted/40 hover:text-red-400 transition-colors mt-0.5">
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${dropdownOpen ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              {user ? (
                <>
                  <img src={userAvatar(user)} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
                  <span className="hidden sm:block font-body text-sm text-text max-w-[100px] truncate">{user.name}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6"/></svg>
                </>
              ) : (
                <User size={17} className="text-text-muted" />
              )}
            </button>

            {/* Dropdown panel */}
            {dropdownOpen && (
              <div className="absolute right-0 top-12 w-64 bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">

                {/* User info */}
                <div className="flex flex-col items-center gap-2 px-5 py-5 border-b border-white/10">
                  {user ? (
                    <Link to="/profile" onClick={() => setDropdownOpen(false)} className="w-14 h-14">
                      <img
                        src={userAvatar(user)}
                        alt={user.name}
                        className="w-14 h-14 rounded-full object-cover border border-white/10 hover:border-primary/50 transition-all"
                      />
                    </Link>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <User size={24} className="text-text-muted" />
                    </div>
                  )}

                  <Link to="/profile" onClick={() => setDropdownOpen(false)}
                    className="font-display text-lg text-text tracking-wide hover:text-primary transition-colors">
                    {user ? user.name : 'Guest'}
                  </Link>
                </div>

                {/* Menu items */}
                <div className="px-3 py-3 flex flex-col gap-1">
                  <div className="flex gap-2 mb-1">
                    <Link to="/profile" onClick={() => setDropdownOpen(false)}
                      className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-text-muted hover:text-text hover:bg-white/5 text-sm font-body transition-all">
                      <User size={15} />
                      Profile
                    </Link>
                    <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-text-muted hover:text-text hover:bg-white/5 text-sm font-body transition-all cursor-pointer">
                      <Sun size={15} />
                      Theme
                    </div>
                  </div>

                  {/* Theme selector */}
                  <div className="flex gap-1.5 px-1 mb-2">
                    {themes.map(({ value, label, icon: Icon }) => (
                      <button key={value} onClick={() => setTheme(value)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-body transition-all ${
                          theme === value
                            ? 'bg-primary/20 border border-primary/40 text-primary'
                            : 'bg-white/5 border border-white/5 text-text-muted hover:bg-white/10'
                        }`}>
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {user && (
                    <Link to="/favorites" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-text-muted hover:text-text hover:bg-white/5 text-sm font-body transition-all">
                      <Heart size={15} />
                      Favorites
                    </Link>
                  )}
                  {user && (
                    <Link to="/stats" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-text-muted hover:text-amber-400 hover:bg-amber-500/5 text-sm font-body transition-all">
                      <TrendingUp size={15} />
                      My Stats
                    </Link>
                  )}
                  <Link to="/downloads" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-text-muted hover:text-violet-400 hover:bg-violet-500/5 text-sm font-body transition-all">
                    <WifiOff size={15} />
                    Offline Library
                  </Link>
                </div>

                {/* Sign in / out */}
                <div className="px-3 pb-3 flex flex-col gap-2">
                  {user ? (
                    <button onClick={() => { logout(); setDropdownOpen(false) }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted hover:text-text rounded-xl text-sm font-body transition-all">
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  ) : (
                    <>
                      <Link to="/login" onClick={() => setDropdownOpen(false)}
                        className="w-full flex items-center justify-center py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-body font-medium transition-all hover:shadow-[0_0_20px_rgba(232,57,77,0.4)]">
                        Sign In
                      </Link>
                      <Link to="/login" onClick={() => setDropdownOpen(false)}
                        className="w-full flex items-center justify-center py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted hover:text-text rounded-xl text-sm font-body transition-all">
                        Register
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-text-muted" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden mx-4 mt-2 bg-surface border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
          {navLinks.map(([path, label]) => (
            <Link key={path} to={path} onClick={() => setMenuOpen(false)}
              className={`text-sm font-body py-1 ${isActive(path) ? 'text-primary' : 'text-text-muted'}`}>
              {label}
            </Link>
          ))}
          <div className="h-px bg-white/10 my-1" />
          {user ? (
            <>
              <Link to="/favorites" onClick={() => setMenuOpen(false)} className="text-sm font-body py-1 text-text-muted flex items-center gap-2">
                <Heart size={14} /> Favorites
              </Link>
              <Link to="/stats" onClick={() => setMenuOpen(false)} className="text-sm font-body py-1 text-amber-400 flex items-center gap-2">
                <TrendingUp size={14} /> My Stats
              </Link>
              <Link to="/downloads" onClick={() => setMenuOpen(false)} className="text-sm font-body py-1 text-violet-400 flex items-center gap-2">
                <WifiOff size={14} /> Offline Library
              </Link>
              <Link to="/profile" onClick={() => setMenuOpen(false)} className="text-sm font-body py-1 text-text-muted flex items-center gap-2">
                <Settings size={14} /> Settings
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={() => setMenuOpen(false)} className="text-sm font-body py-1 text-amber-400 flex items-center gap-2">
                  <Shield size={14} /> Admin Dashboard
                </Link>
              )}
              <button onClick={() => { logout(); setMenuOpen(false) }} className="text-sm font-body py-1 text-text-muted flex items-center gap-2">
                <LogOut size={14} /> Sign Out
              </button>
            </>
          ) : (
            <Link to="/login" onClick={() => setMenuOpen(false)}
              className="w-full text-center py-2.5 bg-primary text-white rounded-xl text-sm font-body">
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>

    <SearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      {/* Global offline banner */}
      {!isOnline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/90 backdrop-blur-sm text-white text-xs font-body rounded-xl shadow-xl border border-amber-400/30">
          <WifiOff size={13} />
          You're offline — some features may not work
        </div>
      )}
    </>

  )
}