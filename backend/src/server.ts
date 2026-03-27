import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import compression from 'compression'
import cors from 'cors'
import helmet from 'helmet'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import mongoose from 'mongoose'
import path from 'path'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { doubleCsrf } from 'csrf-csrf'
import passport from 'passport'
import User from './models/User'
import { configurePassport } from './config/passport'
import { startScheduler } from './utils/scheduler'

import authRoutes from './routes/auth'
import searchRoutes from './routes/search'
import favRoutes from './routes/favorites'
import adminRoutes from './routes/admin'
import adminActivityRoutes from './routes/adminActivity'
import adminVisitorRoutes from './routes/adminVisitors'
import adminExportRoutes from './routes/adminExport'
import adminBackupRoutes from './routes/adminBackup'
import adminPermissionsRoutes from './routes/adminPermissions'
import localMangaRoutes from './routes/localManga'
import mangadexRoutes from './routes/mangadex'
import uploadRoutes from './routes/upload'
import proxyRoutes from './routes/proxy'
import socialRoutes from './routes/social'
import feedRoutes from './routes/feed'
import listsRoutes from './routes/lists'
import mangaRequestsRoutes from './routes/mangaRequests'
import notificationRoutes from './routes/notifications'
import readingProgressRoutes from './routes/readingProgress'
import translateRoutes from './routes/translate'
import pushRoutes = require('./routes/pushSubscription')

const app = express()
const PORT = process.env.PORT || 5000
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mangaverse'
const isDev = process.env.NODE_ENV !== 'production'

app.set('etag', false)
app.set('trust proxy', 1)

// Gzip responses to reduce JSON payload size.
app.use(compression())

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: [
        "'self'", 'data:',
        'https://uploads.mangadex.org',
        'https://*.mangadex.network',
        'https://meo.comick.pictures',
        'https://meo2.comick.pictures',
        'https://mangafire.to',
        'https://flagcdn.com',
      ],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: [
        "'self'",
        'https://api.mangadex.org',
        'http://localhost:3000',
        'http://localhost:5000',
      ],
    },
  },
}))

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')))

// Strip keys starting with $ or containing . from request body and query to prevent NoSQL injection
app.use((req, _res, next) => {
  function sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key]
      } else {
        obj[key] = sanitize(obj[key])
      }
    }
    return obj
  }
  if (req.body) req.body = sanitize(req.body)
  if (req.query) req.query = sanitize(req.query) as any
  next()
})

// Rate limiting; fully skipped in development.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please slow down' },
  skip: (req) => isDev || req.path.startsWith('/api/mangadex'),
}))
app.use('/api/auth/register', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 2,
  message: { error: 'Too many accounts created from this IP, try again in 1 hour' },
  skip: () => isDev,
}))
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again in 15 minutes' },
  skip: () => isDev,
}))
app.use('/api/auth/forgot-password', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password reset requests, try again in 1 hour' },
  skip: () => isDev,
}))
app.use('/api/auth/resend-verification', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many verification emails requested, try again in 1 hour' },
  skip: () => isDev,
}))

// CSRF protection using the double-submit cookie pattern.
// The frontend fetches /api/csrf-token on load and sends the token
// as the x-csrf-token header on every mutating request.
// doubleCsrfProtection is wired up but not applied globally yet.
// uncomment the app.use line below when the frontend is fully integrated.
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || 'dev_secret_change_me',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'lax' as const,
    secure: isDev ? false : true,
    httpOnly: true,
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
})

app.get('/api/csrf-token', (req, res) => {
  res.json({ token: generateToken(req, res) })
})

// app.use(doubleCsrfProtection) // enable once frontend sends the header on all mutations

// Session is stored in MongoDB so it survives server restarts.
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: {
    secure: isDev ? false : true,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}))

// Load the logged-in user from the session on every request.
// readingHistory and readingList are included because several routes
// read them directly off req.user rather than re-querying the DB.
app.use(async (req: any, _res, next) => {
  const userId = req.session?.userId
  if (!userId) return next()
  try {
    const user = await User.findById(userId)
      .select('name email avatar role adminPermissions banned bannedReason theme watchedManga following favorites readingHistory readingList')
      .lean() as any
    if (user && !user.banned) {
      user.id = user._id.toString()
      req.user = user
    } else {
      req.session.destroy(() => {})
    }
  } catch {}
  next()
})

configurePassport()
app.use(passport.initialize())
app.use(passport.session())

// Routes
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/favorites', favRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin', adminActivityRoutes)
app.use('/api/admin', adminPermissionsRoutes)
app.use('/api/admin/export', adminExportRoutes)
app.use('/api/admin/backup', adminBackupRoutes)
app.use('/api/visitors', adminVisitorRoutes)
app.use('/api/local-manga', localMangaRoutes)
app.use('/api/mangadex', mangadexRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/proxy', proxyRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/feed', feedRoutes)
app.use('/api/lists', listsRoutes)
app.use('/api/manga-requests', mangaRequestsRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/progress', readingProgressRoutes)
app.use('/api/push', pushRoutes)
app.use('/api/translate', translateRoutes)

// Connect to MongoDB then start the server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected')
    startScheduler()
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err)
    process.exit(1)
  })

export default app