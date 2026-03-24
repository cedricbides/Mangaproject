import { Router, Request, Response } from 'express'

import User from '../models/User'
type IUser = import('../models/User').IUser


const router = Router()

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

// Toggle favorite manga
router.post('/toggle', requireAuth, async (req: Request, res: Response) => {
  const { mangaId } = req.body
  if (!mangaId) return res.status(400).json({ error: 'mangaId required' })

  const user = await User.findById((req.user as IUser).id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const idx = user.favorites.indexOf(mangaId)
  if (idx > -1) {
    user.favorites.splice(idx, 1)
  } else {
    user.favorites.push(mangaId)
  }

  await user.save()
  return res.json({ favorites: user.favorites })
})

// GET save count for a manga
router.get('/saves/:mangaId', async (req: Request, res: Response) => {
  try {
    const { mangaId } = req.params
    const count = await User.countDocuments({ favorites: mangaId })
    res.json({ count })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})


export default router