import { Router, Request, Response } from 'express'
import axios from 'axios'

const router = Router()

// ── In-memory cache: imageUrl → overlay data (avoid re-processing same page) ──
const cache = new Map<string, TranslatedPage>()

export interface BoundingBox {
  x: number       // % of image width  (0–100)
  y: number       // % of image height (0–100)
  w: number
  h: number
  original: string
  translated: string
}

export interface TranslatedPage {
  boxes: BoundingBox[]
}

// ── Helper: resolve proxy URLs to real CDN URLs ──────────────────────────────
// Page URLs in this project are /api/proxy/image?url=<encoded_CDN_url>
// We extract the real URL so Vision API can fetch it directly.
function resolveImageUrl(url: string): string {
  try {
    // Handle absolute proxy URLs: http://localhost:3000/api/proxy/image?url=...
    const parsed = new URL(url)
    const inner = parsed.searchParams.get('url')
    if (inner) return decodeURIComponent(inner)
  } catch {}
  // Handle relative proxy URLs: /api/proxy/image?url=...
  if (url.includes('/api/proxy/image')) {
    const match = url.match(/[?&]url=([^&]+)/)
    if (match) return decodeURIComponent(match[1])
  }
  return url
}

// ── Helper: fetch image as base64 ────────────────────────────────────────────
async function fetchBase64(url: string): Promise<string> {
  const realUrl = resolveImageUrl(url)
  const res = await axios.get(realUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: { 'User-Agent': 'MangaVerse/1.0' }
  })
  return Buffer.from(res.data).toString('base64')
}

// ── Helper: Google Cloud Vision text detection ───────────────────────────────
async function detectText(base64: string, apiKey: string): Promise<RawAnnotation[]> {
  const body = {
    requests: [{
      image: { content: base64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    }],
  }
  const res = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    body,
    { timeout: 20000 }
  )
  const annotations = res.data?.responses?.[0]?.fullTextAnnotation?.pages?.[0]?.blocks ?? []
  return annotations
}

interface RawAnnotation {
  boundingBox: { vertices: { x?: number; y?: number }[] }
  paragraphs: {
    words: {
      symbols: { text: string }[]
      boundingBox: { vertices: { x?: number; y?: number }[] }
    }[]
  }[]
}

// ── Helper: translate text via unofficial Google Translate API ───────────────
// Uses the free client=gtx endpoint — no API key needed, supports auto-detect.
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return ''

  try {
    const encoded = encodeURIComponent(text.slice(0, 500))
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encoded}`
    const res = await axios.get(url, { timeout: 10000 })
    // Response is a nested array: [[[translated, original, ...]]]
    const data = res.data
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0]
        .map((chunk: any[]) => chunk[0])
        .filter(Boolean)
        .join('')
      if (translated) return translated
    }
  } catch {}

  return text // Return original if translation fails
}

// ── POST /api/translate/page ─────────────────────────────────────────────────
router.post('/page', async (req: Request, res: Response) => {
  const { imageUrl, targetLang = 'en' } = req.body as {
    imageUrl?: string
    targetLang?: string
  }

  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl is required' })
  }

  const cacheKey = `${imageUrl}__${targetLang}`
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey))
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'Translation not configured (missing GOOGLE_VISION_API_KEY)' })
  }

  try {
    const base64 = await fetchBase64(imageUrl)
    console.log('[translate] resolved url:', resolveImageUrl(imageUrl).slice(0, 80))

    // We need image dimensions to convert px coords → percentages
    // Vision API returns pixel coords; we read width/height from the response
    const visionBody = {
      requests: [{
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      }],
    }
    const visionRes = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      visionBody,
      { timeout: 20000 }
    )

    const response = visionRes.data?.responses?.[0]
    const imgW: number = response?.fullTextAnnotation?.pages?.[0]?.width ?? 800
    const imgH: number = response?.fullTextAnnotation?.pages?.[0]?.height ?? 1200
    const blocks: RawAnnotation[] = response?.fullTextAnnotation?.pages?.[0]?.blocks ?? []

    if (blocks.length === 0) {
      const empty: TranslatedPage = { boxes: [] }
      cache.set(cacheKey, empty)
      return res.json(empty)
    }

    // Build text segments per block and translate in parallel (max 8 at a time)
    const segments = blocks.map(block => {
      const verts = block.boundingBox?.vertices ?? []
      const xs = verts.map(v => v.x ?? 0)
      const ys = verts.map(v => v.y ?? 0)
      const x1 = Math.min(...xs), y1 = Math.min(...ys)
      const x2 = Math.max(...xs), y2 = Math.max(...ys)

      const text = block.paragraphs
        .flatMap(p => p.words)
        .map(w => w.symbols.map(s => s.text).join(''))
        .join(' ')

      return { x1, y1, x2, y2, text }
    }).filter(s => s.text.trim().length > 0)

    // Translate all blocks concurrently (batch to avoid rate limits)
    const BATCH = 8
    const boxes: BoundingBox[] = []
    for (let i = 0; i < segments.length; i += BATCH) {
      const batch = segments.slice(i, i + BATCH)
      const translations = await Promise.all(
        batch.map(s => translateText(s.text, targetLang))
      )
      batch.forEach((s, idx) => {
        boxes.push({
          x: (s.x1 / imgW) * 100,
          y: (s.y1 / imgH) * 100,
          w: ((s.x2 - s.x1) / imgW) * 100,
          h: ((s.y2 - s.y1) / imgH) * 100,
          original: s.text,
          translated: translations[idx],
        })
      })
    }

    const result: TranslatedPage = { boxes }
    cache.set(cacheKey, result)

    // Limit cache size to 200 entries
    if (cache.size > 200) {
      const firstKey = cache.keys().next().value
      if (firstKey) cache.delete(firstKey)
    }

    return res.json(result)
  } catch (err: any) {
    console.error('[translate] error:', err.message)
    return res.status(500).json({ error: 'Translation failed', detail: err.message })
  }
})

export default router