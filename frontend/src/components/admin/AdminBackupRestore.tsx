import { useState } from 'react'
import { Download, Upload, AlertTriangle, Check, Database, RefreshCw, X } from 'lucide-react'

type Collection = 'localManga' | 'localChapters' | 'trackedMangaDex' | 'mdxChapters' | 'siteSettings'

const COLLECTIONS: { key: Collection; label: string; description: string }[] = [
  { key: 'localManga',      label: 'Local Manga',          description: 'All locally published manga' },
  { key: 'localChapters',   label: 'Local Chapters',       description: 'All chapters for local manga' },
  { key: 'trackedMangaDex', label: 'Tracked MangaDex',     description: 'Tracked MangaDex manga list' },
  { key: 'mdxChapters',     label: 'MangaDex Chapters',    description: 'Manually uploaded MDX chapters' },
  { key: 'siteSettings',    label: 'Site Settings',        description: 'All site configuration' },
]

export default function AdminBackupRestore() {
  const [selectedCollections, setSelectedCollections] = useState<Set<Collection>>(new Set(COLLECTIONS.map(c => c.key)))
  const [downloading, setDownloading] = useState(false)
  const [downloadDone, setDownloadDone] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<any>(null)

  function toggleCollection(key: Collection) {
    setSelectedCollections(prev => {
      const s = new Set(prev)
      s.has(key) ? s.delete(key) : s.add(key)
      return s
    })
  }

  async function downloadBackup() {
    setDownloading(true)
    try {
      const cols = [...selectedCollections].join(',')
      const res = await fetch(`/api/admin/backup/export?collections=${cols}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Backup failed')
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="(.+)"/)
      const filename = match?.[1] || 'mangaverse-backup.json'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      setDownloadDone(true)
      setTimeout(() => setDownloadDone(false), 3000)
    } catch (e: any) { alert(e.message) }
    setDownloading(false)
  }

  async function previewRestore(file: File) {
    setRestoreFile(file)
    setLoadingPreview(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch('/api/admin/backup/restore/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPreview({ data, summary: json })
    } catch (e: any) { alert(`Invalid backup file: ${e.message}`); setRestoreFile(null) }
    setLoadingPreview(false)
  }

  async function doRestore() {
    if (!preview) return
    setRestoring(true)
    try {
      const cols = [...selectedCollections]
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: preview.data, collections: cols }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRestoreResult(json.results)
      setConfirmRestore(false)
      setPreview(null)
      setRestoreFile(null)
    } catch (e: any) { alert(e.message) }
    setRestoring(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database size={18} className="text-primary" />
        <h3 className="font-heading text-lg text-text">Backup & Restore</h3>
      </div>

      {/* Backup section */}
      <div className="glass rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-body text-text flex items-center gap-2"><Download size={14} className="text-blue-400" /> Export Backup</h4>
        <p className="text-xs text-text-muted">Select which collections to include in the backup file.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COLLECTIONS.map(col => (
            <label key={col.key} className={`flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${selectedCollections.has(col.key) ? 'bg-primary/10 border border-primary/20' : 'glass border border-transparent'}`}>
              <input type="checkbox" checked={selectedCollections.has(col.key)}
                onChange={() => toggleCollection(col.key)}
                className="mt-0.5 accent-primary" />
              <div>
                <div className="text-sm text-text">{col.label}</div>
                <div className="text-xs text-text-muted">{col.description}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={downloadBackup} disabled={downloading || selectedCollections.size === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 ${downloadDone ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}>
            {downloadDone ? <Check size={14} /> : downloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {downloadDone ? 'Downloaded!' : downloading ? 'Exporting…' : 'Download Backup'}
          </button>
          <span className="text-xs text-text-muted">{selectedCollections.size} collection{selectedCollections.size !== 1 ? 's' : ''} selected</span>
        </div>
      </div>

      {/* Restore section */}
      <div className="glass rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-body text-text flex items-center gap-2">
          <Upload size={14} className="text-orange-400" /> Restore Backup
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400">DESTRUCTIVE</span>
        </h4>
        <p className="text-xs text-text-muted">Restoring will <strong className="text-red-400">delete existing data</strong> in selected collections and replace it with backup data.</p>

        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${restoreFile ? 'border-primary/40 bg-primary/5' : 'border-white/10 hover:border-white/20'}`}>
          <input type="file" accept=".json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) previewRestore(f) }} />
          <Upload size={16} className={restoreFile ? 'text-primary' : 'text-text-muted'} />
          <div className="flex-1 min-w-0">
            {loadingPreview
              ? <span className="text-sm text-text-muted">Validating…</span>
              : restoreFile
                ? <span className="text-sm text-text truncate">{restoreFile.name}</span>
                : <span className="text-sm text-text-muted">Choose backup .json file</span>
            }
          </div>
          {restoreFile && <button onClick={e => { e.preventDefault(); setRestoreFile(null); setPreview(null) }} className="p-1 text-text-muted hover:text-text"><X size={14} /></button>}
        </label>

        {/* Preview */}
        {preview && (
          <div className="bg-black/20 rounded-xl p-3 space-y-2">
            <div className="text-xs text-text-muted flex items-center gap-2">
              <Check size={11} className="text-green-400" /> Valid backup — exported {new Date(preview.summary.exportedAt).toLocaleString()}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(preview.summary.collections).map(([col, count]) => (
                <div key={col} className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-sm font-heading text-primary">{count as number}</div>
                  <div className="text-[10px] text-text-muted">{col}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setConfirmRestore(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-xl text-sm hover:bg-orange-500/30 transition-colors">
              <Upload size={14} /> Restore Selected Collections
            </button>
          </div>
        )}

        {/* Restore result */}
        {restoreResult && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 space-y-1">
            <div className="text-sm text-green-400 flex items-center gap-2"><Check size={14} /> Restore Complete</div>
            {Object.entries(restoreResult).map(([col, r]: any) => (
              <div key={col} className="text-xs text-text-muted flex gap-3">
                <span className="font-mono">{col}:</span>
                <span>{r.deleted} deleted → {r.inserted} restored</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-heading text-text">Confirm Restore</h4>
                <p className="text-sm text-text-muted mt-1">This will <strong className="text-red-400">permanently delete</strong> existing data in the selected collections and replace it with the backup. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={doRestore} disabled={restoring}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 disabled:opacity-50 transition-colors">
                {restoring ? 'Restoring…' : 'Yes, Restore'}
              </button>
              <button onClick={() => setConfirmRestore(false)}
                className="flex-1 py-2 glass text-text-muted rounded-xl text-sm hover:text-text transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}