import { Request, Response, NextFunction } from 'express'
import type { IUser } from '../models/User'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as IUser | undefined
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (!['admin', 'superadmin'].includes(user.role)) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as IUser | undefined
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Super admin access required' })
  }
  next()
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const user = req.user as IUser | undefined
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (!['moderator', 'admin', 'superadmin'].includes(user.role)) {
    return res.status(403).json({ error: 'Staff access required' })
  }
  next()
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IUser | undefined
    if (!user) return res.status(401).json({ error: 'Not authenticated' })

    // superadmin and admin always pass
    if (['admin', 'superadmin'].includes(user.role)) return next()

    // moderators need the specific permission
    const perms: string[] = (user as any).adminPermissions ?? []
    if (perms.includes(permission)) return next()

    return res.status(403).json({ error: 'Permission denied' })
  }
}