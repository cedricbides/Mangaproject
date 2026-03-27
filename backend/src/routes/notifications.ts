import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import Notification from '../models/Notification'

const router = Router()

router.get('/unread-count', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any
    const isAdmin = ['admin', 'superadmin'].includes(user.role)
    const count = isAdmin
      ? await Notification.countDocuments({ audience: 'admin', read: false })
      : await Notification.countDocuments({ audience: 'user', userId: user.id, read: false })
    res.json({ count })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Returns user's notifications. Staff also receive admin notifications.
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user  = req.user as any
    const page  = parseInt(req.query.page as string) || 0
    const limit = 20
    const isAdmin = ['admin', 'superadmin', 'moderator'].includes(user.role)

    const query = isAdmin
      ? { $or: [{ audience: 'user', userId: user.id }, { audience: 'admin' }] }
      : { audience: 'user', userId: user.id }

    const [notifications, total, unread] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(page * limit).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, read: false }),
    ])

    const tagged = notifications.map((n: any) => ({
      ...n,
      isAdminNotif: n.audience === 'admin',
    }))

    res.json({ notifications: tagged, total, unread, page, pages: Math.ceil(total / limit) })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/admin', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any
    if (!['admin', 'superadmin'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' })

    const page  = parseInt(req.query.page as string) || 0
    const limit = 20

    const [notifications, total, unread] = await Promise.all([
      Notification.find({ audience: 'admin' }).sort({ createdAt: -1 }).skip(page * limit).limit(limit).lean(),
      Notification.countDocuments({ audience: 'admin' }),
      Notification.countDocuments({ audience: 'admin', read: false }),
    ])

    res.json({ notifications, total, unread, page, pages: Math.ceil(total / limit) })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Mark one notification as read. Supports both PATCH and PUT for frontend compatibility.
async function markOneRead(req: Request, res: Response) {
  try {
    const user  = req.user as any
    const notif = await Notification.findById(req.params.id)
    if (!notif) return res.status(404).json({ error: 'Not found' })

    if (notif.audience === 'user' && notif.userId !== user.id)
      return res.status(403).json({ error: 'Forbidden' })
    if (notif.audience === 'admin' && !['admin', 'superadmin', 'moderator'].includes(user.role))
      return res.status(403).json({ error: 'Forbidden' })

    notif.read = true
    await notif.save()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
}

// Mark all notifications as read
async function markAllRead(req: Request, res: Response) {
  try {
    const user    = req.user as any
    const isAdmin = ['admin', 'superadmin', 'moderator'].includes(user.role)

    if (isAdmin) {
      await Notification.updateMany({ audience: 'admin', read: false }, { $set: { read: true } })
    }
    await Notification.updateMany(
      { audience: 'user', userId: user.id, read: false },
      { $set: { read: true } }
    )

    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
}

router.patch('/:id/read', requireAuth, markOneRead)
router.put('/:id/read',   requireAuth, markOneRead)
router.patch('/read-all', requireAuth, markAllRead)
router.put('/read-all',   requireAuth, markAllRead)

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user  = req.user as any
    const notif = await Notification.findById(req.params.id)
    if (!notif) return res.status(404).json({ error: 'Not found' })

    if (notif.audience === 'user' && notif.userId !== user.id)
      return res.status(403).json({ error: 'Forbidden' })
    if (notif.audience === 'admin' && !['admin', 'superadmin'].includes(user.role))
      return res.status(403).json({ error: 'Forbidden' })

    await notif.deleteOne()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user    = req.user as any
    const isAdmin = ['admin', 'superadmin'].includes(user.role)

    if (isAdmin) {
      await Notification.deleteMany({ audience: 'admin' })
    } else {
      await Notification.deleteMany({ audience: 'user', userId: user.id })
    }

    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router