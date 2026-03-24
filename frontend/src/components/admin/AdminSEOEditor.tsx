import { useState, useEffect } from 'react'
import axios from 'axios'
import { Globe, Search, Check, Edit3, ChevronDown, ChevronUp } from 'lucide-react'

interface MangaSEO {
  _id?: string
  mangaDexId?: string
  title: string
  slug?: string
  coverUrl?: string
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string[]
  source: 'local' | 'mdx'
}

export default function AdminSEOEditor() {
  const [manga, setManga] = useState<MangaSEO[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, Partial<MangaSEO>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await axios.get('/api/admin/seo/manga', { withCredentials: true })
      const local: MangaSEO[] = res.data.local.map((m: any) => ({ ...m, source: 'local', id: m._id }))
      const mdx: MangaSEO[] = res.data.mdx.map((m: any) => ({ ...m, source: 'mdx', id: m.mangaDexId || m._id }))
      setManga([...local, ...mdx])
    } catch { }
    setLoading(false)
  }

  const getId = (m: MangaSEO) => m.source === 'local' ? (m._id || '') : (m.mangaDexId || '')

  const filtered = manga.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
  const filled = filtered.filter(m => m.seoTitle || m.seoDescription)
  const missing = filtered.filter(m => !m.seoTitle && !m.seoDescription)

  function getForm(id: string, m: MangaSEO) {
    return forms[id] || { seoTitle: m.seoTitle || '', seoDescription: m.seoDescription || '', seoKeywords: m.seoKeywords || [] }
  }

  function updateForm(id: string, field: string, value: any) {
    setForms(f => ({ ...f, [id]: { ...f[id], [field]: value } }))
  }

  async function saveSEO(m: MangaSEO) {
    const id = getId(m)
    setSaving(id)
    const form = getForm(id, m)
    try {
      if (m.source === 'local') {
        await axios.put(`/api/admin/seo/manga/${m._id}`, form, { withCredentials: true })
      } else {
        await axios.put(`/api/admin/seo/mangadex/${m.mangaDexId}`, form, { withCredentials: true })
      }
      setSaved(id)
      setTimeout(() => setSaved(null), 2000)
      await load()
    } catch (e: any) { alert(e.message) }
    setSaving(null)
  }

  const renderGroup = (items: MangaSEO[], label: string, color: string) => (
    items.length > 0 && (
      <div className="space-y-2">
        <div className={`text-xs font-mono px-2 py-0.5 rounded-full inline-block ${color}`}>{label} ({items.length})</div>
        {items.map(m => {
          const id = getId(m)
          const isOpen = expanded === id
          const form = getForm(id, m)
          const isSaving = saving === id
          const isSaved = saved === id
          return (
            <div key={id} className="glass rounded-xl overflow-hidden">
              <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/2 transition-colors"
                onClick={() => setExpanded(isOpen ? null : id)}>
                {m.coverUrl && <img src={m.coverUrl} alt="" className="w-8 h-10 object-cover rounded flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text font-body truncate">{m.title}</div>
                  <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                    <span className={`px-1 rounded text-[10px] font-mono ${m.source === 'local' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>{m.source}</span>
                    {m.seoTitle && <span className="truncate">{m.seoTitle}</span>}
                    {!m.seoTitle && <span className="text-text-muted/50">No SEO title</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isSaved && <Check size={14} className="text-green-400" />}
                  <Globe size={13} className={m.seoTitle ? 'text-green-400' : 'text-text-muted/40'} />
                  {isOpen ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 border-t border-white/5">
                  <div className="pt-2">
                    <label className="text-xs text-text-muted block mb-1">SEO Title <span className="text-text-muted/50">(60 chars recommended)</span></label>
                    <input value={form.seoTitle || ''} onChange={e => updateForm(id, 'seoTitle', e.target.value)}
                      maxLength={80} placeholder={`${m.title} — Read Online Free | MangaVerse`}
                      className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/60" />
                    <div className="text-right text-[10px] text-text-muted mt-0.5">{(form.seoTitle || '').length}/80</div>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Meta Description <span className="text-text-muted/50">(150-160 chars recommended)</span></label>
                    <textarea value={form.seoDescription || ''} onChange={e => updateForm(id, 'seoDescription', e.target.value)}
                      maxLength={200} rows={2} placeholder="Read this manga online for free..."
                      className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/60 resize-none" />
                    <div className="text-right text-[10px] text-text-muted mt-0.5">{(form.seoDescription || '').length}/200</div>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Keywords <span className="text-text-muted/50">(comma-separated)</span></label>
                    <input value={(form.seoKeywords || []).join(', ')}
                      onChange={e => updateForm(id, 'seoKeywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                      placeholder="manga, read online, action, adventure"
                      className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/60" />
                  </div>
                  {/* Google preview */}
                  {(form.seoTitle || form.seoDescription) && (
                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <div className="text-xs text-text-muted mb-1 flex items-center gap-1"><Search size={10} /> Google Preview</div>
                      <div className="text-sm text-blue-400">{form.seoTitle || m.title}</div>
                      <div className="text-xs text-green-400/70 font-mono mt-0.5">mangaverse.app/manga/{m.slug || m.mangaDexId}</div>
                      <div className="text-xs text-text-muted mt-1 line-clamp-2">{form.seoDescription || 'No description'}</div>
                    </div>
                  )}
                  <button onClick={() => saveSEO(m)} disabled={isSaving}
                    className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors">
                    {isSaving ? 'Saving…' : 'Save SEO'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-heading text-lg text-text flex-1">SEO Meta Editor</h3>
        <div className="text-xs text-text-muted">{filled.length}/{filtered.length} optimized</div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search manga by title..."
        className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/60" />

      {/* Progress bar */}
      <div className="glass rounded-xl p-3">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>SEO Coverage</span>
          <span>{filtered.length > 0 ? Math.round(filled.length / filtered.length * 100) : 0}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${filtered.length > 0 ? (filled.length / filtered.length) * 100 : 0}%` }} />
        </div>
      </div>

      {loading
        ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)
        : (
          <div className="space-y-4">
            {renderGroup(missing, '⚠ Missing SEO', 'bg-yellow-500/10 text-yellow-400')}
            {renderGroup(filled, '✓ Optimized', 'bg-green-500/10 text-green-400')}
          </div>
        )}
    </div>
  )
}