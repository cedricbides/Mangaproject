// Usage (from your project root):  node apply-cleanup-traffic.js [path-to-Mangaproject]
//
// 1) First copy the 4 NEW files into your project (see the table in the chat).
// 2) Then run this script. It edits existing files, and "retires" unused ones by
//    renaming them to <name>.bak (nothing is hard-deleted).
// Safe to run twice. Makes a .bak copy of every file it edits.
const fs = require('fs')
const path = require('path')

const root = path.resolve(process.argv[2] || '.')
let problems = 0

function read(rel) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) return null
  const raw = fs.readFileSync(file, 'utf8')
  return { file, raw, crlf: raw.includes('\r\n'), text: raw.replace(/\r\n/g, '\n') }
}

function patch(rel, edits) {
  const f = read(rel)
  if (!f) { console.log(`MISSING  ${rel}`); problems++; return }
  let s = f.text
  let failed = false
  for (const [from, to, label] of edits) {
    if (to === '' ? !s.includes(from) : s.includes(to)) continue // already applied
    if (!s.includes(from)) { console.log(`  !! could not find: ${label}`); failed = true; continue }
    s = s.replace(from, to)
  }
  if (s === f.text) {
    console.log(`${failed ? 'FAILED ' : 'SKIPPED'}  ${rel}${failed ? '' : ' (already patched)'}`)
    if (failed) problems++
    return
  }
  fs.writeFileSync(f.file + '.bak', f.raw)
  fs.writeFileSync(f.file, f.crlf ? s.replace(/\n/g, '\r\n') : s)
  console.log(`PATCHED  ${rel}${failed ? '  (some edits failed, see above)' : ''}`)
  if (failed) problems++
}

function retire(rel) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) { console.log(`SKIPPED  ${rel} (already retired)`); return }
  fs.renameSync(file, file + '.bak')
  console.log(`RETIRED  ${rel}  ->  ${rel}.bak`)
}

// ── Check the new files are in place ────────────────────────────────────────
for (const rel of [
  'backend/src/models/RequestLog.ts',
  'backend/src/middleware/requestLogger.ts',
  'backend/src/routes/adminTraffic.ts',
  'frontend/src/components/admin/AdminTraffic.tsx',
]) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.log(`!! New file missing: ${rel}  (copy it in first, then run again)`)
    problems++
  }
}
if (problems) { console.log('\nStopping: copy the missing files first.'); process.exit(1) }

// ── backend/src/server.ts ───────────────────────────────────────────────────
patch('backend/src/server.ts', [
  [
    "import { requireAuth } from './middleware/auth'\n",
    "import { requireAuth } from './middleware/auth'\nimport { requestLogger } from './middleware/requestLogger'\nimport adminTrafficRoutes from './routes/adminTraffic'\n",
    'imports',
  ],
  // admin.ts duplicated social.ts and shadowed the moderation delete routes
  ["import adminRoutes from './routes/admin'\n", '', 'remove adminRoutes import'],
  ["app.use('/api/admin', adminRoutes)\n", '', 'remove adminRoutes mount'],
  [
    "app.use(compression())\n",
    "// Log every API request (buffered) so the admin Traffic tab can see bots\napp.use(requestLogger(clientIp))\n\napp.use(compression())\n",
    'mount requestLogger',
  ],
  // Must come BEFORE adminPermissionsRoutes, which applies requireSuperAdmin to everything after it
  [
    "app.use('/api/admin', adminActivityRoutes)\n",
    "app.use('/api/admin', adminActivityRoutes)\napp.use('/api/admin/traffic', adminTrafficRoutes)\n",
    'mount traffic routes',
  ],
  // Public debug endpoint that echoes request headers
  [
    "// Shows which IP the rate limiter sees for YOU (compare with your real public IP)\napp.get('/api/whoami-ip', (req, res) => {\n  res.json({\n    keyUsed: clientIp(req),\n    expressIp: req.ip,\n    hasCfConnectingIp: !!req.headers['cf-connecting-ip'],\n    hasTrueClientIp: !!req.headers['true-client-ip'],\n  })\n})\n",
    '',
    'remove /api/whoami-ip',
  ],
])

