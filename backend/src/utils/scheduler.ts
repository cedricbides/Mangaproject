import LocalChapter from '../models/LocalChapter'
import MangaDexManualChapter from '../models/MangaDexManualChapter'
import AdminActivityLog from '../models/AdminActivityLog'
import MangaRequest from '../models/MangaRequest'
import { notifyAdmin, notifyUser } from './notifications'

// Publishes any chapters whose scheduled publishAt time has passed.
// Runs every 60 seconds.
async function publishDueChapters() {
  const now = new Date()

  const [local, mdx] = await Promise.all([
    LocalChapter.updateMany(
      { draft: true, publishAt: { $lte: now, $ne: null } },
      { $set: { draft: false, publishAt: null } }
    ),
    MangaDexManualChapter.updateMany(
      { published: false, publishAt: { $lte: now, $ne: null } },
      { $set: { published: true, publishAt: null } }
    ),
  ])

  const total = local.modifiedCount + mdx.modifiedCount
  if (total === 0) return

  console.log(`[scheduler] Published ${local.modifiedCount} local + ${mdx.modifiedCount} MangaDex chapters`)

  AdminActivityLog.create({
    adminId: 'system',
    adminUsername: 'scheduler',
    action: 'scheduler.publish',
    category: 'chapter',
    details: { localPublished: local.modifiedCount, mdxPublished: mdx.modifiedCount },
  }).catch(() => {})

  notifyAdmin({
    type: 'chapter_published',
    title: 'Chapters Auto-Published',
    body: `Scheduler published ${local.modifiedCount} local + ${mdx.modifiedCount} MangaDex chapter(s).`,
    link: '/admin?tab=tools',
  })
}

// Deletes stale manga requests and warns users whose requests are about to expire.
// Pending requests expire after 14 days, denied/rejected after 3 days.
// Users get a warning notification at day 12 (2 days before expiry).
// Runs once every 24 hours.
async function cleanupStaleRequests() {
  const now = new Date()
  const pendingExpiry = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const deniedExpiry  = new Date(now.getTime() -  3 * 24 * 60 * 60 * 1000)
  const warnThreshold = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000)

  // Warn users whose requests are between day 12 and day 14 and haven't been warned yet
  const soonExpiring = await MangaRequest.find({
    status: 'pending',
    createdAt: { $lt: warnThreshold, $gt: pendingExpiry },
    warnedExpiry: { $ne: true },
  })

  for (const req of soonExpiring) {
    if (req.userId) {
      await notifyUser({
        userId: req.userId,
        type: 'system',
        title: 'Request Expiring Soon',
        body: `Your request for "${req.title}" will be auto-deleted in 2 days if still pending.`,
        link: '/requests',
      })
    }
    await MangaRequest.updateOne({ _id: req._id }, { warnedExpiry: true })
  }

  const [stalePending, staleDenied] = await Promise.all([
    MangaRequest.deleteMany({ status: 'pending', createdAt: { $lt: pendingExpiry } }),
    MangaRequest.deleteMany({ status: { $in: ['denied', 'rejected'] }, createdAt: { $lt: deniedExpiry } }),
  ])

  const total = stalePending.deletedCount + staleDenied.deletedCount
  if (total === 0) return

  console.log(`[scheduler] Cleaned up ${stalePending.deletedCount} stale pending + ${staleDenied.deletedCount} denied requests`)

  AdminActivityLog.create({
    adminId: 'system',
    adminUsername: 'scheduler',
    action: 'scheduler.cleanup',
    category: 'request',
    details: { pendingDeleted: stalePending.deletedCount, deniedDeleted: staleDenied.deletedCount },
  }).catch(() => {})

  notifyAdmin({
    type: 'system',
    title: 'Stale Requests Cleaned Up',
    body: `Auto-deleted ${stalePending.deletedCount} pending (14d) + ${staleDenied.deletedCount} denied (3d) requests.`,
    link: '/admin?tab=requests',
  })
}

export function startScheduler() {
  publishDueChapters().catch(() => {})
  setInterval(() => publishDueChapters().catch(() => {}), 60 * 1000)
  console.log('[scheduler] Auto-publish started (interval: 60s)')

  cleanupStaleRequests().catch(() => {})
  setInterval(() => cleanupStaleRequests().catch(() => {}), 24 * 60 * 60 * 1000)
  console.log('[scheduler] Stale request cleanup started (interval: 24h)')
}