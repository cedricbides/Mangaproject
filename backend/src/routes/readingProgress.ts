import { Router, Request, Response } from 'express'
import User from '../models/User'
import { requireAuth } from '../middleware/auth'
import type { IUser } from '../models/User'

const router = Router()

// Keep only the most recent entry per manga to clean old duplicates.
function deduplicateHistory(history: any[]): any[] {
  const byManga = new Map<string, any>()
  for (const h of history) {
    const existing = byManga.get(h.mangaId)
    if (!existing || new Date(h.updatedAt) > new Date(existing.updatedAt)) {
      byManga.set(h.mangaId, h)
    }
  }
  return [...byManga.values()]
}

// Fetch full reading history. Auto-cleans duplicate entries left over from old data.
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const u    = req.user as IUser
    const user = await User.findById(u.id).select('readingHistory').lean() as any
    if (!user) return res.status(404).json({ error: 'User not found' })

    const history = user.readingHistory || []
    const deduped = deduplicateHistory(history)

    if (deduped.length < history.length) {
      await User.updateOne({ _id: u.id }, { $set: { readingHistory: deduped } })
    }

    res.json({ readingHistory: deduped })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/:mangaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const u    = req.user as IUser
    const user = await User.findById(u.id).select('readingHistory').lean() as any
    if (!user) return res.status(404).json({ error: 'User not found' })
    const history = (user.readingHistory || []).filter((h: any) => h.mangaId === req.params.mangaId)
    res.json({ history })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Upsert reading progress. Keep a single latest entry per manga.
router.patch('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const u = req.user as IUser
    const { mangaId, chapterId, page, isLocal } = req.body

    if (!mangaId || !chapterId || page === undefined) {
      return res.status(400).json({ error: 'mangaId, chapterId, and page are required' })
    }

    const userDoc = await User.findById(u.id).select('readingHistory')
    if (!userDoc) return res.status(404).json({ error: 'User not found' })

    const allEntries   = userDoc.readingHistory || []
    const mangaEntries = allEntries.filter((h: any) => h.mangaId === mangaId)

    if (mangaEntries.length > 1) {
      // Old data could have duplicates per manga; clean and re-add the latest.
      await User.updateOne({ _id: u.id }, { $pull: { readingHistory: { mangaId } } })
      await User.updateOne(
        { _id: u.id },
        { $push: { readingHistory: { mangaId, chapterId, page, isLocal: isLocal ?? false, updatedAt: new Date() } } }
      )
    } else if (mangaEntries.length === 1) {
      await User.updateOne(
        { _id: u.id, 'readingHistory.mangaId': mangaId },
        {
          $set: {
            'readingHistory.$.chapterId': chapterId,
            'readingHistory.$.page':      page,
            'readingHistory.$.isLocal':   isLocal ?? false,
            'readingHistory.$.updatedAt': new Date(),
          },
        }
      )
    } else {
      await User.updateOne(
        { _id: u.id },
        { $push: { readingHistory: { mangaId, chapterId, page, isLocal: isLocal ?? false, updatedAt: new Date() } } }
      )
    }

    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/:mangaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const u = req.user as IUser
    await User.updateOne({ _id: u.id }, { $pull: { readingHistory: { mangaId: req.params.mangaId } } })
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router