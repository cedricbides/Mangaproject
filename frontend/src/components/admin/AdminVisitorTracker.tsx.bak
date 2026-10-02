import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Wifi, Users, UserCheck, User, RefreshCw, Monitor } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Visitor {
  _id: string
  sessionId: string
  userId?: string
  username?: string
  page: string
  pageTitle?: string
  lastSeen: string
  ip?: string
}

interface ActiveData {
  total: number
  authenticated: number
  guests: number
  visitors: Visitor[]
  topPages: { page: string; count: number }[]
}

interface HistoryBucket { time: string; total: number; auth: number }

const TooltipStyle = {
  contentStyle: { background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#e2e8f0' },
}

export default function AdminVisitorTracker() {
  const [active, setActive] = useState<ActiveData | null>(null)
  const [history, setHistory] = useState<HistoryBucket[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadAll()
    if (autoRefresh) {
      intervalRef.current = setInterval(loadActive, 15000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadActive(), loadHistory()])
    setLoading(false)
  }

  async function loadActive() {
    try {
      const res = await axios.get('/api/visitors/active', { withCredentials: true })
      setActive(res.data)
      setLastUpdated(new Date())
    } catch { }
  }

  async function loadHistory() {
    try {
      const res = await axios.get('/api/visitors/history', { withCredentials: true })
      setHistory(res.data)
    } catch { }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    return `${Math.floor(diff / 60000)}m ago`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          <h3 className="font-heading text-lg text-text">Live Visitors</h3>
          {lastUpdated && <span className="text-xs text-text-muted">Updated {timeAgo(lastUpdated.toISOString())}</span>}
        </div>
        <button onClick={() => setAutoRefresh(a => !a)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${autoRefresh ? 'bg-green-500/20 text-green-400' : 'glass text-text-muted hover:text-text'}`}>
          <Wifi size={12} /> {autoRefresh ? 'Live' : 'Paused'}
        </button>
        <button onClick={loadAll} className="p-1.5 glass rounded-lg text-text-muted hover:text-text">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Online Now', value: active?.total ?? '—', icon: Monitor, color: 'text-green-400' },
          { label: 'Logged In', value: active?.authenticated ?? '—', icon: UserCheck, color: 'text-blue-400' },
          { label: 'Guests', value: active?.guests ?? '—', icon: User, color: 'text-text-muted' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-xl p-3 text-center">
            <Icon size={16} className={`${color} mx-auto mb-1`} />
            <div className={`text-2xl font-heading ${color}`}>{value}</div>
            <div className="text-xs text-text-muted mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Visitor trend chart */}
      <div className="glass rounded-xl p-4">
        <h4 className="text-sm text-text-muted mb-3">Last 24h Visits</h4>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={history} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <defs>
              <linearGradient id="vTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e8394d" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#e8394d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false}
              interval={Math.floor(history.length / 6)} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
            <Tooltip {...TooltipStyle} />
            <Area type="monotone" dataKey="total" stroke="#e8394d" fill="url(#vTotal)" strokeWidth={2} name="Visitors" />
            <Area type="monotone" dataKey="auth" stroke="#3b82f6" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Auth" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top pages */}
        <div className="glass rounded-xl p-4 space-y-2">
          <h4 className="text-sm text-text-muted">Top Pages Now</h4>
          {active?.topPages?.length
            ? active.topPages.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text truncate font-mono">{p.page}</div>
                </div>
                <span className="text-xs text-primary font-mono">{p.count}</span>
              </div>
            ))
            : <div className="text-xs text-text-muted">No active visitors</div>
          }
        </div>

        {/* Active visitors list */}
        <div className="glass rounded-xl p-4 space-y-2">
          <h4 className="text-sm text-text-muted">Active Sessions ({active?.total ?? 0})</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {active?.visitors?.length
              ? active.visitors.slice(0, 20).map(v => (
                <div key={v._id} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${v.userId ? 'bg-blue-400' : 'bg-green-400'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-text">{v.username || 'Guest'}</span>
                    <span className="text-xs text-text-muted ml-2 truncate">{v.page}</span>
                  </div>
                  <span className="text-[10px] text-text-muted flex-shrink-0">{timeAgo(v.lastSeen)}</span>
                </div>
              ))
              : <div className="text-xs text-text-muted">No active visitors</div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}