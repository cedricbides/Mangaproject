import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
// @ts-ignore
const { fileTypeFromBuffer } = require('file-type')
import { requireAdmin, requireAuth } from '../middleware/auth'

const router = Router()

const uploadsDir = path.join(__dirname, '../../public/uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname)
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// Validates the actual file bytes, not just the MIME type header.
// This prevents attackers from uploading malicious files with a spoofed content-type.
async function validateImageBytes(filePath: string): Promise<boolean> {
  const buffer = fs.readFileSync(filePath)
  const type   = await fileTypeFromBuffer(buffer)
  return !!type && ALLOWED_MIME_TYPES.includes(type.mime)
}

// Admin only: upload chapter pages (up to 50 at once)
router.post('/pages', requireAdmin, upload.array('pages', 50), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' })

    for (const file of files) {
      const valid = await validateImageBytes(file.path)
      if (!valid) {
        fs.unlinkSync(file.path)
        return res.status(400).json({ error: `File ${file.originalname} is not a valid image` })
      }
    }

    res.json({ urls: files.map(f => `/uploads/${f.filename}`) })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/pages/:filename', requireAdmin, (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename) // strip any directory traversal
    const filePath = path.join(uploadsDir, filename)

    // Double-check resolved path is still inside uploadsDir
    if (!filePath.startsWith(uploadsDir + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Any logged-in user: upload a single feed image
router.post('/image', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'No image provided' })

    const valid = await validateImageBytes(file.path)
    if (!valid) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'File is not a valid image' })
    }

    res.json({ url: `/uploads/${file.filename}` })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router