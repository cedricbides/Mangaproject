import { Router, Request, Response } from 'express'
import LocalManga from '../models/LocalManga'

const router = Router()

// GET /api/search?q=...&limit=5
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim()
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20)

    if (!q || q.length < 1) return res.json({ local: [], query: q })

    const regex = new RegExp(q, 'i')

    const results = await LocalManga.find({
      $or: [
        { title: { $regex: regex } },
        { author: { $regex: regex } },
      ],
    })
      .select('title author coverUrl slug genres status')
      .limit(limit)
      .lean()

    res.json({
      local: results.map((m: any) => ({
        id: m._id.toString(),
        title: m.title,
        author: m.author || '',
        cover: m.coverUrl || '',
        slug: m.slug,
        genres: m.genres?.slice(0, 2) || [],
        status: m.status || '',
        source: 'local',
      })),
      query: q,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router