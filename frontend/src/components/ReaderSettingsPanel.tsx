import { X, AlignJustify, BookOpen, Maximize2, Minimize2, Square, Moon, Sun, Sunset, ArrowLeftRight, Columns2 } from 'lucide-react'
import type { ReaderSettings, LayoutMode, FitMode, BgColor } from '../hooks/useReaderSettings'

interface Props {
  settings: ReaderSettings
  update: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void
  onClose: () => void
}

function OptionBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-body transition-all border ${
        active
          ? 'bg-primary/20 border-primary/50 text-primary'
          : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20 hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

export default function ReaderSettingsPanel({ settings, update, onClose }: Props) {
  return (
    <div className="absolute top-14 right-4 z-50 w-72 glass border border-white/10 rounded-2xl p-4 shadow-2xl"
      onClick={e => e.stopPropagation()}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-body text-white font-medium">Reader Settings</p>
        <button onClick={onClose} className="p-1 text-text-muted hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Layout */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-text-muted font-body mb-2">Layout</p>
        <div className="flex gap-2">
          <OptionBtn active={settings.layout === 'single'} onClick={() => update('layout', 'single')}>
            <BookOpen size={16} />
            Single Page
          </OptionBtn>
          <OptionBtn active={settings.layout === 'webtoon'} onClick={() => update('layout', 'webtoon')}>
            <AlignJustify size={16} />
            Webtoon
          </OptionBtn>
          <OptionBtn active={settings.layout === 'double'} onClick={() => update('layout', 'double')}>
            <Columns2 size={16} />
            Double
          </OptionBtn>
        </div>
      </div>

      {/* Fit (only for single page) */}
      {settings.layout === 'single' && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-body mb-2">Fit</p>
          <div className="flex gap-2">
            <OptionBtn active={settings.fit === 'width'} onClick={() => update('fit', 'width')}>
              <Maximize2 size={16} />
              Width
            </OptionBtn>
            <OptionBtn active={settings.fit === 'height'} onClick={() => update('fit', 'height')}>
              <Minimize2 size={16} />
              Height
            </OptionBtn>
            <OptionBtn active={settings.fit === 'original'} onClick={() => update('fit', 'original')}>
              <Square size={16} />
              Original
            </OptionBtn>
          </div>
        </div>
      )}

      {/* Direction (only for single/double page) */}
      {(settings.layout === 'single' || settings.layout === 'double') && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-body mb-2">Direction</p>
          <div className="flex gap-2">
            <OptionBtn active={settings.direction === 'ltr'} onClick={() => update('direction', 'ltr')}>
              <ArrowLeftRight size={16} />
              Left → Right
            </OptionBtn>
            <OptionBtn active={settings.direction === 'rtl'} onClick={() => update('direction', 'rtl')}>
              <ArrowLeftRight size={16} className="scale-x-[-1]" />
              Right → Left
            </OptionBtn>
          </div>
        </div>
      )}

      {/* Background */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-text-muted font-body mb-2">Background</p>
        <div className="flex gap-2">
          <OptionBtn active={settings.bg === 'black'} onClick={() => update('bg', 'black')}>
            <Moon size={16} />
            Black
          </OptionBtn>
          <OptionBtn active={settings.bg === 'dark'} onClick={() => update('bg', 'dark')}>
            <Sunset size={16} />
            Dark
          </OptionBtn>
          <OptionBtn active={settings.bg === 'white'} onClick={() => update('bg', 'white')}>
            <Sun size={16} />
            White
          </OptionBtn>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <p className="text-[10px] text-text-muted font-body text-center">
          ← → Arrow keys or A / D to flip pages
        </p>
      </div>
    </div>
  )
}