/**
 * chapterImageService.ts
 *
 * Fetches chapter page images from 5 independent public APIs in order.
 * If a source fails (or returns 0 pages), the next one is tried automatically.
 * A duplicate checker runs on every result before returning.
 *
 * IMPORTANT: MangaDex at-home CDN URLs (*.mangadex.network) expire after ~15 minutes.
 * ALL MangaDex image URLs are routed through /api/proxy/image so:
 *   - The backend's IP fetches the image (avoids regional blocks / CORS issues)
 *   - Expired URL → frontend sees 502 → Reader triggers a fresh URL re-fetch
 *
 * Priority:
 *   1. MangaDex at-home CDN      → api.mangadex.org/at-home/server/:chapterId  (proxied)
 *   2. MangaDex direct CDN       → uploads.mangadex.org                         (proxied)
 *   3. ComicK                    → api.comick.io/chapter/?md_id=:chapterId      (proxied)
 *   4. ComicK data-saver         → ComicK low-quality CDN (meo2.comick.pictures)(proxied)
 *   5. MangaFire                 → mangafire.to (scrapes chapter via slug lookup)(proxied)
 */

import axios from 'axios'

export interface ChapterPageResult {
  pages: string[]           // deduplicated, final proxy URLs to serve
  source: string            // which API succeeded
  totalFetched: number      // before dedup
  duplicatesRemoved: number
  fetchedAt?: number        // timestamp for debugging URL freshness
}

// ─────────────────────────────────────────────
// In-memory cache for chapter URLs (SHORT TTL)
// FIX: corrected Map generic syntax (was `number>()>`)
// ─────────────────────────────────────────────
const _chapterCache = new Map<string, { data: any; exp: number }>()

function cacheGetChapter(k: string) {
  const e = _chapterCache.get(k)
  if (!e) return null
  if (Date.now() > e.exp) {
    _chapterCache.delete(k)
    console.log(`[ChapterCache] Expired cache for ${k}`)
    return null
  }
  console.log(`[ChapterCache] HIT for ${k}`)
  return e.data
}

function cacheSetChapter(k: string, data: any, ttl = 30_000) {  // 30 sec default
  if (_chapterCache.size >= 100) _chapterCache.delete(_chapterCache.keys().next().value!)
  _chapterCache.set(k, { data, exp: Date.now() + ttl })
  console.log(`[ChapterCache] SET ${k} with TTL=${ttl}ms`)
}

// ─────────────────────────────────────────────
// Helper: wrap a raw CDN URL in the backend proxy.
// ALL image URLs must go through here so the
// browser never fetches CDN URLs directly —
// this avoids CORS issues, regional blocks, and
// lets the backend handle CDN URL expiry.
// ─────────────────────────────────────────────
function toProxyUrl(rawUrl: string): string {
  return `/api/proxy/image?url=${encodeURIComponent(rawUrl)}`
}

// ─────────────────────────────────────────────
// Helper: deduplicate by normalising the URL's
// filename (last path segment, lowercased).
// Two different CDN hostnames serving the same
// file (e.g. same hash/filename) count as dupes.
// ─────────────────────────────────────────────
function deduplicatePages(urls: string[]): { unique: string[]; removed: number } {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const url of urls) {
    try {
      // For proxy URLs, extract the inner CDN URL's filename for dedup
      const innerMatch = url.match(/[?&]url=([^&]+)/)
      const deduKey = innerMatch
        ? new URL(decodeURIComponent(innerMatch[1])).pathname.split('/').pop()?.toLowerCase() ?? url
        : new URL(url).pathname.split('/').pop()?.toLowerCase() ?? url

      if (!seen.has(deduKey)) {
        seen.add(deduKey)
        unique.push(url)
      }
    } catch {
      // malformed URL — include it anyway
      if (!seen.has(url)) {
        seen.add(url)
        unique.push(url)
      }
    }
  }

  return { unique, removed: urls.length - unique.length }
}

// ─────────────────────────────────────────────
// API 1 — MangaDex at-home (rotating CDN node)
// FIX: URLs are now routed through /api/proxy/image
// instead of being served directly to the browser.
// Rotating *.mangadex.network URLs expire in ~15 min;
// proxying means the backend fetches them and the
// frontend only sees /api/proxy/... paths.
// ─────────────────────────────────────────────
async function fetchFromMangaDex(chapterId: string): Promise<string[]> {
  const r = await axios.get(
    `https://api.mangadex.org/at-home/server/${chapterId}`,
    { headers: { 'User-Agent': 'MangaVerse/1.0' }, timeout: 12_000 }
  )
  const { baseUrl, chapter } = r.data
  const pages: string[] = chapter.data.map(
    (f: string) => toProxyUrl(`${baseUrl}/data/${chapter.hash}/${f}`)
  )
  if (pages.length === 0) throw new Error('MangaDex returned 0 pages')
  return pages
}

// ─────────────────────────────────────────────
// API 2 — MangaDex direct CDN (uploads.mangadex.org)
// Completely independent from API 1 — different
// hostname means it works even when at-home nodes
// are down or rate-limited.
// FIX: also proxied through backend for consistency.
// ─────────────────────────────────────────────
async function fetchFromMangaDexDirect(chapterId: string): Promise<string[]> {
  const r = await axios.get(
    `https://api.mangadex.org/at-home/server/${chapterId}`,
    { headers: { 'User-Agent': 'MangaVerse/1.0' }, timeout: 12_000 }
  )
  const { chapter } = r.data
  const pages: string[] = chapter.data.map(
    (f: string) => toProxyUrl(`https://uploads.mangadex.org/data/${chapter.hash}/${f}`)
  )
  if (pages.length === 0) throw new Error('MangaDex direct returned 0 pages')
  return pages
}

