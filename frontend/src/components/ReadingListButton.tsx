import { useState } from 'react'
import { BookOpen, CheckCircle, Clock, XCircle, PauseCircle, ChevronDown } from 'lucide-react'
import { useReadingList, type ReadingStatus } from '@/hooks/useReadingList'

const STATUS_CONFIG: Record<ReadingStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  reading:      { label: 'Reading',      icon: BookOpen,     color: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/40' },
  completed:    { label: 'Completed',    icon: CheckCircle,  color: 'text-blue-400',   bg: 'bg-blue-500/20 border-blue-500/40' },
  plan_to_read: { label: 'Plan to Read', icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/40' },
  on_hold:      { label: 'On Hold',      icon: PauseCircle,  color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/40' },
  dropped:      { label: 'Dropped',      icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/20 border-red-500/40' },
}

interface Props {
  mangaId: string
}

export default function ReadingListButton({ mangaId }: Props) {
  const { getStatus, setStatus, initialized } = useReadingList()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const status = getStatus(mangaId)
  const current = status ? STATUS_CONFIG[status] : null
  const CurrentIcon = current?.icon || BookOpen

  const handleSelect = async (key: ReadingStatus) => {
    setSaving(true)
    setOpen(false)
    await setStatus(mangaId, status === key ? null : key)
    setSaving(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving || !initialized}
        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-body border transition-all disabled:opacity-50 ${
          current
            ? `${current.bg} ${current.color}`
            : 'glass border-white/10 text-text-muted hover:border-primary/30 hover:text-text'
        }`}
      >
        <CurrentIcon size={15} />
        {!initialized ? 'Loading…' : current ? current.label : 'Add to List'}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-48 glass border border-white/10 rounded-2xl p-1.5 z-50 shadow-2xl">
            {(Object.entries(STATUS_CONFIG) as [ReadingStatus, typeof STATUS_CONFIG[ReadingStatus]][]).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body transition-all text-left ${
                    status === key
                      ? `${cfg.bg} ${cfg.color}`
                      : 'text-text-muted hover:text-text hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} />
                  {cfg.label}
                  {status === key && <span className="ml-auto text-[10px] opacity-60">✓ Remove</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}