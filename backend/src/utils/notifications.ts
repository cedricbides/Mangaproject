// backend/src/utils/notifications.ts
// REPLACE the existing file entirely with this version.
// Changes: notifyUser + notifyUsers now also fire web-push to all
// stored subscriptions for each target user.

import webpush from 'web-push'
import Notification from '../models/Notification'
import User from '../models/User'

// ─── VAPID Setup ──────────────────────────────────────────────────────────────
// Run once to generate keys:  npx web-push generate-vapid-keys
// Then add to backend/.env:
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
//   VAPID_MAILTO=mailto:you@example.com

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@mangaverse.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// ─── Internal push helper ─────────────────────────────────────────────────────

interface PushPayload {
  title: string
  body: string
  link?: string
  icon?: string
}

async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!process.env.VAPID_PUBLIC_KEY) return   // push not configured, skip silently

  try {
    const user = await User.findById(userId).select('pushSubscriptions').lean()
    if (!user?.pushSubscriptions?.length) return

    const message = JSON.stringify({
      title: payload.title,
      body:  payload.body,
      link:  payload.link || '/',
      icon:  payload.icon || '/icon-192.png',
    })

    const sends = user.pushSubscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          message
        )
      } catch (err: any) {
        // 410 Gone = subscription expired/revoked — clean it up
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

// ─── USER NOTIFICATIONS ───────────────────────────────────────────────────────

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
    await sendPushToUser(opts.userId, {
      title: opts.title,
      body:  opts.body,
      link:  opts.link,
    })
  } catch (err) {
    console.error('[notifications] notifyUser error:', err)
  }
}

// Notify multiple users at once (e.g. all followers of a manga)
export async function notifyUsers(userIds: string[], opts: Omit<UserNotifOptions, 'userId'>) {
  if (!userIds.length) return
  try {
    await Notification.insertMany(
      userIds.map(userId => ({ audience: 'user', userId, ...opts }))
    )
    await sendPushToUsers(userIds, {
      title: opts.title,
      body:  opts.body,
      link:  opts.link,
    })
  } catch (err) {
    console.error('[notifications] notifyUsers error:', err)
  }
}

// ─── ADMIN NOTIFICATIONS ──────────────────────────────────────────────────────

interface AdminNotifOptions {
  type: 'new_report' | 'new_request' | 'new_user' | 'chapter_published' | 'system'
  title: string
  body: string
  link?: string
}

export async function notifyAdmin(opts: AdminNotifOptions) {
  try {
    await Notification.create({ audience: 'admin', ...opts })

    // Push to all admin + superadmin users
    const admins = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      'pushSubscriptions.0': { $exists: true },
    }).select('_id pushSubscriptions').lean()

    await Promise.allSettled(
      admins.map(a => sendPushToUser(String(a._id), {
        title: opts.title,
        body:  opts.body,
        link:  opts.link,
      }))
    )
  } catch (err) {
    console.error('[notifications] notifyAdmin error:', err)
  }
}