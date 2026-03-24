import { Router, Request, Response } from 'express'

import mongoose from 'mongoose'
import LocalManga from '../models/LocalManga'
import LocalChapter from '../models/LocalChapter'
import TrackedMangaDex from '../models/TrackedMangaDex'
import MangaDexManualChapter from '../models/MangaDexManualChapter'
import SiteSettings from '../models/SiteSettings'
import AdminActivityLog from '../models/AdminActivityLog'
import User from '../models/User'
import Comment from '../models/Comment'
import Review from '../models/Review'
import Report from '../models/Report'
import { requireAdmin, requireAuth, requirePermission, requireStaff } from '../middleware/auth'
import type { IUser } from '../models/User'
const router = Router()

// ─── Helper: generate unique slug ─────────────────────────────────────────────
async function generateSlug(title: string): Promise<string> {
  let base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `manga-${Date.now()}`
  let slug = base
  let n = 1
  while (await LocalManga.findOne({ slug })) {
    slug = `${base}-${n++}`
  }
  return slug
}

// ─── Helper: log admin action ──────────────────────────────────────────────────
async function logAction(
  req: Request,
  action: string,
  category: string,
  targetId?: string,
  targetLabel?: string,
  details?: any
) {
  try {
    const u = req.user as IUser
    await AdminActivityLog.create({
      adminId: u?.id || 'unknown',
      adminUsername: u?.name || 'admin',
      action, category, targetId, targetLabel, details,
      ip: req.ip,
    })
  } catch {}
}

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [userCount, mangaCount, chapterCount, mdxImportedChapters, manualChapters, comickChapters] = await Promise.all([
      User.countDocuments(),
      LocalManga.countDocuments(),
      LocalChapter.countDocuments(),
      MangaDexManualChapter.countDocuments({ source: 'mangadex' }),
      MangaDexManualChapter.countDocuments({ source: 'manual' }),
      MangaDexManualChapter.countDocuments({ source: 'comick' }),
    ])
    res.json({ userCount, mangaCount, chapterCount, mdxImportedChapters, manualChapters, comickChapters })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Manga CRUD ───────────────────────────────────────────────────────────────
