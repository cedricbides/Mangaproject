import { Router, Request, Response } from 'express'
import passport from 'passport'
import crypto from 'crypto'
import User from '../models/User'
import type { IUser } from '../models/User'
import SiteSettings from '../models/SiteSettings'
import { notifyAdmin } from '../utils/notifications'
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email'

const router = Router()

function safeUser(user: any) {
  return {
    id: user.id || user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    favorites: user.favorites,
    adminPermissions: user.adminPermissions ?? [],
    emailVerified: user.emailVerified ?? false,
    readingHistory: user.readingHistory ?? [],
    theme: user.theme ?? 'dark',
  }
}

// REGISTER
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' })

    // Sanitize inputs
    const cleanName = name.trim().slice(0, 50).replace(/[<>]/g, '')
    const cleanEmail = email.trim().toLowerCase().slice(0, 100)

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) return res.status(400).json({ error: 'Invalid email address' })

    // Password strength
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
    if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one uppercase letter' })
    if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one number' })
    if (cleanName.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' })

    const userCount = await User.countDocuments()
    if (userCount > 0) {
      const settings = await SiteSettings.findOne()
      if (!(settings?.registrationOpen ?? true)) {
        return res.status(403).json({ error: 'Registration is currently closed. Please contact an administrator.' })
      }
    }

    const existing = await User.findOne({ email: cleanEmail })
    if (existing) return res.status(400).json({ error: 'Email already registered' })

    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const user = await User.create({
      name: cleanName, email: cleanEmail, password,
      role: 'user', // role must be set manually in DB — never auto-promote on register
      avatar: '',
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    })

    notifyAdmin({ type: 'new_user', title: 'New User Registered', body: `${cleanName} just created an account.`, link: '/admin' })

    try {
      await sendVerificationEmail(cleanEmail, cleanName, verificationToken)
    } catch (mailErr) {
      console.error('[auth] Verification email failed:', mailErr)
    }

    return res.status(201).json({ pendingVerification: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// VERIFY EMAIL
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Token required' })

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires')

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link. Please request a new one.' })

    user.emailVerified = true
    user.emailVerificationToken = undefined
    user.emailVerificationExpires = undefined
    await user.save()

    ;(req.session as any).userId = (user as any)._id.toString()
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session save failed' })
      res.json({ user: safeUser(user) })
    })
  } catch (err: any) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message })
  }
})

// RESEND VERIFICATION EMAIL
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    const user = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationExpires')
    if (!user || user.emailVerified) return res.json({ success: true })

    const token = crypto.randomBytes(32).toString('hex')
    user.emailVerificationToken = token
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await user.save()

    try { await sendVerificationEmail(user.email, user.name, token) }
    catch (mailErr) { console.error('[auth] Resend verification failed:', mailErr) }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message })
  }
})

// LOGIN
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = await User.findOne({ email }).select('+password +readingHistory')
    if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await user.comparePassword(password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        pendingVerification: true,
        email: user.email,
      })
    }

    if (user.banned) {
      return res.status(403).json({ error: "Your account has been banned. Please contact an administrator." })
    }

    // Shorter session for shared/public devices when rememberMe is false
    if (req.session) {
      req.session.cookie.maxAge = rememberMe
        ? 7 * 24 * 60 * 60 * 1000  // 7 days
        : 2 * 60 * 60 * 1000       // 2 hours
    }

    ;(req.session as any).userId = (user as any)._id.toString()
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Session save failed' })
      res.json({ user: safeUser(user) })
    })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// FORGOT PASSWORD
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    const user = await User.findOne({ email }).select('+password +passwordResetToken +passwordResetExpires')
    // Always return success to prevent email enumeration
    if (!user || !user.password) return res.json({ success: true })

    const token = crypto.randomBytes(32).toString('hex')
    user.passwordResetToken = token
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await user.save()

    try { await sendPasswordResetEmail(user.email, user.name, token) }
    catch (mailErr) { console.error('[auth] Password reset email failed:', mailErr) }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message })
  }
})

// RESET PASSWORD
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ error: 'Token and new password required' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password +passwordResetToken +passwordResetExpires')

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' })

    user.password = password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message })
  }
})

