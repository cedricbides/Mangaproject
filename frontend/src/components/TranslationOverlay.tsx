import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type { BoundingBox } from '../../../backend/src/routes/translate'

// ── Re-export the type locally so we don't depend on backend path ─────────────
export interface Box extends BoundingBox {}

interface Props {
  pageUrl: string
  targetLang: string
  enabled: boolean
}

export default function TranslationOverlay({ pageUrl, targetLang, enabled }: Props) {
  const [boxes, setBoxes] = useState<Box[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const prevKey = useRef('')

  useEffect(() => {
    if (!enabled || !pageUrl) { setBoxes([]); setStatus('idle'); return }
    const cacheKey = `${pageUrl}__${targetLang}`
    if (prevKey.current === cacheKey && status === 'done') return
    prevKey.current = cacheKey
    setStatus('loading')
    setBoxes([])

    // Convert relative URLs (e.g. /api/proxy/...) to absolute so the backend can fetch them
    const absoluteUrl = pageUrl.startsWith('http') ? pageUrl : `${window.location.origin}${pageUrl}`
    axios.post('/api/translate/page', { imageUrl: absoluteUrl, targetLang })
      .then(res => { setBoxes(res.data.boxes ?? []); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [pageUrl, targetLang, enabled])

  if (!enabled) return null

  return (
    // This div sits absolutely over the manga page image — parent must be position:relative
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* Loading shimmer */}
      {status === 'loading' && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 rounded-lg pointer-events-auto">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-[11px] text-white/70 font-mono">Translating…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute top-2 right-2 px-2.5 py-1 bg-red-900/80 rounded-lg text-[11px] text-red-300 font-mono">
          Translation failed
        </div>
      )}

      {/* Overlay boxes */}
      {boxes.map((box, i) => (
        <div
          key={i}
          className="absolute pointer-events-auto cursor-default"
          style={{
            left: `${box.x}%`,
            top: `${box.y}%`,
            width: `${box.w}%`,
            height: `${box.h}%`,
          }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* White cover box with translated text */}
          <div
            className="w-full h-full flex items-center justify-center overflow-hidden rounded-sm"
            style={{
              background: 'rgba(255,255,255,0.93)',
              border: '1px solid rgba(37,99,235,0.3)',
            }}
          >
            <span
              style={{
                fontSize: `clamp(7px, ${Math.max(box.h * 0.28, 1.2)}vw, 13px)`,
                lineHeight: 1.25,
                color: '#1e1e1e',
                fontFamily: 'var(--font-sans, sans-serif)',
                fontWeight: 500,
                textAlign: 'center',
                padding: '1px 2px',
                wordBreak: 'break-word',
                display: 'block',
              }}
            >
              {box.translated}
            </span>
          </div>

          {/* Hover: show original text */}
          {hoveredIdx === i && (
            <div
              className="absolute z-50 bottom-full left-0 mb-1 px-2 py-1 rounded text-[11px] font-mono whitespace-nowrap"
              style={{ background: 'rgba(0,0,0,0.85)', color: '#ddd', maxWidth: 200, whiteSpace: 'normal' }}
            >
              <span className="text-white/40 text-[9px] block mb-0.5">Original</span>
              {box.original}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}