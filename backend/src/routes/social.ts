import { Router, Request, Response } from 'express'
import User from '../models/User'
import Review from '../models/Review'
import Comment from '../models/Comment'
import Report from '../models/Report'
import { notifyUser, notifyAdmin } from '../utils/notifications'
import { requireAuth } from '../middleware/auth'
import type { IUser, ReadingStatus } from '../models/User'

const router = Router()

// Reading list

router.get('/reading-list/:mangaId', requireAuth, async (req: Request, res: Response) => {
  const user = await User.findById((req.user as IUser).id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const entry = user.readingList?.find(r => r.mangaId === req.params.mangaId)
  res.json({ status: entry?.status || null })
})

router.post('/reading-list', requireAuth, async (req: Request, res: Response) => {
  const { mangaId, status } = req.body
  if (!mangaId) return res.status(400).json({ error: 'mangaId required' })

  const user = await User.findById((req.user as IUser).id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  if (!user.readingList) user.readingList = []
  const idx = user.readingList.findIndex(r => r.mangaId === mangaId)

  if (!status) {
    if (idx > -1) user.readingList.splice(idx, 1)
  } else if (idx > -1) {
    user.readingList[idx].status = status as ReadingStatus
    user.readingList[idx].updatedAt = new Date()
  } else {
    user.readingList.push({ mangaId, status: status as ReadingStatus, updatedAt: new Date() })
  }

  await user.save()
  res.json({ status: status || null, readingList: user.readingList })
})

router.get('/reading-list', requireAuth, async (req: Request, res: Response) => {
  const user = await User.findById((req.user as IUser).id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ readingList: user.readingList || [] })
})

// Reviews

router.get('/reviews/:mangaId', async (req: Request, res: Response) => {
  try {
    const reviews = await Review.find({ mangaId: req.params.mangaId })
      .sort({ createdAt: -1 })
      .limit(50)
    const avg = reviews.length
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null
    res.json({ reviews, avg, count: reviews.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/reviews/:mangaId/mine', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.user as IUser).id
  const review = await Review.findOne({ mangaId: req.params.mangaId, userId })
  res.json({ review: review || null })
})

router.post('/reviews/:mangaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rating, body } = req.body
    if (!rating || rating < 1 || rating > 10) return res.status(400).json({ error: 'Rating must be 1-10' })
    const user = req.user as IUser
    const review = await Review.findOneAndUpdate(
      { mangaId: req.params.mangaId, userId: user.id },
      {
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar || '',
        rating: Number(rating),
        body: body?.trim() || '',
      },
      { upsert: true, new: true }
    )
    res.json({ review })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/reviews/:mangaId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.user as IUser).id
  await Review.findOneAndDelete({ mangaId: req.params.mangaId, userId })
  res.json({ success: true })
})

// Comments

router.get('/comments/:chapterId', async (req: Request, res: Response) => {
  try {
    const comments = await Comment.find({ chapterId: req.params.chapterId })
      .sort({ createdAt: -1 })
      .limit(100)
    res.json({ comments })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/comments/:chapterId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { body, mangaId, parentId } = req.body
    if (!body?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' })
    if (body.length > 2000) return res.status(400).json({ error: 'Comment too long' })

    const user = req.user as IUser
    const comment = await Comment.create({
      chapterId: req.params.chapterId,
      mangaId: mangaId || '',
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar || '',
      body: body.trim(),
      parentId: parentId || null,
    })

    // Notify the parent comment's author when someone replies (not self-replies)
    if (parentId) {
      const parent = await Comment.findById(parentId)
      if (parent && parent.userId !== user.id) {
        notifyUser({
          userId: parent.userId,
          type: 'comment_reply',
          title: 'New Reply',
          body: `${user.name} replied to your comment: "${body.trim().slice(0, 80)}"`,
          link: mangaId ? `/manga/${mangaId}` : undefined,
        })
      }
    }

    res.status(201).json({ comment })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/comments/:commentId/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser
    const comment = await Comment.findById(req.params.commentId)
    if (!comment) return res.status(404).json({ error: 'Not found' })

    const alreadyLiked = comment.likes.includes(user.id)
    if (alreadyLiked) {
      comment.likes = comment.likes.filter((id: string) => id !== user.id)
    } else {
      comment.likes.push(user.id)
      if (comment.userId !== user.id) {
        notifyUser({
          userId: comment.userId,
          type: 'comment_reply',
          title: 'Someone liked your comment',
          body: `${user.name} liked your comment: "${comment.body.slice(0, 80)}"`,
          link: comment.mangaId ? `/manga/${comment.mangaId}` : undefined,
        })
      }
    }

    await comment.save()
    res.json({ liked: !alreadyLiked, likeCount: comment.likes.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser
    const comment = await Comment.findById(req.params.commentId)
    if (!comment) return res.status(404).json({ error: 'Not found' })
    if (comment.userId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await comment.deleteOne()
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Reports

router.post('/reports', requireAuth, async (req: Request, res: Response) => {
  try {
    const { targetType, targetId, reason } = req.body
    const reporter = req.user as IUser
    if (!['comment', 'review'].includes(targetType)) return res.status(400).json({ error: 'Invalid target type' })
    if (!reason?.trim()) return res.status(400).json({ error: 'Reason required' })

    const target: any = targetType === 'comment'
      ? await Comment.findById(targetId)
      : await Review.findById(targetId)
    if (!target) return res.status(404).json({ error: 'Target not found' })

    const report = await Report.create({
      targetType, targetId,
      targetBody:     target.body || '',
      targetUserId:   target.userId,
      targetUserName: target.userName,
      reportedBy:     String(reporter._id),
      reportedByName: reporter.name,
      reason:         reason.trim(),
    })

    notifyAdmin({
      type: 'new_report',
      title: 'New Content Report',
      body: `${reporter.name} reported a ${targetType}: "${reason.trim().slice(0, 80)}"`,
      link: '/admin?tab=moderation',
    })

    res.status(201).json(report)
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ error: 'You already reported this.' })
    res.status(500).json({ error: err.message })
  }
})

// Follow system

router.post('/follow/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const me = req.user as IUser
    const targetId = req.params.userId
    if (me.id === targetId) return res.status(400).json({ error: 'You cannot follow yourself' })

    const target = await User.findById(targetId)
    if (!target || target.banned) return res.status(404).json({ error: 'User not found' })

    const myUser = await User.findById(me.id)
    if (!myUser) return res.status(404).json({ error: 'User not found' })

    const alreadyFollowing = myUser.following.includes(targetId)
    if (alreadyFollowing) {
      myUser.following = myUser.following.filter(id => id !== targetId)
    } else {
      myUser.following.push(targetId)
    }
    await myUser.save()

    const followerCount = await User.countDocuments({ following: targetId })

    if (!alreadyFollowing) {
      notifyUser({
        userId: targetId,
        type: 'new_follower',
        title: 'New Follower',
        body: `${myUser.name} started following you.`,
        link: `/profile/${myUser.id}`,
      })
    }

    res.json({ following: !alreadyFollowing, followerCount })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/followers/:userId', async (req: Request, res: Response) => {
  try {
    const followers = await User.find({ following: req.params.userId })
      .select('_id name avatar role')
      .limit(100)
      .lean()
    res.json({ followers, count: followers.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/following/:userId', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.userId).select('following').lean() as any
    if (!user) return res.status(404).json({ error: 'User not found' })
    const following = await User.find({ _id: { $in: user.following } })
      .select('_id name avatar role')
      .limit(100)
      .lean()
    res.json({ following, count: following.length })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Manga watch (chapter notifications)

router.get('/watch/:mangaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById((req.user as IUser).id).select('watchedManga')
    if (!user) return res.status(404).json({ error: 'User not found' })
    const watching = (user.watchedManga || []).includes(req.params.mangaId)
    res.json({ watching })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/watch/:mangaId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById((req.user as IUser).id).select('watchedManga')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!user.watchedManga) user.watchedManga = []
    const idx = user.watchedManga.indexOf(req.params.mangaId)
    if (idx > -1) {
      user.watchedManga.splice(idx, 1)
    } else {
      user.watchedManga.push(req.params.mangaId)
    }
    await user.save()
    res.json({ watching: idx === -1 })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router