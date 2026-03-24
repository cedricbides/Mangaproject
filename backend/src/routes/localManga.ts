import { Router, Request, Response } from 'express'
import mongoose from 'mongoose'

import LocalManga from '../models/LocalManga'
import LocalChapter from '../models/LocalChapter'
import MangaDexManualChapter from '../models/MangaDexManualChapter'

const router = Router()

// Get all local manga (public) — supports ?search=, ?limit=, ?genre=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, limit, genre } = req.query as Record<string, string>
    const filter: any = {}
    if (search?.trim()) filter.$or = [
      { title: { $regex: search.trim(), $options: 'i' } },
      { altTitle: { $regex: search.trim(), $options: 'i' } },
    ]
    if (genre?.trim()) filter.genres = genre.trim()
    const q = LocalManga.find(filter).sort({ updatedAt: -1 })
    if (limit) q.limit(parseInt(limit))
    const list = await q
    res.json(list)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get single chapter by ID — must be before /:slug
router.get('/chapter/:chapterId', async (req: Request, res: Response) => {
  const chapter = await LocalChapter.findById(req.params.chapterId).populate('mangaId')
  if (!chapter) return res.status(404).json({ error: 'Not found' })
  res.json(chapter)
})

// Get single MangaDex manual chapter by ID — must be before /:slug
router.get('/manual-chapter/:chapterId', async (req: Request, res: Response) => {
  const chapter = await MangaDexManualChapter.findById(req.params.chapterId)
  if (!chapter) return res.status(404).json({ error: 'Not found' })
  res.json(chapter)
})

// GET published manual chapters for a MangaDex manga (public)
router.get('/manual-chapters/:mangaDexId', async (req: Request, res: Response) => {
  try {
    const chapters = await MangaDexManualChapter
      .find({ mangaDexId: req.params.mangaDexId, published: true })
      .sort({ chapterNumber: 1 })
    res.json(chapters)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get single manga by slug or ID
router.get('/:slug', async (req: Request, res: Response) => {
  const param = req.params.slug
  const isObjectId = mongoose.Types.ObjectId.isValid(param)

  const query = isObjectId
    ? { $or: [{ slug: param }, { _id: param }] }
    : { slug: param }

  const manga = await LocalManga.findOneAndUpdate(
    query,
    { $inc: { views: 1 } },
    { new: true }
  ).catch(() => null)

  if (!manga) return res.status(404).json({ error: 'Not found' })
  res.json(manga)
})

// Get chapters for a manga
router.get('/:id/chapters', async (req: Request, res: Response) => {
  const chapters = await LocalChapter.find({ mangaId: req.params.id }).sort({ chapterNumber: 1 })
  res.json(chapters)
})

export default router