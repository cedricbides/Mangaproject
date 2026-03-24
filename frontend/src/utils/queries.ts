// Central react-query keys and fetchers
// All pages use these so the cache is shared — fetch once, reuse everywhere

import axios from 'axios'

const MD = '/api/mangadex'

// ── Query keys ────────────────────────────────────────────────────────────────
export const QK = {
  manga:          (id: string)  => ['manga', id] as const,
  mangaFeed:      (id: string)  => ['mangaFeed', id] as const,
  chapterPages:   (id: string)  => ['chapterPages', id] as const,
  trending:       ()            => ['trending'] as const,
  recommended:    ()            => ['recommended'] as const,
  seasonal:       (year: number) => ['seasonal', year] as const,
  recentlyAdded:  ()            => ['recentlyAdded'] as const,
  latestChapters: ()            => ['latestChapters'] as const,
  localManga:     ()            => ['localManga'] as const,
  siteSettings:   ()            => ['siteSettings'] as const,
  siteStatus:     ()            => ['siteStatus'] as const,
  browse:         (params: string) => ['browse', params] as const,
  catalog:        (params: string) => ['catalog', params] as const,
  reviews:        (mangaId: string) => ['reviews', mangaId] as const,
  comments:       (chapterId: string) => ['comments', chapterId] as const,
  feed:           (page: number, filter: string) => ['feed', page, filter] as const,
  progress:       ()            => ['progress'] as const,
  notifications:  ()            => ['notifications'] as const,
  mangaProgress:  (mangaId: string) => ['mangaProgress', mangaId] as const,
  profile:        (userId: string) => ['profile', userId] as const,
  favorites:      ()            => ['favorites'] as const,
  myList:         ()            => ['myList'] as const,
  stats:          ()            => ['stats'] as const,
  adminUsers:     ()            => ['adminUsers'] as const,
  adminAnalytics: ()            => ['adminAnalytics'] as const,
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

export async function fetchMangaList(params: string) {
  const res = await axios.get(`${MD}/manga?${params}&includes[]=cover_art&includes[]=author`)
  return res.data.data
}

export async function fetchLatestChapters() {
  const res = await axios.get(
    `${MD}/chapter?limit=64&translatedLanguage[]=en&order[publishAt]=desc&contentRating[]=safe&includes[]=manga&includes[]=scanlation_group`
  )
  const chapters: any[] = res.data.data

  const grouped: Record<string, { mangaId: string; chapters: any[] }> = {}
  for (const ch of chapters) {
    const mangaRel = ch.relationships?.find((r: any) => r.type === 'manga')
    if (!mangaRel) continue
    const mid = mangaRel.id
    if (!grouped[mid]) grouped[mid] = { mangaId: mid, chapters: [] }
    if (grouped[mid].chapters.length < 3) grouped[mid].chapters.push(ch)
  }

  const mangaIds = Object.keys(grouped).slice(0, 20)
  if (mangaIds.length === 0) return []

  const mangaRes = await axios.get(
    `${MD}/manga?ids[]=${mangaIds.join('&ids[]=')}&limit=20&includes[]=cover_art`
  )
  const mangaMap: Record<string, any> = {}
  for (const m of mangaRes.data.data) mangaMap[m.id] = m

  return mangaIds
    .filter(id => mangaMap[id])
    .map(id => ({ manga: mangaMap[id], chapters: grouped[id].chapters }))
}

export async function fetchSiteSettings() {
  const res = await axios.get('/api/admin/site-settings', { withCredentials: true })
  return res.data
}

export async function fetchSiteStatus() {
  const res = await axios.get('/api/admin/site-status')
  return res.data
}

export async function fetchManga(id: string) {
  const res = await axios.get(
    `${MD}/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`
  )
  return res.data.data
}

export async function fetchMangaFeed(id: string) {
  const res = await axios.get(
    `${MD}/manga/${id}/feed?limit=96&translatedLanguage[]=en&order[chapter]=desc&includeEmptyPages=0`
  )
  return res.data.data
}

export async function fetchReviews(mangaId: string) {
  const res = await axios.get(`/api/social/reviews/${mangaId}`)
  return res.data
}

export async function fetchFeed(page: number, filter: string, userId?: string) {
  const res = await axios.get(`/api/feed?page=${page}&filter=${filter}`, { withCredentials: true })
  return res.data
}

export async function fetchProgress() {
  const res = await axios.get('/api/progress', { withCredentials: true })
  return res.data.readingHistory || []
}

export async function fetchLocalManga() {
  const res = await axios.get('/api/local-manga?limit=18')
  return res.data?.data || res.data || []
}

export async function fetchBrowse(queryString: string) {
  const res = await axios.get(`${MD}/manga?${queryString}`)
  return { data: res.data.data, total: res.data.total }
}

export async function fetchNotifications() {
  const res = await axios.get('/api/notifications', { withCredentials: true })
  return res.data
}