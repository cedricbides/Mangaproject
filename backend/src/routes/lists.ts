import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import MangaList from '../models/Mangalist'

const router = Router()

// GET all public lists for a user (by userId) — public
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const lists = await MangaList.find({ userId: req.params.userId, isPublic: true })
      .sort({ createdAt: -1 })
    res.json(lists)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET all lists for the logged-in user (including private) — auth
router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id
    const lists = await MangaList.find({ userId }).sort({ createdAt: -1 })
    res.json(lists)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET single list by id — public if isPublic, else owner only
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const list = await MangaList.findById(req.params.id)
    if (!list) return res.status(404).json({ error: 'List not found' })
    const userId = (req.user as any)?.id
    if (!list.isPublic && list.userId !== userId)
      return res.status(403).json({ error: 'Private list' })
    res.json(list)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// POST create list — auth
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id
    const { name, description, isPublic } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
    const count = await MangaList.countDocuments({ userId })
    if (count >= 50) return res.status(400).json({ error: 'Maximum 50 lists allowed' })
    const list = await MangaList.create({
      userId,
      name: name.trim().slice(0, 100),
      description: description?.trim().slice(0, 500) || '',
      isPublic: isPublic !== false,
      mangaIds: [],
    })
    res.status(201).json(list)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// PATCH update list name/description/visibility — owner only
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id
    const list = await MangaList.findById(req.params.id)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (list.userId !== userId) return res.status(403).json({ error: 'Forbidden' })
    const { name, description, isPublic } = req.body
    if (name !== undefined) list.name = name.trim().slice(0, 100)
    if (description !== undefined) list.description = description.trim().slice(0, 500)
    if (isPublic !== undefined) list.isPublic = isPublic
    await list.save()
    res.json(list)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// DELETE list — owner only
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id
    const list = await MangaList.findById(req.params.id)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (list.userId !== userId) return res.status(403).json({ error: 'Forbidden' })
    await list.deleteOne()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// POST add manga to list — owner only
router.post('/:id/manga', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id
    const list = await MangaList.findById(req.params.id)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (list.userId !== userId) return res.status(403).json({ error: 'Forbidden' })
    const { mangaId } = req.body
    if (!mangaId) return res.status(400).json({ error: 'mangaId required' })
    if (!list.mangaIds.includes(mangaId)) {
      list.mangaIds.push(mangaId)
      await list.save()
    }
    res.json(list)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// DELETE remove manga from list — owner only
router.delete('/:id/manga/:mangaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id
    const list = await MangaList.findById(req.params.id)
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (list.userId !== userId) return res.status(403).json({ error: 'Forbidden' })
    list.mangaIds = list.mangaIds.filter(id => id !== req.params.mangaId)
    await list.save()
    res.json(list)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router