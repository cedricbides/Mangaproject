import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, BookOpen, Star, Calendar, Tag, Plus, Trash2, X, Upload, Download, Link2, Eye, CheckSquare, Square, Globe, EyeOff, FileText, ChevronDown, ChevronUp, Check, Pencil, List, Lock } from 'lucide-react'

import axios from 'axios'
import type { Manga, Chapter } from '@/types'
import { getCoverUrl, getMangaTitle, getMangaDescription, getMangaTags, getStatusColor, formatChapter } from '@/utils/manga'
import { useAuth } from '@/context/AuthContext'
import DownloadChapterButton from '@/components/DownloadChapterButton'
import ReadingListButton from '@/components/ReadingListButton'
import WatchButton from '@/components/WatchButton'

import RatingReviews from '@/components/RatingReviews'
import MangaComments from '@/components/MangaComments'
import RecommendedManga from '@/components/RecommendedManga'


const MD = '/api/mangadex'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ManualChapter {
  _id: string
  mangaDexId: string
  chapterNumber: string
  title?: string
  volume?: string
  pages: string[]
  language: string
  source: 'manual'
  published: boolean
  externalUrl?: string
  createdAt: string
}

type MergedChapter =
  | { type: 'api'; data: Chapter }
  | { type: 'manual'; data: ManualChapter }

// ─── Page resolver helpers ────────────────────────────────────────────────────

function resolveApiPages(chapterId: string) {
  // Route through backend so all 5 fallback image sources are available
  return async (): Promise<string[]> => {
    const res = await axios.get(`/api/mangadex/chapter-pages/${chapterId}`)
    return res.data.pages
  }
}

function resolveManualPages(pages: string[]) {
  return async (): Promise<string[]> => pages
}

// ─── Admin: Add Chapter Modal ─────────────────────────────────────────────────

interface PreviewChapter {
  id: string
  chapterNumber: string
  title?: string
  volume?: string
  pages: number
  publishAt: string
  language: string
}

