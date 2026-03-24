import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronUp, Clock, CheckCircle, XCircle, BookCheck, Search, X, ExternalLink, Loader2 } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

const DEFAULT_CAT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1e1e30"/><stop offset="100%" stop-color="#0d0d14"/></radialGradient><clipPath id="circ"><circle cx="100" cy="100" r="100"/></clipPath></defs><circle cx="100" cy="100" r="100" fill="url(#bg)"/><g clip-path="url(#circ)"><ellipse cx="100" cy="110" rx="42" ry="40" fill="#f0a012"/><polygon points="68,80 58,55 85,74" fill="#f0a012"/><polygon points="132,80 142,55 115,74" fill="#f0a012"/><circle cx="100" cy="122" r="3" fill="#7a4a00"/></g><circle cx="100" cy="100" r="97" fill="none" stroke="#e8394d" stroke-width="1.5" opacity="0.4"/></svg>')}`

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: 'Pending',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   icon: Clock },
  approved: { label: 'Approved', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',      icon: CheckCircle },
  added:    { label: 'Added!',   color: 'text-green-400 bg-green-500/10 border-green-500/20',   icon: BookCheck },
  rejected: { label: 'Rejected', color: 'text-red-400 bg-red-500/10 border-red-500/20',         icon: XCircle },
}

