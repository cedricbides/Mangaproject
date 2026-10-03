// backend/src/routes/publicHome.ts
// PUBLIC (no login) read-only data for the guest front page.
// Only exposes: titles, covers, year/status and "latest chapter" numbers.
// Chapter IDs, chapter pages and everything else stay behind login.
import { Router, Request, Response } from 'express'
import axios from 'axios'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

const router = Router()
const MD = 'https://api.mangadex.org'
const UA = { 'User-Agent': 'MangaVerse/1.0' }
const isDev = process.env.NODE_ENV !== 'production'

// Real client IP behind Render/Cloudflare (same logic as server.ts)
function clientIp(req: Request): string {
  const h = (req.headers['cf-connecting-ip'] || req.headers['true-client-ip']) as string | undefined
  return (h ? h.split(',')[0].trim() : req.ip) || 'unknown'
}
const keyGenerator = (req: Request) => ipKeyGenerator(clientIp(req))

const homeLimiter = rateLimit({
  keyGenerator,
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down' },
  skip: () => isDev,
})
// A page load requests ~80 covers, so this one is generous
const coverLimiter = rateLimit({
  keyGenerator,
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: { error: 'Too many requests, please slow down' },
  skip: () => isDev,
})

// ── helpers ──────────────────────────────────────────────────────────────────
function titleOf(m: any): string {
  const t = m.attributes?.title || {}
  return t.en || t['ja-ro'] || (Object.values(t)[0] as string) || 'Untitled'
}

function coverOf(m: any, size: 256 | 512): string {
  const rel = m.relationships?.find((r: any) => r.type === 'cover_art')
  const file = rel?.attributes?.fileName
  return file ? `/api/public/cover/${m.id}/${file}?s=${size}` : ''
}

function card(m: any) {
  return {
    id: m.id as string,
    title: titleOf(m),
    cover: coverOf(m, 256),
    year: (m.attributes?.year ?? null) as number | null,
    status: (m.attributes?.status ?? '') as string,
  }
}

async function listManga(qs: string): Promise<any[]> {
  const r = await axios.get(`${MD}/manga?${qs}&includes[]=cover_art`, { headers: UA, timeout: 10_000 })
  return Array.isArray(r.data?.data) ? r.data.data : []
}

async function latestUpdates() {
  const r = await axios.get(
    `${MD}/chapter?limit=64&translatedLanguage[]=en&order[publishAt]=desc&contentRating[]=safe&includes[]=scanlation_group`,
    { headers: UA, timeout: 10_000 }
  )
  const chapters: any[] = Array.isArray(r.data?.data) ? r.data.data : []

  const grouped = new Map<string, { group: string; chapters: any[] }>()
  for (const ch of chapters) {
    const mangaRel = ch.relationships?.find((x: any) => x.type === 'manga')
    if (!mangaRel) continue
    if (!grouped.has(mangaRel.id)) {
      const g = ch.relationships?.find((x: any) => x.type === 'scanlation_group')
      grouped.set(mangaRel.id, { group: g?.attributes?.name || '', chapters: [] })
    }
    const entry = grouped.get(mangaRel.id)!
    if (entry.chapters.length < 2) {
      entry.chapters.push({
        num: ch.attributes?.chapter ?? null,
        title: ch.attributes?.title ?? null,
        publishAt: ch.attributes?.publishAt ?? null,
      })
    }
  }

  const ids = Array.from(grouped.keys()).slice(0, 16)
  if (ids.length === 0) return []

  const mangaList = await listManga(`ids[]=${ids.join('&ids[]=')}&limit=16&contentRating[]=safe`)
  const byId = new Map<string, any>(mangaList.map(m => [m.id, m]))

  return ids
    .filter(id => byId.has(id))
    .map(id => {
      const m = byId.get(id)
      const g = grouped.get(id)!
      return { id, title: titleOf(m), cover: coverOf(m, 256), group: g.group, chapters: g.chapters }
    })
}

// MangaDex tag ids for the genre rows on the landing page
const GENRE_TAGS = {
  action: '391b0423-d847-456f-aff0-8b0cfc03066b',
  romance: '423e2eae-a7a2-4a8b-ac03-a8351462d71d',
  sliceOfLife: 'e5301a23-ebd9-4bf3-8ffd-2b0a4d3a1d56',
}

function settled<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === 'fulfilled' ? r.value : fallback
}

