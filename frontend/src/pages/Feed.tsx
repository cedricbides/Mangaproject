import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import {
  Heart, MessageCircle, Share2, Send, Trash2,
  Image as ImageIcon, Link as LinkIcon, X,
  MoreVertical, ArrowLeft, AlertCircle, ChevronDown
} from 'lucide-react'

const EMOJIS = ['❤️', '😂', '🔥', '😮', '👏', '😢']

// ── Role badges (take priority over tier) ────────────────────────────────────
const ROLE_BADGES: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  superadmin: { label: 'Super Admin', emoji: '👑', color: 'text-amber-300',  bg: 'bg-amber-500/20 border-amber-400/40' },
  admin:      { label: 'Admin',       emoji: '🛡️', color: 'text-red-300',    bg: 'bg-red-500/20 border-red-400/40'    },
  moderator:  { label: 'Moderator',   emoji: '⚔️', color: 'text-blue-300',   bg: 'bg-blue-500/20 border-blue-400/40'  },
}

// ── Tier system (for regular users) ──────────────────────────────────────────
interface UserTier { label: string; emoji: string; color: string; bg: string; minPosts: number }
const TIERS: UserTier[] = [
  { label: 'Newcomer', emoji: '🌱', color: 'text-slate-400',  bg: 'bg-slate-500/15 border-slate-500/25',   minPosts: 0   },
  { label: 'Reader',   emoji: '📖', color: 'text-sky-400',    bg: 'bg-sky-500/15 border-sky-500/25',       minPosts: 5   },
  { label: 'Regular',  emoji: '⭐', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/25', minPosts: 20  },
  { label: 'Veteran',  emoji: '🔥', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/25', minPosts: 60  },
  { label: 'Elite',    emoji: '💎', color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/25', minPosts: 150 },
  { label: 'Legend',   emoji: '👑', color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-400/30',   minPosts: 400 },
]
function getTier(n = 0) {
  return [...TIERS].reverse().find(t => n >= t.minPosts) ?? TIERS[0]
}

function UserBadge({ role, postCount }: { role?: string; postCount?: number }) {
  const roleBadge = role ? ROLE_BADGES[role] : null
  if (roleBadge) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold tracking-wide ${roleBadge.color} ${roleBadge.bg}`}>
        {roleBadge.emoji} {roleBadge.label}
      </span>
    )
  }
  const tier = getTier(postCount)
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold tracking-wide ${tier.color} ${tier.bg}`}>
      {tier.emoji} {tier.label}
    </span>
  )
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface PostComment {
  _id: string; userId: string; userName: string
  userAvatar: string; userPostCount?: number; userRole?: string
  body: string; createdAt: string
}
interface Post {
  _id: string; userId: string; userName: string
  userAvatar: string; userPostCount?: number; userRole?: string
  body: string; imageUrl?: string
  linkUrl?: string; linkTitle?: string; linkDescription?: string
  linkImage?: string; linkSource?: string
  reactions: { userId: string; emoji: string }[]
  comments: PostComment[]; createdAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const DEFAULT_CAT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1e1e30"/><stop offset="100%" stop-color="#0d0d14"/></radialGradient><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e8394d" stop-opacity="0.2"/><stop offset="100%" stop-color="#e8394d" stop-opacity="0"/></radialGradient><clipPath id="circ"><circle cx="100" cy="100" r="100"/></clipPath></defs><circle cx="100" cy="100" r="100" fill="url(#bg)"/><circle cx="100" cy="120" r="75" fill="url(#glow)"/><g clip-path="url(#circ)"><rect x="52" y="158" width="96" height="50" fill="#e8900a"/><ellipse cx="100" cy="158" rx="48" ry="20" fill="#e8900a"/><path d="M 52 165 Q 20 160 18 185 Q 16 200 38 198 Q 50 196 55 185" fill="#e8900a"/><path d="M 22 178 Q 18 185 22 190" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M 24 188 Q 20 193 25 196" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="110" rx="42" ry="40" fill="#f0a012"/><polygon points="68,80 58,55 85,74" fill="#f0a012"/><polygon points="132,80 142,55 115,74" fill="#f0a012"/><polygon points="72,78 64,60 84,74" fill="#c06a20" opacity="0.5"/><polygon points="128,78 136,60 116,74" fill="#c06a20" opacity="0.5"/><path d="M 82 108 Q 87 104 92 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 108 108 Q 113 104 118 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 87 113 Q 87 119 92 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M 113 113 Q 113 119 108 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="100" cy="122" r="3" fill="#7a4a00"/><path d="M 100 125 Q 96 130 100 132 Q 104 130 100 125" fill="#7a4a00"/><ellipse cx="80" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/><ellipse cx="120" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/></g><circle cx="100" cy="100" r="97" fill="none" stroke="#e8394d" stroke-width="1.5" opacity="0.4"/></svg>')}`

function Avatar({ src, name, size = 40, linkTo }: { src?: string; name: string; size?: number; linkTo?: string }) {
  const [err, setErr] = useState(false)
  const inner = (!src || err)
    ? <img src={DEFAULT_CAT_AVATAR} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
    : <img src={src} onError={() => setErr(true)} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  if (linkTo) return <Link to={linkTo} className="flex-shrink-0 hover:opacity-80 transition-opacity">{inner}</Link>
  return inner
}

// ── ReactionBar ────────────────────────────────────────────────────────────────
function ReactionBar({ post, onReact, userId }: { post: Post; onReact: (id: string, emoji: string) => void; userId?: string }) {
  const [open, setOpen] = useState(false)
  const grouped = EMOJIS.map(e => ({
    emoji: e,
    count: post.reactions.filter(r => r.emoji === e).length,
    mine: !!userId && post.reactions.some(r => r.userId === userId && r.emoji === e),
  })).filter(g => g.count > 0)
  const myReaction = userId ? post.reactions.find(r => r.userId === userId) : null

  return (
    <div className="relative flex items-center gap-1 flex-wrap">
      {grouped.map(g => (
        <button key={g.emoji} onClick={() => userId && onReact(post._id, g.emoji)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${g.mine ? 'bg-primary/20 border border-primary/40 text-primary' : 'bg-white/5 hover:bg-white/10 text-text-muted'}`}>
          {g.emoji} <span>{g.count}</span>
        </button>
      ))}
      {userId && (
        <div className="relative">
          <button onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${myReaction ? 'text-primary' : 'text-text-muted hover:text-text'}`}>
            <Heart size={14} className={myReaction ? 'fill-current' : ''} /> React
          </button>
          {open && (
            <div className="absolute bottom-full left-0 mb-2 flex gap-1 bg-surface border border-white/10 rounded-2xl p-2 shadow-xl z-10">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => { onReact(post._id, e); setOpen(false) }}
                  className="text-xl hover:scale-125 transition-transform p-1">{e}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── PostCard ───────────────────────────────────────────────────────────────────
function PostCard({ post, currentUser, onReact, onDelete, onComment, onDeleteComment }: {
  post: Post; currentUser: any
  onReact: (id: string, emoji: string) => void
  onDelete: (id: string) => void
  onComment: (id: string, body: string) => void
  onDeleteComment: (postId: string, commentId: string) => void
}) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const canDelete = currentUser && (currentUser.id === post.userId || ['admin','superadmin'].includes(currentUser.role))
  const profileLink = `/profile${currentUser?.id === post.userId ? '' : `/${post.userId}`}`

  function handleShare() {
    navigator.clipboard.writeText(window.location.origin + '/feed#' + post._id)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    onComment(post._id, commentText.trim()); setCommentText('')
  }

  return (
    <div id={post._id} className="glass rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          <Avatar src={post.userAvatar} name={post.userName} size={40} linkTo={profileLink} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={profileLink} className="text-sm font-semibold text-text font-body hover:text-primary transition-colors">
                {post.userName}
              </Link>
              <UserBadge role={post.userRole} postCount={post.userPostCount} />
            </div>
            <p className="text-xs text-text-muted font-body mt-0.5">
              @{post.userName.replace(/\s+/g,'')} · {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen(o => !o)} className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-all">
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-white/10 rounded-xl shadow-xl z-10 min-w-[130px] overflow-hidden">
              <button onClick={handleShare} className="w-full text-left px-4 py-2.5 text-sm text-text-muted hover:bg-white/5 hover:text-text transition-all font-body flex items-center gap-2">
                <Share2 size={13} /> {copied ? 'Copied!' : 'Copy Link'}
              </button>
              {canDelete && (
                <button onClick={() => { onDelete(post._id); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all font-body flex items-center gap-2">
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {post.body && <div className="px-4 pb-3"><p className="text-sm text-text font-body leading-relaxed whitespace-pre-wrap">{post.body}</p></div>}

      {post.imageUrl && (
        <div className="px-4 pb-3">
          <img src={post.imageUrl} className="rounded-xl w-full object-cover max-h-96" alt="Post image" />
        </div>
      )}

      {post.linkUrl && (
        <div className="mx-4 mb-3">
          <a href={post.linkUrl} target="_blank" rel="noopener noreferrer"
            className="block border border-white/10 rounded-xl overflow-hidden hover:border-primary/30 transition-all">
            {post.linkImage && <img src={post.linkImage} className="w-full object-cover max-h-52" alt="" />}
            <div className="p-3 bg-white/3">
              {post.linkSource && <p className="text-xs text-text-muted mb-1 font-body">{post.linkSource}</p>}
              {post.linkTitle && <p className="text-sm font-semibold text-text font-body">{post.linkTitle}</p>}
              {post.linkDescription && <p className="text-xs text-text-muted mt-1 font-body line-clamp-2">{post.linkDescription}</p>}
              <p className="text-xs text-primary mt-1 font-body truncate">{post.linkUrl}</p>
            </div>
          </a>
        </div>
      )}

      <div className="px-4 pb-3 flex items-center justify-between flex-wrap gap-2">
        <ReactionBar post={post} onReact={onReact} userId={currentUser?.id} />
        <div className="flex items-center gap-1">
          <button onClick={() => setShowComments(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-text-muted hover:text-text transition-all">
            <MessageCircle size={14} />
            {post.comments.length > 0 ? `${post.comments.length} ` : ''}Comment{post.comments.length !== 1 ? 's' : ''}
          </button>
          <button onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-text-muted hover:text-text transition-all">
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      {showComments && (
        <div className="border-t border-white/5 px-4 py-3 space-y-3">
          {currentUser && (
            <form onSubmit={submitComment} className="flex gap-2">
              <Avatar src={currentUser.avatar} name={currentUser.name} size={32} />
              <div className="flex-1 flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Write a comment…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-text font-body outline-none focus:border-primary/40 min-w-0" />
                <button type="submit" disabled={!commentText.trim()}
                  className="p-2 bg-primary rounded-xl text-white disabled:opacity-40 hover:bg-primary/80 transition-all flex-shrink-0">
                  <Send size={14} />
                </button>
              </div>
            </form>
          )}
          {post.comments.length === 0 && (
            <p className="text-xs text-text-muted font-body text-center py-2">No comments yet. Be the first!</p>
          )}
          {post.comments.map(c => (
            <div key={c._id} className="flex gap-2">
              <Avatar src={c.userAvatar} name={c.userName} size={32}
                linkTo={currentUser?.id === c.userId ? '/profile' : `/profile/${c.userId}`} />
              <div className="flex-1 min-w-0">
                <div className="bg-white/5 rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={currentUser?.id === c.userId ? '/profile' : `/profile/${c.userId}`}
                        className="text-xs font-semibold text-text font-body hover:text-primary transition-colors">{c.userName}</Link>
                      <UserBadge role={c.userRole} postCount={c.userPostCount} />
                    </div>
                    {currentUser && (currentUser.id === c.userId || ['admin','superadmin'].includes(currentUser.role)) && (
                      <button onClick={() => onDeleteComment(post._id, c._id)} className="text-text-muted hover:text-red-400 transition-colors flex-shrink-0">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-text-muted font-body mt-0.5">{c.body}</p>
                </div>
                <p className="text-[10px] text-text-muted font-body mt-1 ml-2">{timeAgo(c.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tier Legend ────────────────────────────────────────────────────────────────
function TierLegend() {
  const [open, setOpen] = useState(false)
  return (
    <div className="glass rounded-2xl border border-white/5 p-4 mb-6">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <span className="text-base">🏅</span>
          <span className="text-sm font-semibold text-text font-body">Community Tiers</span>
          <span className="text-xs text-text-muted font-body">· Post to level up!</span>
        </div>
        <ChevronDown size={14} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          {/* Role badges */}
          <div>
            <p className="text-[10px] text-text-muted font-body uppercase tracking-widest mb-2">Staff Roles</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ROLE_BADGES).map(([key, b]) => (
                <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${b.bg}`}>
                  <span className="text-base">{b.emoji}</span>
                  <p className={`text-xs font-semibold ${b.color}`}>{b.label}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Tier badges */}
          <div>
            <p className="text-[10px] text-text-muted font-body uppercase tracking-widest mb-2">Community Tiers</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIERS.map(tier => (
                <div key={tier.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${tier.bg}`}>
                  <span className="text-base">{tier.emoji}</span>
                  <div>
                    <p className={`text-xs font-semibold ${tier.color}`}>{tier.label}</p>
                    <p className="text-[10px] text-text-muted font-body">{tier.minPosts === 0 ? 'Starting out' : `${tier.minPosts}+ posts`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Feed ──────────────────────────────────────────────────────────────────
export default function Feed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all')
  const [postText, setPostText] = useState('')
  const [postLink, setPostLink] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [postError, setPostError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const loader = useRef<HTMLDivElement>(null)

  const canPost = postText.trim().length > 0 || postLink.trim().length > 0 || !!imageFile
  const isOverLimit = postText.length > 500

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // react-query for feed — cached per filter/page
  const { data: feedData, isLoading: loading, refetch: refetchFeed } = useQuery({
    queryKey: ['feed', page, feedFilter],
    queryFn: async () => {
      const res = await axios.get(`/api/feed?page=${page}${feedFilter === 'following' ? '&filter=following' : ''}`, { withCredentials: true })
      return res.data
    },
    staleTime: 30 * 1000,
  })

  // Accumulate posts across pages
  useEffect(() => {
    if (!feedData) return
    if (page === 0) {
      setPosts(feedData.posts || [])
    } else {
      setPosts(prev => [...prev, ...(feedData.posts || [])])
    }
    setHasMore(feedData.hasMore || false)
  }, [feedData, page])

  // Reset on filter change
  useEffect(() => { setPage(0); setPosts([]) }, [feedFilter])

  // Infinite scroll observer
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(prev => prev + 1)
      }
    }, { threshold: 0.1 })
    if (loader.current) obs.observe(loader.current)
    return () => obs.disconnect()
  }, [hasMore, loading])

  async function submitPost(e: React.FormEvent) {
    e.preventDefault()
    if (!canPost || submitting || isOverLimit) return
    setPostError(''); setSubmitting(true)
    try {
      let uploadedImageUrl: string | undefined
      if (imageFile) {
        setUploadingImage(true)
        try {
          const formData = new FormData()
          formData.append('image', imageFile)
          const uploadRes = await axios.post('/api/upload/image', formData, {
            withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' },
          })
          uploadedImageUrl = uploadRes.data.url
        } catch {
          setPostError('Image upload failed. Try again or remove the image.')
          setSubmitting(false); setUploadingImage(false); return
        }
        setUploadingImage(false)
      }
      const payload: any = { body: postText.trim() }
      if (uploadedImageUrl) payload.imageUrl = uploadedImageUrl
      if (postLink.trim()) {
        payload.linkUrl = postLink.trim()
        try { payload.linkSource = new URL(postLink.trim()).hostname.replace('www.', '') } catch {}
      }
      const res = await axios.post('/api/feed', payload, { withCredentials: true })
      setPosts(prev => [res.data, ...prev])
      setPostText(''); setPostLink(''); setShowLinkInput(false); removeImage()
    } catch (err: any) {
      setPostError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to post. Please try again.')
    } finally { setSubmitting(false) }
  }

  async function handleReact(postId: string, emoji: string) {
    if (!user) return
    try {
      const res = await axios.post(`/api/feed/${postId}/react`, { emoji }, { withCredentials: true })
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, reactions: res.data.reactions } : p))
    } catch {}
  }
  async function handleDelete(postId: string) {
    try { await axios.delete(`/api/feed/${postId}`, { withCredentials: true }); setPosts(prev => prev.filter(p => p._id !== postId)) } catch {}
  }
  async function handleComment(postId: string, body: string) {
    try {
      const res = await axios.post(`/api/feed/${postId}/comments`, { body }, { withCredentials: true })
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: res.data.comments } : p))
    } catch {}
  }
  async function handleDeleteComment(postId: string, commentId: string) {
    try {
      const res = await axios.delete(`/api/feed/${postId}/comments/${commentId}`, { withCredentials: true })
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: res.data.comments } : p))
    } catch {}
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="p-2 glass rounded-xl text-text-muted hover:text-text transition-all"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Community Feed</h1>
          <p className="text-xs text-text-muted font-body">Share, discover, and talk Mangaverse</p>
        </div>
      </div>

      <TierLegend />

      {/* Feed filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'following'] as const).map(f => (
          <button key={f} onClick={() => setFeedFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-body border transition-colors capitalize ${feedFilter === f ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-text-muted hover:text-text'}`}>
            {f === 'all' ? '🌐 All Posts' : '👥 Following'}
          </button>
        ))}
      </div>

      {feedFilter === 'following' && !user && (
        <div className="glass rounded-2xl border border-white/5 p-4 mb-5 text-center text-sm text-text-muted font-body">
          <Link to="/login" className="text-primary hover:underline">Log in</Link> to see posts from people you follow.
        </div>
      )}

      {user ? (
        <form onSubmit={submitPost} className="glass rounded-2xl border border-white/5 p-4 mb-6 space-y-3">
          <div className="flex gap-3">
            <Avatar src={user.avatar} name={user.name} size={40} linkTo="/profile" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-text-muted font-body">{user.name}</span>
                <UserBadge role={user.role} postCount={user.postCount} />
              </div>
              <textarea value={postText} onChange={e => { setPostText(e.target.value); setPostError('') }}
                placeholder="Share something with the Mangaverse community…" rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/40 resize-none" />
            </div>
          </div>

          {imagePreview && (
            <div className="relative rounded-xl overflow-hidden border border-white/10 ml-[52px]">
              <img src={imagePreview} alt="Preview" className="w-full max-h-72 object-cover" />
              <button type="button" onClick={removeImage}
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 rounded-lg text-white transition-all"><X size={14} /></button>
            </div>
          )}

          {showLinkInput && (
            <div className="flex gap-2 items-center ml-[52px]">
              <LinkIcon size={14} className="text-text-muted flex-shrink-0" />
              <input value={postLink} onChange={e => { setPostLink(e.target.value); setPostError('') }}
                placeholder="Paste a Mangaverse or MangaDex link…"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/40" />
              <button type="button" onClick={() => { setShowLinkInput(false); setPostLink('') }}
                className="p-1.5 text-text-muted hover:text-red-400 transition-colors"><X size={14} /></button>
            </div>
          )}

          {postError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-body ml-[52px]">
              <AlertCircle size={13} className="flex-shrink-0" />{postError}
            </div>
          )}

          <div className="flex items-center justify-between ml-[52px]">
            <div className="flex gap-2">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <button type="button" onClick={() => imageInputRef.current?.click()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body transition-all ${imageFile ? 'bg-primary/20 text-primary border border-primary/30' : 'glass text-text-muted hover:text-text border border-white/5'}`}>
                <ImageIcon size={12} /> Image
              </button>
              <button type="button" onClick={() => setShowLinkInput(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body transition-all ${showLinkInput ? 'bg-primary/20 text-primary border border-primary/30' : 'glass text-text-muted hover:text-text border border-white/5'}`}>
                <LinkIcon size={12} /> Link
              </button>
            </div>
            <div className="flex items-center gap-3">
              {postText.length > 400 && (
                <span className={`text-xs font-body tabular-nums ${isOverLimit ? 'text-red-400' : 'text-text-muted'}`}>{postText.length}/500</span>
              )}
              <button type="submit" disabled={submitting || !canPost || isOverLimit}
                className="px-5 py-2 bg-primary text-white text-sm font-body rounded-xl disabled:opacity-40 hover:bg-primary/80 active:scale-95 transition-all min-w-[72px] text-center">
                {uploadingImage ? 'Uploading…' : submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="glass rounded-2xl border border-white/5 p-6 mb-6 text-center">
          <p className="text-text-muted font-body text-sm">
            <Link to="/login" className="text-primary hover:underline">Log in</Link> to post and interact with the community.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map(post => (
          <PostCard key={post._id} post={post} currentUser={user}
            onReact={handleReact} onDelete={handleDelete}
            onComment={handleComment} onDeleteComment={handleDeleteComment} />
        ))}

        {loading && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="glass rounded-2xl border border-white/5 p-4 animate-pulse">
                <div className="flex gap-3 mb-3">
                  <div className="w-10 h-10 bg-white/10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-white/10 rounded w-32" /><div className="h-2 bg-white/5 rounded w-20" />
                  </div>
                </div>
                <div className="space-y-2"><div className="h-3 bg-white/10 rounded w-full" /><div className="h-3 bg-white/10 rounded w-3/4" /></div>
              </div>
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-text-muted font-body">No posts yet. Be the first to share something!</p>
            <p className="text-xs text-text-muted/60 font-body">Post to earn your first tier badge 🌱</p>
          </div>
        )}

        <div ref={loader} className="h-4" />
        {!hasMore && posts.length > 0 && (
          <p className="text-center text-xs text-text-muted font-body py-4">You're all caught up! ✨</p>
        )}
      </div>
    </div>
  )
}