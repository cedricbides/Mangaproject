import { Router, Request, Response } from 'express'
import axios from 'axios'

import TrackedMangaDex from '../models/TrackedMangaDex'
import HiddenChapter from '../models/HiddenChapter'
import DeletedChapter from '../models/DeletedChapter'
import MangaDexManualChapter from '../models/MangaDexManualChapter'
import { getChapterPages } from '../utils/chapterImageService'
import { requireAdmin } from '../middleware/auth'

// ── In-memory API cache (5 min TTL, max 300 entries) ─────────────────────────
const _cache = new Map<string, { data: any; exp: number }>()
function cacheGet(k: string) {
  const e = _cache.get(k)
  if (!e) return null
  if (Date.now() > e.exp) { _cache.delete(k); return null }
  return e.data
}
function cacheSet(k: string, data: any, ttl = 300_000) {
  if (_cache.size >= 300) _cache.delete(_cache.keys().next().value!)
  _cache.set(k, { data, exp: Date.now() + ttl })
}

const router = Router()
const MD = 'https://api.mangadex.org'
const COMICK_API = 'https://api.comick.io'

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Fetch ALL chapters from MangaDex with full pagination
// MangaDex caps at 500/request; we loop until we have everything.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAllMangaDexChapters(
  mangaId: string,
  language?: string
): Promise<any[]> {
  const chapters: any[] = []
  let offset = 0
  const limit = 500

  while (true) {
    const params: any = {
      limit,
      offset,
      'order[chapter]': 'asc',
      includeEmptyPages: 0,
    }
    if (language) params['translatedLanguage[]'] = language

    const r = await axios.get(`${MD}/manga/${mangaId}/feed`, {
      params,
      headers: { 'User-Agent': 'MangaVerse/1.0' },
      timeout: 15_000,
    })
    const data: any[] = r.data.data ?? []
    const total: number = r.data.total ?? 0
    chapters.push(...data)
    if (data.length < limit || chapters.length >= total) break
    offset += limit
  }

  return chapters
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Fetch chapters from ComicK as fallback chapter-list source.
// ComicK mirrors most MangaDex titles and has its own chapter listing.
// We look up the MangaDex manga UUID via ComicK's /manga/md/<uuid> endpoint,
// then paginate their chapter list.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAllComicKChapters(
  mangaId: string,
  language?: string
): Promise<any[]> {
  const slugRes = await axios.get(
    `${COMICK_API}/manga/md/${mangaId}`,
    { headers: { 'User-Agent': 'MangaVerse/1.0' }, timeout: 12_000 }
  )
  const slug: string = slugRes.data?.slug
  if (!slug) throw new Error('ComicK: no slug found for this manga')

  const chapters: any[] = []
  let page = 1
  const perPage = 300

  while (true) {
    const params: any = { page, limit: perPage }
    if (language) params.lang = language

    const r = await axios.get(`${COMICK_API}/manga/${slug}/chapters`, {
      params,
      headers: { 'User-Agent': 'MangaVerse/1.0' },
      timeout: 12_000,
    })
    const data: any[] = r.data?.chapters ?? r.data ?? []
    if (!Array.isArray(data) || data.length === 0) break
    chapters.push(...data)
    if (data.length < perPage) break
    page++
  }

  if (chapters.length === 0) throw new Error('ComicK: returned 0 chapters')

  // Normalise ComicK chapters to MangaDex-compatible shape so the
  // frontend can use a single data format.
  // chap / chap_numeric are the two ComicK chapter number fields.
  return chapters.map((c: any) => {
    const chapterNum: string | null =
      c.chap != null        ? String(c.chap) :
      c.chap_numeric != null? String(c.chap_numeric) :
      c.chapter != null     ? String(c.chapter) :
      null

    return {
      id: c.md_chapter_id ?? c.hid,           // prefer MangaDex UUID when available
      _comickHid: c.hid,                       // kept for ComicK image fetching
      _source: 'comick',
      type: 'chapter',
      attributes: {
        chapter: chapterNum,
        title: c.title ?? null,
        volume: c.vol != null ? String(c.vol) : null,
        pages: c.page_count ?? 0,
        translatedLanguage: c.lang ?? language ?? 'unknown',
        publishAt: c.created_at ?? c.updated_at ?? new Date().toISOString(),
        readableAt: c.created_at ?? new Date().toISOString(),
        _source: 'comick',
      },
      relationships: [],
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Merge chapters from multiple sources and deduplicate.
//
// Dedup key  →  `${chapterNumber}:${language}` (e.g. "42.5:en")
// When two sources have the same chapter number + language:
//   - MangaDex version always wins (it's the primary source)
//   - ComicK version is only kept when MangaDex has no entry for that number
//
// Also strips any chapters whose number is null/undefined so they
// don't corrupt the sort order.
//
// Returns chapters sorted ascending by chapter number.
// ─────────────────────────────────────────────────────────────────────────────
interface MergeResult {
  chapters: any[]
  fromMangaDex: number
  fromComicK: number
  duplicatesRemoved: number
}

function mergeAndDeduplicateChapters(
  mdxChapters: any[],
  comickChapters: any[]
): MergeResult {
  // Map: dedup-key → winning chapter entry
  const map = new Map<string, any>()

  // ── Pass 1: insert all MangaDex chapters (they always win) ──────────────
  let mdxCount = 0
  for (const ch of mdxChapters) {
    const num = ch.attributes?.chapter
    const lang = ch.attributes?.translatedLanguage ?? 'en'
    if (num == null || num === '') continue  // skip numberless chapters
    const key = `${String(num).trim()}:${lang}`
    map.set(key, { ...ch, _source: 'mangadex' })
    mdxCount++
  }

  // ── Pass 2: insert ComicK chapters ONLY if no MangaDex entry exists ─────
  let comickAdded = 0
  let duplicates = 0
  for (const ch of comickChapters) {
    const num = ch.attributes?.chapter
    const lang = ch.attributes?.translatedLanguage ?? 'en'
    if (num == null || num === '') continue
    const key = `${String(num).trim()}:${lang}`
    if (map.has(key)) {
      duplicates++       // MangaDex already has this chapter — skip ComicK's copy
    } else {
      map.set(key, ch)   // ComicK fills the gap
      comickAdded++
    }
  }

  // ── Sort ascending by chapter number ────────────────────────────────────
  const sorted = Array.from(map.values()).sort((a, b) => {
    const nA = parseFloat(a.attributes?.chapter ?? '0')
    const nB = parseFloat(b.attributes?.chapter ?? '0')
    return nA - nB
  })

  return {
    chapters: sorted,
    fromMangaDex: mdxCount,
    fromComicK: comickAdded,
    duplicatesRemoved: duplicates,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mangadex/all-chapters/:mangaId
//
// Fetches chapters from ALL available sources IN PARALLEL, then merges
// and deduplicates by chapter number + language:
//   1. MangaDex  (paginated, primary source — always preferred)
//   2. ComicK    (runs in parallel — fills in gaps MangaDex is missing)
//
// Hidden and deleted chapters are always filtered out.
// Results are cached for 2 minutes.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all-chapters/:mangaId', async (req: Request, res: Response) => {
  try {
    const { mangaId } = req.params
    const language = (req.query.lang as string) || 'en'
    const fetchAll = language === 'all'
    const cacheKey = `all-chapters:${mangaId}:${language}`

    // ── Serve from cache if fresh ────────────────────────────────────────────
    const cached = cacheGet(cacheKey)
    if (cached) {
      // Still need to filter hidden/deleted even from cache
      const [hiddenDocs, deletedDocs] = await Promise.all([
        HiddenChapter.find({ mangaDexId: mangaId }).select('chapterId').lean(),
        DeletedChapter.find({ mangaDexId: mangaId }).select('chapterId').lean(),
      ])
      const blocked = new Set([
        ...hiddenDocs.map((h: any) => h.chapterId),
        ...deletedDocs.map((d: any) => d.chapterId),
      ])
      const filtered = blocked.size > 0
        ? cached.filter((c: any) => !blocked.has(c.id))
        : cached
      res.setHeader('Cache-Control', 'public, max-age=120')
      return res.json({ data: filtered, total: filtered.length, source: 'cache' })
    }

    // ── Fetch from ALL sources in PARALLEL ──────────────────────────────────
    console.log(`[all-chapters] Fetching from all sources in parallel for ${mangaId}`)

    const [mdxResult, comickResult] = await Promise.allSettled([
      fetchAll
        ? fetchAllMangaDexChapters(mangaId, undefined) // undefined = no language filter
        : fetchAllMangaDexChapters(mangaId, language),
      fetchAll
        ? fetchAllComicKChapters(mangaId, undefined)
        : fetchAllComicKChapters(mangaId, language),
    ])

    const mdxChapters  = mdxResult.status    === 'fulfilled' ? mdxResult.value    : []
    const comickChapters = comickResult.status === 'fulfilled' ? comickResult.value : []

    if (mdxResult.status === 'rejected') {
      console.warn(`[all-chapters] MangaDex failed: ${mdxResult.reason?.message}`)
    }
    if (comickResult.status === 'rejected') {
      console.warn(`[all-chapters] ComicK failed: ${comickResult.reason?.message}`)
    }

    if (mdxChapters.length === 0 && comickChapters.length === 0) {
      // Not a server error — the manga simply has no chapters in this language
      return res.json({ data: [], total: 0, source: 'none', meta: { fromMangaDex: 0, fromComicK: 0, duplicatesRemoved: 0 } })
    }

    // ── Merge + deduplicate (MangaDex wins on conflict) ──────────────────────
    const { chapters, fromMangaDex, fromComicK, duplicatesRemoved } =
      mergeAndDeduplicateChapters(mdxChapters, comickChapters)

    console.log(
      `[all-chapters] Merged: ${fromMangaDex} from MangaDex + ${fromComicK} gap-fills from ComicK` +
      ` = ${chapters.length} unique chapters (${duplicatesRemoved} duplicates removed)`
    )

    // ── Persist ComicK gap-fills to DB so they show in dashboard stats ───────
    if (fromComicK > 0) {
      const comickChaptersToSave = chapters.filter((c: any) => c._source === 'comick')
      for (const ch of comickChaptersToSave) {
        const chapterNum = ch.attributes?.chapter
        if (!chapterNum) continue
        // Only save if not already in DB
        const exists = await MangaDexManualChapter.findOne({
          mangaDexId: mangaId,
          chapterNumber: String(chapterNum),
          language: ch.attributes?.translatedLanguage || language,
          source: 'comick',
        })
        if (!exists) {
          await MangaDexManualChapter.create({
            mangaDexId: mangaId,
            mdxChapterId: ch.id,
            chapterNumber: String(chapterNum),
            title: ch.attributes?.title || '',
            volume: ch.attributes?.volume || '',
            language: ch.attributes?.translatedLanguage || language,
            pages: [],
            source: 'comick',
            published: true,
            uploadedBy: 'comick-autofill',
          }).catch(() => {}) // ignore duplicate key errors
        }
      }
      console.log(`[all-chapters] Saved ${comickChaptersToSave.length} ComicK gap-fills to DB`)
    }

    // Determine source label for response metadata
    const sourceLabel =
      fromMangaDex > 0 && fromComicK > 0 ? 'mangadex+comick' :
      fromMangaDex > 0                    ? 'mangadex' :
                                            'comick'

    // Cache the merged list (before filtering, so cache is reusable)
    cacheSet(cacheKey, chapters, 120_000)

    // ── Filter hidden / deleted chapters ────────────────────────────────────
    const [hiddenDocs, deletedDocs] = await Promise.all([
      HiddenChapter.find({ mangaDexId: mangaId }).select('chapterId').lean(),
      DeletedChapter.find({ mangaDexId: mangaId }).select('chapterId').lean(),
    ])
    const blocked = new Set([
      ...hiddenDocs.map((h: any) => h.chapterId),
      ...deletedDocs.map((d: any) => d.chapterId),
    ])
    const filtered = blocked.size > 0
      ? chapters.filter((c: any) => !blocked.has(c.id))
      : chapters

    res.setHeader('Cache-Control', 'public, max-age=120')
    res.json({
      data: filtered,
      total: filtered.length,
      source: sourceLabel,
      meta: { fromMangaDex, fromComicK, duplicatesRemoved },
    })
  } catch (err: any) {
    console.error('[all-chapters] fatal error:', err.message)
    res.status(500).json({ error: 'Failed to fetch chapters', detail: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mangadex/manga-chapters/:mangaId
// Returns all English chapters for a manga (for the admin chapter picker).
// Also uses full pagination now.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/manga-chapters/:mangaId', async (req: Request, res: Response) => {
  try {
    const { mangaId } = req.params
    const chapters = await fetchAllMangaDexChapters(mangaId, 'en')

    const list = chapters.map((c: any) => ({
      id: c.id,
      chapter: c.attributes.chapter,
      title: c.attributes.title,
      volume: c.attributes.volume,
      pages: c.attributes.pages,
      publishAt: c.attributes.publishAt,
      language: c.attributes.translatedLanguage || 'en',
    }))

    res.setHeader('Cache-Control', 'no-store')
    res.json(list)
  } catch (err: any) {
    console.error('manga-chapters error:', err.response?.data || err.message)
    const status = err.response?.status || 500
    res.status(status).json({ error: 'Failed to fetch chapters from MangaDex', detail: err.response?.data })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mangadex/chapter-pages/:chapterId
// Tries 5 independent public APIs in order (see chapterImageService.ts).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/chapter-pages/:chapterId', async (req: Request, res: Response) => {
  try {
    const { chapterId } = req.params
    const result = await getChapterPages(chapterId)
    res.json({
      pages: result.pages,
      meta: {
        source: result.source,
        totalFetched: result.totalFetched,
        duplicatesRemoved: result.duplicatesRemoved,
        finalCount: result.pages.length,
      },
    })
  } catch (err: any) {
    console.error('chapter-pages: all sources failed —', err.message)
    res.status(502).json({ error: 'All image sources failed', detail: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mangadex/view/:mangaId  — increment view count
// ─────────────────────────────────────────────────────────────────────────────
router.post('/view/:mangaId', async (req: Request, res: Response) => {
  try {
    const { mangaId } = req.params
    const existing = await TrackedMangaDex.findOne({ mangaDexId: mangaId })

    if (existing) {
      existing.views = (existing.views || 0) + 1
      if (!existing.title || existing.title === 'Untitled' || existing.title === 'Unknown') {
        try {
          const mdRes = await axios.get(
            `${MD}/manga/${mangaId}?includes[]=cover_art&includes[]=author`,
            { headers: { 'User-Agent': 'MangaVerse/1.0' }, timeout: 8000 }
          )
          const data = mdRes.data?.data
          if (data) {
            const titles = data.attributes?.title || {}
            existing.title = titles.en || titles['ja-ro'] || titles.ja || Object.values(titles)[0] as string || existing.title
            existing.status = data.attributes?.status || existing.status
            existing.year = data.attributes?.year
            const authorRel = data.relationships?.find((r: any) => r.type === 'author')
            existing.author = authorRel?.attributes?.name || existing.author
            const coverRel = data.relationships?.find((r: any) => r.type === 'cover_art')
            const coverFile = coverRel?.attributes?.fileName
            if (coverFile) existing.coverUrl = `https://uploads.mangadex.org/covers/${mangaId}/${coverFile}.256.jpg`
          }
        } catch {}
      }
      await existing.save()
      return res.json({ views: existing.views })
    }

    let title = '', coverUrl = '', status = 'unknown', author = ''
    let year: number | undefined

    try {
      const mdRes = await axios.get(
        `${MD}/manga/${mangaId}?includes[]=cover_art&includes[]=author`,
        { headers: { 'User-Agent': 'MangaVerse/1.0' }, timeout: 8000 }
      )
      const data = mdRes.data?.data
      if (data) {
        const titles = data.attributes?.title || {}
        title = titles.en || titles['ja-ro'] || titles.ja || Object.values(titles)[0] || 'Untitled'
        status = data.attributes?.status || 'unknown'
        year = data.attributes?.year
        const authorRel = data.relationships?.find((r: any) => r.type === 'author')
        author = authorRel?.attributes?.name || ''
        const coverRel = data.relationships?.find((r: any) => r.type === 'cover_art')
        const coverFile = coverRel?.attributes?.fileName
        if (coverFile) coverUrl = `https://uploads.mangadex.org/covers/${mangaId}/${coverFile}.256.jpg`
      }
    } catch {
      title = 'Unknown'
    }

    const doc = await TrackedMangaDex.create({
      mangaDexId: mangaId, title, coverUrl, status, author, year, views: 1,
    })
    return res.json({ views: doc.views })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/mangadex/view/:mangaId  — get view count
router.get('/view/:mangaId', async (req: Request, res: Response) => {
  try {
    const doc = await TrackedMangaDex.findOne({ mangaDexId: req.params.mangaId }).select('views')
    res.json({ views: doc?.views ?? 0 })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// API-CHAPTERS admin routes
// These manage the hide/delete state for MangaDex API chapters
// (distinct from manually-uploaded chapters).
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/api-chapters/filtered/:mangaId
// Returns sets of hidden and deleted chapter IDs for a manga
router.get('/api-chapters/filtered/:mangaId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { mangaId } = req.params
    const [hiddenDocs, deletedDocs] = await Promise.all([
      HiddenChapter.find({ mangaDexId: mangaId }).select('chapterId').lean(),
      DeletedChapter.find({ mangaDexId: mangaId }).select('chapterId').lean(),
    ])
    res.json({
      hidden: hiddenDocs.map((h: any) => h.chapterId),
      deleted: deletedDocs.map((d: any) => d.chapterId),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/api-chapters/hide
router.post('/api-chapters/hide', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { mangaDexId, chapterId, chapterNumber, chapterTitle, mangaTitle } = req.body
    if (!mangaDexId || !chapterId) return res.status(400).json({ error: 'mangaDexId and chapterId required' })
    await HiddenChapter.findOneAndUpdate(
      { mangaDexId, chapterId },
      { mangaDexId, chapterId, chapterNumber, chapterTitle, mangaTitle },
      { upsert: true, new: true }
    )
    // Invalidate cache
    _cache.delete(`all-chapters:${mangaDexId}:en`)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/admin/api-chapters/hide/:chapterId
router.delete('/api-chapters/hide/:chapterId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { chapterId } = req.params
    const doc = await HiddenChapter.findOneAndDelete({ chapterId })
    if (doc) _cache.delete(`all-chapters:${doc.mangaDexId}:en`)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/api-chapters/delete  (permanent hide — adds to DeletedChapter)
router.post('/api-chapters/delete', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { mangaDexId, chapterId, chapterNumber, chapterTitle, mangaTitle } = req.body
    if (!mangaDexId || !chapterId) return res.status(400).json({ error: 'mangaDexId and chapterId required' })
    await DeletedChapter.findOneAndUpdate(
      { mangaDexId, chapterId },
      { mangaDexId, chapterId, chapterNumber, chapterTitle, mangaTitle },
      { upsert: true, new: true }
    )
    // Also remove from hidden if it was there
    await HiddenChapter.deleteOne({ mangaDexId, chapterId })
    _cache.delete(`all-chapters:${mangaDexId}:en`)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Generic proxy: forwards any GET to MangaDex API with caching.
// Special case: manga/:id/feed filters hidden/deleted chapters.
// NOTE: Prefer /all-chapters/:id for chapter lists; this proxy is kept for
// other MangaDex API calls (manga info, covers, search, etc.)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/*', async (req: Request, res: Response) => {
  try {
    const path = req.params[0]
    const key = `${path}?${new URLSearchParams(req.query as any).toString()}`

    // ── Special case: chapter feed — filter hidden/deleted chapters ───────────
    const feedMatch = path.match(/^manga\/([^/]+)\/feed$/)
    if (feedMatch) {
      const mangaId = feedMatch[1]
      const cached = cacheGet(key)
      let data: any
      if (cached) {
        data = cached
      } else {
        const response = await axios.get(`${MD}/${path}`, {
          params: req.query,
          headers: { 'User-Agent': 'MangaVerse/1.0' },
          timeout: 10000,
        })
        data = response.data
        cacheSet(key, data, 120_000)
      }
      const [hiddenDocs, deletedDocs] = await Promise.all([
        HiddenChapter.find({ mangaDexId: mangaId }).select('chapterId').lean(),
        DeletedChapter.find({ mangaDexId: mangaId }).select('chapterId').lean(),
      ])
      const blocked = new Set([
        ...hiddenDocs.map((h: any) => h.chapterId),
        ...deletedDocs.map((d: any) => d.chapterId),
      ])
      if (blocked.size > 0 && Array.isArray(data?.data)) {
        data = { ...data, data: data.data.filter((ch: any) => !blocked.has(ch.id)) }
      }
      res.setHeader('Cache-Control', 'public, max-age=120')
      return res.json(data)
    }

    // ── Standard proxy ────────────────────────────────────────────────────────
    const cached = cacheGet(key)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('Cache-Control', 'public, max-age=300')
      return res.json(cached)
    }
    const response = await axios.get(`${MD}/${path}`, {
      params: req.query,
      headers: { 'User-Agent': 'MangaVerse/1.0' },
      timeout: 10000,
    })
    cacheSet(key, response.data)
    res.setHeader('X-Cache', 'MISS')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.json(response.data)
  } catch (err: any) {
    const status = err.response?.status || 500
    const message = err.response?.data || { message: 'MangaDex API error' }
    res.status(status).json(message)
  }
})

export default router