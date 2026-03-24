// frontend/src/components/NotificationBell.tsx
// REPLACE the existing file entirely.
// Changes: added push notification subscribe/unsubscribe toggle button in the panel header.

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell, BellOff, X, CheckCheck, Trash2, ChevronRight,
  BookMarked, MessageSquare, Heart, AlertTriangle,
  UserX, UserCheck, BookCheck, Shield, Loader2,
} from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const DEFAULT_CAT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1e1e30"/><stop offset="100%" stop-color="#0d0d14"/></radialGradient><clipPath id="circ"><circle cx="100" cy="100" r="100"/></clipPath></defs><circle cx="100" cy="100" r="100" fill="url(#bg)"/><g clip-path="url(#circ)"><ellipse cx="100" cy="110" rx="42" ry="40" fill="#f0a012"/><polygon points="68,80 58,55 85,74" fill="#f0a012"/><polygon points="132,80 142,55 115,74" fill="#f0a012"/><circle cx="100" cy="122" r="3" fill="#7a4a00"/></g><circle cx="100" cy="100" r="97" fill="none" stroke="#e8394d" stroke-width="1.5" opacity="0.4"/></svg>')}`

type NotifType =
  | 'post_comment' | 'post_reaction' | 'comment_reply' | 'request_status'
  | 'comment_flagged' | 'account_banned' | 'account_unbanned'
  | 'new_request' | 'new_report' | 'new_user' | 'content_flagged'
  | 'new_chapter' | 'new_follower' | 'request_approved' | 'request_denied' | 'system'

interface Notif {
  _id: string
  type: NotifType
  isAdminNotif: boolean
  read: boolean
  title: string
  body: string
  link?: string
  actorName?: string
  actorAvatar?: string
  createdAt: string
}

