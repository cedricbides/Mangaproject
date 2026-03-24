import { useState, useCallback } from 'react'

export type LayoutMode = 'webtoon' | 'single' | 'double'
export type FitMode = 'width' | 'height' | 'original'
export type BgColor = 'black' | 'dark' | 'white'
export type Direction = 'ltr' | 'rtl'

export interface ReaderSettings {
  layout: LayoutMode
  fit: FitMode
  bg: BgColor
  direction: Direction
}

const DEFAULTS: ReaderSettings = {
  layout: 'single',
  fit: 'width',
  bg: 'black',
  direction: 'ltr',
}

const STORAGE_KEY = 'mv_reader_settings'

// ─── Settings ────────────────────────────────────────────────────────────────

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })

  const update = useCallback(<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, update }
}

// ─── BG color map ─────────────────────────────────────────────────────────────

export const BG_CLASSES: Record<BgColor, string> = {
  black: 'bg-black',
  dark:  'bg-[#1a1a2e]',
  white: 'bg-gray-100',
}

export const BG_HEX: Record<BgColor, string> = {
  black: '#000000',
  dark:  '#1a1a2e',
  white: '#f3f4f6',
}