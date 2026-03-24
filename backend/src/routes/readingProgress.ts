import { Router, Request, Response } from 'express'
import User from '../models/User'
import { requireAuth } from '../middleware/auth'
import type { IUser } from '../models/User'

const router = Router()

// Helper: deduplicate history keeping only latest entry per mangaId
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

// GET /api/progress — fetch reading history for logged-in user
// Auto-cleans duplicate entries (multiple chapters per manga) from old data
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const u = req.user as IUser
    const user = await User.findById(u.id).select('readingHistory').lean() as any
    if (!user) return res.status(404).json({ error: 'User not found' })

    const history: any[] = user.readingHistory || []
    const deduped = deduplicateHistory(history)

    // Silently fix old duplicate data in DB
    if (deduped.length < history.length) {
      await User.updateOne({ _id: u.id }, { $set: { readingHistory: deduped } })
    }

    res.json({ readingHistory: deduped })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/progress/:mangaId — fetch progress for a specific manga
router.get('/:mangaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const u = req.user as IUser
    const { mangaId } = req.params
    const user = await User.findById(u.id).select('readingHistory').lean() as any
    if (!user) return res.status(404).json({ error: 'User not found' })

    const history = (user.readingHistory || []).filter((h: any) => h.mangaId === mangaId)
    res.json({ history })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/progress — upsert reading progress
// One entry per manga — always stores the latest chapter read
// If reading chapter 2, it UPDATES the manga entry (doesn't add a new one)
router.patch('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const u = req.user as IUser
    const { mangaId, chapterId, page, isLocal } = req.body

    if (!mangaId || !chapterId || page === undefined) {
      return res.status(400).json({ error: 'mangaId, chapterId, and page are required' })
    }

    // First clean up any duplicates for this manga (from old data)
    const userDoc = await User.findById(u.id).select('readingHistory')
    if (!userDoc) return res.status(404).json({ error: 'User not found' })

    const allEntries = userDoc.readingHistory || []
    const mangaEntries = allEntries.filter((h: any) => h.mangaId === mangaId)

    if (mangaEntries.length > 1) {
      // Clean up: remove all entries for this manga, we'll re-add the correct one
      await User.updateOne(
        { _id: u.id },
        { $pull: { readingHistory: { mangaId } } }
      )
      // Re-add single entry with latest data
      await User.updateOne(
        { _id: u.id },
        {
          $push: {
            readingHistory: {
              mangaId,
              chapterId,
              page,
              isLocal: isLocal ?? false,
              updatedAt: new Date(),
            },
          },
        }
      )
    } else if (mangaEntries.length === 1) {
      // Update the single existing entry
      await User.updateOne(
        { _id: u.id, 'readingHistory.mangaId': mangaId },
        {
          $set: {
            'readingHistory.$.chapterId': chapterId,
            'readingHistory.$.page': page,
            'readingHistory.$.isLocal': isLocal ?? false,
            'readingHistory.$.updatedAt': new Date(),
          },
        }
      )
    } else {
      // No entry yet — create new
      await User.updateOne(
        { _id: u.id },
        {
          $push: {
            readingHistory: {
              mangaId,
              chapterId,
              page,
              isLocal: isLocal ?? false,
              updatedAt: new Date(),
            },
          },
        }
      )
    }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/progress/:mangaId — remove progress for a manga entirely
router.delete('/:mangaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const u = req.user as IUser
    const { mangaId } = req.params
    await User.updateOne(
      { _id: u.id },
      { $pull: { readingHistory: { mangaId } } }
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router