function AddChapterModal({
  mangaDexId,
  existingChapters = [],
  onClose,
  onAdded,
}: {
  mangaDexId: string
  existingChapters?: ManualChapter[]
  onClose: () => void
  onAdded: (ch: ManualChapter) => void
}) {
  const [tab, setTab] = useState<'manual' | 'import'>('manual')

  const nextChapterNumber = (() => {
    if (!existingChapters.length) return '1'
    const nums = existingChapters
      .map(c => parseFloat(c.chapterNumber))
      .filter(n => !isNaN(n))
    if (!nums.length) return '1'
    return String(Math.floor(Math.max(...nums)) + 1)
  })()

  const [form, setForm] = useState({ chapterNumber: nextChapterNumber, title: '', volume: '', language: 'en', pages: '', externalUrl: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [importUrl, setImportUrl] = useState('')
  const [importLang, setImportLang] = useState('en')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [previewChapters, setPreviewChapters] = useState<PreviewChapter[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; message?: string } | null>(null)
  const [importError, setImportError] = useState('')

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.chapterNumber.trim()) return setError('Chapter number is required.')
    setSaving(true)
    setError('')
    try {
      const pages = form.pages.split('\n').map((l) => l.trim()).filter(Boolean)
      const res = await axios.post(
        `/api/admin/mangadex/${mangaDexId}/chapters`,
        { ...form, pages, externalUrl: form.externalUrl.trim() || undefined },
        { withCredentials: true }
      )
      onAdded(res.data)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save chapter.')
    } finally {
      setSaving(false)
    }
  }

  const handleFetchPreview = async () => {
    if (!importUrl.trim()) return setFetchError('Please paste a MangaDex URL.')
    setFetching(true)
    setFetchError('')
    setPreviewChapters(null)
    setSelected(new Set())
    setImportResult(null)
    try {
      const match = importUrl.match(/mangadex\.org\/title\/([a-f0-9-]{36})/i)
      if (!match) throw new Error('Invalid MangaDex URL')
      const sourceId = match[1]
      // Use the backend all-chapters endpoint (paginated, multi-source fallback)
      const res = await axios.get(`/api/mangadex/all-chapters/${sourceId}?lang=${importLang}`)
      const data: any[] = res.data.data || []
      const all: PreviewChapter[] = data.map((c: any) => ({
        id: c.id,
        chapterNumber: c.attributes.chapter || '?',
        title: c.attributes.title || '',
        volume: c.attributes.volume || '',
        pages: c.attributes.pages || 0,
        publishAt: c.attributes.publishAt,
        language: c.attributes.translatedLanguage,
      }))
      setPreviewChapters(all)
      setSelected(new Set(all.map(c => c.id)))
    } catch (err: any) {
      setFetchError(err.message || 'Failed to fetch chapters.')
    } finally {
      setFetching(false)
    }
  }

  const handleImport = async () => {
    if (!selected.size) return setImportError('Select at least one chapter.')
    const match = importUrl.match(/mangadex\.org\/title\/([a-f0-9-]{36})/i)
    if (!match) return
    setImporting(true)
    setImportError('')
    setImportResult(null)
    try {
      const res = await axios.post(
        `/api/admin/mangadex/${mangaDexId}/import-from-mangadex`,
        { sourceUrl: importUrl, language: importLang, selectedIds: Array.from(selected) },
        { withCredentials: true }
      )
      setImportResult(res.data)
    } catch (err: any) {
      setImportError(err.response?.data?.error || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const toggleAll = () => {
    if (!previewChapters) return
    if (selected.size === previewChapters.length) setSelected(new Set())
    else setSelected(new Set(previewChapters.map(c => c.id)))
  }

  const toggleOne = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#13131a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h2 className="font-display text-xl text-white tracking-wide">Add Chapter</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="flex gap-1 mx-6 mb-4 bg-white/5 rounded-xl p-1 flex-shrink-0">
          <button onClick={() => setTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-body rounded-lg transition-all ${tab === 'manual' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-text'}`}>
            <Upload size={13} /> Manual
          </button>
          <button onClick={() => setTab('import')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-body rounded-lg transition-all ${tab === 'import' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-text'}`}>
            <Link2 size={13} /> Import from MangaDex
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {tab === 'manual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-xs text-text-muted tracking-widest block mb-1 flex items-center gap-1.5">
                    CHAPTER NO. *
                    {existingChapters.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-mono uppercase">auto</span>
                    )}
                  </label>
                  <input value={form.chapterNumber} onChange={(e) => set('chapterNumber', e.target.value)}
                    placeholder="e.g. 79.2"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">VOLUME</label>
                  <input value={form.volume} onChange={(e) => set('volume', e.target.value)}
                    placeholder="e.g. 8"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
                </div>
              </div>
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">TITLE</label>
                <input value={form.title} onChange={(e) => set('title', e.target.value)}
                  placeholder="Optional chapter title"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">LANGUAGE</label>
                <select value={form.language} onChange={(e) => set('language', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50">
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="pt-br">Portuguese (BR)</option>
                  <option value="id">Indonesian</option>
                </select>
              </div>
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">
                  PAGE URLs <span className="normal-case text-text-muted/60">(one per line)</span>
                </label>
                <textarea value={form.pages} onChange={(e) => set('pages', e.target.value)}
                  placeholder={"https://cdn.example.com/page1.jpg\nhttps://cdn.example.com/page2.jpg"}
                  rows={5}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50 resize-none font-mono" />
                <p className="text-xs text-text-muted mt-1 font-body">
                  {form.pages.split('\n').filter((l) => l.trim()).length} pages entered
                </p>
              </div>
              <div>
                <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">
                  EXTERNAL URL <span className="normal-case text-text-muted/60">(optional)</span>
                </label>
                <input value={form.externalUrl} onChange={(e) => set('externalUrl', e.target.value)}
                  placeholder="https://mangaplus.shueisha.co.jp/..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
              </div>
              {error && <p className="text-xs text-red-400 font-body bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3 mt-2">
                <button onClick={handleSubmit} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-body font-medium rounded-xl transition-all disabled:opacity-50">
                  <Upload size={14} />
                  {saving ? 'Saving…' : 'Add Chapter'}
                </button>
                <button onClick={onClose}
                  className="px-5 py-2.5 glass border border-white/10 text-text-muted text-sm font-body rounded-xl hover:text-text transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {tab === 'import' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">MANGADEX URL *</label>
                  <input value={importUrl} onChange={(e) => { setImportUrl(e.target.value); setPreviewChapters(null); setImportResult(null) }}
                    placeholder="https://mangadex.org/title/fa3f1ddb-..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="font-mono text-xs text-text-muted tracking-widest block mb-1">LANGUAGE</label>
                    <select value={importLang} onChange={(e) => { setImportLang(e.target.value); setPreviewChapters(null) }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/50">
                      <option value="en">English</option>
                      <option value="ja">Japanese</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="pt-br">Portuguese (BR)</option>
                      <option value="id">Indonesian</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleFetchPreview} disabled={fetching || !importUrl.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-body rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                      <Link2 size={13} />
                      {fetching ? 'Fetching…' : 'Fetch Chapters'}
                    </button>
                  </div>
                </div>
                {fetchError && <p className="text-xs text-red-400 font-body bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{fetchError}</p>}
              </div>

              {previewChapters && !importResult && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-body text-text-muted hover:text-text transition-colors">
                      {selected.size === previewChapters.length
                        ? <CheckSquare size={14} className="text-primary" />
                        : <Square size={14} />}
                      {selected.size === previewChapters.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-xs text-text-muted font-body">{selected.size} / {previewChapters.length} selected</span>
                  </div>
                  <div className="border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    {previewChapters.map((ch, i) => (
                      <button key={ch.id} onClick={() => toggleOne(ch.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${i > 0 ? 'border-t border-white/5' : ''} ${selected.has(ch.id) ? 'bg-primary/5' : ''}`}>
                        {selected.has(ch.id)
                          ? <Check size={13} className="text-primary flex-shrink-0" />
                          : <Square size={13} className="text-text-muted/40 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-body text-text">
                            {ch.volume ? `Vol.${ch.volume} ` : ''}Ch.{ch.chapterNumber}
                            {ch.title ? <span className="text-text-muted"> — {ch.title}</span> : ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-muted font-mono flex-shrink-0">{ch.pages}p</span>
                      </button>
                    ))}
                  </div>
                  {importError && <p className="text-xs text-red-400 font-body bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{importError}</p>}
                  {importing && (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                      <p className="text-xs text-text-muted font-body animate-pulse">Importing {selected.size} chapters…</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={handleImport} disabled={importing || !selected.size}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-body font-medium rounded-xl transition-all disabled:opacity-50">
                      <Upload size={14} />
                      {importing ? 'Importing…' : `Import ${selected.size} Chapter${selected.size !== 1 ? 's' : ''}`}
                    </button>
                    <button onClick={onClose}
                      className="px-5 py-2.5 glass border border-white/10 text-text-muted text-sm font-body rounded-xl hover:text-text transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {importResult && (
                <div className="space-y-3">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-4">
                    <p className="text-sm text-green-400 font-body font-medium mb-1">Import complete!</p>
                    <p className="text-xs text-text-muted font-body">
                      {importResult.imported} chapter{importResult.imported !== 1 ? 's' : ''} imported.
                      {importResult.skipped > 0 && ` ${importResult.skipped} skipped.`}
                    </p>
                  </div>
                  <button onClick={onClose} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl transition-all">Done</button>
                </div>
              )}

              {!previewChapters && !fetching && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-blue-300 font-body leading-relaxed">
                    Paste a MangaDex manga URL and click <strong>Fetch Chapters</strong> to see the chapter list.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Language map (module-level so LangFlag can be a stable component) ──────────
const LANG_MAP: Record<string, { cc: string; label: string; color: string }> = {
    en:      { cc: 'gb',  label: 'English',                color: '#3b82f6' },
    'ja':    { cc: 'jp',  label: 'Japanese',               color: '#ef4444' },
    'ja-ro': { cc: 'jp',  label: 'Japanese (Romaji)',      color: '#ef4444' },
    ko:      { cc: 'kr',  label: 'Korean',                 color: '#8b5cf6' },
    zh:      { cc: 'cn',  label: 'Chinese (Simplified)',   color: '#f59e0b' },
    'zh-hk': { cc: 'hk',  label: 'Chinese (Traditional)', color: '#f59e0b' },
    es:      { cc: 'es',  label: 'Spanish',                color: '#f97316' },
    'es-la': { cc: 'mx',  label: 'Spanish (Latin America)',color: '#22c55e' },
    fr:      { cc: 'fr',  label: 'French',                 color: '#3b82f6' },
    'pt-br': { cc: 'br',  label: 'Portuguese (Brazil)',    color: '#22c55e' },
    pt:      { cc: 'pt',  label: 'Portuguese',             color: '#22c55e' },
    ru:      { cc: 'ru',  label: 'Russian',                color: '#3b82f6' },
    ar:      { cc: 'sa',  label: 'Arabic',                 color: '#22c55e' },
    id:      { cc: 'id',  label: 'Indonesian',             color: '#ef4444' },
    vi:      { cc: 'vn',  label: 'Vietnamese',             color: '#ef4444' },
    tr:      { cc: 'tr',  label: 'Turkish',                color: '#ef4444' },
    de:      { cc: 'de',  label: 'German',                 color: '#f59e0b' },
    it:      { cc: 'it',  label: 'Italian',                color: '#22c55e' },
    pl:      { cc: 'pl',  label: 'Polish',                 color: '#ef4444' },
    th:      { cc: 'th',  label: 'Thai',                   color: '#3b82f6' },
    tl:      { cc: 'ph',  label: 'Filipino',               color: '#3b82f6' },
    ms:      { cc: 'my',  label: 'Malay',                  color: '#ef4444' },
    uk:      { cc: 'ua',  label: 'Ukrainian',              color: '#f59e0b' },
    ro:      { cc: 'ro',  label: 'Romanian',               color: '#f59e0b' },
    cs:      { cc: 'cz',  label: 'Czech',                  color: '#3b82f6' },
    hu:      { cc: 'hu',  label: 'Hungarian',              color: '#22c55e' },
    bg:      { cc: 'bg',  label: 'Bulgarian',              color: '#22c55e' },
    he:      { cc: 'il',  label: 'Hebrew',                 color: '#3b82f6' },
    hi:      { cc: 'in',  label: 'Hindi',                  color: '#f97316' },
    mn:      { cc: 'mn',  label: 'Mongolian',              color: '#3b82f6' },
    sr:      { cc: 'rs',  label: 'Serbian',                color: '#ef4444' },
    hr:      { cc: 'hr',  label: 'Croatian',               color: '#3b82f6' },
    nl:      { cc: 'nl',  label: 'Dutch',                  color: '#f97316' },
    sv:      { cc: 'se',  label: 'Swedish',                color: '#3b82f6' },
    fa:      { cc: 'ir',  label: 'Persian',                color: '#22c55e' },
    ca:      { cc: 'es',  label: 'Catalan',                color: '#f59e0b' },
    sk:      { cc: 'sk',  label: 'Slovak',                 color: '#3b82f6' },
    lt:      { cc: 'lt',  label: 'Lithuanian',             color: '#f59e0b' },
    lv:      { cc: 'lv',  label: 'Latvian',                color: '#ef4444' },
    et:      { cc: 'ee',  label: 'Estonian',               color: '#3b82f6' },
    fi:      { cc: 'fi',  label: 'Finnish',                color: '#3b82f6' },
    da:      { cc: 'dk',  label: 'Danish',                 color: '#ef4444' },
    no:      { cc: 'no',  label: 'Norwegian',              color: '#ef4444' },
    ka:      { cc: 'ge',  label: 'Georgian',               color: '#ef4444' },
    az:      { cc: 'az',  label: 'Azerbaijani',            color: '#22c55e' },
    kk:      { cc: 'kz',  label: 'Kazakh',                 color: '#22c55e' },
    uz:      { cc: 'uz',  label: 'Uzbek',                  color: '#3b82f6' },
    hy:      { cc: 'am',  label: 'Armenian',               color: '#ef4444' },
    sq:      { cc: 'al',  label: 'Albanian',               color: '#ef4444' },
    mk:      { cc: 'mk',  label: 'Macedonian',             color: '#f59e0b' },
    bs:      { cc: 'ba',  label: 'Bosnian',                color: '#22c55e' },
    sl:      { cc: 'si',  label: 'Slovenian',              color: '#3b82f6' },
    gl:      { cc: 'es',  label: 'Galician',               color: '#f59e0b' },
    eu:      { cc: 'es',  label: 'Basque',                 color: '#ef4444' },
    ne:      { cc: 'np',  label: 'Nepali',                 color: '#ef4444' },
    si:      { cc: 'lk',  label: 'Sinhala',                color: '#f59e0b' },
    km:      { cc: 'kh',  label: 'Khmer',                  color: '#3b82f6' },
    my:      { cc: 'mm',  label: 'Burmese',                color: '#f59e0b' },
    lo:      { cc: 'la',  label: 'Lao',                    color: '#ef4444' },
    ta:      { cc: 'in',  label: 'Tamil',                  color: '#f97316' },
    te:      { cc: 'in',  label: 'Telugu',                 color: '#f97316' },
    ml:      { cc: 'in',  label: 'Malayalam',              color: '#f97316' },
    bn:      { cc: 'bd',  label: 'Bengali',                color: '#22c55e' },
    ur:      { cc: 'pk',  label: 'Urdu',                   color: '#22c55e' },
  }

// ── LangFlag: language name only ─────────────────────────────────────────────
function LangFlag({ lang, size }: { lang: string; size?: number }) {
  const info = LANG_MAP[lang]
  const fullLabel = info?.label ?? lang
  return (
    <span
      className="font-body text-text-muted/70 flex-shrink-0"
      style={{ fontSize: size ? `${size}px` : '11px' }}
    >
      {fullLabel}
    </span>
  )
}

// ─── Add to List Button ───────────────────────────────────────────────────────

function AddToListButton({ mangaId }: { mangaId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [lists, setLists] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function openDropdown() {
    if (!user) return
    setOpen(o => !o)
    if (!lists.length) {
      setLoading(true)
      try { const r = await axios.get('/api/lists/mine', { withCredentials: true }); setLists(r.data) }
      catch {} finally { setLoading(false) }
    }
  }

  async function toggleInList(list: any) {
    const inList = list.mangaIds.includes(mangaId)
    setAdding(list._id)
    try {
      if (inList) {
        const r = await axios.delete(`/api/lists/${list._id}/manga/${mangaId}`, { withCredentials: true })
        setLists(prev => prev.map(l => l._id === list._id ? r.data : l))
      } else {
        const r = await axios.post(`/api/lists/${list._id}/manga`, { mangaId }, { withCredentials: true })
        setLists(prev => prev.map(l => l._id === list._id ? r.data : l))
      }
    } catch {} finally { setAdding(null) }
  }

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button onClick={openDropdown}
        className="flex items-center gap-2 px-5 py-3 glass border border-white/10 rounded-xl text-sm font-body text-text-muted hover:border-white/20 hover:text-text transition-all">
        <List size={15} /> Add to List
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 bg-surface border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden min-w-[220px]">
          <div className="px-4 py-2.5 border-b border-white/5">
            <p className="text-xs font-body text-text-muted uppercase tracking-widest">Your Lists</p>
          </div>
          {loading ? (
            <div className="px-4 py-4 text-xs text-text-muted font-body text-center">Loading…</div>
          ) : lists.length === 0 ? (
            <div className="px-4 py-4 text-xs text-text-muted font-body text-center">
              No lists yet.<br/>
              <Link to="/profile" onClick={() => setOpen(false)} className="text-primary hover:underline">Create one in your profile</Link>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {lists.map(list => {
                const inList = list.mangaIds.includes(mangaId)
                return (
                  <button key={list._id} onClick={() => toggleInList(list)} disabled={adding === list._id}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/5 transition-all group">
                    <div className="flex items-center gap-2 min-w-0">
                      {!list.isPublic && <Lock size={9} className="text-text-muted flex-shrink-0"/>}
                      <span className="text-sm font-body text-text truncate">{list.name}</span>
                      <span className="text-[10px] text-text-muted font-body flex-shrink-0">{list.mangaIds.length}</span>
                    </div>
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${inList ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-white/40'}`}>
                      {inList && <Check size={10} className="text-white"/>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <div className="border-t border-white/5 px-4 py-2.5">
            <Link to="/profile" onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-xs text-text-muted hover:text-primary font-body transition-colors">
              <Plus size={12}/> Manage lists
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MangaDetail() {
  const { id } = useParams<{ id: string }>()
  const [manga, setManga] = useState<Manga | null>(null)
  const [apiChapters, setApiChapters] = useState<Chapter[]>([])
  const [manualChapters, setManualChapters] = useState<ManualChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'chapters' | 'info'>('chapters')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [hiddenApiIds, setHiddenApiIds] = useState<Set<string>>(new Set())
  const [deletedApiIds, setDeletedApiIds] = useState<Set<string>>(new Set())
  const [apiActionId, setApiActionId] = useState<string | null>(null)
  const [editUrlId, setEditUrlId] = useState<string | null>(null)
  const [editUrlValue, setEditUrlValue] = useState("")
  const [savingUrlId, setSavingUrlId] = useState<string | null>(null)
  const [saves, setSaves] = useState<number>(0)
  const [mdxViews, setMdxViews] = useState<number>(0)
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [ratingCount, setRatingCount] = useState(0)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [chapterFilter, setChapterFilter] = useState<'all' | 'api' | 'manual'>('all')
  const [continueChapterId, setContinueChapterId] = useState<string | null>(null)
  const [continueChapterNum, setContinueChapterNum] = useState<string | null>(null)
  const [selectedLang, setSelectedLang] = useState('en')
  const [chaptersLoading, setChaptersLoading] = useState(false)

  // ── FIX: get authLoading so we never show staff UI during auth resolution ──
  const { toggleFavorite, isFavorite, isAdmin, isStaff, user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      axios.get(`${MD}/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`),
      axios.get(`${MD}/all-chapters/${id}?lang=all`),
      axios.get(`/api/favorites/saves/${id}`).catch(() => ({ data: { saves: 0 } })),
      axios.post(`/api/mangadex/view/${id}`).catch(() => ({ data: { views: 0 } })),
      axios.get(`/api/social/reviews/${id}`).catch(() => ({ data: { reviews: [], avg: null, count: 0 } })),
    ]).then(([mangaRes, chaptersRes, savesRes, viewsRes, ratingsRes]) => {
      setManga(mangaRes.data.data)
      setApiChapters(chaptersRes.data.data ?? [])
      setSaves(savesRes.data.saves ?? 0)
      setMdxViews(viewsRes.data.views ?? 0)
      setAvgRating(ratingsRes.data.avg ?? null)
      setRatingCount(ratingsRes.data.count ?? ratingsRes.data.reviews?.length ?? 0)
    }).finally(() => setLoading(false))
  }, [id])

  // Filter by selected language (client-side — no re-fetch needed)
  useEffect(() => {
    setChaptersLoading(false)
  }, [selectedLang])

  useEffect(() => {
    if (!id) return
    axios.get(`/api/local-manga/manual-chapters/${id}`)
      .then((res) => setManualChapters(res.data))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!id || !isStaff) return
    axios.get(`/api/admin/mangadex/${id}/chapters`, { withCredentials: true })
      .then((res) => setManualChapters(res.data))
      .catch(() => {})
  }, [id, isStaff])

  useEffect(() => {
    if (!id || !isAdmin) return
    axios.get(`/api/admin/api-chapters/filtered/${id}`, { withCredentials: true })
      .then(res => {
        setHiddenApiIds(new Set(res.data.hidden || []))
        setDeletedApiIds(new Set(res.data.deleted || []))
      })
      .catch(() => {})
  }, [id, isAdmin])

  useEffect(() => {
    if (!id || !user) return
    axios.get(`/api/progress/${id}`, { withCredentials: true })
      .then(res => {
        const p = res.data
        if (p?.chapterId) {
          setContinueChapterId(p.chapterId)
          setContinueChapterNum(p.chapterNumber ?? null)
        }
      }).catch(() => {})
  }, [id, user])

  const handleDeleteManual = async (chapterId: string) => {
    if (!confirm('Delete this manual chapter?')) return
    setDeletingId(chapterId)
    try {
      await axios.delete(`/api/admin/mangadex/chapters/${chapterId}`, { withCredentials: true })
      setManualChapters((prev) => prev.filter((c) => c._id !== chapterId))
    } finally {
      setDeletingId(null)
    }
  }

  const handleHideApiChapter = async (ch: Chapter) => {
    setApiActionId(ch.id)
    try {
      await axios.post('/api/admin/api-chapters/hide', {
        mangaDexId: id, chapterId: ch.id,
        chapterNumber: ch.attributes?.chapter,
        chapterTitle: ch.attributes?.title,
        mangaTitle: manga?.attributes?.title?.en,
      }, { withCredentials: true })
      setHiddenApiIds(prev => new Set([...prev, ch.id]))
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to hide chapter')
    } finally { setApiActionId(null) }
  }

  const handleUnhideApiChapter = async (chapterId: string) => {
    setApiActionId(chapterId)
    try {
      await axios.delete(`/api/admin/api-chapters/hide/${chapterId}`, { withCredentials: true })
      setHiddenApiIds(prev => { const s = new Set(prev); s.delete(chapterId); return s })
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to unhide chapter')
    } finally { setApiActionId(null) }
  }

  const handleDeleteApiChapter = async (ch: Chapter) => {
    if (!confirm(`Permanently hide Ch.${ch.attributes?.chapter} from this site?`)) return
    setApiActionId(ch.id)
    try {
      await axios.post('/api/admin/api-chapters/delete', {
        mangaDexId: id, chapterId: ch.id,
        chapterNumber: ch.attributes?.chapter,
        chapterTitle: ch.attributes?.title,
        mangaTitle: manga?.attributes?.title?.en,
      }, { withCredentials: true })
      setDeletedApiIds(prev => new Set([...prev, ch.id]))
      setHiddenApiIds(prev => { const s = new Set(prev); s.delete(ch.id); return s })
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete chapter')
    } finally { setApiActionId(null) }
  }

  const handleSaveExternalUrl = async (chapterId: string, urlOverride?: string) => {
    const urlToSave = (urlOverride !== undefined ? urlOverride : editUrlValue).trim()
    setSavingUrlId(chapterId)
    try {
      const res = await axios.patch(`/api/admin/mangadex/chapters/${chapterId}`, { externalUrl: urlToSave }, { withCredentials: true })
      setManualChapters(prev => prev.map(c => c._id === chapterId ? { ...c, externalUrl: res.data.externalUrl } : c))
      setEditUrlId(null)
      setEditUrlValue('')
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save URL')
    } finally { setSavingUrlId(null) }
  }

  const handleBulkAction = async (action: 'publish' | 'draft' | 'delete') => {
    if (!bulkSelected.size) return
    if (action === 'delete' && !confirm(`Delete ${bulkSelected.size} chapter(s)?`)) return
    setBulkWorking(true)
    try {
      await axios.post('/api/admin/mangadex/bulk-action', { ids: Array.from(bulkSelected), action }, { withCredentials: true })
      if (action === 'delete') {
        setManualChapters(prev => prev.filter(c => !bulkSelected.has(c._id)))
      } else {
        setManualChapters(prev => prev.map(c => bulkSelected.has(c._id) ? { ...c, published: action === 'publish' } : c))
      }
      setBulkSelected(new Set())
      setBulkMode(false)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Bulk action failed.')
    } finally { setBulkWorking(false) }
  }

  const toggleBulkSelect = (id: string) => {
    const s = new Set(bulkSelected)
    s.has(id) ? s.delete(id) : s.add(id)
    setBulkSelected(s)
  }

  const allMergedChapters: MergedChapter[] = [
    ...apiChapters
      .filter(c => isAdmin || !deletedApiIds.has(c.id))
      .filter(c => isAdmin || !hiddenApiIds.has(c.id))
      .map((c): MergedChapter => ({ type: 'api', data: c })),
    ...manualChapters.map((c): MergedChapter => ({ type: 'manual', data: c })),
  ].sort((a, b) => {
    const numA = parseFloat(a.type === 'api' ? a.data.attributes.chapter || '0' : a.data.chapterNumber)
    const numB = parseFloat(b.type === 'api' ? b.data.attributes.chapter || '0' : b.data.chapterNumber)
    return numB - numA
  })

  const mergedChapters = chapterFilter === 'all'
    ? allMergedChapters
    : allMergedChapters.filter(c => c.type === chapterFilter)



  // Available languages from manga metadata
  const availableLangs: string[] = manga
    ? (manga.attributes.availableTranslatedLanguages ?? []).filter(Boolean)
    : ['en']


  if (loading) return (
    <div className="max-w-6xl mx-auto px-5 pt-28 pb-16 animate-pulse">
      <div className="flex gap-8">
        <div className="skeleton w-48 rounded-2xl flex-shrink-0" style={{ aspectRatio: '2/3' }} />
        <div className="flex-1 space-y-4 pt-4">
          <div className="skeleton h-8 rounded w-3/4" />
          <div className="skeleton h-4 rounded w-1/2" />
          <div className="skeleton h-24 rounded w-full" />
        </div>
      </div>
    </div>
  )

  if (!manga) return <div className="pt-28 text-center text-text-muted">Manga not found.</div>

  const title = getMangaTitle(manga)
  const desc = getMangaDescription(manga)
  const tags = manga.attributes.tags.map((t) => t.attributes.name.en)
  const tagIds = manga.attributes.tags.filter((t) => t.attributes.group === 'genre').map((t) => t.id)
  const cover = getCoverUrl(manga, 512)
  const fav = isFavorite(manga.id)
  const status = manga.attributes.status
  const authors = manga.relationships
    .filter((r) => r.type === 'author')
    .map((r) => (r.attributes as { name?: string })?.name)
    .filter(Boolean)

  return (
    <div>
      {showAddModal && id && (
        <AddChapterModal
          mangaDexId={id}
          existingChapters={manualChapters}
          onClose={() => setShowAddModal(false)}
          onAdded={(ch) => setManualChapters((prev) => [ch, ...prev])}
        />
      )}

      <div className="relative h-64 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${cover})`, filter: 'blur(60px) brightness(0.2)', transform: 'scale(1.2)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
      </div>

      <div className="max-w-6xl mx-auto px-5 -mt-32 relative z-10 pb-16">
        <div className="flex flex-col sm:flex-row gap-7">
          <div className="flex-shrink-0">
            <img src={cover} alt={title}
              className="w-36 sm:w-48 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
              style={{ aspectRatio: '2/3', objectFit: 'cover' }} />
          </div>

          <div className="flex-1 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: getStatusColor(status) }} />
              <span className="font-mono text-xs text-text-muted capitalize">{status}</span>
              {manga.attributes.year && <span className="font-mono text-xs text-text-muted">· {manga.attributes.year}</span>}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl text-white tracking-wide leading-tight mb-3">{title}</h1>
            {authors.length > 0 && <p className="font-body text-sm text-text-muted mb-3">by {authors.join(', ')}</p>}

            {avgRating !== null ? (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Star key={i} size={13} className={i < Math.round(avgRating) ? 'text-yellow-400' : 'text-white/15'} fill={i < Math.round(avgRating) ? 'currentColor' : 'none'} />
                  ))}
                </div>
                <span className="font-mono text-sm text-yellow-400 font-bold">{avgRating.toFixed(1)}</span>
                <span className="font-body text-xs text-text-muted">/ 10</span>
                <span className="font-body text-xs text-text-muted">({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => <Star key={i} size={13} className="text-white/10" fill="none" />)}
                </div>
                <span className="font-body text-xs text-text-muted">No ratings yet</span>
              </div>
            )}

            <p className="font-body text-sm text-text-muted leading-relaxed mb-4 max-w-2xl line-clamp-3 sm:line-clamp-none">{desc}</p>

            <div className="flex flex-wrap gap-2 mb-5">
              {tags.slice(0, 8).map((t) => (
                <Link key={t} to={`/browse?genre=${t}`} className="tag badge bg-white/5 border border-white/10 text-text-muted hover:text-primary">{t}</Link>
              ))}
            </div>

            <div className="flex gap-3 flex-wrap items-center">
              {continueChapterId ? (
                <>
                  <Link to={`/read/${continueChapterId}`}
                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-body font-medium rounded-xl transition-all hover:shadow-[0_0_20px_rgba(232,57,77,0.4)]">
                    <BookOpen size={15} />
                    Continue{continueChapterNum ? ` Ch. ${continueChapterNum}` : ''}
                  </Link>
                  {apiChapters[apiChapters.length - 1] && (
                    <Link to={`/read/${apiChapters[apiChapters.length - 1]?.id}`}
                      className="flex items-center gap-2 px-4 py-3 glass border border-white/10 rounded-xl text-sm font-body text-text-muted hover:text-text hover:border-white/20 transition-all">
                      <BookOpen size={14} /> Start Over
                    </Link>
                  )}
                </>
              ) : (
                apiChapters[0] && (
                  <Link to={`/read/${apiChapters[apiChapters.length - 1]?.id}`}
                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-body font-medium rounded-xl transition-all hover:shadow-[0_0_20px_rgba(232,57,77,0.4)]">
                    <BookOpen size={15} /> Start Reading
                  </Link>
                )
              )}

              <button onClick={async () => {
                if (!user) { window.location.href = '/login'; return }
                const wasFav = fav
                await toggleFavorite(manga.id)
                setSaves(s => wasFav ? Math.max(0, s - 1) : s + 1)
              }}
                className={`flex items-center gap-2 px-5 py-3 glass rounded-xl text-sm font-body transition-all ${fav ? 'border border-primary/50 text-primary' : 'border border-white/10 text-text-muted hover:border-white/20'}`}>
                <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
                {fav ? 'Saved' : 'Save'}
              </button>

              <ReadingListButton mangaId={manga.id} />
              <WatchButton mangaId={manga.id} />

              <Link to="/downloads"
                className="flex items-center gap-2 px-4 py-3 glass border border-white/10 rounded-xl text-sm font-body text-text-muted hover:text-violet-400 hover:border-violet-400/30 transition-all">
                <Download size={14} /> My Downloads
              </Link>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 mt-6 mb-8 flex-wrap">
          {[
            { icon: BookOpen, label: `${allMergedChapters.length} Chapters` },
            { icon: Calendar, label: manga.attributes.year?.toString() || 'Unknown year' },
            { icon: Eye, label: `${mdxViews.toLocaleString()} Views` },
            { icon: Heart, label: `${saves.toLocaleString()} Saves` },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 font-body text-xs text-text-muted">
              <Icon size={12} className="text-primary" />
              <span className="capitalize">{label}</span>
            </div>
          ))}
          {avgRating !== null && (
            <div className="flex items-center gap-1.5 font-body text-xs text-text-muted">
              <Star size={12} className="text-yellow-400" fill="currentColor" />
              <span>{avgRating.toFixed(1)} / 10 · {ratingCount} ratings</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-white/5 mb-6 gap-3 flex-wrap">
          <div className="flex gap-4">
            {(['chapters', 'info'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-3 font-body text-sm capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}>
                {t}
              </button>
            ))}
          </div>

          {isAdmin && tab === 'chapters' && (
            <div className="flex items-center gap-2 mb-3">
              {bulkMode ? (
                <>
                  <button onClick={() => { setBulkMode(false); setBulkSelected(new Set()) }}
                    className="px-3 py-1.5 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-colors">Cancel</button>
                  <span className="text-xs text-text-muted font-body">{bulkSelected.size} selected</span>
                  <button onClick={() => setBulkSelected(new Set(manualChapters.map(c => c._id)))}
                    className="px-3 py-1.5 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-colors">All</button>
                  <button onClick={() => handleBulkAction('publish')} disabled={!bulkSelected.size || bulkWorking}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-body rounded-xl hover:bg-green-500/30 transition-all disabled:opacity-40">
                    <Globe size={11} /> Publish
                  </button>
                  <button onClick={() => handleBulkAction('draft')} disabled={!bulkSelected.size || bulkWorking}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-body rounded-xl hover:bg-yellow-500/30 transition-all disabled:opacity-40">
                    <FileText size={11} /> Draft
                  </button>
                  <button onClick={() => handleBulkAction('delete')} disabled={!bulkSelected.size || bulkWorking}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-body rounded-xl hover:bg-red-500/30 transition-all disabled:opacity-40">
                    <Trash2 size={11} /> Delete
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setBulkMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-colors">
                    <CheckSquare size={11} /> Bulk Edit
                  </button>
                  <button onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-body rounded-xl hover:bg-amber-500/30 transition-all">
                    <Plus size={13} /> Add Chapter
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Chapter list */}
        {tab === 'chapters' && (
          <div>
            {/* ── FIX: only show filter pills when auth is resolved AND user is staff ── */}
            {!!user && !authLoading && isStaff && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {([
                  { key: 'all',    label: 'All',            count: allMergedChapters.length,                                                    color: 'white'  },
                  { key: 'api',    label: 'MangaDex API',   count: apiChapters.filter((c: any) => c._source !== 'comick').length,               color: 'blue'   },
                  { key: 'comick', label: 'ComicK',         count: apiChapters.filter((c: any) => c._source === 'comick').length,               color: 'green'  },
                  { key: 'manual', label: 'Manually Added', count: manualChapters.length,                                                        color: 'amber'  },
                ] as const).map(({ key, label, count, color }) => (
                  <button key={key}
                    onClick={() => setChapterFilter(key === 'comick' ? 'api' : key as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body border transition-all ${
                      (chapterFilter === key || (key === 'comick' && chapterFilter === 'api'))
                        ? color === 'blue'  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                          : color === 'green' ? 'bg-green-500/20 border-green-500/40 text-green-300'
                          : color === 'amber' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-white/10 border-white/20 text-white'
                        : 'glass border-white/8 text-text-muted hover:text-text hover:border-white/15'
                    }`}>
                    {color === 'blue'  && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-80" />}
                    {color === 'green' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 opacity-80" />}
                    {color === 'amber' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 opacity-80" />}
                    {label}
                    <span className="text-[10px] font-mono opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-0 max-h-[600px] overflow-y-auto pr-1">
              {chaptersLoading ? (
                <div className="flex flex-col items-center py-12 gap-3">
                  <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  <p className="text-text-muted font-body text-sm">Loading chapters…</p>
                </div>
              ) : mergedChapters.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2">
                  <p className="text-text-muted font-body text-sm text-center">No chapters available.</p>
                </div>
              ) : (() => {
                // ── Group by chapter number (MangaDex style) ──────────────────
                type GroupedChapter = { chapterNum: string; items: MergedChapter[] }
                const groups: GroupedChapter[] = []
                const seen = new Map<string, GroupedChapter>()

                for (const item of mergedChapters) {
                  const num = item.type === 'api'
                    ? (item.data.attributes.chapter ?? '?')
                    : item.data.chapterNumber
                  const key = String(num)
                  if (!seen.has(key)) {
                    const g: GroupedChapter = { chapterNum: key, items: [] }
                    seen.set(key, g)
                    groups.push(g)
                  }
                  seen.get(key)!.items.push(item)
                }

                return groups.map(({ chapterNum, items }) => (
                  <div key={chapterNum} className="border-b border-white/5 last:border-0">
                    {/* Chapter number header */}
                    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                      <span className="text-xs font-mono text-text-muted opacity-50">Ch.{chapterNum}</span>
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-[10px] font-mono text-text-muted opacity-30">{items.length} version{items.length > 1 ? 's' : ''}</span>
                    </div>

                    {/* Each language row */}
                    {items.map((item) => {
                      if (item.type === 'api') {
                        const ch = item.data
                        const isHidden  = hiddenApiIds.has(ch.id)
                        const isDeleted = deletedApiIds.has(ch.id)
                        const working   = apiActionId === ch.id
                        const lang      = ch.attributes.translatedLanguage
                        const date      = new Date(ch.attributes.publishAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        return (
                          <div key={ch.id} className={`flex items-center gap-1 group ${isDeleted ? 'opacity-30' : isHidden ? 'opacity-40' : ''}`}>
                            <Link to={`/read/${ch.id}`}
                              className="flex-1 flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] transition-colors rounded-lg">
                              {/* Flag + full language name — no abbreviations */}
                              <LangFlag lang={lang} size={13} />
                              {/* Title */}
                              <span className="font-body text-sm text-text/80 group-hover:text-primary transition-colors flex-1 truncate">
                                {ch.attributes.title || `Chapter ${chapterNum}`}
                              </span>
                              {!!user && isStaff && (
                                <span className={`text-[9px] font-mono flex-shrink-0 ${(ch as any)._source === 'comick' ? 'text-green-500/40' : 'text-blue-500/40'}`}>
                                  {(ch as any)._source === 'comick' ? 'CK' : 'MDX'}
                                </span>
                              )}
                              {isAdmin && isHidden  && <span className="text-[9px] font-mono text-amber-400/60 flex-shrink-0">HIDDEN</span>}
                              {isAdmin && isDeleted && <span className="text-[9px] font-mono text-red-400/60 flex-shrink-0">DELETED</span>}
                              <span className="text-[11px] font-mono text-text-muted/40 flex-shrink-0">{date}</span>
                              <BookOpen size={13} className="text-text-muted/30 group-hover:text-primary transition-colors flex-shrink-0" />
                            </Link>
                            <DownloadChapterButton
                              chapterId={ch.id} chapterNumber={ch.attributes.chapter || '?'}
                              chapterTitle={ch.attributes.title} source="api"
                              mangaId={manga.id} mangaTitle={title} mangaCover={cover}
                              resolvePages={resolveApiPages(ch.id)} compact
                            />
                            {isAdmin && !isDeleted && (
                              <button onClick={() => isHidden ? handleUnhideApiChapter(ch.id) : handleHideApiChapter(ch)}
                                disabled={working}
                                className={`p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${isHidden ? 'text-amber-400 hover:bg-amber-500/10' : 'text-text-muted hover:bg-white/10 hover:text-amber-400'}`}>
                                {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                            )}
                            {isAdmin && !isDeleted && (
                              <button onClick={() => handleDeleteApiChapter(ch)} disabled={working}
                                className="p-1.5 rounded-lg text-text-muted hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )
                      }

                      // Manual chapter row
                      const ch = item.data
                      return (
                        <div key={ch._id} className="flex items-center gap-1 group">
                          <div className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors border-l-2 border-amber-500/30 ml-3 ${bulkMode && bulkSelected.has(ch._id) ? 'bg-primary/5' : ''}`}>
                            {bulkMode && (
                              <button onClick={() => toggleBulkSelect(ch._id)} className="flex-shrink-0">
                                {bulkSelected.has(ch._id) ? <CheckSquare size={13} className="text-primary" /> : <Square size={13} className="text-text-muted" />}
                              </button>
                            )}
                            {/* Flag + full language name — no abbreviations */}
                            <LangFlag lang={ch.language ?? 'en'} size={13} />
                            {ch.externalUrl ? (
                              <a href={ch.externalUrl} target="_blank" rel="noopener noreferrer"
                                className="font-body text-sm text-text hover:text-primary transition-colors flex-1 truncate flex items-center gap-1.5">
                                {ch.title || `Ch.${ch.chapterNumber}`}
                                <Globe size={10} className="flex-shrink-0 text-orange-400" />
                              </a>
                            ) : ch.pages.length > 0 ? (
                              <Link to={`/read/manual/${ch._id}`}
                                className="font-body text-sm text-text hover:text-primary transition-colors flex-1 truncate">
                                {ch.title || `Ch.${ch.chapterNumber}`}
                              </Link>
                            ) : (
                              <span className="font-body text-sm text-text-muted flex-1 truncate">
                                {ch.title || `Ch.${ch.chapterNumber}`}
                              </span>
                            )}
                            {!!user && isStaff && <span className="px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[9px] font-mono rounded flex-shrink-0">MANUAL</span>}
                            {ch.externalUrl && <span className="px-1.5 py-0.5 bg-orange-500/15 border border-orange-500/25 text-orange-400 text-[9px] font-mono rounded flex-shrink-0">OFFICIAL</span>}
                            {!!user && isStaff && (
                              ch.published
                                ? <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/25 text-green-400 text-[9px] font-mono rounded flex-shrink-0">PUB</span>
                                : <span className="px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-[9px] font-mono rounded flex-shrink-0">DRAFT</span>
                            )}
                            <span className="text-[11px] font-mono text-text-muted flex-shrink-0">{new Date(ch.createdAt).toLocaleDateString()}</span>
                          </div>
                          {isAdmin && (
                            <>
                              <button onClick={() => { setEditUrlId(ch._id); setEditUrlValue(ch.externalUrl || '') }}
                                className="p-1.5 rounded-lg text-text-muted hover:bg-white/10 hover:text-text transition-colors opacity-0 group-hover:opacity-100">
                                <Link2 size={12} />
                              </button>
                              <button onClick={() => handleDeleteManual(ch._id)} disabled={!!deletingId}
                                className="p-1.5 rounded-lg text-text-muted hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}
                    <div className="h-1" />
                  </div>
                ))
              })()}

            </div>
          </div>
        )}

        {tab === 'info' && (
          <div className="glass rounded-2xl p-6">
            <p className="font-body text-sm text-text-muted leading-relaxed">{desc}</p>
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              {[
                ['Status', manga.attributes.status],
                ['Year', manga.attributes.year?.toString() || '-'],
                ['Content Rating', manga.attributes.contentRating],
                ['Languages', manga.attributes.availableTranslatedLanguages?.join(', ') || '-'],
                ['Last Chapter', manga.attributes.lastChapter || '-'],
                ['Last Volume', manga.attributes.lastVolume || '-'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-white/5">
                  <span className="font-mono text-xs text-text-muted">{k}</span>
                  <span className="font-body text-xs text-text capitalize">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <RecommendedManga mangadexId={manga.id} tags={tagIds} />
        <RatingReviews mangaId={manga.id} />
        <MangaComments mangaId={manga.id} />
      </div>
    </div>
  )
}