import type { Manga, MangaCoverArt, MangaRelationship } from '@/types'

const API_BASE = 'https://mangaproject.onrender.com'

export const MANGADEX_BASE = `${API_BASE}/api/mangadex`
export const MANGADEX_UPLOADS = 'https://uploads.mangadex.org'

export function getCoverUrl(manga: Manga, size: 256 | 512 | null = 256): string {
  const cover = manga.relationships.find(
    (r): r is MangaCoverArt & MangaRelationship => r.type === 'cover_art'
  ) as (MangaCoverArt & MangaRelationship) | undefined

  const fileName = (cover?.attributes as { fileName?: string } | undefined)?.fileName
  if (!fileName) return '/no-cover.png'

  const suffix = size ? `.${size}.jpg` : ''
  const url = `https://uploads.mangadex.org/covers/${manga.id}/${fileName}${suffix}`
  return `${API_BASE}/api/proxy/image?url=${encodeURIComponent(url)}`
}

export function getMangaTitle(manga: Manga): string {
  return manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown Title'
}

export function getMangaDescription(manga: Manga): string {
  return manga.attributes.description?.en || 'No description available.'
}

export function getMangaTags(manga: Manga): string[] {
  return manga.attributes.tags
    .filter((t) => t.attributes.group === 'genre')
    .map((t) => t.attributes.name.en)
    .slice(0, 5)
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    ongoing: '#22c55e',
    completed: '#3b82f6',
    hiatus: '#f59e0b',
    cancelled: '#ef4444',
  }
  return map[status] || '#6b7280'
}

export function formatChapter(chapter: { attributes: { volume?: string; chapter?: string; title?: string } }): string {
  const { volume, chapter: ch, title } = chapter.attributes
  let label = ''
  if (volume) label += `Vol.${volume} `
  if (ch) label += `Ch.${ch}`
  if (title) label += ` — ${title}`
  return label.trim() || 'Oneshot'
}