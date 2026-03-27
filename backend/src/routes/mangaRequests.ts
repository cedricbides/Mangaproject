import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import MangaRequest from '../models/MangaRequest'
import { notifyAdmin, notifyUser } from '../utils/notifications'

const router = Router()

// Community request list sorted by upvotes.
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'pending'
    const page   = parseInt(req.query.page as string) || 0
    const limit  = 20
    const filter: any = {}
    if (status !== 'all') filter.status = status

    const [requests, total] = await Promise.all([
      MangaRequest.find(filter)
        .sort({ upvotes: -1, createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean(),
      MangaRequest.countDocuments(filter),
    ])
    res.json({ requests, total, page, pages: Math.ceil(total / limit) })
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

    const idx = request.upvotes.indexOf(user.id)
    if (idx === -1) {
      request.upvotes.push(user.id)
    } else {
      request.upvotes.splice(idx, 1)
    }
    await request.save()
    res.json({ upvotes: request.upvotes.length, upvoted: idx === -1 })
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
      MangaRequest.find(filter).sort({ upvotes: -1, createdAt: -1 }).skip(page * limit).limit(limit).lean(),
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