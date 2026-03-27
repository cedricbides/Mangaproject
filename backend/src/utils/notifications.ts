import webpush from 'web-push'
import Notification from '../models/Notification'
import User from '../models/User'

// Set up VAPID credentials for web push.
// Generate keys with: npx web-push generate-vapid-keys
// Then add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT to your .env
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@mangaverse.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

interface PushPayload {
  title: string
  body: string
  link?: string
  icon?: string
}

// Sends a web push notification to all active subscriptions for a single user.
// Expired subscriptions (HTTP 410) are automatically removed from the database.
async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!process.env.VAPID_PUBLIC_KEY) return

  try {
    const user = await User.findById(userId).select('pushSubscriptions').lean()
    if (!user?.pushSubscriptions?.length) return

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      link: payload.link || '/',
      icon: payload.icon || '/icon-192.png',
    })

    const sends = user.pushSubscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, message)
      } catch (err: any) {
        if (err.statusCode === 410) {
          await User.updateOne(
            { _id: userId },
            { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } }
          )
        }
      }
    })

    await Promise.allSettled(sends)
  } catch (err) {
    console.error('[push] sendPushToUser error:', err)
  }
}

async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  await Promise.allSettled(userIds.map(id => sendPushToUser(id, payload)))
}

// User notifications

interface UserNotifOptions {
  userId: string
  type:
    | 'new_chapter'
    | 'new_follower'
    | 'comment_reply'
    | 'request_approved'
    | 'request_denied'
    | 'system'
  title: string
  body: string
  link?: string
}

export async function notifyUser(opts: UserNotifOptions) {
  try {
    await Notification.create({ audience: 'user', ...opts })
    await sendPushToUser(opts.userId, { title: opts.title, body: opts.body, link: opts.link })
  } catch (err) {
    console.error('[notifications] notifyUser error:', err)
  }
}

export async function notifyUsers(userIds: string[], opts: Omit<UserNotifOptions, 'userId'>) {
  if (!userIds.length) return
  try {
    await Notification.insertMany(userIds.map(userId => ({ audience: 'user', userId, ...opts })))
    await sendPushToUsers(userIds, { title: opts.title, body: opts.body, link: opts.link })
  } catch (err) {
    console.error('[notifications] notifyUsers error:', err)
  }
}

// Admin notifications

interface AdminNotifOptions {
  type: 'new_report' | 'new_request' | 'new_user' | 'chapter_published' | 'system'
  title: string
  body: string
  link?: string
}

export async function notifyAdmin(opts: AdminNotifOptions) {
  try {
    await Notification.create({ audience: 'admin', ...opts })

    const admins = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      'pushSubscriptions.0': { $exists: true },
    }).select('_id pushSubscriptions').lean()

    await Promise.allSettled(
      admins.map(a => sendPushToUser(String(a._id), { title: opts.title, body: opts.body, link: opts.link }))
    )
  } catch (err) {
    console.error('[notifications] notifyAdmin error:', err)
  }
}