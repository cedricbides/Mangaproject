import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Activity, ShieldAlert, Globe, Users, Wifi, RefreshCw, Ban } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Totals {
  total: number; s401: number; s403: number; s429: number; s5xx: number
  uniqueIps: number; uniqueUsers: number
}
interface Hour { t: string; label: string; total: number; blocked: number; authed: number }
interface IpRow { ip: string; count: number; blocked: number; accounts: number; last: string }
interface AgentRow { ua: string; count: number; blocked: number }
interface PathRow { path: string; count: number; blocked: number }
interface AccountRow {
  userId: string; name: string; email: string; banned: boolean
  count: number; ips: number; last: string
}
interface Summary {
  hours: number; totals: Totals; hourly: Hour[]
  topIps: IpRow[]; topAgents: AgentRow[]; topPaths: PathRow[]; topAccounts: AccountRow[]
}

const TooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text)' },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#e2e8f0' },
}

const RANGES = [
  { h: 6, label: '6h' },
  { h: 24, label: '24h' },
  { h: 72, label: '3d' },
  { h: 168, label: '7d' },
]

const fmt = (n: number) => n.toLocaleString()

export default function AdminTraffic() {
  const [data, setData] = useState<Summary | null>(null)
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [live, setLive] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await axios.get(`/api/admin/traffic/summary?hours=${hours}`, { withCredentials: true })
      setData(res.data)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load traffic')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    if (timer.current) clearInterval(timer.current)
    if (live) timer.current = setInterval(load, 30000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [hours, live])

  async function toggleBan(a: AccountRow) {
    const banning = !a.banned
    if (banning && !window.confirm(`Ban ${a.name}? They will be blocked on their next request.`)) return
    setBusyId(a.userId)
    try {
      await axios.put(`/api/admin/users/${a.userId}/ban`,
        { banned: banning, reason: banning ? 'Suspicious traffic (admin traffic monitor)' : '' },
        { withCredentials: true })
      setData(d => d && ({
        ...d,
        topAccounts: d.topAccounts.map(x => x.userId === a.userId ? { ...x, banned: banning } : x),
      }))
    } catch (err: any) {
      window.alert(err.response?.data?.error || 'Action failed')
    } finally { setBusyId(null) }
  }

  const t = data?.totals
  const blockedTotal = t ? t.s401 + t.s403 + t.s429 : 0

  const cards = [
    { label: 'Requests',      value: t?.total,       icon: Activity,    color: 'text-blue-400' },
    { label: 'Blocked (401/403)', value: t ? t.s401 + t.s403 : undefined, icon: ShieldAlert, color: 'text-yellow-400' },
    { label: 'Rate limited (429)', value: t?.s429,   icon: ShieldAlert, color: 'text-red-400' },
    { label: 'Server errors',  value: t?.s5xx,       icon: Activity,    color: 'text-orange-400' },
    { label: 'Unique IPs',     value: t?.uniqueIps,  icon: Globe,       color: 'text-cyan-400' },
    { label: 'Active accounts', value: t?.uniqueUsers, icon: Users,     color: 'text-green-400' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className={`w-2 h-2 rounded-full ${live ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          <h3 className="font-heading text-lg text-text">Traffic Monitor</h3>
          {t && <span className="text-xs text-text-muted">{fmt(blockedTotal)} blocked of {fmt(t.total)}</span>}
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r.h} onClick={() => setHours(r.h)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${hours === r.h ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={() => setLive(l => !l)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${live ? 'bg-green-500/20 text-green-400' : 'glass text-text-muted hover:text-text'}`}>
          <Wifi size={12} /> {live ? 'Live' : 'Paused'}
        </button>
        <button onClick={load} className="p-1.5 glass rounded-lg text-text-muted hover:text-text">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="glass rounded-xl p-3 text-xs text-red-400">{error}</div>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-xl p-3 text-center">
            <Icon size={16} className={`${color} mx-auto mb-1`} />
            <div className={`text-xl font-heading ${color}`}>{value === undefined ? '—' : fmt(value)}</div>
            <div className="text-[11px] text-text-muted mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Hourly chart */}
      <div className="glass rounded-xl p-4">
        <h4 className="text-sm text-text-muted mb-3">Requests per hour <span className="text-red-400">(red = blocked)</span></h4>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data?.hourly || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false}
              interval={Math.max(0, Math.floor((data?.hourly.length || 0) / 8))} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
            <Tooltip {...TooltipStyle} />
            <Bar dataKey="total" name="All requests" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="blocked" name="Blocked" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top IPs */}
        <div className="glass rounded-xl p-4">
          <h4 className="text-sm text-text-muted mb-2">Top IPs</h4>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {data?.topIps.length ? data.topIps.map(r => (
              <div key={r.ip} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-text flex-1 truncate">{r.ip || '(unknown)'}</span>
                <span className="text-text-muted" title="distinct accounts from this IP">{r.accounts} acct</span>
                {r.blocked > 0 && <span className="text-red-400 font-mono">{fmt(r.blocked)} blocked</span>}
                <span className="text-primary font-mono w-14 text-right">{fmt(r.count)}</span>
              </div>
            )) : <div className="text-xs text-text-muted">No data yet</div>}
          </div>
        </div>

        {/* Top accounts */}
        <div className="glass rounded-xl p-4">
          <h4 className="text-sm text-text-muted mb-2">Top accounts</h4>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {data?.topAccounts.length ? data.topAccounts.map(a => (
              <div key={a.userId} className="flex items-center gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="text-text truncate">{a.name}{a.banned && <span className="ml-1 text-red-400">(banned)</span>}</div>
                  <div className="text-[10px] text-text-muted truncate">{a.email}</div>
                </div>
                <span className="text-text-muted" title="distinct IPs used by this account">{a.ips} IP</span>
                <span className="text-primary font-mono w-14 text-right">{fmt(a.count)}</span>
                <button onClick={() => toggleBan(a)} disabled={busyId === a.userId}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors disabled:opacity-50 ${a.banned ? 'glass text-text-muted hover:text-text' : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'}`}>
                  <Ban size={11} /> {a.banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            )) : <div className="text-xs text-text-muted">No logged-in activity yet</div>}
          </div>
        </div>

        {/* Top user agents */}
        <div className="glass rounded-xl p-4">
          <h4 className="text-sm text-text-muted mb-2">Top user agents</h4>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {data?.topAgents.length ? data.topAgents.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-text flex-1 truncate" title={r.ua}>{r.ua || '(none)'}</span>
                {r.blocked > 0 && <span className="text-red-400 font-mono">{fmt(r.blocked)}</span>}
                <span className="text-primary font-mono w-14 text-right">{fmt(r.count)}</span>
              </div>
            )) : <div className="text-xs text-text-muted">No data yet</div>}
          </div>
        </div>

        {/* Top paths */}
        <div className="glass rounded-xl p-4">
          <h4 className="text-sm text-text-muted mb-2">Top endpoints</h4>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {data?.topPaths.length ? data.topPaths.map(r => (
              <div key={r.path} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-text flex-1 truncate" title={r.path}>{r.path}</span>
                {r.blocked > 0 && <span className="text-red-400 font-mono">{fmt(r.blocked)}</span>}
                <span className="text-primary font-mono w-14 text-right">{fmt(r.count)}</span>
              </div>
            )) : <div className="text-xs text-text-muted">No data yet</div>}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-text-muted">
        Logs every API request on the server (not just browser visits), kept for 7 days.
        Many accounts on one IP, or one account on many IPs, is the usual bot pattern.
      </p>
    </div>
  )
}