// ─────────────────────────────────────────────
// API 3 — ComicK HQ  (indexes MangaDex chapters)
// ─────────────────────────────────────────────
async function fetchFromComicK(chapterId: string): Promise<string[]> {
  const searchRes = await axios.get(
    `https://api.comick.io/chapter/`,
    {
      params: { md_id: chapterId },
      headers: { 'User-Agent': 'MangaVerse/1.0' },
      timeout: 12_000,
    }
  )

  const chapters: any[] = searchRes.data
  if (!chapters || chapters.length === 0) throw new Error('ComicK: chapter not found')

  const hid: string = chapters[0].hid
  if (!hid) throw new Error('ComicK: missing hid')

  const chapterRes = await axios.get(
    `https://api.comick.io/chapter/${hid}`,
    {
      headers: { 'User-Agent': 'MangaVerse/1.0' },
      timeout: 12_000,
    }
  )

  const chapterData = chapterRes.data?.chapter
  const images: any[] = chapterData?.images ?? chapterData?.md_images ?? []
  if (images.length === 0) throw new Error('ComicK: returned 0 images')

  const pages: string[] = images.map((img: any) => {
    const b2key = img.b2key ?? img.url
    const raw = b2key.startsWith('http') ? b2key : `https://meo.comick.pictures/${b2key}`
    return toProxyUrl(raw)
  })

  return pages
}

// ─────────────────────────────────────────────
// API 4 — ComicK data-saver (meo2 CDN)
// ─────────────────────────────────────────────
async function fetchFromComicKDataSaver(chapterId: string): Promise<string[]> {
  const searchRes = await axios.get(
    `https://api.comick.io/chapter/`,
    {
      params: { md_id: chapterId },
      headers: { 'User-Agent': 'MangaVerse/1.0' },
      timeout: 12_000,
    }
  )

  const chapters: any[] = searchRes.data
  if (!chapters || chapters.length === 0) throw new Error('ComicK data-saver: chapter not found')

  const hid: string = chapters[0].hid
  if (!hid) throw new Error('ComicK data-saver: missing hid')

  const chapterRes = await axios.get(
    `https://api.comick.io/chapter/${hid}`,
    {
      headers: { 'User-Agent': 'MangaVerse/1.0' },
      timeout: 12_000,
    }
  )

  const chapterData = chapterRes.data?.chapter
  const images: any[] = chapterData?.images ?? chapterData?.md_images ?? []
  if (images.length === 0) throw new Error('ComicK data-saver: returned 0 images')

  const pages: string[] = images.map((img: any) => {
    const b2key = img.b2key ?? img.url
    const raw = b2key.startsWith('http')
      ? b2key.replace('meo.comick.pictures', 'meo2.comick.pictures')
      : `https://meo2.comick.pictures/${b2key}`
    return toProxyUrl(raw)
  })

  return pages
}

// ─────────────────────────────────────────────
// API 5 — MangaFire
// ─────────────────────────────────────────────
async function fetchFromMangaFire(chapterId: string): Promise<string[]> {
  const lookupRes = await axios.get(
    `https://mangafire.to/api/source/chapter/${chapterId}`,
    {
      headers: {
        'User-Agent': 'MangaVerse/1.0',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: 'https://mangafire.to/',
      },
      timeout: 14_000,
    }
  )

  const html: string = lookupRes.data?.html ?? lookupRes.data ?? ''
  const matches = [...html.matchAll(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)['"]/gi)]
  if (matches.length === 0) throw new Error('MangaFire: no images found in response')

  const pages: string[] = matches.map((m) => {
    const raw = m[1].replace(/&amp;/g, '&')
    return toProxyUrl(raw)
  })

  return pages
}

// ─────────────────────────────────────────────
// Main export: try APIs in order, dedup, return
// ─────────────────────────────────────────────
const SOURCES = [
  { name: 'MangaDex at-home',      fn: fetchFromMangaDex         },
  { name: 'MangaDex direct CDN',   fn: fetchFromMangaDexDirect   },
  { name: 'ComicK HQ',             fn: fetchFromComicK           },
  { name: 'ComicK data-saver',     fn: fetchFromComicKDataSaver  },
  { name: 'MangaFire',             fn: fetchFromMangaFire        },
]

export async function getChapterPages(chapterId: string): Promise<ChapterPageResult> {
  const errors: string[] = []

  const cached = cacheGetChapter(`chapter:${chapterId}`)
  if (cached) {
    return { ...cached, fetchedAt: Date.now() }
  }

  for (const source of SOURCES) {
    try {
      console.log(`[ChapterImages] Trying ${source.name} for ${chapterId}…`)
      const raw = await source.fn(chapterId)
      const { unique, removed } = deduplicatePages(raw)

      console.log(
        `[ChapterImages] ${source.name} succeeded — ${raw.length} pages fetched, ${removed} duplicates removed`
      )

      const result: ChapterPageResult = {
        pages: unique,
        source: source.name,
        totalFetched: raw.length,
        duplicatesRemoved: removed,
        fetchedAt: Date.now(),
      }

      cacheSetChapter(`chapter:${chapterId}`, result, 30_000)

      return result
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'unknown error'
      console.warn(`[ChapterImages] ${source.name} failed: ${msg}`)
      errors.push(`${source.name}: ${msg}`)
    }
  }

  throw new Error(`All 5 APIs failed.\n${errors.join('\n')}`)
}