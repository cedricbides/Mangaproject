import { Router, Request, Response } from 'express'
import axios from 'axios'
import { requireAuth } from '../middleware/auth'
import MangaRequest from '../models/MangaRequest'
import { notifyAdmin, notifyUser } from '../utils/notifications'

const router = Router()

// ── Vote-count helpers ───────────────────────────────────────────────────────
// Mongo sorts an array field by its contents (the user ids), not by its length,
// so we compute the vote count first and sort on that.
const VOTE_STAGES = [
  { $addFields: { voteCount: { $size: { $ifNull: ['$upvotes', []] } } } },
  { $sort: { voteCount: -1, createdAt: 1 } },   // ties: earliest request ranks higher
] as any[]

// ── MangaDex cover lookup for leaderboard thumbnails (24h in-memory cache) ───
const _coverCache = new Map<string, { url: string; exp: number }>()
const COVER_TTL = 24 * 60 * 60 * 1000
const MD_UUID = /mangadex\.org\/title\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

function extractMangaDexId(url?: string): string | null {
  const m = url ? MD_UUID.exec(url) : null
  return m ? m[1].toLowerCase() : null
}

async function resolveCovers(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const id of ids) {
    const hit = _coverCache.get(id)
    if (hit && hit.exp > Date.now()) out[id] = hit.url
    else missing.push(id)
  }
  if (missing.length) {
    try {
      const qs = missing.map(id => `ids[]=${id}`).join('&')
      const { data } = await axios.get(
        `https://api.mangadex.org/manga?${qs}&limit=${missing.length}&includes[]=cover_art`,
        { headers: { 'User-Agent': 'MangaVerse/1.0' }, timeout: 8000 },
      )
      for (const m of data?.data ?? []) {
        const file = m.relationships?.find((r: any) => r.type === 'cover_art')?.attributes?.fileName
        if (file) {
          const url = `https://uploads.mangadex.org/covers/${m.id}/${file}.256.jpg`
          _coverCache.set(m.id, { url, exp: Date.now() + COVER_TTL })
          out[m.id] = url
        }
      }
    } catch { /* covers are cosmetic - never fail the leaderboard over them */ }
  }
  return out
}

