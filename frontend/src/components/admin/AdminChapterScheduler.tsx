import { useState, useEffect } from 'react'
import axios from 'axios'
import { Clock, CalendarDays, Check, RefreshCw, PlayCircle } from 'lucide-react'

interface ScheduledChapter {
  _id: string
  chapterNumber: string
  title?: string
  publishAt: string | null
  draft?: boolean
  published?: boolean
  mangaId?: string
  mangaDexId?: string
}

export default function AdminChapterScheduler() {
  const [source, setSource] = useState<'local' | 'mdx'>('local')
  const [chapters, setChapters] = useState<ScheduledChapter[]>([])
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dateInput, setDateInput] = useState('')

  useEffect(() => { load() }, [source])

  async function load() {
    setLoading(true)
    try {
      const res = await axios.get(`/api/admin/scheduler/chapters?source=${source}`, { withCredentials: true })
      setChapters(res.data)
    } catch { setChapters([]) }
    setLoading(false)
  }

  async function saveSchedule(id: string) {
    try {
      const endpoint = source === 'local'
        ? `/api/admin/scheduler/chapters/local/${id}`
        : `/api/admin/scheduler/chapters/mdx/${id}`
      await axios.put(endpoint, { publishAt: dateInput || null }, { withCredentials: true })
      setEditingId(null)
      setDateInput('')
      await load()
    } catch (e: any) {
      alert(e.response?.data?.error || e.message)
    }
  }

  async function publishDue() {
    setPublishing(true)
    try {
      const res = await axios.post('/api/admin/scheduler/publish-due', {}, { withCredentials: true })
      setPublishResult(`Published ${res.data.localPublished} local + ${res.data.mdxPublished} MDX chapters`)
      await load()
    } catch (e: any) {
      setPublishResult(`Error: ${e.response?.data?.error || e.message}`)
    }
    setPublishing(false)
    setTimeout(() => setPublishResult(null), 4000)
  }

  const now = new Date()
  const overdue = chapters.filter(c => c.publishAt && new Date(c.publishAt) <= now)
  const upcoming = chapters.filter(c => c.publishAt && new Date(c.publishAt) > now)

  // Min datetime for input = now
  const minDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-lg text-text flex-1">Chapter Scheduler</h3>
        <div className="flex gap-1 glass rounded-xl p-1">
          {(['local', 'mdx'] as const).map(s => (
            <button key={s} onClick={() => setSource(s)}
              className={`px-3 py-1 rounded-lg text-xs font-body transition-colors ${source === s ? 'bg-primary text-white' : 'text-text-muted hover:text-text'}`}>
              {s === 'local' ? 'Local' : 'MangaDex'}
            </button>
          ))}
        </div>
        <button onClick={publishDue} disabled={publishing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs hover:bg-green-500/30 transition-colors disabled:opacity-50">
          <PlayCircle size={13} /> {publishing ? 'Publishing…' : 'Publish Due Now'}
        </button>
        <button onClick={load} className="p-1.5 glass rounded-lg text-text-muted hover:text-text transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {publishResult && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${publishResult.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
          <Check size={14} /> {publishResult}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3 text-center">
          <div className="text-2xl font-heading text-red-400">{overdue.length}</div>
          <div className="text-xs text-text-muted mt-1">Overdue</div>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <div className="text-2xl font-heading text-blue-400">{upcoming.length}</div>
          <div className="text-xs text-text-muted mt-1">Upcoming</div>
        </div>
      </div>

      {/* Chapters list */}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 glass rounded-xl animate-pulse" />
          ))
          : chapters.length === 0
            ? <div className="text-center py-8 text-text-muted text-sm glass rounded-xl">No scheduled chapters. Set a publish date on a chapter to schedule it.</div>
            : chapters.map(ch => {
              const isOverdue = ch.publishAt && new Date(ch.publishAt) <= now
              const isEditing = editingId === ch._id
              return (
                <div key={ch._id} className={`glass rounded-xl p-3 flex items-center gap-3 ${isOverdue ? 'border border-red-500/20' : 'border border-blue-500/10'}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-400' : 'bg-blue-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text font-body">Ch.{ch.chapterNumber}{ch.title ? ` — ${ch.title}` : ''}</div>
                    {!isEditing && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <CalendarDays size={11} className={isOverdue ? 'text-red-400' : 'text-blue-400'} />
                        <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-text-muted'}`}>
                          {ch.publishAt ? new Date(ch.publishAt).toLocaleString() : 'No date'}
                          {isOverdue && ' (overdue)'}
                        </span>
                      </div>
                    )}
                    {isEditing && (
                      <div className="flex items-center gap-2 mt-1">
                        <input type="datetime-local" value={dateInput} min={minDatetime}
                          onChange={e => setDateInput(e.target.value)}
                          className="bg-surface border border-white/10 rounded-lg px-2 py-1 text-xs text-text focus:outline-none focus:border-primary/60" />
                        <button onClick={() => saveSchedule(ch._id)}
                          className="px-2 py-1 bg-primary text-white rounded-lg text-xs hover:bg-primary/80">Save</button>
                        <button onClick={() => { setEditingId(null); setDateInput('') }}
                          className="px-2 py-1 glass text-text-muted rounded-lg text-xs hover:text-text">Cancel</button>
                      </div>
                    )}
                  </div>
                  {!isEditing && (
                    <button onClick={() => { setEditingId(ch._id); setDateInput(ch.publishAt ? new Date(ch.publishAt).toISOString().slice(0, 16) : '') }}
                      className="p-1.5 glass rounded-lg text-text-muted hover:text-primary transition-colors flex-shrink-0">
                      <Clock size={13} />
                    </button>
                  )}
                </div>
              )
            })}
      </div>
    </div>
  )
}