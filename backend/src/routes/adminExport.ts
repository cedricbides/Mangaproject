import { Router, Request, Response } from 'express'
import LocalManga from '../models/LocalManga'
import LocalChapter from '../models/LocalChapter'
import TrackedMangaDex from '../models/TrackedMangaDex'
import User from '../models/User'
import Comment from '../models/Comment'
import Review from '../models/Review'
import { requireAdmin } from '../middleware/auth'

const router = Router()
router.use(requireAdmin)

function toCSV(rows: Record<string, any>[], columns: string[]): string {
  const escape = (val: any) => {
    const str = val == null ? '' : String(val)
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }
  const header = columns.map(escape).join(',')
  const body = rows.map(row => columns.map(col => escape(row[col])).join(',')).join('\n')
  return `${header}\n${body}`
}

// ── Export: manga list ────────────────────────────────────────────────────────
router.get('/manga', async (_req: Request, res: Response) => {
  try {
    const [local, mdx] = await Promise.all([
      LocalManga.find().sort({ title: 1 }),
      TrackedMangaDex.find().sort({ title: 1 }),
    ])
    const rows = [
      ...local.map(m => ({
        id: (m._id as any).toString(),
        title: m.title,
        status: m.status,
        author: m.author || '',
        genres: (m.genres || []).join('; '),
        views: m.views || 0,
        saves: (m as any).saves || 0,
        source: 'local',
        createdAt: m.createdAt?.toISOString() || '',
      })),
      ...mdx.map(m => ({
        id: (m._id as any).toString(),
        title: m.title || '',
        status: m.status || '',
        author: (m as any).author || '',
        genres: '',
        views: m.views || 0,
        saves: 0,
        source: 'mangadex',
        createdAt: (m as any).createdAt?.toISOString() || '',
      })),
    ]
    const csv = toCSV(rows, ['id', 'title', 'status', 'author', 'genres', 'views', 'saves', 'source', 'createdAt'])
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="manga-export.csv"')
    res.send(csv)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Export: users list ────────────────────────────────────────────────────────
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 })
    const rows = users.map((u: any) => ({
      id: u._id.toString(),
      username: u.username || '',
      email: u.email || '',
      role: u.role || 'user',
      banned: u.banned ? 'yes' : 'no',
      favorites: (u.favorites?.length || 0),
      readingHistory: (u.readingHistory?.length || 0),
      createdAt: u.createdAt?.toISOString() || '',
    }))
    const csv = toCSV(rows, ['id', 'username', 'email', 'role', 'banned', 'favorites', 'readingHistory', 'createdAt'])
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"')
    res.send(csv)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Export: chapters ──────────────────────────────────────────────────────────
router.get('/chapters', async (_req: Request, res: Response) => {
  try {
    const chapters = await LocalChapter.find().sort({ mangaId: 1, chapterNumber: 1 })
    const mangaMap: Record<string, string> = {}
    const mangas = await LocalManga.find().select('title')
    mangas.forEach(m => { mangaMap[(m._id as any).toString()] = m.title ?? '' })

    const rows = chapters.map(c => ({
      id: (c._id as any).toString(),
      manga: mangaMap[c.mangaId.toString()] || c.mangaId.toString(),
      chapter: c.chapterNumber,
      title: c.title || '',
      pages: c.pages.length,
      totalViews: (c as any).totalViews || 0,
      draft: c.draft ? 'yes' : 'no',
      publishAt: c.publishAt?.toISOString() || '',
      createdAt: c.createdAt?.toISOString() || '',
    }))
    const csv = toCSV(rows, ['id', 'manga', 'chapter', 'title', 'pages', 'totalViews', 'draft', 'publishAt', 'createdAt'])
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="chapters-export.csv"')
    res.send(csv)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Export: comments ──────────────────────────────────────────────────────────
router.get('/comments', async (_req: Request, res: Response) => {
  try {
    const comments = await Comment.find().sort({ createdAt: -1 }).limit(10000)
    const rows = (comments as any[]).map(c => ({
      id: c._id.toString(),
      userId: c.userId || '',
      mangaId: c.mangaId || '',
      text: (c.text || '').replace(/\n/g, ' '),
      flagged: c.flagged ? 'yes' : 'no',
      createdAt: c.createdAt?.toISOString() || '',
    }))
    const csv = toCSV(rows, ['id', 'userId', 'mangaId', 'text', 'flagged', 'createdAt'])
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="comments-export.csv"')
    res.send(csv)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Export: reviews ───────────────────────────────────────────────────────────
router.get('/reviews', async (_req: Request, res: Response) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).limit(10000)
    const rows = (reviews as any[]).map(r => ({
      id: r._id.toString(),
      userId: r.userId || '',
      mangaId: r.mangaId || '',
      rating: r.rating || '',
      text: (r.text || '').replace(/\n/g, ' '),
      flagged: r.flagged ? 'yes' : 'no',
      createdAt: r.createdAt?.toISOString() || '',
    }))
    const csv = toCSV(rows, ['id', 'userId', 'mangaId', 'rating', 'text', 'flagged', 'createdAt'])
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="reviews-export.csv"')
    res.send(csv)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router