// Community request list sorted by upvotes.
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'pending'
    const page   = parseInt(req.query.page as string) || 0
    const limit  = 20
    const filter: any = {}
    if (status !== 'all') filter.status = status

    const [requests, total] = await Promise.all([
      MangaRequest.aggregate([
        { $match: filter },
        ...VOTE_STAGES,
        { $skip: page * limit },
        { $limit: limit },
      ]),
      MangaRequest.countDocuments(filter),
    ])
    res.json({ requests, total, page, pages: Math.ceil(total / limit) })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Top requests ranked by votes - this is what the community wants added next.
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const user  = req.user as any
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 25)
    const statuses = req.query.status === 'pending' ? ['pending'] : ['pending', 'approved']

    const [rows, agg] = await Promise.all([
      MangaRequest.aggregate([
        { $match: { status: { $in: statuses } } },
        ...VOTE_STAGES,
        { $limit: limit },
      ]),
      MangaRequest.aggregate([
        { $match: { status: { $in: statuses } } },
        { $group: { _id: null, totalVotes: { $sum: { $size: { $ifNull: ['$upvotes', []] } } }, totalRequests: { $sum: 1 } } },
      ]),
    ])

    const ids = rows.map((r: any) => extractMangaDexId(r.mangadexUrl)).filter(Boolean) as string[]
    const covers = ids.length ? await resolveCovers([...new Set(ids)]) : {}

    const leaderboard = rows.map((r: any, i: number) => {
      const mdId = extractMangaDexId(r.mangadexUrl)
      return {
        _id: r._id,
        rank: i + 1,
        title: r.title,
        alternativeTitles: r.alternativeTitles || '',
        status: r.status,
        votes: r.voteCount,
        voted: !!user && (r.upvotes || []).includes(user.id),   // never expose voter ids
        userName: r.userName,
        mangadexUrl: r.mangadexUrl || '',
        coverUrl: (mdId && covers[mdId]) || '',
        createdAt: r.createdAt,
      }
    })

    res.json({
      leaderboard,
      totalVotes: agg[0]?.totalVotes ?? 0,
      totalRequests: agg[0]?.totalRequests ?? 0,
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any
    const { title, alternativeTitles, mangadexUrl, notes } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' })

    // Cap at 3 pending requests per user to prevent spam
    const pending = await MangaRequest.countDocuments({ userId: user.id, status: 'pending' })
    if (pending >= 3) return res.status(400).json({ error: 'You already have 3 pending requests. Wait for them to be reviewed.' })

    // Prevent duplicate titles (case-insensitive)
    const dup = await MangaRequest.findOne({
      title:  { $regex: new RegExp(`^${title.trim()}$`, 'i') },
      status: { $in: ['pending', 'approved', 'added'] },
    })
    if (dup) return res.status(400).json({ error: 'This manga has already been requested.' })

    const request = await MangaRequest.create({
      userId:            user.id,
      userName:          user.name,
      userAvatar:        user.avatar || '',
      title:             title.trim().slice(0, 200),
      alternativeTitles: alternativeTitles?.trim().slice(0, 300) || '',
      mangadexUrl:       mangadexUrl?.trim().slice(0, 500) || '',
      notes:             notes?.trim().slice(0, 1000) || '',
      status:            'pending',
      upvotes:           [user.id],
    })

    notifyAdmin({
      type:  'new_request',
      title: 'New Manga Request',
      body:  `${user.name} requested "${title.trim().slice(0, 80)}"`,
      link:  '/admin?tab=requests',
    })

    res.status(201).json(request)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/:id/upvote', requireAuth, async (req: Request, res: Response) => {
  try {
    const user    = req.user as any
    const request = await MangaRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ error: 'Request not found' })
    if (request.status !== 'pending') return res.status(400).json({ error: 'Can only upvote pending requests' })

    // Atomic toggle so two quick clicks / two tabs can't lose or double-count a vote
    const hasVoted = request.upvotes.includes(user.id)
    const updated  = await MangaRequest.findByIdAndUpdate(
      request._id,
      hasVoted ? { $pull: { upvotes: user.id } } : { $addToSet: { upvotes: user.id } },
      { new: true },
    )
    res.json({ upvotes: updated?.upvotes.length ?? 0, upvoted: !hasVoted })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user    = req.user as any
    const request = await MangaRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ error: 'Not found' })
    if (request.userId !== user.id && !['admin', 'superadmin', 'moderator'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await request.deleteOne()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Admin routes

router.get('/admin/all', async (req: Request, res: Response) => {
  try {
    const user = req.user as any
    if (!user || !['admin', 'superadmin', 'moderator'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const status = req.query.status as string
    const page   = parseInt(req.query.page as string) || 0
    const limit  = 30
    const filter: any = {}
    if (status && status !== 'all') filter.status = status

    const [requests, total] = await Promise.all([
      MangaRequest.aggregate([{ $match: filter }, ...VOTE_STAGES, { $skip: page * limit }, { $limit: limit }]),
      MangaRequest.countDocuments(filter),
    ])

    const counts = await MangaRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    const statusCounts = counts.reduce((acc: any, c: any) => { acc[c._id] = c.count; return acc }, {})

    res.json({ requests, total, page, pages: Math.ceil(total / limit), statusCounts })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.patch('/admin/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any
    if (!user || !['admin', 'superadmin', 'moderator'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { status, adminNote } = req.body
    const request = await MangaRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ error: 'Not found' })

    if (status)            request.status    = status
    if (adminNote !== undefined) request.adminNote = adminNote.trim().slice(0, 500)
    await request.save()

    // Notify the requester if their request was approved or denied
    if (status && ['approved', 'added', 'denied', 'rejected'].includes(status) && request.userId) {
      const isApproved = ['approved', 'added'].includes(status)
      notifyUser({
        userId: request.userId,
        type:   isApproved ? 'request_approved' : 'request_denied',
        title:  isApproved ? 'Manga Request Approved!' : 'Manga Request Update',
        body:   isApproved
          ? `Your request for "${request.title}" has been approved.`
          : `Your request for "${request.title}" was not approved.${adminNote ? ` Note: ${adminNote.slice(0, 100)}` : ''}`,
        link: '/requests',
      })
    }

    res.json(request)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router