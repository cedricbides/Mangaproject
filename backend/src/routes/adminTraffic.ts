import { Router, Request, Response } from 'express'
import RequestLog from '../models/RequestLog'
import User from '../models/User'
import { requirePermission } from '../middleware/auth'

const router = Router()
router.use(requirePermission('tools.traffic'))

const HOUR = 60 * 60 * 1000
const cond = (test: any) => ({ $sum: { $cond: [test, 1, 0] } })
const isBlocked = { $in: ['$status', [401, 403, 429]] }

// GET /api/admin/traffic/summary?hours=24
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const hours = Math.min(Math.max(parseInt(req.query.hours as string) || 24, 1), 168)
    const since = new Date(Date.now() - hours * HOUR)

    const [r] = await RequestLog.aggregate([
      { $match: { ts: { $gte: since } } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                s401: cond({ $eq: ['$status', 401] }),
                s403: cond({ $eq: ['$status', 403] }),
                s429: cond({ $eq: ['$status', 429] }),
                s5xx: cond({ $gte: ['$status', 500] }),
                ips: { $addToSet: '$ip' },
                users: { $addToSet: '$userId' },
              },
            },
            {
              $project: {
                _id: 0, total: 1, s401: 1, s403: 1, s429: 1, s5xx: 1,
                uniqueIps: { $size: '$ips' },
                uniqueUsers: { $size: { $setDifference: ['$users', [null]] } },
              },
            },
          ],
          hourly: [
            {
              $group: {
                _id: { $subtract: ['$ts', { $mod: [{ $toLong: '$ts' }, HOUR] }] },
                total: { $sum: 1 },
                blocked: cond(isBlocked),
                authed: cond({ $ne: [{ $ifNull: ['$userId', null] }, null] }),
              },
            },
            { $sort: { _id: 1 } },
          ],
          topIps: [
            {
              $group: {
                _id: '$ip',
                count: { $sum: 1 },
                blocked: cond(isBlocked),
                accounts: { $addToSet: '$userId' },
                last: { $max: '$ts' },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 15 },
            {
              $project: {
                _id: 0, ip: '$_id', count: 1, blocked: 1, last: 1,
                accounts: { $size: { $setDifference: ['$accounts', [null]] } },
              },
            },
          ],
          topAgents: [
            { $group: { _id: '$ua', count: { $sum: 1 }, blocked: cond(isBlocked) } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, ua: '$_id', count: 1, blocked: 1 } },
          ],
          topPaths: [
            { $group: { _id: '$path', count: { $sum: 1 }, blocked: cond(isBlocked) } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, path: '$_id', count: 1, blocked: 1 } },
          ],
          topAccounts: [
            { $match: { userId: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: '$userId',
                count: { $sum: 1 },
                ips: { $addToSet: '$ip' },
                last: { $max: '$ts' },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 15 },
            { $project: { _id: 0, userId: '$_id', count: 1, last: 1, ips: { $size: '$ips' } } },
          ],
        },
      },
    ])

    // Fill empty hours so the chart has no gaps
    const byHour = new Map<number, any>((r.hourly || []).map((h: any) => [new Date(h._id).getTime(), h]))
    const end = Math.floor(Date.now() / HOUR) * HOUR
    const hourly: { t: string; label: string; total: number; blocked: number; authed: number }[] = []
    for (let t = end - (hours - 1) * HOUR; t <= end; t += HOUR) {
      const h = byHour.get(t)
      const d = new Date(t)
      hourly.push({
        t: d.toISOString(),
        label: hours > 24
          ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}h`
          : `${String(d.getHours()).padStart(2, '0')}:00`,
        total: h?.total || 0,
        blocked: h?.blocked || 0,
        authed: h?.authed || 0,
      })
    }

    // Attach names / ban state to the top accounts
    const ids = (r.topAccounts || []).map((a: any) => a.userId)
    const users = ids.length
      ? await User.find({ _id: { $in: ids } }).select('name email banned').lean()
      : []
    const userMap = new Map<string, any>(users.map((u: any) => [String(u._id), u]))
    const topAccounts = (r.topAccounts || []).map((a: any) => {
      const u = userMap.get(String(a.userId))
      return { ...a, name: u?.name || '(deleted)', email: u?.email || '', banned: !!u?.banned }
    })

    res.json({
      hours,
      totals: r.totals[0] || { total: 0, s401: 0, s403: 0, s429: 0, s5xx: 0, uniqueIps: 0, uniqueUsers: 0 },
      hourly,
      topIps: r.topIps,
      topAgents: r.topAgents,
      topPaths: r.topPaths,
      topAccounts,
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// GET /api/admin/traffic/recent?blocked=1&limit=100  — raw feed, newest first
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 300)
    const filter: any = {}
    if (req.query.blocked === '1') filter.status = { $in: [401, 403, 429] }
    const rows = await RequestLog.find(filter).sort({ ts: -1 }).limit(limit).lean()
    res.json(rows)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