router.get('/manga', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const list = await LocalManga.find().sort({ createdAt: -1 }).lean()
    res.json(list)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/manga', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, altTitle, coverUrl, description, genres, status, author, year, featured } = req.body
    if (!title) return res.status(400).json({ error: 'Title is required' })
    const slug = await generateSlug(title)
    const manga = await LocalManga.create({ title, altTitle, coverUrl, description, genres, status, author, year, featured, slug })
    await logAction(req, 'manga.create', 'manga', manga.id, manga.title)
    res.status(201).json(manga)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

router.put('/manga/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const manga = await LocalManga.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!manga) return res.status(404).json({ error: 'Manga not found' })
    await logAction(req, 'manga.update', 'manga', manga.id, manga.title)
    res.json(manga)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

router.delete('/manga/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const manga = await LocalManga.findByIdAndDelete(req.params.id)
    if (!manga) return res.status(404).json({ error: 'Manga not found' })
    await LocalChapter.deleteMany({ mangaId: req.params.id })
    await logAction(req, 'manga.delete', 'manga', req.params.id, manga.title)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Chapters ─────────────────────────────────────────────────────────────────
router.get('/manga/:id/chapters', requireAdmin, async (req: Request, res: Response) => {
  try {
    const chapters = await LocalChapter.find({ mangaId: req.params.id }).sort({ chapterNumber: 1 }).lean()
    res.json(chapters)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/manga/:id/chapters', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { chapterNumber, title, volume, pages, language, externalUrl, publishAt, draft } = req.body
    if (!chapterNumber) return res.status(400).json({ error: 'Chapter number is required' })
    const chapter = await LocalChapter.create({
      mangaId: req.params.id, chapterNumber, title, volume,
      pages: pages || [], language: language || 'en', externalUrl,
      draft: draft ?? (publishAt ? true : false),
      publishAt: publishAt ? new Date(publishAt) : null,
    })
    await logAction(req, 'chapter.create', 'chapter', chapter.id, `Ch.${chapterNumber}`, { mangaId: req.params.id })
    res.status(201).json(chapter)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

router.patch('/chapters/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { chapterNumber, title, volume, pages, externalUrl, publishAt, draft } = req.body
    const update: any = {}
    if (chapterNumber !== undefined) update.chapterNumber = chapterNumber
    if (title !== undefined) update.title = title
    if (volume !== undefined) update.volume = volume
    if (pages !== undefined) update.pages = pages
    if (externalUrl !== undefined) update.externalUrl = externalUrl || undefined
    if (draft !== undefined) update.draft = draft
    if (publishAt !== undefined) {
      if (publishAt) { update.publishAt = new Date(publishAt); update.draft = true }
      else { update.publishAt = null; update.draft = false }
    }
    const chapter = await LocalChapter.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' })
    await logAction(req, 'chapter.edit', 'chapter', req.params.id, `Ch.${chapter.chapterNumber}`)
    res.json(chapter)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

router.delete('/chapters/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const chapter = await LocalChapter.findByIdAndDelete(req.params.id)
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' })
    await logAction(req, 'chapter.delete', 'chapter', req.params.id, `Ch.${chapter.chapterNumber}`)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── MangaDex tracked chapters ────────────────────────────────────────────────
// ─── Get all MangaDex manga that have imported chapters ───────────────────────
router.get('/mangadex/imported-overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Aggregate: group MangaDexManualChapters by mangaDexId, get counts + chapter list
    const groups = await MangaDexManualChapter.aggregate([
      { $sort: { chapterNumber: 1 } },
      { $group: {
        _id: '$mangaDexId',
        chapters: { $push: { _id: '$_id', chapterNumber: '$chapterNumber', title: '$title', volume: '$volume', pages: '$pages', published: '$published', publishAt: '$publishAt', source: '$source', createdAt: '$createdAt', externalUrl: '$externalUrl', mdxChapterId: '$mdxChapterId' } },
        count: { $sum: 1 },
      }},
    ])
    // Enrich with TrackedMangaDex info where available
    const mangaDexIds = groups.map((g: any) => g._id)
    const tracked = await TrackedMangaDex.find({ mangaDexId: { $in: mangaDexIds } }).lean()
    const trackedMap: Record<string, any> = {}
    tracked.forEach((t: any) => { trackedMap[t.mangaDexId] = t })
    const result = groups.map((g: any) => ({
      mangaDexId: g._id,
      title: trackedMap[g._id]?.title || g._id,
      coverUrl: trackedMap[g._id]?.coverUrl || '',
      status: trackedMap[g._id]?.status || 'unknown',
      chapterCount: g.count,
      chapters: g.chapters,
    })).sort((a: any, b: any) => a.title.localeCompare(b.title))
    res.json(result)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/mangadex/:mangaDexId/chapters', requireAdmin, async (req: Request, res: Response) => {
  try {
    const chapters = await MangaDexManualChapter.find({ mangaDexId: req.params.mangaDexId }).sort({ chapterNumber: 1 }).lean()
    res.json(chapters)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Import chapters from MangaDex API into tracked chapters ──────────────────
router.post('/mangadex/:mangaDexId/import-from-mangadex', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { mangaDexId } = req.params
    const { sourceUrl, language = 'en', selectedIds } = req.body

    if (!sourceUrl || typeof sourceUrl !== 'string') {
      return res.status(400).json({ error: 'sourceUrl is required' })
    }
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one chapter.' })
    }

    // Extract the source manga UUID from the MangaDex URL
    const match = sourceUrl.match(/mangadex\.org\/title\/([a-f0-9-]{36})/i)
    if (!match) return res.status(400).json({ error: 'Invalid MangaDex URL' })
    const sourceMangaId = match[1]

    const axios = require('axios')
    const MDX = 'https://api.mangadex.org'

    // Fetch all chapters for this manga so we can look up the ones the user selected
    let allChapters: any[] = []
    let offset = 0
    while (true) {
      const r = await axios.get(`${MDX}/manga/${sourceMangaId}/feed`, {
        params: { limit: 96, offset, 'translatedLanguage[]': language, 'order[chapter]': 'asc', includeEmptyPages: 0 },
        headers: { 'User-Agent': 'MangaVerse/1.0' },
      })
      const data = r.data.data || []
      allChapters = allChapters.concat(data)
      if (allChapters.length >= r.data.total || data.length < 96) break
      offset += 96
    }

    // Filter to only the chapters the user selected
    const selectedSet = new Set(selectedIds)
    const toImport = allChapters.filter((c: any) => selectedSet.has(c.id))

    if (toImport.length === 0) {
      return res.status(400).json({ error: 'None of the selected chapters were found on MangaDex.' })
    }

    // Fetch pages for each chapter from the at-home server, then save
    const imported: any[] = []
    const skipped: string[] = []

    for (const chapter of toImport) {
      const chapterId = chapter.id
      const attrs = chapter.attributes

      // Skip if already imported (same mdxChapterId)
      const existing = await MangaDexManualChapter.findOne({ mangaDexId, mdxChapterId: chapterId })
      if (existing) { skipped.push(chapterId); continue }

      // Get page URLs from at-home server
      let pages: string[] = []
      try {
        const homeRes = await axios.get(`${MDX}/at-home/server/${chapterId}`, {
          headers: { 'User-Agent': 'MangaVerse/1.0' },
        })
        const { baseUrl, chapter: chData } = homeRes.data
        pages = (chData.data || []).map((f: string) => `${baseUrl}/data/${chData.hash}/${f}`)
      } catch {
        // If we can't get pages, still import with empty pages array
      }

      const doc = await MangaDexManualChapter.create({
        mangaDexId,
        mdxChapterId: chapterId,
        chapterNumber: attrs.chapter || '?',
        title: attrs.title || '',
        volume: attrs.volume || '',
        language: attrs.translatedLanguage || language,
        pages,
        source: 'mangadex',
        published: true,
        uploadedBy: (req.user as IUser)?.name || 'admin',
      })
      imported.push(doc)
    }

    await logAction(req, 'mangadex.import', 'chapter', mangaDexId, undefined, {
      imported: imported.length, skipped: skipped.length,
    })

    res.json({
      success: true,
      imported: imported.length,
      skipped: skipped.length,
      chapters: imported,
    })
  } catch (err: any) {
    console.error('[import-from-mangadex]', err.message)
    res.status(500).json({ error: err.response?.data?.errors?.[0]?.detail || err.message || 'Import failed.' })
  }
})

router.delete('/mangadex/chapters/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const chapter = await MangaDexManualChapter.findByIdAndDelete(req.params.id)
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' })
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.patch('/mangadex/chapters/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { externalUrl } = req.body
    const update: any = {}
    if (externalUrl !== undefined) update.externalUrl = externalUrl.trim() || undefined
    const chapter = await MangaDexManualChapter.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    )
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' })
    res.json(chapter)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/mangadex/bulk-action', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { action, ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' })
    if (action === 'delete') {
      await MangaDexManualChapter.deleteMany({ _id: { $in: ids } })
    }
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/users', requirePermission('users'), async (req: Request, res: Response) => {
  try {
    const page  = Math.max(0, parseInt(req.query.page  as string) || 0)
    const limit = Math.min(100, parseInt(req.query.limit as string) || 200)
    const users = await User.find()
      .select('-password -pushSubscriptions')
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit)
      .lean()
    // Return plain array for backward compat with Admin.tsx (setUsers(res.data))
    res.json(users)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/users/:id/activity', requirePermission('users'), async (req: Request, res: Response) => {
  try {
    const [reviews, comments] = await Promise.all([
      Review.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean(),
      Comment.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean(),
    ])
    res.json({ reviews, comments })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/users/:id/ban', requirePermission('users'), async (req: Request, res: Response) => {
  try {
    const { banned, reason } = req.body
    const update: any = { banned }
    if (banned) { update.bannedReason = reason || ''; update.bannedAt = new Date() }
    else { update.bannedReason = ''; update.bannedAt = null }
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    await logAction(req, banned ? 'user.ban' : 'user.unban', 'user', user.id, user.name, { reason })
    res.json(user)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/users/:id/role', requirePermission('users'), async (req: Request, res: Response) => {
  try {
    const { role } = req.body
    if (!['user', 'moderator', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    await logAction(req, 'user.role.change', 'user', user.id, user.name, { role })
    res.json(user)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      localMangaCount, mdxMangaCount, totalChapters,
      newUsersThisWeek, totalUsers,
      topLocal, topTracked,
      topSavedLocal,
      genreAgg, statusAgg,
      userGrowthRaw, activityRaw, dauRaw,
      mdxImportedChapters, manualChapters,
      totalComments30d, totalReviews30d, avgRating,
      mostCommented,
    ] = await Promise.all([
      LocalManga.countDocuments(),
      TrackedMangaDex.countDocuments(),
      LocalChapter.countDocuments(),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments(),
      LocalManga.find().sort({ views: -1 }).limit(8).select('title views saves coverUrl').lean(),
      TrackedMangaDex.find().sort({ views: -1 }).limit(8).select('title views coverUrl').lean(),
      LocalManga.find().sort({ saves: -1 }).limit(8).select('title saves coverUrl').lean(),
      LocalManga.aggregate([
        { $unwind: '$genres' },
        { $group: { _id: '$genres', value: { $sum: 1 } } },
        { $sort: { value: -1 } }, { $limit: 10 },
        { $project: { name: '$_id', value: 1, _id: 0 } },
      ]),
      LocalManga.aggregate([
        { $group: { _id: '$status', value: { $sum: 1 } } },
        { $project: { name: '$_id', value: 1, _id: 0 } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } },
      ]),
      AdminActivityLog.aggregate([
        { $match: { action: { $regex: /read|view/i }, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, reads: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', reads: 1, _id: 0 } },
      ]),
      AdminActivityLog.aggregate([
        { $match: { createdAt: { $gte: fourteenDaysAgo } } },
        { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, adminId: '$adminId' } } },
        { $group: { _id: '$_id.date', dau: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', dau: 1, _id: 0 } },
      ]),
      MangaDexManualChapter.countDocuments({ source: 'mangadex' }),
      MangaDexManualChapter.countDocuments({ source: 'manual' }),
      Comment.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Review.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Review.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, avg: { $avg: '$rating' } } },
      ]),
      Comment.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$mangaId', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 8 },
        { $project: { title: '$_id', count: 1, _id: 0 } },
      ]),
    ])

    const topManga = [
      ...topLocal.map(m => ({ title: (m.title ?? '').slice(0, 18), fullTitle: m.title ?? '', views: (m as any).views ?? 0, saves: (m as any).saves ?? 0, coverUrl: (m as any).coverUrl ?? '', source: 'local' })),
      ...topTracked.map(m => ({ title: (m.title ?? '').slice(0, 18), fullTitle: m.title ?? '', views: (m as any).views ?? 0, saves: 0, coverUrl: (m as any).coverUrl ?? '', source: 'mangadex' })),
    ].sort((a, b) => b.views - a.views).slice(0, 8)

    const topSaved = topSavedLocal.map(m => ({
      title: (m.title ?? '').slice(0, 18), fullTitle: m.title ?? '', saves: (m as any).saves ?? 0, coverUrl: (m as any).coverUrl ?? '',
    }))

    const totalViews = topManga.reduce((s, m) => s + m.views, 0)
    const totalSaves = topSaved.reduce((s, m) => s + m.saves, 0)
    const totalFavorites = await User.aggregate([{ $project: { count: { $size: { $ifNull: ['$favorites', []] } } } }, { $group: { _id: null, total: { $sum: '$count' } } }]).then(r => r[0]?.total || 0)

    // Simple retention: users who registered 30d ago and were seen again in last 7d
    const cohortUsers = await User.find({ createdAt: { $gte: thirtyDaysAgo, $lt: sevenDaysAgo } }).select('_id').lean()
    const cohortSize = cohortUsers.length
    let retentionRate: number | null = null
    if (cohortSize > 0) {
      const cohortIds = cohortUsers.map(u => u._id.toString())
      const returnedCount = await AdminActivityLog.distinct('adminId', {
        adminId: { $in: cohortIds },
        createdAt: { $gte: sevenDaysAgo },
      }).then(r => r.length)
      retentionRate = Math.round((returnedCount / cohortSize) * 100)
    }

    res.json({
      topManga, topSaved, mostCommented, genreData: genreAgg, statusData: statusAgg,
      userGrowthData: userGrowthRaw, activityData: activityRaw, dauData: dauRaw,
      summary: {
        totalViews, totalSaves, totalFavorites,
        newUsersThisWeek, totalManga: localMangaCount + mdxMangaCount,
        localMangaCount, mdxMangaCount, totalChapters,
        mdxImportedChapters, comickChapters: await MangaDexManualChapter.countDocuments({ source: 'comick' }), manualChapters,
        totalComments30d, totalReviews30d,
        avgRating30d: avgRating[0]?.avg != null ? Number(avgRating[0].avg).toFixed(1) : null,
        retentionRate, cohortSize,
      },
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Moderation ───────────────────────────────────────────────────────────────
router.get('/moderation/counts', requireStaff, async (_req: Request, res: Response) => {
  try {
    const [pendingReports, flaggedComments, flaggedReviews] = await Promise.all([
      Report.countDocuments({ status: 'pending' }),
      Comment.countDocuments({ flagged: true }),
      Review.countDocuments({ flagged: true }),
    ])
    res.json({ pendingReports, flaggedComments, flaggedReviews })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/moderation/reports', requirePermission('moderation'), async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'pending'
    const reports = await Report.find({ status }).sort({ createdAt: -1 }).lean()
    res.json(reports)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/moderation/reports/:id', requirePermission('moderation'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, resolvedAt: new Date() },
      { new: true }
    )
    if (!report) return res.status(404).json({ error: 'Report not found' })
    if (status === 'resolved') {
      if (report.targetType === 'comment') await Comment.findByIdAndDelete(report.targetId)
      if (report.targetType === 'review') await Review.findByIdAndDelete(report.targetId)
    }
    res.json(report)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/moderation/comments', requirePermission('moderation'), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 0
    const flagged = req.query.flagged === 'true'
    const filter = flagged ? { flagged: true } : {}
    const [comments, total] = await Promise.all([
      Comment.find(filter).sort({ createdAt: -1 }).skip(page * 30).limit(30).lean(),
      Comment.countDocuments(filter),
    ])
    res.json({ comments, total })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/moderation/comments/:id/flag', requirePermission('moderation'), async (req: Request, res: Response) => {
  try {
    const comment = await Comment.findByIdAndUpdate(req.params.id, { flagged: req.body.flagged }, { new: true })
    if (!comment) return res.status(404).json({ error: 'Comment not found' })
    res.json(comment)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/comments/:id', requirePermission('moderation'), async (req: Request, res: Response) => {
  try {
    await Comment.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/moderation/reviews', requirePermission('moderation'), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 0
    const flagged = req.query.flagged === 'true'
    const filter = flagged ? { flagged: true } : {}
    const [reviews, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(page * 30).limit(30).lean(),
      Review.countDocuments(filter),
    ])
    res.json({ reviews, total })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/moderation/reviews/:id/flag', requirePermission('moderation'), async (req: Request, res: Response) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { flagged: req.body.flagged }, { new: true })
    if (!review) return res.status(404).json({ error: 'Review not found' })
    res.json(review)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/reviews/:id', requirePermission('moderation'), async (req: Request, res: Response) => {
  try {
    await Review.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Site Settings ────────────────────────────────────────────────────────────
async function getOrCreateSettings() {
  let settings = await SiteSettings.findOne()
  if (!settings) settings = await SiteSettings.create({})
  return settings
}

router.get('/site-settings', requirePermission('site'), async (_req: Request, res: Response) => {
  try {
    res.json(await getOrCreateSettings())
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Public endpoint — only exposes what guests need to know (maintenance status)
// No auth required so the frontend can check it before the user logs in
router.get('/site-status', async (_req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings()
    res.json({
      maintenanceMode: !!settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage || 'We are down for maintenance. Check back soon.',
    })
  } catch { res.json({ maintenanceMode: false, maintenanceMessage: '' }) }
})

router.put('/site-settings/general', requirePermission('site'), async (req: Request, res: Response) => {
  try {
    const { maintenanceMode, maintenanceMessage, announcementBanner, announcementBannerEnabled, registrationOpen, defaultLanguage } = req.body
    const settings = await getOrCreateSettings()
    Object.assign(settings, { maintenanceMode, maintenanceMessage, announcementBanner, announcementBannerEnabled, registrationOpen, defaultLanguage })
    await settings.save()
    await logAction(req, 'site.settings.general', 'site')
    res.json(settings)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/site-settings/featured', requirePermission('site'), async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings()
    settings.featuredPicks = req.body.picks || []
    await settings.save()
    res.json(settings)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/site-settings/banner', requirePermission('site'), async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings()
    settings.bannerSlides = req.body.slides || []
    await settings.save()
    res.json(settings)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/site-settings/genres', requirePermission('site'), async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings()
    settings.genres = req.body.genres || []
    await settings.save()
    res.json(settings)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/site-settings/genres/rename', requirePermission('site'), async (req: Request, res: Response) => {
  try {
    const { oldName, newName } = req.body
    if (!oldName || !newName) return res.status(400).json({ error: 'oldName and newName required' })
    const settings = await getOrCreateSettings()
    settings.genres = settings.genres.map((g: string) => g === oldName ? newName : g)
    await settings.save()
    // Also update all manga
    await LocalManga.updateMany(
      { genres: oldName },
      { $set: { 'genres.$[elem]': newName } },
      { arrayFilters: [{ elem: { $eq: oldName } }] }
    )
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/site-settings/genres/:name', requirePermission('site'), async (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const settings = await getOrCreateSettings()
    settings.genres = settings.genres.filter((g: string) => g !== name)
    await settings.save()
    await LocalManga.updateMany({ genres: name }, { $pull: { genres: name } })
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── SEO ──────────────────────────────────────────────────────────────────────
router.get('/seo/manga', requirePermission('tools.seo'), async (_req: Request, res: Response) => {
  try {
    const manga = await LocalManga.find().select('title seoTitle seoDescription seoKeywords').lean()
    res.json(manga)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/seo/manga/:id', requirePermission('tools.seo'), async (req: Request, res: Response) => {
  try {
    const { seoTitle, seoDescription, seoKeywords } = req.body
    const manga = await LocalManga.findByIdAndUpdate(req.params.id, { seoTitle, seoDescription, seoKeywords }, { new: true })
    if (!manga) return res.status(404).json({ error: 'Manga not found' })
    res.json(manga)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.put('/seo/mangadex/:id', requirePermission('tools.seo'), async (req: Request, res: Response) => {
  try {
    const tracked = await TrackedMangaDex.findOneAndUpdate(
      { mangaDexId: req.params.id },
      { $set: req.body },
      { new: true }
    )
    if (!tracked) return res.status(404).json({ error: 'Not found' })
    res.json(tracked)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Activity Log ─────────────────────────────────────────────────────────────
router.get('/activity-log', requirePermission('tools.activity'), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 0
    const limit = 50
    const [logs, total] = await Promise.all([
      AdminActivityLog.find().sort({ createdAt: -1 }).skip(page * limit).limit(limit).lean(),
      AdminActivityLog.countDocuments(),
    ])
    res.json({ logs, total })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/activity-log', requirePermission('tools.activity'), async (_req: Request, res: Response) => {
  try {
    await AdminActivityLog.deleteMany({})
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Scheduled chapters ───────────────────────────────────────────────────────
router.get('/scheduler/chapters', requirePermission('tools.scheduler'), async (req: Request, res: Response) => {
  try {
    const source = (req.query.source as string) || 'local'
    const now = new Date()
    if (source === 'local') {
      const chapters = await LocalChapter.find({ publishAt: { $ne: null } }).sort({ publishAt: 1 }).lean()
      res.json(chapters)
    } else {
      const chapters = await MangaDexManualChapter.find({ publishAt: { $ne: null } }).sort({ publishAt: 1 }).lean()
      res.json(chapters)
    }
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Set or clear publishAt on a local chapter
router.put('/scheduler/chapters/local/:id', requirePermission('tools.scheduler'), async (req: Request, res: Response) => {
  try {
    const { publishAt } = req.body
    const update: any = publishAt
      ? { publishAt: new Date(publishAt), draft: true }
      : { publishAt: null, draft: false }
    const chapter = await LocalChapter.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' })
    await logAction(req, 'scheduler.set', 'chapter', chapter.id, `Ch.${chapter.chapterNumber}`, { publishAt })
    res.json(chapter)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// Set or clear publishAt on a MangaDex manual chapter
router.put('/scheduler/chapters/mdx/:id', requirePermission('tools.scheduler'), async (req: Request, res: Response) => {
  try {
    const { publishAt } = req.body
    const update: any = publishAt
      ? { publishAt: new Date(publishAt), published: false }
      : { publishAt: null, published: true }
    const chapter = await MangaDexManualChapter.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' })
    await logAction(req, 'scheduler.set', 'chapter', chapter.id, `Ch.${chapter.chapterNumber}`, { publishAt })
    res.json(chapter)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

router.post('/scheduler/publish-due', requirePermission('tools.scheduler'), async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const [local, mdx] = await Promise.all([
      LocalChapter.updateMany(
        { publishAt: { $lte: now, $ne: null }, draft: true },
        { $set: { draft: false, publishAt: null } }
      ),
      MangaDexManualChapter.updateMany(
        { published: false, publishAt: { $lte: now, $ne: null } },
        { $set: { published: true, publishAt: null } }
      ),
    ])
    res.json({ localPublished: local.modifiedCount, mdxPublished: mdx.modifiedCount })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Bulk manager ─────────────────────────────────────────────────────────────
router.post('/bulk/manga', requirePermission('tools.bulk'), async (req: Request, res: Response) => {
  try {
    const { action, ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' })

    if (action === 'delete') {
      await LocalManga.deleteMany({ _id: { $in: ids } })
      await LocalChapter.deleteMany({ mangaId: { $in: ids } })
    } else if (action === 'feature') {
      await LocalManga.updateMany({ _id: { $in: ids } }, { $set: { featured: true } })
    } else if (action === 'unfeature') {
      await LocalManga.updateMany({ _id: { $in: ids } }, { $set: { featured: false } })
    }

    await logAction(req, `bulk.manga.${action}`, 'manga', undefined, undefined, { ids, count: ids.length })
    res.json({ success: true, count: ids.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/bulk/manga/import', requirePermission('tools.bulk'), async (req: Request, res: Response) => {
  try {
    const { mangaDexIds } = req.body
    if (!Array.isArray(mangaDexIds)) return res.status(400).json({ error: 'mangaDexIds required' })
    // This just records the IDs as tracked — actual data comes from MangaDex API on the frontend
    const results = []
    for (const id of mangaDexIds) {
      const existing = await TrackedMangaDex.findOne({ mangaDexId: id })
      if (!existing) {
        results.push(id)
      }
    }
    res.json({ queued: results })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ─── Admins (permissions) - proxied through here for convenience ──────────────
router.get('/admins', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const admins = await User.find({ role: { $in: ['moderator', 'admin', 'superadmin'] } }).select('-password').sort({ role: -1, createdAt: 1 })
    res.json(admins)
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router