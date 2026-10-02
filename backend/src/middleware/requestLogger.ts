import { Request, Response, NextFunction } from 'express'
import RequestLog from '../models/RequestLog'

// Paths that would only add noise (or feed back on themselves)
const SKIP_PREFIXES = [
  '/api/health',
  '/api/csrf-token',
  '/api/visitors/heartbeat',
  '/api/admin/traffic',
]

// Collapse ids so "/api/mangadex/manga/abc-123" and ".../xyz-456" group together
function normalizePath(raw: string): string {
  return raw
    .split('?')[0]
    .replace(/[0-9a-f]{24}/gi, ':id')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .slice(0, 160)
}

// Writes are buffered and flushed in batches, so logging never means
// "one database write per request" (which would itself hurt during an attack).
const FLUSH_MS = 5000
const FLUSH_AT = 200
const MAX_BUFFER = 5000
let buffer: any[] = []

async function flush() {
  if (!buffer.length) return
  const batch = buffer
  buffer = []
  try {
    await RequestLog.insertMany(batch, { ordered: false })
  } catch (err: any) {
    console.error('[requestLogger] flush failed:', err.message)
  }
}
setInterval(flush, FLUSH_MS).unref()

export function requestLogger(getIp: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl || req.url
    if (!url.startsWith('/api') && !url.startsWith('/uploads')) return next()
    if (SKIP_PREFIXES.some(p => url.startsWith(p))) return next()

    const started = Date.now()
    res.on('finish', () => {
      // Drop logs instead of growing memory without limit
      if (buffer.length >= MAX_BUFFER) return
      buffer.push({
        ts:     new Date(),
        ip:     getIp(req),
        userId: (req.user as any)?.id,
        method: req.method,
        path:   normalizePath(url),
        status: res.statusCode,
        ua:     String(req.headers['user-agent'] || '').slice(0, 200),
        ms:     Date.now() - started,
      })
      if (buffer.length >= FLUSH_AT) void flush()
    })
    next()
  }
}
