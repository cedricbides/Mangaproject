import { useState, useEffect } from 'react'
import axios from 'axios'
import { Activity, RefreshCw, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

interface LogEntry {
  _id: string
  adminUsername: string
  action: string
  category: string
  targetLabel?: string
  details?: Record<string, any>
  ip?: string
  createdAt: string
}

const CATEGORY_COLORS: Record<string, string> = {
  manga: 'bg-blue-500/20 text-blue-400',
  chapter: 'bg-purple-500/20 text-purple-400',
  user: 'bg-green-500/20 text-green-400',
  site: 'bg-yellow-500/20 text-yellow-400',
  moderation: 'bg-red-500/20 text-red-400',
  backup: 'bg-orange-500/20 text-orange-400',
  analytics: 'bg-cyan-500/20 text-cyan-400',
}

const ACTION_LABELS: Record<string, string> = {
  'manga.bulk.delete': 'Bulk deleted manga',
  'manga.bulk.import': 'Bulk imported manga',
  'manga.bulk.update-status': 'Bulk status change',
  'manga.bulk.update-featured': 'Bulk featured change',
  'manga.seo.update': 'Updated SEO (local)',
  'manga.seo.update.mdx': 'Updated SEO (MangaDex)',
  'chapter.schedule': 'Scheduled chapter',
  'chapter.schedule.mdx': 'Scheduled MDX chapter',
  'scheduler.publish-due': 'Published due chapters',
  'backup.export': 'Exported backup',
  'backup.restore': 'Restored backup',
}

export default function AdminActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const CATEGORIES = ['all', 'manga', 'chapter', 'user', 'site', 'moderation', 'backup', 'analytics']

  useEffect(() => { load() }, [page, category])

  async function load() {
    setLoading(true)
    try {
      const res = await axios.get('/api/admin/activity-log', {
        params: { page, category },
        withCredentials: true,
      })
      setLogs(res.data.logs)
      setTotal(res.data.total)
    } catch { setLogs([]) }
    setLoading(false)
  }

  async function clearLog() {
    try {
      await axios.delete('/api/admin/activity-log', { withCredentials: true })
      setLogs([])
      setTotal(0)
      setConfirmClear(false)
    } catch (e: any) { alert(e.message) }
  }

  const totalPages = Math.ceil(total / 50)
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-lg text-text flex-1">Admin Activity Log</h3>
        <button onClick={load} className="p-1.5 glass rounded-lg text-text-muted hover:text-text transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={() => setConfirmClear(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 glass text-red-400 rounded-lg text-xs hover:bg-red-500/10 transition-colors">
          <Trash2 size={12} /> Clear Log
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => { setCategory(c); setPage(0) }}
            className={`px-2.5 py-1 rounded-lg text-xs font-body transition-colors capitalize ${category === c ? 'bg-primary text-white' : 'glass text-text-muted hover:text-text'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="text-xs text-text-muted">{total} total entries</div>

      {/* Log entries */}
      <div className="space-y-1.5">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 glass rounded-xl animate-pulse" />)
          : logs.length === 0
            ? <div className="py-10 text-center text-text-muted text-sm glass rounded-xl">No activity logged yet</div>
            : logs.map(log => (
              <div key={log._id} className="glass rounded-xl overflow-hidden">
                <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/2 transition-colors"
                  onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}>
                  <Activity size={14} className="text-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono capitalize ${CATEGORY_COLORS[log.category] || 'bg-white/5 text-text-muted'}`}>
                        {log.category}
                      </span>
                      <span className="text-sm text-text font-body">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      {log.targetLabel && <span className="text-xs text-text-muted truncate">— {log.targetLabel}</span>}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5 flex gap-3">
                      <span>@{log.adminUsername}</span>
                      <span>{timeAgo(log.createdAt)}</span>
                      {log.ip && <span className="hidden sm:inline">{log.ip}</span>}
                    </div>
                  </div>
                </button>
                {expandedId === log._id && log.details && (
                  <div className="px-3 pb-3">
                    <pre className="text-[11px] font-mono text-text-muted bg-black/20 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="p-1.5 glass rounded-lg text-text-muted hover:text-text disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-text-muted">Page {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="p-1.5 glass rounded-lg text-text-muted hover:text-text disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Confirm clear */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h4 className="font-heading text-text">Clear Activity Log?</h4>
            <p className="text-sm text-text-muted">All {total} log entries will be permanently deleted.</p>
            <div className="flex gap-2">
              <button onClick={clearLog} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600">Confirm</button>
              <button onClick={() => setConfirmClear(false)} className="flex-1 py-2 glass text-text-muted rounded-xl text-sm hover:text-text">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}