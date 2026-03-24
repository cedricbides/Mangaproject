import { Router, Request, Response } from 'express'
import LocalManga from '../models/LocalManga'
import LocalChapter from '../models/LocalChapter'
import TrackedMangaDex from '../models/TrackedMangaDex'
import MangaDexManualChapter from '../models/MangaDexManualChapter'
import SiteSettings from '../models/SiteSettings'
import AdminActivityLog from '../models/AdminActivityLog'
import { requireAdmin } from '../middleware/auth'

const router = Router()
router.use(requireAdmin)

// ── Backup: export all data as JSON ──────────────────────────────────────────
router.get('/export', async (req: Request, res: Response) => {
  try {
    const collections = (req.query.collections as string || 'all').split(',')
    const include = (name: string) => collections.includes('all') || collections.includes(name)

    const backup: Record<string, any> = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      collections: {},
    }

    if (include('localManga'))   backup.collections.localManga   = await LocalManga.find().lean()
    if (include('localChapters')) backup.collections.localChapters = await LocalChapter.find().lean()
    if (include('trackedMangaDex')) backup.collections.trackedMangaDex = await TrackedMangaDex.find().lean()
    if (include('mdxChapters'))  backup.collections.mdxChapters  = await MangaDexManualChapter.find().lean()
    if (include('siteSettings')) backup.collections.siteSettings = await SiteSettings.find().lean()

    const json = JSON.stringify(backup, null, 2)
    const filename = `mangaverse-backup-${new Date().toISOString().slice(0, 10)}.json`

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(json)

    // Log after sending (fire-and-forget)
    AdminActivityLog.create({
      adminId: (req.user as any)?.id || 'unknown',
      adminUsername: (req.user as any)?.username || 'admin',
      action: 'backup.export',
      category: 'backup',
      details: { collections, filename },
      ip: req.ip,
    }).catch(() => {})
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Restore: dry-run first (count what would change) ─────────────────────────
router.post('/restore/preview', async (req: Request, res: Response) => {
  try {
    const { data } = req.body
    if (!data?.collections) return res.status(400).json({ error: 'Invalid backup data' })
    if (data.version !== '1.0') return res.status(400).json({ error: `Unsupported backup version: ${data.version}` })

    const preview: Record<string, number> = {}
    for (const [key, docs] of Object.entries(data.collections)) {
      if (Array.isArray(docs)) preview[key] = (docs as any[]).length
    }
    res.json({ version: data.version, exportedAt: data.exportedAt, collections: preview })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// ── Restore: apply backup (DESTRUCTIVE - replaces data) ──────────────────────
router.post('/restore', async (req: Request, res: Response) => {
  try {
    const { data, collections } = req.body
    if (!data?.collections) return res.status(400).json({ error: 'Invalid backup data' })

    const toRestore: string[] = Array.isArray(collections) ? collections : Object.keys(data.collections)
    const results: Record<string, { deleted: number; inserted: number }> = {}

    for (const col of toRestore) {
      const docs = data.collections[col]
      if (!Array.isArray(docs)) continue

      try {
        switch (col) {
          case 'localManga': {
            const del = await LocalManga.deleteMany({})
            const ins = docs.length ? await LocalManga.insertMany(docs, { ordered: false }) : []
            results[col] = { deleted: del.deletedCount, inserted: (ins as any[]).length }
            break
          }
          case 'localChapters': {
            const del = await LocalChapter.deleteMany({})
            const ins = docs.length ? await LocalChapter.insertMany(docs, { ordered: false }) : []
            results[col] = { deleted: del.deletedCount, inserted: (ins as any[]).length }
            break
          }
          case 'trackedMangaDex': {
            const del = await TrackedMangaDex.deleteMany({})
            const ins = docs.length ? await TrackedMangaDex.insertMany(docs, { ordered: false }) : []
            results[col] = { deleted: del.deletedCount, inserted: (ins as any[]).length }
            break
          }
          case 'mdxChapters': {
            const del = await MangaDexManualChapter.deleteMany({})
            const ins = docs.length ? await MangaDexManualChapter.insertMany(docs, { ordered: false }) : []
            results[col] = { deleted: del.deletedCount, inserted: (ins as any[]).length }
            break
          }
          case 'siteSettings': {
            const del = await SiteSettings.deleteMany({})
            const ins = docs.length ? await SiteSettings.insertMany(docs, { ordered: false }) : []
            results[col] = { deleted: del.deletedCount, inserted: (ins as any[]).length }
            break
          }
        }
      } catch (e: any) {
        results[col] = { deleted: 0, inserted: 0 }
      }
    }

    await AdminActivityLog.create({
      adminId: (req.user as any)?.id || 'unknown',
      adminUsername: (req.user as any)?.username || 'admin',
      action: 'backup.restore',
      category: 'backup',
      details: { results },
      ip: req.ip,
    })

    res.json({ success: true, results })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router