async function buildHome() {
  const year = new Date().getFullYear()
  const base = 'contentRating[]=safe&hasAvailableChapters=true'

  const tag = (id: string) => `includedTags[]=${id}&includedTagsMode=AND`
  const [trendingR, recommendedR, seasonalR, recentR, latestR, actionR, romanceR, solR] = await Promise.allSettled([
    listManga(`limit=18&order[followedCount]=desc&${base}`),
    listManga(`limit=18&order[rating]=desc&${base}`),
    listManga(`limit=18&year=${year}&order[followedCount]=desc&${base}`),
    listManga(`limit=18&order[createdAt]=desc&${base}`),
    latestUpdates(),
    listManga(`limit=12&order[followedCount]=desc&${tag(GENRE_TAGS.action)}&${base}`),
    listManga(`limit=12&order[followedCount]=desc&${tag(GENRE_TAGS.romance)}&${base}`),
    listManga(`limit=12&order[followedCount]=desc&${tag(GENRE_TAGS.sliceOfLife)}&${base}`),
  ])

  const trendingRaw = settled(trendingR, [] as any[])
  const recommended = settled(recommendedR, [] as any[]).map(card)
  const seasonal = settled(seasonalR, [] as any[]).map(card)
  const recentlyAdded = settled(recentR, [] as any[]).map(card)
  const latest = settled(latestR, [] as any[])
  const genres = {
    action: settled(actionR, [] as any[]).map(card),
    romance: settled(romanceR, [] as any[]).map(card),
    sliceOfLife: settled(solR, [] as any[]).map(card),
  }

  const hero = trendingRaw.slice(0, 6).map((m: any) => {
    const desc = m.attributes?.description || {}
    const text: string = desc.en || (Object.values(desc)[0] as string) || ''
    const tags = (m.attributes?.tags || [])
      .slice(0, 4)
      .map((t: any) => t.attributes?.name?.en)
      .filter(Boolean)
    return {
      id: m.id as string,
      title: titleOf(m),
      description: text.length > 240 ? text.slice(0, 237) + '…' : text,
      cover: coverOf(m, 512),
      tags: tags as string[],
    }
  })

  const trending = trendingRaw.map(card)

  if (!trending.length && !recommended.length && !latest.length) {
    throw new Error('No data from upstream')
  }
  return { hero, trending, recommended, seasonal, recentlyAdded, latest, genres }
}

// ── GET /api/public/home ─────────────────────────────────────────────────────
let homeCache: { data: any; exp: number } | null = null
let inflight: Promise<any> | null = null
const HOME_TTL = 10 * 60 * 1000

router.get('/home', homeLimiter, async (_req: Request, res: Response) => {
  try {
    if (homeCache && Date.now() < homeCache.exp) {
      res.setHeader('Cache-Control', 'public, max-age=300')
      return res.json(homeCache.data)
    }
    if (!inflight) inflight = buildHome().finally(() => { inflight = null })
    const data = await inflight
    homeCache = { data, exp: Date.now() + HOME_TTL }
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.json(data)
  } catch (err: any) {
    console.error('[public/home] failed:', err.message)
    if (homeCache) return res.json(homeCache.data) // serve stale
    return res.status(502).json({ error: 'Unable to load right now' })
  }
})

// ── GET /api/public/cover/:id/:file?s=256|512 ────────────────────────────────
// Tiny cover-only image proxy. Host is fixed and inputs are strictly validated,
// so it cannot be used to fetch anything except MangaDex cover art.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE = /^[A-Za-z0-9_.-]{1,100}\.(jpg|jpeg|png|webp|gif)$/i

const coverCache = new Map<string, { buf: Buffer; type: string }>()
const COVER_CACHE_MAX = 300

router.get('/cover/:id/:file', coverLimiter, async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const file = String(req.params.file)
  const size = req.query.s === '512' ? 512 : 256
  if (!UUID.test(id) || !FILE.test(file)) return res.status(400).end()

  const key = `${id}/${file}/${size}`
  const send = (buf: Buffer, type: string) => {
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    return res.send(buf)
  }

  const hit = coverCache.get(key)
  if (hit) return send(hit.buf, hit.type)

  try {
    const r = await axios.get(`https://uploads.mangadex.org/covers/${id}/${file}.${size}.jpg`, {
      responseType: 'arraybuffer',
      headers: UA,
      timeout: 10_000,
      maxContentLength: 3 * 1024 * 1024,
    })
    const buf = Buffer.from(r.data)
    const type = (r.headers['content-type'] as string) || 'image/jpeg'
    if (coverCache.size >= COVER_CACHE_MAX) coverCache.delete(coverCache.keys().next().value!)
    coverCache.set(key, { buf, type })
    return send(buf, type)
  } catch {
    return res.status(404).end()
  }
})

export default router