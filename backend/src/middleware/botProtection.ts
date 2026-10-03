// backend/src/middleware/botProtection.ts
// Needs Node 18+ (global fetch) and TURNSTILE_SECRET in backend/.env (and on Render)
import { Request, Response, NextFunction } from 'express'

function getToken(req: Request): string | undefined {
  const fromBody = req.body?.turnstileToken
  if (typeof fromBody === 'string' && fromBody) return fromBody
  const fromHeader = req.headers['x-turnstile-token']
  if (typeof fromHeader === 'string' && fromHeader) return fromHeader
  return undefined
}

/**
 * Cloudflare Turnstile verification.
 * Token comes from body.turnstileToken or the x-turnstile-token header.
 */
export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.TURNSTILE_SECRET

  // No secret configured: allow in dev, block in production
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[turnstile] TURNSTILE_SECRET is not set')
      return res.status(500).json({ error: 'Captcha not configured' })
    }
    return next()
  }

  const token = getToken(req)
  if (!token) return res.status(400).json({ error: 'Please complete the captcha' })

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: req.ip ?? '',
      }),
    })
    const data = (await r.json()) as { success: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      console.warn('[turnstile] failed:', data['error-codes'])
      return res.status(403).json({ error: 'Captcha failed, please try again' })
    }
    next()
  } catch (err) {
    console.error('[turnstile] error:', err)
    return res.status(502).json({ error: 'Captcha verification unavailable' })
  }
}

/**
 * Honeypot: hidden field `website` (body) or x-honeypot header that real users never fill.
 * Bots get a fake success so they don't adapt.
 */
export function honeypot(req: Request, res: Response, next: NextFunction) {
  const filled = req.body?.website || req.headers['x-honeypot']
  if (filled) return res.status(200).json({ ok: true })
  next()
}