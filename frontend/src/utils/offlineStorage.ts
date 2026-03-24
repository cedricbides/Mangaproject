// ─── Offline Storage via IndexedDB ───────────────────────────────────────────
// All data is scoped per user. Guests cannot save anything.
// DB_VERSION bump wipes old unscoped data.

const DB_NAME = 'mangaverse-offline'
const DB_VERSION = 3           // v3: clean wipe of all pre-userId data
const CHAPTERS_STORE = 'chapters'
const IMAGES_STORE = 'images'

export interface OfflineChapterMeta {
  id: string              // `${userId}:${chapterId}`
  chapterId: string       // raw chapter id
  userId: string          // owner — never 'guest'
  mangaId: string
  mangaTitle: string
  mangaCover: string
  chapterNumber: string
  chapterTitle?: string
  pageCount: number
  sizeBytes: number
  downloadedAt: string
  source: 'api' | 'manual'
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      // Wipe both stores on every version upgrade for clean migration
      if (db.objectStoreNames.contains(CHAPTERS_STORE)) db.deleteObjectStore(CHAPTERS_STORE)
      if (db.objectStoreNames.contains(IMAGES_STORE)) db.deleteObjectStore(IMAGES_STORE)
      const store = db.createObjectStore(CHAPTERS_STORE, { keyPath: 'id' })
      store.createIndex('userId', 'userId', { unique: false })
      db.createObjectStore(IMAGES_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function scopedId(userId: string, chapterId: string) {
  return `${userId}:${chapterId}`
}

// ── Save ──────────────────────────────────────────────────────────────────────

export async function downloadChapterOffline(
  userId: string,
  meta: Omit<OfflineChapterMeta, 'id' | 'userId' | 'sizeBytes' | 'downloadedAt'>,
  pageUrls: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  if (!userId || userId === 'guest') throw new Error('Must be logged in to download chapters')

  const db = await openDB()
  let totalBytes = 0
  const blobs: Blob[] = []

  for (let i = 0; i < pageUrls.length; i++) {
    const res = await fetch(pageUrls[i])
    if (!res.ok) throw new Error(`Failed to fetch page ${i + 1}`)
    const blob = await res.blob()
    blobs.push(blob)
    totalBytes += blob.size
    onProgress?.(i + 1, pageUrls.length)
  }

  const key = scopedId(userId, meta.chapterId)

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CHAPTERS_STORE, IMAGES_STORE], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)

    tx.objectStore(CHAPTERS_STORE).put({
      ...meta,
      id: key,
      userId,
      sizeBytes: totalBytes,
      downloadedAt: new Date().toISOString(),
    } as OfflineChapterMeta)

    blobs.forEach((blob, i) => {
      tx.objectStore(IMAGES_STORE).put(blob, `${key}:${i}`)
    })
  })

  db.close()
}

// ── Get all downloads for a specific user only ────────────────────────────────

export async function getAllDownloads(userId: string): Promise<OfflineChapterMeta[]> {
  if (!userId || userId === 'guest') return []

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAPTERS_STORE, 'readonly')
    const idx = tx.objectStore(CHAPTERS_STORE).index('userId')
    const req = idx.getAll(IDBKeyRange.only(userId))
    req.onsuccess = () => { db.close(); resolve(req.result as OfflineChapterMeta[]) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

// ── Check if downloaded ───────────────────────────────────────────────────────

export async function isChapterDownloaded(userId: string, chapterId: string): Promise<boolean> {
  if (!userId || userId === 'guest') return false

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAPTERS_STORE, 'readonly')
    const req = tx.objectStore(CHAPTERS_STORE).get(scopedId(userId, chapterId))
    req.onsuccess = () => { db.close(); resolve(!!req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

// ── Get pages for reader ───────────────────────────────────────────────────────

export async function getOfflinePages(userId: string, chapterId: string): Promise<string[] | null> {
  if (!userId || userId === 'guest') return null

  const db = await openDB()
  const key = scopedId(userId, chapterId)

  const meta: OfflineChapterMeta | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(CHAPTERS_STORE, 'readonly')
    const req = tx.objectStore(CHAPTERS_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  if (!meta) { db.close(); return null }

  const urls: string[] = []
  for (let i = 0; i < meta.pageCount; i++) {
    const blob: Blob = await new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGES_STORE, 'readonly')
      const req = tx.objectStore(IMAGES_STORE).get(`${key}:${i}`)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    urls.push(URL.createObjectURL(blob))
  }

  db.close()
  return urls
}

// ── Delete one chapter ────────────────────────────────────────────────────────

export async function deleteOfflineChapter(userId: string, chapterId: string): Promise<void> {
  if (!userId || userId === 'guest') return

  const db = await openDB()
  const key = scopedId(userId, chapterId)

  const meta: OfflineChapterMeta | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(CHAPTERS_STORE, 'readonly')
    const req = tx.objectStore(CHAPTERS_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CHAPTERS_STORE, IMAGES_STORE], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(CHAPTERS_STORE).delete(key)
    if (meta) {
      for (let i = 0; i < meta.pageCount; i++) {
        tx.objectStore(IMAGES_STORE).delete(`${key}:${i}`)
      }
    }
  })

  db.close()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}