const TYPE_META: Record<string, { icon: any; color: string }> = {
  post_comment:    { icon: MessageSquare, color: 'text-blue-400'   },
  post_reaction:   { icon: Heart,         color: 'text-primary'    },
  comment_reply:   { icon: MessageSquare, color: 'text-purple-400' },
  request_status:  { icon: BookCheck,     color: 'text-green-400'  },
  request_approved:{ icon: BookCheck,     color: 'text-green-400'  },
  request_denied:  { icon: X,             color: 'text-red-400'    },
  comment_flagged: { icon: AlertTriangle, color: 'text-amber-400'  },
  account_banned:  { icon: UserX,         color: 'text-red-400'    },
  account_unbanned:{ icon: UserCheck,     color: 'text-green-400'  },
  new_request:     { icon: BookMarked,    color: 'text-blue-400'   },
  new_report:      { icon: AlertTriangle, color: 'text-red-400'    },
  new_user:        { icon: UserCheck,     color: 'text-green-400'  },
  content_flagged: { icon: Shield,        color: 'text-amber-400'  },
  new_chapter:     { icon: BookMarked,    color: 'text-primary'    },
  new_follower:    { icon: UserCheck,     color: 'text-sky-400'    },
  system:          { icon: Bell,          color: 'text-text-muted' },
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const { user, isStaff } = useAuth()
  const navigate = useNavigate()
  const { state: pushState, subscribe, unsubscribe } = usePushNotifications()

  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'all' | 'admin'>('all')
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll unread count every 30s
  const pollUnread = useCallback(async () => {
    if (!user) return
    try {
      const res = await axios.get('/api/notifications/unread-count', { withCredentials: true })
      setUnread(res.data.count)
    } catch {}
  }, [user])

  useEffect(() => {
    if (!user) return
    pollUnread()
    pollRef.current = setInterval(pollUnread, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [user, pollUnread])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function loadNotifs(p = 0) {
    setLoading(true)
    try {
      const res = await axios.get(`/api/notifications?page=${p}`, { withCredentials: true })
      if (p === 0) setNotifs(res.data.notifications)
      else setNotifs(prev => [...prev, ...res.data.notifications])
      setUnread(res.data.unread)
      setHasMore((p + 1) * 20 < res.data.total)
      setPage(p)
    } catch {} finally { setLoading(false) }
  }

  function openPanel() {
    setOpen(o => !o)
    if (!open) loadNotifs(0)
  }

  async function markRead(id: string) {
    setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
    setUnread(u => Math.max(0, u - 1))
    await axios.put(`/api/notifications/${id}/read`, {}, { withCredentials: true }).catch(() => {})
  }

  async function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
    await axios.put('/api/notifications/read-all', {}, { withCredentials: true }).catch(() => {})
  }

  async function deleteNotif(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setNotifs(prev => prev.filter(n => n._id !== id))
    await axios.delete(`/api/notifications/${id}`, { withCredentials: true }).catch(() => {})
  }

  function handleNotifClick(n: Notif) {
    if (!n.read) markRead(n._id)
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }

  const displayed = tab === 'admin'
    ? notifs.filter(n => n.isAdminNotif)
    : notifs.filter(n => !n.isAdminNotif)
  const adminUnread = notifs.filter(n => n.isAdminNotif && !n.read).length
  const userUnread = notifs.filter(n => !n.isAdminNotif && !n.read).length

  if (!user) return null

  // Push toggle button label/icon
  const pushLabel = pushState === 'subscribed' ? 'Mute push' : 'Enable push'
  const PushIcon = pushState === 'subscribed' ? BellOff : Bell
  const pushDisabled = pushState === 'loading' || pushState === 'unsupported' || pushState === 'denied'

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button onClick={openPanel}
        className="relative p-2 glass border border-white/10 rounded-xl text-text-muted hover:text-text hover:border-white/20 transition-all">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-primary text-white text-[10px] font-body font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[540px] bg-surface border border-white/10 rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
            <h3 className="font-display text-sm text-white">Notifications</h3>
            <div className="flex items-center gap-1">

              {/* Push toggle */}
              {pushState !== 'unsupported' && (
                <button
                  onClick={pushState === 'subscribed' ? unsubscribe : subscribe}
                  disabled={pushDisabled}
                  title={pushLabel}
                  className={`p-1.5 rounded-lg hover:bg-white/5 transition-all disabled:opacity-30 ${
                    pushState === 'subscribed' ? 'text-primary' : 'text-text-muted hover:text-primary'
                  }`}
                >
                  {pushState === 'loading'
                    ? <Loader2 size={13} className="animate-spin" />
                    : <PushIcon size={13} />
                  }
                </button>
              )}

              {unread > 0 && (
                <button onClick={markAllRead} title="Mark all read"
                  className="p-1.5 text-text-muted hover:text-primary rounded-lg hover:bg-white/5 transition-all">
                  <CheckCheck size={13} />
                </button>
              )}
              {notifs.length > 0 && (
                <button onClick={async () => {
                  setNotifs([])
                  setUnread(0)
                  await axios.delete('/api/notifications', { withCredentials: true }).catch(() => {})
                }} title="Clear all"
                  className="p-1.5 text-text-muted hover:text-red-400 rounded-lg hover:bg-white/5 transition-all">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Push denied warning */}
          {pushState === 'denied' && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] font-body text-amber-400 flex items-center gap-2">
              <AlertTriangle size={11} />
              Push blocked in browser settings. Allow in site permissions to enable.
            </div>
          )}

          {/* Tabs — only for staff */}
          {isStaff && (
            <div className="flex border-b border-white/5 flex-shrink-0">
              <button onClick={() => setTab('all')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-body transition-all ${tab === 'all' ? 'text-text border-b-2 border-primary' : 'text-text-muted hover:text-text'}`}>
                Personal
                {userUnread > 0 && <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded-md text-[10px]">{userUnread}</span>}
              </button>
              <button onClick={() => setTab('admin')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-body transition-all ${tab === 'admin' ? 'text-text border-b-2 border-amber-400' : 'text-text-muted hover:text-text'}`}>
                <Shield size={11} className="text-amber-400" /> Admin
                {adminUnread > 0 && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-md text-[10px]">{adminUnread}</span>}
              </button>
            </div>
          )}

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {loading && notifs.length === 0 ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 skeleton rounded-xl" />
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Bell size={32} className="text-text-muted opacity-20" />
                <p className="text-xs font-body text-text-muted">
                  {tab === 'admin' ? 'No admin notifications' : 'No notifications yet'}
                </p>
              </div>
            ) : (
              <div>
                {displayed.map(n => {
                  const meta = TYPE_META[n.type] || TYPE_META.system
                  const Icon = meta.icon
                  return (
                    <div key={n._id}
                      onClick={() => handleNotifClick(n)}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-all group ${!n.read ? 'bg-white/[0.02]' : ''}`}>

                      {/* Unread dot */}
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-2 h-2 rounded-full ${!n.read ? 'bg-primary' : 'bg-transparent'}`} />
                      </div>

                      {/* Avatar or icon */}
                      {n.actorAvatar ? (
                        <img src={n.actorAvatar || DEFAULT_CAT_AVATAR} alt={n.actorName}
                          className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-xl glass border border-white/10 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className={meta.color} />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-body font-medium leading-snug ${n.read ? 'text-text-muted' : 'text-text'}`}>
                          {n.title}
                        </p>
                        <p className="text-[11px] font-body text-text-muted mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                        <p className="text-[10px] font-body text-text-muted opacity-50 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {n.link && <ChevronRight size={12} className="text-text-muted" />}
                        <button onClick={(e) => deleteNotif(n._id, e)}
                          className="p-1 hover:text-red-400 text-text-muted transition-colors rounded">
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {hasMore && (
                  <button onClick={() => loadNotifs(page + 1)} disabled={loading}
                    className="w-full py-3 text-xs font-body text-text-muted hover:text-text transition-colors disabled:opacity-40">
                    Load more
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}