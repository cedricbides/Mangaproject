import { useState, useEffect } from 'react'
import axios from 'axios'
import { CheckSquare, Square, Trash2, Tag, Star, Upload, AlertTriangle, X, Check } from 'lucide-react'

interface LocalManga { _id: string; title: string; status: string; genres: string[]; coverUrl?: string; featured: boolean }

const STATUSES = ['ongoing', 'completed', 'hiatus', 'cancelled']
const STATUS_COLORS: Record<string, string> = { ongoing: 'text-green-400', completed: 'text-blue-400', hiatus: 'text-yellow-400', cancelled: 'text-red-400' }

export default function AdminBulkManager() {
  const [manga, setManga] = useState<LocalManga[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<null | { label: string; fn: () => void }>(null)
  const [importJson, setImportJson] = useState('')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await axios.get('/api/admin/manga', { withCredentials: true })
    setManga(res.data)
    setLoading(false)
  }

  const filtered = manga.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchStatus
  })

  const allSelected = filtered.length > 0 && filtered.every(m => selected.has(m._id))
  const toggle = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => {
    if (allSelected) setSelected(prev => { const s = new Set(prev); filtered.forEach(m => s.delete(m._id)); return s })
    else setSelected(prev => { const s = new Set(prev); filtered.forEach(m => s.add(m._id)); return s })
  }

  async function bulkAction(action: string, data?: any) {
    const ids = [...selected]
    if (!ids.length) return
    setActionStatus('loading')
    try {
      const res = await axios.post('/api/admin/bulk/manga', { ids, action, data }, { withCredentials: true })
      setActionStatus(`✓ ${res.data.affected} manga updated`)
      setSelected(new Set())
      await load()
    } catch (e: any) {
      setActionStatus(`Error: ${e.response?.data?.error || e.message}`)
    }
    setTimeout(() => setActionStatus(null), 3000)
  }

  async function handleImport() {
    try {
      const items = JSON.parse(importJson)
      if (!Array.isArray(items)) throw new Error('Expected a JSON array')
      setActionStatus('loading')
      const res = await axios.post('/api/admin/bulk/manga/import', { items }, { withCredentials: true })
      setActionStatus(`✓ Imported ${res.data.imported}, skipped ${res.data.skipped}`)
      setShowImport(false)
      setImportJson('')
      await load()
    } catch (e: any) {
      setActionStatus(`Error: ${e.response?.data?.error || e.message}`)
    }
    setTimeout(() => setActionStatus(null), 4000)
  }

  const selectedCount = selected.size
  const canAct = selectedCount > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-lg text-text flex-1">Bulk Manga Manager</h3>
        <button onClick={() => setShowImport(!showImport)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass text-sm text-text-muted hover:text-primary transition-colors">
          <Upload size={13} /> Import JSON
        </button>
      </div>

      {/* Import JSON panel */}
      {showImport && (
        <div className="glass rounded-xl p-4 space-y-3">
          <p className="text-xs text-text-muted">Paste a JSON array of manga objects. Required field: <code className="text-primary">title</code>. Optional: <code className="text-primary">status, genres, author, description, coverUrl, year</code>.</p>
          <textarea value={importJson} onChange={e => setImportJson(e.target.value)}
            rows={5} placeholder='[{"title":"My Manga","status":"ongoing","genres":["Action"]}]'
            className="w-full bg-surface border border-white/10 rounded-lg p-3 text-sm font-mono text-text placeholder-text-muted focus:outline-none focus:border-primary/60 resize-none" />
          <div className="flex gap-2">
            <button onClick={handleImport} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/80 transition-colors">Import</button>
            <button onClick={() => setShowImport(false)} className="px-4 py-1.5 glass text-text-muted rounded-lg text-sm hover:text-text transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search manga..."
          className="flex-1 min-w-40 bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/60" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none">
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Bulk Action Bar */}
      {canAct && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm text-primary font-body">{selectedCount} selected</span>
          <div className="flex-1" />
          <button onClick={() => setConfirmAction({ label: `Delete ${selectedCount} manga?`, fn: () => bulkAction('delete') })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
          <select onChange={e => { if (e.target.value) bulkAction('update-status', { status: e.target.value }); e.target.value = '' }}
            className="bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none">
            <option value="">Set Status…</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => bulkAction('update-featured', { featured: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 glass text-yellow-400 rounded-lg text-xs hover:bg-yellow-500/20 transition-colors">
            <Star size={12} /> Feature
          </button>
          <button onClick={() => bulkAction('update-featured', { featured: false })}
            className="flex items-center gap-1.5 px-3 py-1.5 glass text-text-muted rounded-lg text-xs hover:text-text transition-colors">
            <X size={12} /> Unfeature
          </button>
        </div>
      )}

      {/* Status feedback */}
      {actionStatus && actionStatus !== 'loading' && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${actionStatus.startsWith('✓') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {actionStatus.startsWith('✓') ? <Check size={14} /> : <AlertTriangle size={14} />}
          {actionStatus}
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="p-3 text-left w-10">
                  <button onClick={toggleAll} className="text-text-muted hover:text-primary transition-colors">
                    {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                </th>
                <th className="p-3 text-left text-text-muted font-body font-normal">Title</th>
                <th className="p-3 text-left text-text-muted font-body font-normal hidden sm:table-cell">Status</th>
                <th className="p-3 text-left text-text-muted font-body font-normal hidden md:table-cell">Genres</th>
                <th className="p-3 text-center text-text-muted font-body font-normal w-16">Featured</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td colSpan={5} className="p-3"><div className="h-5 bg-white/5 rounded animate-pulse" /></td>
                  </tr>
                ))
                : filtered.map(m => (
                  <tr key={m._id} onClick={() => toggle(m._id)}
                    className={`border-b border-white/5 cursor-pointer transition-colors ${selected.has(m._id) ? 'bg-primary/5' : 'hover:bg-white/2'}`}>
                    <td className="p-3" onClick={e => { e.stopPropagation(); toggle(m._id) }}>
                      <span className="text-text-muted">
                        {selected.has(m._id) ? <CheckSquare size={15} className="text-primary" /> : <Square size={15} />}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {m.coverUrl && <img src={m.coverUrl} alt="" className="w-7 h-9 object-cover rounded" />}
                        <span className="text-text font-body line-clamp-1">{m.title}</span>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <span className={`text-xs font-mono capitalize ${STATUS_COLORS[m.status] || 'text-text-muted'}`}>{m.status}</span>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {m.genres.slice(0, 3).map(g => (
                          <span key={g} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-text-muted">{g}</span>
                        ))}
                        {m.genres.length > 3 && <span className="text-[10px] text-text-muted">+{m.genres.length - 3}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {m.featured && <Star size={13} className="text-yellow-400 mx-auto" />}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-text-muted text-sm">No manga found</div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-heading text-text">Confirm Action</h4>
                <p className="text-sm text-text-muted mt-1">{confirmAction.label} This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { confirmAction.fn(); setConfirmAction(null) }}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 transition-colors">Confirm</button>
              <button onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 glass text-text-muted rounded-xl text-sm hover:text-text transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}