export default function MangaRequests() {
  const { user } = useAuth()
  const [requests, setRequests]   = useState<any[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [upvoting, setUpvoting]   = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Form state
  const [form, setForm] = useState({ title: '', alternativeTitles: '', mangadexUrl: '', notes: '' })
  const [formError, setFormError] = useState('')

  const filteredRequests = requests.filter(r =>
    !search.trim() || r.title.toLowerCase().includes(search.toLowerCase())
  )

  async function loadRequests(p = 0, status = statusFilter) {
    setLoading(true)
    try {
      const res = await axios.get(`/api/manga-requests?status=${status}&page=${p}`)
      if (p === 0) setRequests(res.data.requests)
      else setRequests(prev => [...prev, ...res.data.requests])
      setTotal(res.data.total)
      setPage(p)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadRequests(0, statusFilter) }, [statusFilter])

  async function handleSubmit() {
    if (!form.title.trim()) { setFormError('Title is required'); return }
    setFormError('')
    setSubmitting(true)
    try {
      const res = await axios.post('/api/manga-requests', form, { withCredentials: true })
      setRequests(prev => [res.data, ...prev])
      setTotal(t => t + 1)
      setForm({ title: '', alternativeTitles: '', mangadexUrl: '', notes: '' })
      setShowForm(false)
      setSuccessMsg('Request submitted! The admin will review it soon.')
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to submit')
    } finally { setSubmitting(false) }
  }

  async function toggleUpvote(id: string) {
    if (!user) return
    setUpvoting(id)
    try {
      const res = await axios.post(`/api/manga-requests/${id}/upvote`, {}, { withCredentials: true })
      setRequests(prev => prev.map(r => r._id === id
        ? { ...r, upvotes: res.data.upvoted
            ? [...r.upvotes, user.id]
            : r.upvotes.filter((u: string) => u !== user.id) }
        : r
      ))
    } catch {} finally { setUpvoting(null) }
  }

  async function deleteRequest(id: string) {
    if (!confirm('Delete this request?')) return
    try {
      await axios.delete(`/api/manga-requests/${id}`, { withCredentials: true })
      setRequests(prev => prev.filter(r => r._id !== id))
      setTotal(t => t - 1)
    } catch {}
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10 pt-24">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-white mb-1">Manga Requests</h1>
          <p className="font-body text-text-muted text-sm">
            Can't find a manga on the site? Request it here and the admin will review it.
          </p>
        </div>
        {user ? (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-white text-sm font-body rounded-xl transition-all flex-shrink-0">
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'Request Manga'}
          </button>
        ) : (
          <Link to="/login" className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-white text-sm font-body rounded-xl transition-all">
            Sign in to Request
          </Link>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400 text-sm font-body flex items-center gap-2">
          <CheckCircle size={14} /> {successMsg}
        </div>
      )}

      {/* Submit Form */}
      {showForm && (
        <div className="glass border border-primary/20 rounded-2xl p-5 mb-6 space-y-3">
          <h2 className="font-display text-base text-white">New Request</h2>

          {formError && (
            <p className="text-xs text-red-400 font-body bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-muted font-body mb-1">Manga Title <span className="text-primary">*</span></label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value.slice(0, 200)}))}
                placeholder="e.g. Bloom Into You"
                className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none" />
            </div>
            <div>
              <label className="block text-xs text-text-muted font-body mb-1">Alternative Titles</label>
              <input value={form.alternativeTitles} onChange={e => setForm(f => ({...f, alternativeTitles: e.target.value.slice(0, 300)}))}
                placeholder="Japanese / other titles"
                className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none" />
            </div>
            <div>
              <label className="block text-xs text-text-muted font-body mb-1">MangaDex URL <span className="text-text-muted">(optional)</span></label>
              <input value={form.mangadexUrl} onChange={e => setForm(f => ({...f, mangadexUrl: e.target.value.slice(0, 500)}))}
                placeholder="https://mangadex.org/title/..."
                className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-muted font-body mb-1">Notes <span className="text-text-muted">(why you want it, genre, etc.)</span></label>
              <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value.slice(0, 1000)}))}
                placeholder="Any extra info for our team..." rows={3}
                className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2 text-sm text-text font-body outline-none resize-none" />
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <p className="text-xs text-text-muted font-body">Max 3 pending requests per user</p>
            <button onClick={handleSubmit} disabled={!form.title.trim() || submitting}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-body rounded-xl disabled:opacity-40 transition-all">
              {submitting ? <><Loader2 size={13} className="animate-spin" /> Submitting…</> : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-1.5">
          {(['pending', 'approved', 'added', 'rejected'] as const).map(s => {
            const meta = STATUS_META[s]
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-body border transition-all ${
                  statusFilter === s ? `${meta.color}` : 'glass border-white/10 text-text-muted hover:text-text'
                }`}>
                {meta.label}
              </button>
            )
          })}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search requests…"
            className="w-full bg-white/5 border border-white/10 focus:border-primary/40 rounded-xl pl-8 pr-3 py-1.5 text-sm text-text font-body outline-none" />
        </div>
      </div>

      {/* Request list */}
      {loading && requests.length === 0 ? (
        <div className="space-y-3">
          {Array.from({length: 5}).map((_,i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-20">
          <BookCheck size={48} className="text-text-muted mx-auto mb-4 opacity-30" />
          <p className="font-body text-text-muted">No {statusFilter} requests yet.</p>
          {statusFilter === 'pending' && user && (
            <button onClick={() => setShowForm(true)} className="mt-4 text-primary font-body text-sm hover:underline">
              Be the first to request a manga →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(r => {
            const meta = STATUS_META[r.status]
            const StatusIcon = meta.icon
            const hasUpvoted = user && r.upvotes.includes(user.id)
            const isOwn = user?.id === r.userId

            return (
              <div key={r._id} className="glass border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all">
                <div className="flex items-start gap-3">

                  {/* Upvote button */}
                  <button
                    onClick={() => toggleUpvote(r._id)}
                    disabled={!user || r.status !== 'pending' || !!upvoting}
                    className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl border transition-all flex-shrink-0 ${
                      hasUpvoted
                        ? 'bg-primary/15 border-primary/30 text-primary'
                        : 'glass border-white/10 text-text-muted hover:border-white/20 hover:text-text disabled:opacity-40 disabled:cursor-default'
                    }`}
                  >
                    {upvoting === r._id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <ChevronUp size={14} className={hasUpvoted ? 'text-primary' : ''} />
                    }
                    <span className="text-xs font-body leading-none">{r.upvotes.length}</span>
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-display text-base text-white">{r.title}</h3>
                        {r.alternativeTitles && (
                          <p className="text-xs text-text-muted font-body">{r.alternativeTitles}</p>
                        )}
                      </div>
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-body border flex-shrink-0 ${meta.color}`}>
                        <StatusIcon size={10} /> {meta.label}
                      </span>
                    </div>

                    {r.notes && (
                      <p className="text-xs text-text-muted font-body mt-1.5 line-clamp-2">{r.notes}</p>
                    )}

                    {r.adminNote && (
                      <div className="mt-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                        <p className="text-xs text-text-muted font-body"><span className="text-primary">Staff note:</span> {r.adminNote}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <img src={r.userAvatar || DEFAULT_CAT_AVATAR} alt={r.userName}
                          className="w-4 h-4 rounded-full object-cover" />
                        <span className="text-xs text-text-muted font-body">{r.userName}</span>
                      </div>
                      <span className="text-xs text-text-muted font-body opacity-50">
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {r.mangadexUrl && (
                        <a href={r.mangadexUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline font-body">
                          <ExternalLink size={10} /> MangaDex
                        </a>
                      )}
                      {isOwn && r.status === 'pending' && (
                        <button onClick={() => deleteRequest(r._id)}
                          className="text-xs text-red-400 hover:text-red-300 font-body ml-auto transition-colors">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Load more */}
          {requests.length < total && (
            <button onClick={() => loadRequests(page + 1, statusFilter)} disabled={loading}
              className="w-full py-3 glass border border-white/10 text-text-muted text-sm font-body rounded-xl hover:text-text hover:border-white/20 transition-all disabled:opacity-40">
              {loading ? 'Loading…' : `Load more (${total - requests.length} remaining)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}