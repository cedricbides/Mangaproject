import { Router, Request, Response } from 'express'
import axios from 'axios'

const router = Router()

// Only allow requests to known manga CDN hosts.
// MangaDex uses rotating CDN subdomains so we check the suffix.
function isAllowedHost(hostname: string): boolean {
  return (
    hostname === 'uploads.mangadex.org' ||
    hostname === 'mangadex.org' ||
    hostname.endsWith('.mangadex.network') ||
    hostname === 'meo.comick.pictures' ||
    hostname.endsWith('.comick.pictures')
  )
}

// Block private/internal IP ranges to prevent SSRF attacks
function isPrivateHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.') ||
    hostname === '0.0.0.0' ||
    hostname.includes('169.254') // AWS metadata endpoint
  )
}

router.get('/image', async (req: Request, res: Response) => {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol' })
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  if (!isAllowedHost(parsed.hostname) || isPrivateHost(parsed.hostname)) {
    return res.status(403).json({ error: 'URL host not allowed' })
  }

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer':    `${parsed.protocol}//${parsed.hostname}/`,
        'Accept':     'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    const contentType = response.headers['content-type'] || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'URL does not point to an image' })
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
    res.setHeader('Access-Control-Allow-Origin', '*')
    response.data.pipe(res)
  } catch (err: any) {
    const status = err.response?.status || 500
    res.status(status).json({ error: `Failed to fetch image: ${err.message}` })
  }
})

export default router