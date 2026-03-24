import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  Shield, ShieldCheck, ShieldOff, ChevronDown, ChevronUp,
  Check, Crown, UserX, AlertTriangle, ToggleLeft, ToggleRight,
  Sword, Search, Plus, ChevronRight
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface StaffUser {
  _id: string
  name: string
  email: string
  avatar?: string
  role: 'moderator' | 'admin' | 'superadmin'
  adminPermissions: string[]
  createdAt: string
}
interface RegularUser {
  _id: string
  name: string
  email: string
  avatar?: string
  role: 'user'
  createdAt: string
}

// ── Permission config ──────────────────────────────────────────────────────────
const PERMISSION_GROUPS = [
  {
    label: 'Main Tabs',
    perms: [
      { key: 'manga',      label: 'Manga Management', desc: 'Create, edit, delete manga' },
      { key: 'users',      label: 'User Management',  desc: 'View and manage users' },
      { key: 'analytics',  label: 'Analytics',        desc: 'View site analytics' },
      { key: 'site',       label: 'Site Settings',    desc: 'Manage site config, banners, genres' },
      { key: 'moderation', label: 'Moderation',       desc: 'Handle reports and flagged content' },
    ],
  },
  {
    label: 'Admin Tools',
    perms: [
      { key: 'tools.visitors',  label: 'Live Visitors',     desc: 'See who is online now' },
      { key: 'tools.bulk',      label: 'Bulk Manager',      desc: 'Bulk edit/delete/import manga' },
      { key: 'tools.scheduler', label: 'Chapter Scheduler', desc: 'Schedule chapter publish dates' },
      { key: 'tools.activity',  label: 'Activity Log',      desc: 'View admin action history' },
      { key: 'tools.seo',       label: 'SEO Editor',        desc: 'Edit per-manga SEO metadata' },
      { key: 'tools.export',    label: 'Export CSV',        desc: 'Download data as CSV' },
      { key: 'tools.backup',    label: 'Backup & Restore',  desc: 'Full database backup / restore' },
    ],
  },
]
const ALL_PERM_KEYS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key))

// ── Role display config ────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  superadmin: {
    label: 'Super Admin', icon: Crown,
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    ring: 'border-amber-500/25', dot: 'bg-amber-400',
  },
  admin: {
    label: 'Admin', icon: Shield,
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    ring: 'border-red-500/20', dot: 'bg-red-400',
  },
  moderator: {
    label: 'Moderator', icon: Sword,
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    ring: 'border-blue-500/20', dot: 'bg-blue-400',
  },
}