// ── backend/src/routes/adminPermissions.ts ──────────────────────────────────
patch('backend/src/routes/adminPermissions.ts', [
  ["  'tools.visitors',\n", "  'tools.visitors',\n  'tools.traffic',\n", "add 'tools.traffic' permission"],
])

// ── frontend/src/components/admin/AdminPermissionManager.tsx ────────────────
patch('frontend/src/components/admin/AdminPermissionManager.tsx', [
  [
    "      { key: 'tools.visitors',  label: 'Live Visitors',     desc: 'See who is online now' },\n",
    "      { key: 'tools.visitors',  label: 'Live Visitors',     desc: 'See who is online now' },\n      { key: 'tools.traffic',   label: 'Traffic Monitor',   desc: 'Server request log, bots, ban abusive accounts' },\n",
    'permission label',
  ],
])

// ── frontend/src/pages/Admin.tsx ────────────────────────────────────────────
patch('frontend/src/pages/Admin.tsx', [
  [
    "import AdminVisitorTracker from '@/components/admin/AdminVisitorTracker'\n",
    "import AdminVisitorTracker from '@/components/admin/AdminVisitorTracker'\nimport AdminTraffic from '@/components/admin/AdminTraffic'\n",
    'import AdminTraffic',
  ],
  [
    "'bulk' | 'scheduler' | 'visitors' | 'activity' | 'seo' | 'export' | 'backup'",
    "'bulk' | 'scheduler' | 'visitors' | 'traffic' | 'activity' | 'seo' | 'export' | 'backup'",
    'tool tab type',
  ],
  [
    "    { key: 'visitors',  label: '🟢 Live Visitors',     perm: 'tools.visitors'  },\n",
    "    { key: 'visitors',  label: '🟢 Live Visitors',     perm: 'tools.visitors'  },\n    { key: 'traffic',   label: '🛡 Traffic Monitor',   perm: 'tools.traffic'   },\n",
    'tool tab entry',
  ],
  [
    "        {toolTab === 'visitors'  && <AdminVisitorTracker />}\n",
    "        {toolTab === 'visitors'  && <AdminVisitorTracker />}\n        {toolTab === 'traffic'   && <AdminTraffic />}\n",
    'tool tab render',
  ],
])

// ── frontend/src/components/admin/AdminVisitorTracker.tsx (remove guest UI) ─
patch('frontend/src/components/admin/AdminVisitorTracker.tsx', [
  ["          { label: 'Guests', value: active?.guests ?? '—', icon: User, color: 'text-text-muted' },\n", '', 'remove Guests stat'],
  ['<div className="grid grid-cols-3 gap-3">', '<div className="grid grid-cols-2 gap-3">', 'stat grid 3 -> 2'],
  ["{v.username || 'Guest'}", "{v.username || 'User'}", 'Guest label'],
  ["import { Wifi, Users, UserCheck, User, RefreshCw, Monitor } from 'lucide-react'", "import { Wifi, UserCheck, RefreshCw, Monitor } from 'lucide-react'", 'unused icon imports'],
])

// ── frontend/src/App.tsx (one downloads page, not two) ──────────────────────
patch('frontend/src/App.tsx', [
  ["import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'", "import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'", 'import Navigate'],
  ["const MyDownloads     = lazy(() => import('@/pages/MyDownloads'))\n", '', 'remove MyDownloads import'],
  [
    '<Route path="/my-downloads"       element={<ProtectedRoute><Layout><MyDownloads /></Layout></ProtectedRoute>} />',
    '<Route path="/my-downloads"       element={<Navigate to="/downloads" replace />} />',
    'redirect /my-downloads',
  ],
])

// ── Retire unused / junk files ──────────────────────────────────────────────
retire('top')                                      // pasted grep output, not code
retire('frontend/src/pages/SearchModal.tsx')       // unused copy (Navbar uses components/SearchModal)
retire('frontend/src/pages/MyDownloads.tsx')       // replaced by Downloads.tsx
retire('backend/src/routes/admin.ts')              // duplicate of social.ts

console.log(problems
  ? '\nSome edits failed (see above). Send me the messages and I will adjust.'
  : '\nDone. Now run "npm run build" in backend/ and in frontend/.')
process.exitCode = problems ? 1 : 0
