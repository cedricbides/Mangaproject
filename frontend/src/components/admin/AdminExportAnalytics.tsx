import { useState } from 'react'
import { Download, FileText, Users, BookOpen, MessageSquare, Star, Check } from 'lucide-react'

type ExportType = 'manga' | 'users' | 'chapters' | 'comments' | 'reviews'

interface ExportOption {
  key: ExportType
  label: string
  description: string
  icon: typeof FileText
  color: string
}

const OPTIONS: ExportOption[] = [
  { key: 'manga',    label: 'Manga List',  description: 'All manga with views, saves, genres, status', icon: BookOpen,      color: 'text-blue-400'   },
  { key: 'users',    label: 'Users',       description: 'User accounts, roles, ban status',             icon: Users,         color: 'text-green-400'  },
  { key: 'chapters', label: 'Chapters',    description: 'All chapters with view counts, schedule info', icon: FileText,      color: 'text-purple-400' },
  { key: 'comments', label: 'Comments',    description: 'Last 10k comments with flag status',           icon: MessageSquare, color: 'text-yellow-400' },
  { key: 'reviews',  label: 'Reviews',     description: 'Last 10k reviews with ratings',                icon: Star,          color: 'text-orange-400' },
]

export default function AdminExportAnalytics() {
  const [downloading, setDownloading] = useState<ExportType | null>(null)
  const [downloaded, setDownloaded] = useState<ExportType | null>(null)

  async function download(type: ExportType) {
    setDownloading(type)
    try {
      const response = await fetch(`/api/admin/export/${type}`, { credentials: 'include' })
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = response.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="(.+)"/)
      a.href = url
      a.download = filenameMatch?.[1] || `${type}-export.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setDownloaded(type)
      setTimeout(() => setDownloaded(null), 3000)
    } catch (e: any) {
      alert(`Export failed: ${e.message}`)
    }
    setDownloading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-heading text-lg text-text">Export Data to CSV</h3>
      </div>
      <p className="text-sm text-text-muted">Download your data as CSV files for analysis in Excel, Google Sheets, or any data tool.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map(opt => {
          const Icon = opt.icon
          const isLoading = downloading === opt.key
          const isDone = downloaded === opt.key
          return (
            <div key={opt.key} className="glass rounded-xl p-4 flex items-start gap-3">
              <Icon size={18} className={`${opt.color} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-body text-text">{opt.label}</div>
                <div className="text-xs text-text-muted mt-0.5">{opt.description}</div>
              </div>
              <button onClick={() => download(opt.key)} disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs flex-shrink-0 transition-colors disabled:opacity-60 ${isDone ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}>
                {isDone ? <Check size={12} /> : isLoading ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <Download size={12} />}
                {isDone ? 'Done' : isLoading ? 'Exporting…' : 'Export'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}