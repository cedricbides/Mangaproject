export interface MangaTag {
  id: string
  attributes: { name: { en: string }; group: string }
}

export interface MangaCoverArt {
  id: string
  type: 'cover_art'
  attributes: { fileName: string; volume?: string }
}

export interface MangaRelationship {
  id: string
  type: string
  attributes?: Record<string, unknown>
}

export interface Manga {
  id: string
  type: 'manga'
  attributes: {
    title: { en?: string; [key: string]: string | undefined }
    altTitles: Array<{ [key: string]: string }>
    description: { en?: string; [key: string]: string | undefined }
    status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled'
    contentRating: 'safe' | 'suggestive' | 'erotica' | 'pornographic'
    tags: MangaTag[]
    year?: number
    availableTranslatedLanguages: string[]
    lastVolume?: string
    lastChapter?: string
  }
  relationships: MangaRelationship[]
}

export interface Chapter {
  id: string
  type: 'chapter'
  attributes: {
    title?: string
    volume?: string
    chapter?: string
    pages: number
    translatedLanguage: string
    publishAt: string
    readableAt: string
  }
  relationships: MangaRelationship[]
}

export type ReadingStatus = 'reading' | 'completed' | 'plan_to_read' | 'dropped' | 'on_hold'

export interface User {
  id: string
  name: string
  email: string
  avatar: string

  bannerUrl?: string
  bio?: string
  postCount?: number
  role: 'user' | 'moderator' | 'admin' | 'superadmin'
  adminPermissions?: string[]
  favorites: string[]
  following?: string[]
  theme?: 'dark' | 'dim' | 'light'
  emailVerified?: boolean

  readingList: Array<{ mangaId: string; status: ReadingStatus; updatedAt: string }>
  readingHistory: { mangaId: string; chapterId: string; page: number; updatedAt: string; isLocal?: boolean }[]
}

export interface MangaDexResponse<T> {
  result: string
  response: string
  data: T
  limit?: number
  offset?: number
  total?: number
}

// Local manga types (admin-managed)
export interface LocalManga {
  _id: string
  title: string
  altTitle?: string
  coverUrl: string
  description: string
  genres: string[]
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled'
  author?: string
  artist?: string
  year?: number
  slug: string
  featured: boolean
  views: number
  createdAt: string
  updatedAt: string
}

export interface LocalChapter {
  _id: string
  mangaId: string
  chapterNumber: string
  title?: string
  volume?: string
  pages: string[]
  language: string
  externalUrl?: string
  createdAt: string
}