function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const [err, setErr] = useState(false)
  const colors = ['bg-primary','bg-purple-500','bg-blue-500','bg-green-500','bg-orange-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  if (!src || err)
    return <div className={`${color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
      style={{ width: size, height: size }}>{name.slice(0,2).toUpperCase()}</div>
  return <img src={src} onError={() => setErr(true)} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
}

// ── Staff Row ──────────────────────────────────────────────────────────────────
function StaffRow({
  member, isOpen, onToggle,
  pendingPerms, onTogglePerm, onGrantAll, onRevokeAll,
  onSave, saving, saved, hasPending,
  onDemote, onPromoteAdmin, onPromoteSuper,
}: any) {
  const cfg = ROLE_CONFIG[member.role as keyof typeof ROLE_CONFIG]
  const Icon = cfg.icon
  const isSuper = member.role === 'superadmin'
  const isMod = member.role === 'moderator'
  const perms: string[] = pendingPerms ?? member.adminPermissions

  return (
    <div className={`glass rounded-2xl overflow-hidden border transition-all ${cfg.ring}`}>
      {/* Row header */}
      <div className="flex items-center gap-3 p-4">
        <Avatar name={member.name} src={member.avatar} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text font-body">{member.name}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.badge}`}>
              <Icon size={9} /> {cfg.label}
            </span>
            {!isSuper && (
              <span className="text-[10px] text-text-muted font-body">{perms.length}/{ALL_PERM_KEYS.length} perms</span>
            )}
          </div>
          <p className="text-xs text-text-muted font-body mt-0.5">{member.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saved && <Check size={14} className="text-green-400" />}
          {hasPending && !saving && <span className="text-[10px] text-amber-400 font-mono">unsaved</span>}
          {!isSuper && (
            <button onClick={onToggle}
              className="p-1.5 glass rounded-lg text-text-muted hover:text-text transition-colors">
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {isOpen && !isSuper && (
        <div className="border-t border-white/5 p-4 space-y-4 bg-black/10">

          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted font-body">Quick:</span>
            <button onClick={onGrantAll}
              className="flex items-center gap-1 px-2.5 py-1 glass text-green-400 rounded-lg text-xs hover:bg-green-500/10 transition-colors">
              <ShieldCheck size={11} /> Grant All
            </button>
            <button onClick={onRevokeAll}
              className="flex items-center gap-1 px-2.5 py-1 glass text-red-400 rounded-lg text-xs hover:bg-red-500/10 transition-colors">
              <ShieldOff size={11} /> Revoke All
            </button>
          </div>

          {/* Permission groups */}
          {PERMISSION_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">{group.label}</p>
              <div className="space-y-1.5">
                {group.perms.map(p => {
                  const granted = perms.includes(p.key)
                  return (
                    <button key={p.key} onClick={() => onTogglePerm(p.key, perms)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                        granted ? 'bg-green-500/10 border border-green-500/20' : 'glass border border-transparent hover:border-white/10'
                      }`}>
                      {granted ? <ToggleRight size={18} className="text-green-400 flex-shrink-0" /> : <ToggleLeft size={18} className="text-text-muted/40 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-body ${granted ? 'text-text' : 'text-text-muted'}`}>{p.label}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{p.desc}</p>
                      </div>
                      <span className={`text-[10px] font-mono flex-shrink-0 ${granted ? 'text-green-400' : 'text-text-muted/30'}`}>
                        {granted ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
            <button onClick={onSave} disabled={saving || !hasPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm hover:bg-primary/80 disabled:opacity-40 transition-colors">
              {saving
                ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                : <Check size={13} />}
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>

            {/* Upgrade path */}
            {isMod && (
              <button onClick={onPromoteAdmin}
                className="flex items-center gap-1.5 px-3 py-2 glass text-red-400 rounded-xl text-sm hover:bg-red-500/10 transition-colors">
                <Shield size={13} /> Promote to Admin
              </button>
            )}
            {!isMod && (
              <button onClick={onPromoteSuper}
                className="flex items-center gap-1.5 px-3 py-2 glass text-amber-400 rounded-xl text-sm hover:bg-amber-500/10 transition-colors">
                <Crown size={13} /> Make Super Admin
              </button>
            )}

            {/* Demote */}
            <button onClick={onDemote}
              className="flex items-center gap-1.5 px-3 py-2 glass text-red-400 rounded-xl text-sm hover:bg-red-500/10 transition-colors ml-auto">
              <UserX size={13} /> {isMod ? 'Remove Moderator' : 'Demote to User'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Promote Panel (live search) ────────────────────────────────────────────────
function PromotePanel({ onPromote, onClose, targetRole }: {
  onPromote: (id: string, role: 'moderator' | 'admin') => void
  onClose: () => void
  targetRole: 'moderator' | 'admin'
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<RegularUser[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const cfg = targetRole === 'moderator' ? ROLE_CONFIG.moderator : ROLE_CONFIG.admin
  const Icon = cfg.icon
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqRef = useRef(0)
  const firstRun = useRef(true)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const delay = firstRun.current ? 0 : 300
    firstRun.current = false
    debounceRef.current = setTimeout(() => fetchUsers(search), delay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  async function fetchUsers(q: string) {
    const id = ++reqRef.current
    setLoadingSearch(true)
    try {
      const res = await axios.get(`/api/admin/promotable-users?q=${encodeURIComponent(q)}`, { withCredentials: true })
      if (id === reqRef.current) { setResults(res.data); setError('') }
    } catch (e: any) {
      if (id === reqRef.current) setError(e?.response?.data?.error || 'Failed to load users')
    } finally {
      if (id === reqRef.current) setLoadingSearch(false)
    }
  }

  async function handle(id: string) {
    setPromoting(id)
    await onPromote(id, targetRole)
    setPromoting(null)
  }

  return (
    <div className="glass rounded-2xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} className={targetRole === 'moderator' ? 'text-blue-400' : 'text-red-400'} />
          <span className="text-sm font-semibold text-text font-body">
            Promote user to {cfg.label}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 glass rounded-lg text-text-muted hover:text-text transition-colors">
          <ChevronUp size={14} />
        </button>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-text font-body outline-none focus:border-primary/40"
        />
        {loadingSearch && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 font-body px-1">{error}</p>
      )}

      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
        {!loadingSearch && results.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4 font-body">
            {search ? `No users matching "${search}"` : 'No regular users found'}
          </p>
        )}
        {results.map(u => (
          <div key={u._id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
            <Avatar name={u.name} src={u.avatar} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text font-body truncate">{u.name}</p>
              <p className="text-xs text-text-muted font-body truncate">{u.email}</p>
            </div>
            <button
              onClick={() => handle(u._id)}
              disabled={promoting === u._id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body transition-all disabled:opacity-40 ${
                targetRole === 'moderator'
                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              }`}>
              {promoting === u._id
                ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                : <><ChevronRight size={11} /> Promote</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Confirm Modal ──────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }: any) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-white/10">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-display text-text text-base">{title}</h4>
            <p className="text-sm text-text-muted mt-1 font-body">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} className={`flex-1 py-2 rounded-xl text-sm font-body transition-colors ${confirmClass}`}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="flex-1 py-2 glass text-text-muted rounded-xl text-sm font-body hover:text-text transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminPermissionManager() {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingPerms, setPendingPerms] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [showPromote, setShowPromote] = useState<'moderator' | 'admin' | null>(null)
  const [confirm, setConfirm] = useState<{ type: string; member: StaffUser } | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const staffRes = await axios.get('/api/admin/admins', { withCredentials: true })
      setStaff(staffRes.data)
    } catch {}
    setLoading(false)
  }

  function getPerms(m: StaffUser) { return pendingPerms[m._id] ?? m.adminPermissions }

  function togglePerm(memberId: string, perm: string, currentPerms: string[]) {
    const updated = currentPerms.includes(perm) ? currentPerms.filter(p => p !== perm) : [...currentPerms, perm]
    setPendingPerms(prev => ({ ...prev, [memberId]: updated }))
  }

  const hasPendingChanges = (m: StaffUser) =>
    pendingPerms[m._id] !== undefined &&
    JSON.stringify(pendingPerms[m._id].sort()) !== JSON.stringify(m.adminPermissions.sort())

  async function savePerms(member: StaffUser) {
    const perms = getPerms(member)
    setSaving(member._id)
    try {
      await axios.put(`/api/admin/permissions/${member._id}`, { permissions: perms }, { withCredentials: true })
      setSaved(member._id); setTimeout(() => setSaved(null), 2000)
      await load()
      setPendingPerms(prev => { const n = { ...prev }; delete n[member._id]; return n })
    } catch (e: any) { alert(e.response?.data?.error || e.message) }
    setSaving(null)
  }

  async function promoteUser(userId: string, role: 'moderator' | 'admin') {
    try {
      const endpoint = role === 'moderator' ? `/api/admin/promote-moderator/${userId}` : `/api/admin/promote/${userId}`
      await axios.post(endpoint, { permissions: role === 'admin' ? [] : ['moderation'] }, { withCredentials: true })
      setShowPromote(null)
      await load()
    } catch (e: any) { alert(e.response?.data?.error || e.message) }
  }

  async function executeConfirm() {
    if (!confirm) return
    const { type, member } = confirm
    try {
      if (type === 'demote') await axios.post(`/api/admin/demote/${member._id}`, {}, { withCredentials: true })
      if (type === 'demote-mod') await axios.post(`/api/admin/demote-moderator/${member._id}`, {}, { withCredentials: true })
      if (type === 'promote-super') await axios.post(`/api/admin/promote-super/${member._id}`, {}, { withCredentials: true })
      if (type === 'promote-admin') await axios.post(`/api/admin/promote/${member._id}`, { permissions: [] }, { withCredentials: true })
      setConfirm(null); await load()
    } catch (e: any) { alert(e.response?.data?.error || e.message) }
  }

  // Group staff by role
  const superAdmins = staff.filter(s => s.role === 'superadmin')
  const admins = staff.filter(s => s.role === 'admin')
  const mods = staff.filter(s => s.role === 'moderator')

  function RoleSection({ title, icon: Icon, members, color, emptyLabel, promote, promoteLabel }:
    { title: string; icon: any; members: StaffUser[]; color: string; emptyLabel: string; promote: 'moderator' | 'admin'; promoteLabel: string }) {
    return (
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={15} className={color} />
            <span className={`text-sm font-semibold font-body ${color}`}>{title}</span>
            <span className="text-xs text-text-muted font-body">({members.length})</span>
          </div>
          <button onClick={() => setShowPromote(showPromote === promote ? null : promote)}
            className="flex items-center gap-1.5 px-3 py-1.5 glass rounded-xl text-xs font-body text-text-muted hover:text-text border border-white/8 transition-all">
            <Plus size={11} /> {promoteLabel}
          </button>
        </div>

        {/* Promote panel — key forces remount only when role changes, not on every parent render */}
        {showPromote === promote && (
          <PromotePanel
            key={promote}
            targetRole={promote}
            onPromote={promoteUser}
            onClose={() => setShowPromote(null)}
          />
        )}

        {/* Members */}
        {members.length === 0 && showPromote !== promote && (
          <div className="py-4 text-center text-xs text-text-muted font-body glass rounded-xl border border-white/5">
            {emptyLabel}
          </div>
        )}
        {members.map(m => (
          <StaffRow
            key={m._id}
            member={m}
            isOpen={expandedId === m._id}
            onToggle={() => setExpandedId(expandedId === m._id ? null : m._id)}
            pendingPerms={pendingPerms[m._id]}
            onTogglePerm={(perm: string, cur: string[]) => togglePerm(m._id, perm, cur)}
            onGrantAll={() => setPendingPerms(prev => ({ ...prev, [m._id]: [...ALL_PERM_KEYS] }))}
            onRevokeAll={() => setPendingPerms(prev => ({ ...prev, [m._id]: [] }))}
            onSave={() => savePerms(m)}
            saving={saving === m._id}
            saved={saved === m._id}
            hasPending={hasPendingChanges(m)}
            onDemote={() => setConfirm({ type: m.role === 'moderator' ? 'demote-mod' : 'demote', member: m })}
            onPromoteAdmin={() => setConfirm({ type: 'promote-admin', member: m })}
            onPromoteSuper={() => setConfirm({ type: 'promote-super', member: m })}
          />
        ))}
      </div>
    )
  }

  if (loading) return (
    <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)}</div>
  )

  return (
    <div className="space-y-8">
      {/* Super Admins */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Crown size={15} className="text-amber-400" />
          <span className="text-sm font-semibold font-body text-amber-400">Super Admin</span>
          <span className="text-xs text-text-muted font-body">({superAdmins.length})</span>
        </div>
        {superAdmins.length === 0 && (
          <div className="py-4 text-center text-xs text-text-muted font-body glass rounded-xl border border-white/5">No super admins</div>
        )}
        {superAdmins.map(m => (
          <StaffRow key={m._id} member={m} isOpen={false} onToggle={() => {}}
            pendingPerms={undefined} onTogglePerm={() => {}} onGrantAll={() => {}} onRevokeAll={() => {}}
            onSave={() => {}} saving={false} saved={false} hasPending={false}
            onDemote={() => {}} onPromoteAdmin={() => {}} onPromoteSuper={() => {}} />
        ))}
      </div>

      <div className="h-px bg-white/5" />

      {/* Admins */}
      <RoleSection
        title="Admins" icon={Shield} members={admins} color="text-red-400"
        emptyLabel="No admins yet — promote a user or moderator above"
        promote="admin" promoteLabel="Promote to Admin"
      />

      <div className="h-px bg-white/5" />

      {/* Moderators */}
      <RoleSection
        title="Moderators" icon={Sword} members={mods} color="text-blue-400"
        emptyLabel="No moderators yet — promote a user above"
        promote="moderator" promoteLabel="Promote to Moderator"
      />

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          title={
            confirm.type === 'demote' ? 'Demote to User?' :
            confirm.type === 'demote-mod' ? 'Remove Moderator?' :
            confirm.type === 'promote-admin' ? 'Promote to Admin?' :
            'Promote to Super Admin?'
          }
          message={
            confirm.type === 'demote'
              ? `${confirm.member.name} will lose all admin access and become a regular user.`
            : confirm.type === 'demote-mod'
              ? `${confirm.member.name} will lose moderator access and become a regular user.`
            : confirm.type === 'promote-admin'
              ? `${confirm.member.name} will be upgraded from Moderator to Admin with configurable permissions.`
            : `${confirm.member.name} will get full unrestricted access to everything, including permission management.`
          }
          confirmLabel={
            confirm.type === 'promote-super' ? 'Confirm' :
            confirm.type.startsWith('promote') ? 'Promote' : 'Demote'
          }
          confirmClass={
            confirm.type === 'promote-super'
              ? 'bg-amber-500 text-black hover:bg-amber-400'
            : confirm.type === 'promote-admin'
              ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-red-500/80 text-white hover:bg-red-600'
          }
          onConfirm={executeConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}