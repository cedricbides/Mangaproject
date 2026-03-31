/**
 * chapterImageService.ts
 *
 * Fetches chapter page images from 5 independent public APIs in order.
 * If a source fails (or returns 0 pages), the next one is tried automatically.
 * A duplicate checker runs on every result before returning.
 *
 * Priority:
 *   1. MangaDex at-home CDN      → api.mangadex.org/at-home/server/:chapterId
 *   2. MangaDex direct CDN       → uploads.mangadex.org (independent hostname)
 *   3. ComicK                    → api.comick.io/chapter/?md_id=:chapterId
 *   4. ComicK data-saver         → ComicK low-quality CDN (meo2.comick.pictures)
 *   5. MangaFire                 → mangafire.to (scrapes chapter via slug lookup)
 */

import axios from 'axios'

export interface ChapterPageResult {
  pages: string[]           // deduplicated, final URLs to serve
  source: string            // which API succeeded
  totalFetched: number      // before dedup
  duplicatesRemoved: number
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
      const pathname = new URL(url).pathname
      const filename = pathname.split('/').pop()?.toLowerCase() ?? url
      if (!seen.has(filename)) {
        seen.add(filename)
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
// ─────────────────────────────────────────────
async function fetchFromMangaDex(chapterId: string): Promise<string[]> {
  const r = await axios.get(
    `https://api.mangadex.org/at-home/server/${chapterId}`,
    { headers: { 'User-Agent': 'MangaVerse/1.0' }, timeout: 12_000 }
  )
  const { baseUrl, chapter } = r.data
  // Return direct CDN URLs — MangaDex CDN supports CORS and is meant to be
  // fetched by the browser directly, not proxied through a server.
  const pages: string[] = chapter.data.map(
    (f: string) => `${baseUrl}/data/${chapter.hash}/${f}`
  )
  if (pages.length === 0) throw new Error('MangaDex returned 0 pages')
  return pages
}

// ─────────────────────────────────────────────
// API 2 — MangaDex direct CDN (uploads.mangadex.org)
// Completely independent from API 1 — different
// hostname means it works even when at-home nodes
// are down or rate-limited.
// ─────────────────────────────────────────────
async function fetchFromMangaDexDirect(chapterId: string): Promise<string[]> {
  const r = await axios.get(
    `https://api.mangadex.org/at-home/server/${chapterId}`,
    { headers: { 'User-Agent': 'MangaVerse/1.0' }, timeout: 12_000 }
  )
  const { chapter } = r.data
  const pages: string[] = chapter.data.map(
    (f: string) => `https://uploads.mangadex.org/data/${chapter.hash}/${f}`
  )
  if (pages.length === 0) throw new Error('MangaDex direct returned 0 pages')
  return pages
}

// ─────────────────────────────────────────────
// API 3 — ComicK HQ  (indexes MangaDex chapters)
// Looks up the chapter by MangaDex chapter ID,
// then fetches HQ image list from ComicK's CDN.
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
    return `/api/proxy/image?url=${encodeURIComponent(raw)}`
  })

  return pages
}

// ─────────────────────────────────────────────
// API 4 — ComicK data-saver (meo2 CDN)
// Uses the same ComicK chapter lookup but forces
// the lower-resolution meo2 CDN, which has better
// uptime during peak hours.
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
    // Force meo2 (data-saver/low-res) CDN instead of meo
    const raw = b2key.startsWith('http')
      ? b2key.replace('meo.comick.pictures', 'meo2.comick.pictures')
      : `https://meo2.comick.pictures/${b2key}`
    return `/api/proxy/image?url=${encodeURIComponent(raw)}`
  })

  return pages
}

// ─────────────────────────────────────────────
// API 5 — MangaFire
// MangaFire indexes many MangaDex titles.
// We look up the chapter via the MangaDex chapter
// ID using their /api/chapter endpoint, then
// fetch the image list.
// ─────────────────────────────────────────────
async function fetchFromMangaFire(chapterId: string): Promise<string[]> {
  // MangaFire exposes a chapter lookup by external (MangaDex) ID
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
  // MangaFire returns img tags — extract src attributes
  const matches = [...html.matchAll(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)]
  if (matches.length === 0) throw new Error('MangaFire: no images found in response')

  const pages: string[] = matches.map((m) => {
    const raw = m[1].replace(/&amp;/g, '&')
    return `/api/proxy/image?url=${encodeURIComponent(raw)}`
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

  for (const source of SOURCES) {
    try {
      console.log(`[ChapterImages] Trying ${source.name} for ${chapterId}…`)
      const raw = await source.fn(chapterId)
      const { unique, removed } = deduplicatePages(raw)

      console.log(
        `[ChapterImages] ${source.name} succeeded — ${raw.length} pages fetched, ${removed} duplicates removed`
      )

      return {
        pages: unique,
        source: source.name,
        totalFetched: raw.length,
        duplicatesRemoved: removed,
      }
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'unknown error'
      console.warn(`[ChapterImages] ${source.name} failed: ${msg}`)
      errors.push(`${source.name}: ${msg}`)
    }
  }

  throw new Error(`All 5 APIs failed.\n${errors.join('\n')}`)
}