import { Router, Request, Response } from 'express'
import VisitorSession from '../models/VisitorSession'
import { requireAdmin } from '../middleware/auth'

const router = Router()

// Called by the frontend heartbeat every 30s to track active visitors.
// No auth required; guest sessions are tracked too.
router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const { sessionId, page, pageTitle, referrer } = req.body
    if (!sessionId || !page) return res.status(400).json({ error: 'sessionId and page required' })

    const user      = req.user as any
    const ip        = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim()
    const userAgent = req.headers['user-agent'] || ''

    await VisitorSession.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          page, pageTitle, referrer,
          lastSeen: new Date(),
          ip, userAgent,
          userId:   user?.id,
          username: user?.name,
        },
      },
      { upsert: true, new: true }
    )
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Returns visitors active in the last 5 minutes with a page breakdown
router.get('/active', requireAdmin, async (_req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const visitors = await VisitorSession.find({ lastSeen: { $gte: fiveMinutesAgo } })
      .sort({ lastSeen: -1 })
      .limit(200)

    const total         = visitors.length
    const authenticated = visitors.filter(v => v.userId).length
    const guests        = total - authenticated

    const pageMap: Record<string, number> = {}
    visitors.forEach(v => { pageMap[v.page] = (pageMap[v.page] || 0) + 1 })
    const topPages = Object.entries(pageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, count]) => ({ page, count }))

    res.json({ total, authenticated, guests, visitors, topPages })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Returns visitor traffic bucketed by hour for the last 24 hours
router.get('/history', requireAdmin, async (_req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const sessions  = await VisitorSession.find({ createdAt: { $gte: oneDayAgo } }).select('createdAt userId')

    // Pre-fill all 24 hourly buckets so gaps show as zero
    const buckets: Record<string, { time: string; total: number; auth: number }> = {}
    for (let i = 23; i >= 0; i--) {
      const d   = new Date(Date.now() - i * 60 * 60 * 1000)
      const key = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      buckets[key] = { time: key, total: 0, auth: 0 }
    }

    sessions.forEach((s: any) => {
      const key = new Date(s.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      if (buckets[key]) {
        buckets[key].total++
        if (s.userId) buckets[key].auth++
      }
    })

    res.json(Object.values(buckets))
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router