// ME
router.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null })
  const u = req.user as IUser
  const fresh = await User.findById(u.id).lean() as any
  return res.json({
    user: {
      id: u.id, name: u.name, email: u.email, avatar: u.avatar,
      bannerUrl: fresh?.bannerUrl ?? '',
      bio: fresh?.bio ?? '',
      postCount: fresh?.postCount ?? 0,
      role: u.role, favorites: u.favorites,
      adminPermissions: fresh?.adminPermissions ?? [],
      emailVerified: fresh?.emailVerified ?? false,
      readingHistory: fresh?.readingHistory ?? [],
      theme: fresh?.theme ?? 'dark',
    }
  })
})

// UPDATE PROFILE
router.patch('/profile', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  const u = req.user as IUser
  const { avatar, bannerUrl, bio, theme } = req.body
  const update: any = {}

  // ✅ Fix: only allow safe https:// URLs to prevent javascript: injection
  function isSafeUrl(val: unknown): boolean {
    if (typeof val !== 'string' || val === '') return true // empty string is allowed (to clear)
    try { return new URL(val).protocol === 'https:' } catch { return false }
  }

  if (typeof bio === 'string') update.bio = bio.slice(0, 300)
  if (typeof avatar === 'string') {
    if (!isSafeUrl(avatar)) return res.status(400).json({ error: 'Avatar must be a valid https:// URL' })
    update.avatar = avatar
  }
  if (typeof bannerUrl === 'string') {
    if (!isSafeUrl(bannerUrl)) return res.status(400).json({ error: 'Banner must be a valid https:// URL' })
    update.bannerUrl = bannerUrl
  }
  if (['dark', 'dim', 'light'].includes(theme)) update.theme = theme
  const updated = await User.findByIdAndUpdate(u.id, { $set: update }, { new: true }).lean() as any
  return res.json({
    user: {
      id: updated._id, name: updated.name, email: updated.email,
      avatar: updated.avatar, bannerUrl: updated.bannerUrl ?? '',
      bio: updated.bio ?? '', postCount: updated.postCount ?? 0,
      role: updated.role, favorites: updated.favorites,
      adminPermissions: updated.adminPermissions ?? [],
      emailVerified: updated.emailVerified ?? false,
      theme: updated.theme ?? 'dark',
    }
  })
})

// LOGOUT
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }))
})

// PUBLIC USER PROFILE
router.get('/user/:id', async (req: Request, res: Response) => {
  try {
    const target = await User.findById(req.params.id).select('-password -email -googleId -bannedReason')
    if (!target || target.banned) return res.status(404).json({ error: 'User not found' })

    const requester = req.user as IUser | undefined
    const isStaff = requester && ['moderator', 'admin', 'superadmin'].includes(requester.role)
    const followerCount = await User.countDocuments({ following: target.id })
    const isFollowing = requester ? !!(await User.findOne({ _id: requester.id, following: target.id })) : false

    const profile: any = {
      id: target.id, name: target.name, avatar: target.avatar,
      bannerUrl: target.bannerUrl, bio: target.bio, role: target.role,
      favorites: target.favorites, postCount: target.postCount,
      followingCount: (target as any).following?.length || 0,
      followerCount, isFollowing, createdAt: target.createdAt,
    }
    if (isStaff) {
      profile.readingHistory = target.readingHistory
      profile.readingList = target.readingList
    }
    res.json(profile)
  } catch (err: any) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message })
  }
})

// REGISTRATION STATUS
router.get('/registration-status', async (_req, res) => {
  try {
    const settings = await SiteSettings.findOne()
    res.json({ registrationOpen: settings?.registrationOpen ?? true })
  } catch { res.json({ registrationOpen: true }) }
})

// PUBLIC SITE SETTINGS
router.get('/site-settings', async (_req, res) => {
  try {
    const settings = await SiteSettings.findOne().lean()
    if (!settings) return res.json({
      announcementBanner: '', announcementBannerEnabled: false,
      maintenanceMode: false, maintenanceMessage: '', registrationOpen: true,
      bannerSlides: [], featuredPicks: [],
    })
    res.json({
      announcementBanner: settings.announcementBanner ?? '',
      announcementBannerEnabled: settings.announcementBannerEnabled ?? false,
      maintenanceMode: settings.maintenanceMode ?? false,
      maintenanceMessage: settings.maintenanceMessage ?? '',
      registrationOpen: settings.registrationOpen ?? true,
      // Expose read-only display data needed by the public home page
      bannerSlides: settings.bannerSlides ?? [],
      featuredPicks: settings.featuredPicks ?? [],
    })
  } catch (err: any) { res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message }) }
})

// GOOGLE OAUTH
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google_failed' }),
  (_req, res) => { res.redirect(process.env.CLIENT_URL || 'http://localhost:3000') }
)

export default router