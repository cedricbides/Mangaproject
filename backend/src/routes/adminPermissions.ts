import { Router, Request, Response } from 'express'
import User from '../models/User'
import { requireSuperAdmin } from '../middleware/auth'
import AdminActivityLog from '../models/AdminActivityLog'

const router = Router()
router.use(requireSuperAdmin)

// All valid permission keys
export const ALL_PERMISSIONS = [
  'manga',
  'users',
  'analytics',
  'site',
  'moderation',
  'tools.visitors',
  'tools.bulk',
  'tools.scheduler',
  'tools.activity',
  'tools.seo',
  'tools.export',
  'tools.backup',
]

async function log(req: Request, action: string, targetId: string, targetLabel: string, details?: any) {
  try {
    const admin = req.user as any
    await AdminActivityLog.create({
      adminId: admin?.id || 'unknown',
      adminUsername: admin?.name || 'superadmin',
      action,
      category: 'user',
      targetId,
      targetLabel,
      details,
      ip: req.ip,
    })
  } catch { }
}

// ── List all staff (moderators + admins + superadmins) ────────────────────────
router.get('/admins', async (_req: Request, res: Response) => {
  try {
    const admins = await User.find({ role: { $in: ['moderator', 'admin', 'superadmin'] } })
      .select('-password')
      .sort({ role: -1, createdAt: 1 })
    res.json(admins)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Promote user → moderator ───────────────────────────────────────────────────
router.post('/promote-moderator/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.role === 'superadmin') return res.status(400).json({ error: 'Cannot modify a super admin' })

    user.role = 'moderator'
    user.adminPermissions = ['moderation']   // default: moderation only
    await user.save()

    await log(req, 'user.promote.moderator', user.id, user.name, { permissions: ['moderation'] })
    res.json(user)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Demote moderator → user ────────────────────────────────────────────────────
router.post('/demote-moderator/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.role !== 'moderator') return res.status(400).json({ error: 'User is not a moderator' })

    user.role = 'user'
    user.adminPermissions = []
    await user.save()

    await log(req, 'user.demote.moderator', user.id, user.name)
    res.json(user)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Promote user/moderator → admin ────────────────────────────────────────────
router.post('/promote/:id', async (req: Request, res: Response) => {
  try {
    const { permissions } = req.body
    const validPerms = Array.isArray(permissions)
      ? permissions.filter((p: string) => ALL_PERMISSIONS.includes(p))
      : []

    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.role === 'superadmin') return res.status(400).json({ error: 'Cannot modify a super admin' })

    user.role = 'admin'
    user.adminPermissions = validPerms
    await user.save()

    await log(req, 'user.promote.admin', user.id, user.name, { permissions: validPerms })
    res.json(user)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Demote admin → user ────────────────────────────────────────────────────────
router.post('/demote/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.role === 'superadmin') return res.status(400).json({ error: 'Cannot demote a super admin' })

    user.role = 'user'
    user.adminPermissions = []
    await user.save()

    await log(req, 'user.demote.user', user.id, user.name)
    res.json(user)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Update an admin's permissions ─────────────────────────────────────────────
router.put('/permissions/:id', async (req: Request, res: Response) => {
  try {
    const { permissions } = req.body
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions must be an array' })

    const validPerms = permissions.filter((p: string) => ALL_PERMISSIONS.includes(p))

    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.role === 'superadmin') return res.status(400).json({ error: 'Cannot restrict a super admin' })
    if (user.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' })

    user.adminPermissions = validPerms
    await user.save()

    await log(req, 'user.permissions.update', user.id, user.name, { permissions: validPerms })
    res.json(user)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Promote admin → superadmin ────────────────────────────────────────────────
router.post('/promote-super/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })

    user.role = 'superadmin'
    user.adminPermissions = []   // superadmin doesn't need explicit permissions
    await user.save()

    await log(req, 'user.promote.superadmin', user.id, user.name)
    res.json(user)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Get available permissions list ────────────────────────────────────────────
router.get('/permissions/list', async (_req, res) => {
  res.json(ALL_PERMISSIONS)
})

// ── Search non-staff users for promotion picker ────────────────────────────────
router.get('/promotable-users', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim()
    const filter: any = { role: 'user' }
    if (q) {
      filter.$or = [
        { name:  { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ]
    }
    const users = await User.find(filter)
      .select('_id name email avatar role')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    res.json(users)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router