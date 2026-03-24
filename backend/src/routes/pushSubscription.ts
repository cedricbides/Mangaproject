// backend/src/routes/pushSubscription.ts
  // Handles saving/removing browser push subscriptions per user.

  import { Router, Request, Response } from 'express'
  import User from '../models/User'
  import { requireAuth } from '../middleware/auth'
  import { IUser } from '../models/User'

  const router = Router()

  // Return the VAPID public key so the frontend can subscribe
  router.get('/vapid-public-key', (_req: Request, res: Response) => {
    const key = process.env.VAPID_PUBLIC_KEY
    if (!key) return res.status(500).json({ error: 'Push notifications not configured' })
    res.json({ publicKey: key })
  })

  // Save a new push subscription for the logged-in user
  router.post('/subscribe', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as IUser).id
      const { endpoint, keys } = req.body

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Invalid subscription object' })
      }

      // Avoid duplicates — upsert by endpoint
      await User.updateOne(
        { _id: userId, 'pushSubscriptions.endpoint': { $ne: endpoint } },
        { $push: { pushSubscriptions: { endpoint, keys } } }
      )

      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Remove a push subscription (user unsubscribed or browser revoked)
  router.post('/unsubscribe', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as IUser).id
      const { endpoint } = req.body

      if (!endpoint) return res.status(400).json({ error: 'endpoint required' })

      await User.updateOne(
        { _id: userId },
        { $pull: { pushSubscriptions: { endpoint } } }
      )

      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  export = router