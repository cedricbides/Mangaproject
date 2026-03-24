import { Router, Request, Response } from 'express'
import Post from '../models/Post'
import { notifyUser } from '../utils/notifications'

type IUser = import('../models/User').IUser

const router = Router()

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

const EMOJIS = ['❤️', '😂', '🔥', '😮', '👏', '😢']

// ─── GET feed (paginated) ─────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 0
    const limit = 20
    const filter = req.query.filter as string

    let query: any = {}

    if (filter === 'following' && req.user) {
      const user = req.user as any
      const following: string[] = user.following || []
      if (following.length === 0) {
        return res.json({ posts: [], total: 0, hasMore: false })
      }
      query = { userId: { $in: following } }
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit)
      .lean()
    const total = await Post.countDocuments(query)
    res.json({ posts, total, hasMore: (page + 1) * limit < total })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── CREATE post ──────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser
    const { body, imageUrl, linkUrl, linkTitle, linkDescription, linkImage, linkSource } = req.body
    if (!body?.trim() && !imageUrl && !linkUrl) {
      return res.status(400).json({ error: 'Post must have content' })
    }
    const post = await Post.create({
      userId:    user.id,
      userName:  user.name,
      userAvatar: user.avatar || '',
      body: body?.trim() || '',
      imageUrl, linkUrl, linkTitle, linkDescription, linkImage, linkSource,
      reactions: [],
      comments:  [],
    })
    res.status(201).json(post)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── DELETE post ──────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Post not found' })
    if (post.userId !== user.id && !['admin','superadmin'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await post.deleteOne()
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── REACT to post ────────────────────────────────────────────────────────────
router.post('/:id/react', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser
    const { emoji } = req.body
    if (!EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Invalid emoji' })

    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const existing = post.reactions.findIndex(r => r.userId === user.id)
    if (existing > -1) {
      if (post.reactions[existing].emoji === emoji) {
        // Remove reaction (toggle off)
        post.reactions.splice(existing, 1)
      } else {
        // Change reaction
        post.reactions[existing].emoji = emoji
      }
    } else {
      post.reactions.push({ userId: user.id, emoji })
    }

    await post.save()

    // Notify post author when someone reacts (not self-reactions)
    if (post.userId !== user.id && existing === -1) {
      notifyUser({
        userId: post.userId,
        type: 'comment_reply',
        title: 'New Reaction',
        body: `${user.name} reacted ${emoji} to your post.`,
        link: '/feed',
      })
    }

    res.json({ reactions: post.reactions })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── ADD comment ──────────────────────────────────────────────────────────────
router.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser
    const { body } = req.body
    if (!body?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' })
    if (body.length > 1000) return res.status(400).json({ error: 'Comment too long' })

    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    post.comments.push({
      userId:     user.id,
      userName:   user.name,
      userAvatar: user.avatar || '',
      body:       body.trim(),
      createdAt:  new Date(),
    } as any)

    await post.save()

    // Notify post author on new comment (not self-comments)
    if (post.userId !== user.id) {
      notifyUser({
        userId: post.userId,
        type: 'comment_reply',
        title: 'New Comment on Your Post',
        body: `${user.name} commented: "${body.trim().slice(0, 80)}"`,
        link: '/feed',
      })
    }

    res.json({ comments: post.comments })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
router.delete('/:id/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const idx = post.comments.findIndex(c => c._id.toString() === req.params.commentId)
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' })

    const comment = post.comments[idx]
    if (comment.userId !== user.id && !['admin','superadmin'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    post.comments.splice(idx, 1)
    await post.save()
    res.json({ comments: post.comments })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router