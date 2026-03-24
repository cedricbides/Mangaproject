import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash2, Calendar, Check, AlertTriangle, Info, X } from 'lucide-react'

interface ScheduledAnnouncement {
  _id?: string
  message: string
  color: 'info' | 'warning' | 'success' | 'danger'
  startsAt: string
  endsAt: string
  enabled: boolean
}

const COLOR_STYLES = {
  info:    { label: 'Info',    bg: 'bg-blue-500/20',   text: 'text-blue-400',   icon: Info },
  warning: { label: 'Warning', bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: AlertTriangle },
  success: { label: 'Success', bg: 'bg-green-500/20',  text: 'text-green-400',  icon: Check },
  danger:  { label: 'Danger',  bg: 'bg-red-500/20',    text: 'text-red-400',    icon: AlertTriangle },
}

const EMPTY: ScheduledAnnouncement = {
  message: '', color: 'info', startsAt: '', endsAt: '', enabled: true,
}

export default function AdminAnnouncementScheduler() {
  const [announcements, setAnnouncements] = useState<ScheduledAnnouncement[]>([])
  const [form, setForm] = useState<ScheduledAnnouncement>({ ...EMPTY })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [siteSettings, setSiteSettings] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await axios.get('/api/admin/site-settings', { withCredentials: true })
      setSiteSettings(res.data)
      setAnnouncements(res.data.scheduledAnnouncements || [])
    } catch { }
  }

  async function save(updated: ScheduledAnnouncement[]) {
    setSaving(true)
    try {
      await axios.put('/api/admin/site-settings/general', {
        ...siteSettings,
        scheduledAnnouncements: updated,
      }, { withCredentials: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setAnnouncements(updated)
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  function addAnnouncement() {
    if (!form.message || !form.startsAt || !form.endsAt) return
    const updated = [...announcements, form]
    save(updated)
    setForm({ ...EMPTY })
    setShowForm(false)
  }

  function remove(idx: number) {
    save(announcements.filter((_, i) => i !== idx))
  }

  function toggleEnabled(idx: number) {
    const updated = announcements.map((a, i) => i === idx ? { ...a, enabled: !a.enabled } : a)
    save(updated)
  }

  const now = new Date()
  const minDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-heading text-lg text-text flex-1">Scheduled Announcements</h3>
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-xs hover:bg-primary/30 transition-colors">
          <Plus size={13} /> New
        </button>
      </div>

      {/* New form */}
      {showForm && (
        <div className="glass rounded-xl p-4 space-y-3 border border-primary/20">
          <h4 className="text-sm font-body text-text">New Announcement</h4>
          <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            placeholder="Announcement message..." rows={2}
            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/60 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Type</label>
              <select value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value as any }))}
                className="w-full bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none">
                {Object.entries(COLOR_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Enabled</label>
              <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                className={`w-full py-1.5 rounded-lg text-sm transition-colors ${form.enabled ? 'bg-green-500/20 text-green-400' : 'glass text-text-muted'}`}>
                {form.enabled ? 'Yes' : 'No'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Starts At</label>
              <input type="datetime-local" value={form.startsAt} min={minDate}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                className="w-full bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-primary/60" />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Ends At</label>
              <input type="datetime-local" value={form.endsAt} min={form.startsAt || minDate}
                onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                className="w-full bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none focus:border-primary/60" />
            </div>
          </div>
          {/* Preview */}
          {form.message && (
            <div className={`rounded-lg p-2 text-xs flex items-center gap-2 ${COLOR_STYLES[form.color].bg} ${COLOR_STYLES[form.color].text}`}>
              <Info size={12} /> {form.message}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={addAnnouncement} disabled={!form.message || !form.startsAt || !form.endsAt || saving}
              className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/80 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY }) }}
              className="px-4 py-1.5 glass text-text-muted rounded-lg text-sm hover:text-text">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {announcements.length === 0
        ? <div className="py-8 text-center text-text-muted text-sm glass rounded-xl">No scheduled announcements</div>
        : (
          <div className="space-y-2">
            {announcements.map((ann, idx) => {
              const style = COLOR_STYLES[ann.color]
              const Icon = style.icon
              const start = new Date(ann.startsAt)
              const end = new Date(ann.endsAt)
              const isActive = ann.enabled && now >= start && now <= end
              const isExpired = now > end
              const isPending = now < start
              return (
                <div key={idx} className={`glass rounded-xl p-3 flex gap-3 ${!ann.enabled ? 'opacity-50' : ''}`}>
                  <Icon size={15} className={`${style.text} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text">{ann.message}</p>
                    <div className="flex flex-wrap gap-2 mt-1 items-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${style.bg} ${style.text}`}>{style.label}</span>
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Calendar size={9} /> {start.toLocaleDateString()} → {end.toLocaleDateString()}
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isActive ? 'bg-green-500/20 text-green-400' : isExpired ? 'bg-white/5 text-text-muted' : 'bg-blue-500/20 text-blue-400'}`}>
                        {isActive ? 'ACTIVE' : isExpired ? 'EXPIRED' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => toggleEnabled(idx)}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${ann.enabled ? 'glass text-text-muted hover:text-text' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                      {ann.enabled ? <X size={12} /> : <Check size={12} />}
                    </button>
                    <button onClick={() => remove(idx)}
                      className="p-1.5 glass rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}