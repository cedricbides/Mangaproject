import { useState, useEffect } from 'react'
import { MessageCircle, Trash2, Send, CornerDownRight, Flag, X, Heart } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

interface Comment {
  _id: string
  userId: string
  userName: string
  userAvatar: string
  body: string
  parentId: string | null
  likes: string[]
  createdAt: string
}

interface Props {
  mangaId: string
}

const DEFAULT_CAT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1e1e30"/><stop offset="100%" stop-color="#0d0d14"/></radialGradient><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e8394d" stop-opacity="0.2"/><stop offset="100%" stop-color="#e8394d" stop-opacity="0"/></radialGradient><clipPath id="circ"><circle cx="100" cy="100" r="100"/></clipPath></defs><circle cx="100" cy="100" r="100" fill="url(#bg)"/><circle cx="100" cy="120" r="75" fill="url(#glow)"/><g clip-path="url(#circ)"><rect x="52" y="158" width="96" height="50" fill="#e8900a"/><ellipse cx="100" cy="158" rx="48" ry="20" fill="#e8900a"/><path d="M 52 165 Q 20 160 18 185 Q 16 200 38 198 Q 50 196 55 185" fill="#e8900a"/><path d="M 22 178 Q 18 185 22 190" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M 24 188 Q 20 193 25 196" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="110" rx="42" ry="40" fill="#f0a012"/><polygon points="68,80 58,55 85,74" fill="#f0a012"/><polygon points="132,80 142,55 115,74" fill="#f0a012"/><polygon points="72,78 64,60 84,74" fill="#c06a20" opacity="0.5"/><polygon points="128,78 136,60 116,74" fill="#c06a20" opacity="0.5"/><path d="M 82 108 Q 87 104 92 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 108 108 Q 113 104 118 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 87 113 Q 87 119 92 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M 113 113 Q 113 119 108 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="100" cy="122" r="3" fill="#7a4a00"/><path d="M 100 125 Q 96 130 100 132 Q 104 130 100 125" fill="#7a4a00"/><ellipse cx="80" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/><ellipse cx="120" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/></g><circle cx="100" cy="100" r="97" fill="none" stroke="#e8394d" stroke-width="1.5" opacity="0.4"/></svg>')}`

function Avatar({ name, avatar, size = 9 }: { name: string; avatar?: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-xl flex-shrink-0`
  return <img src={avatar || DEFAULT_CAT_AVATAR} alt={name} className={`${cls} object-cover`} />
}

function ReplyBox({ onPost, onCancel, posting }: { onPost: (body: string) => void; onCancel: () => void; posting: boolean }) {
  const [body, setBody] = useState('')
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="flex gap-2 mt-2 ml-11">
      <Avatar name={user.name} avatar={user.avatar} size={7} />
      <div className="flex-1 flex gap-2">
        <input
          autoFocus
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && body.trim()) { onPost(body); setBody('') } }}
          placeholder="Write a reply…"
          maxLength={2000}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/40 transition-colors"
        />
        <button onClick={() => { if (body.trim()) { onPost(body); setBody('') } }} disabled={!body.trim() || posting}
          className="px-3 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-xl transition-all disabled:opacity-40">
          <Send size={13} />
        </button>
        <button onClick={onCancel}
          className="px-3 py-2 glass border border-white/10 text-text-muted text-xs font-body rounded-xl hover:text-text transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ReportModal({ targetId, targetType, onClose }: { targetId: string; targetType: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const presets = ['Spam', 'Harassment', 'Inappropriate content', 'Spoilers', 'Other']

  const submit = async (r: string) => {
    setSending(true)
    try {
      await axios.post('/api/social/reports', { targetType, targetId, reason: r }, { withCredentials: true })
      setDone(true)
      setTimeout(onClose, 1500)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit report')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#13131a] border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-4">
            <p className="text-green-400 font-body text-sm font-medium">✓ Report submitted</p>
            <p className="text-text-muted font-body text-xs mt-1">Our team will review it shortly.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base text-white tracking-wide">Report {targetType}</h3>
              <button onClick={onClose} className="text-text-muted hover:text-white"><X size={15} /></button>
            </div>
            <p className="text-xs text-text-muted font-body mb-3">Why are you reporting this?</p>
            <div className="flex flex-col gap-2 mb-3">
              {presets.map(p => (
                <button key={p} onClick={() => submit(p)} disabled={sending}
                  className="text-left px-3 py-2 glass border border-white/10 hover:border-primary/30 hover:text-primary text-sm text-text-muted font-body rounded-xl transition-all disabled:opacity-40">
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Other reason…"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/40" />
              <button onClick={() => reason.trim() && submit(reason.trim())} disabled={!reason.trim() || sending}
                className="px-3 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl disabled:opacity-40 transition-all">
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MangaComments({ mangaId }: Props) {
  const { user } = useAuth()
  const commentKey = `manga_${mangaId}`
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [postingReply, setPostingReply] = useState(false)
  const [reportingId, setReportingId] = useState<string | null>(null)

  useEffect(() => {
    axios.get(`/api/social/comments/${commentKey}`)
      .then(res => setComments(res.data.comments))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [commentKey])

  const postComment = async (text: string, parentId: string | null = null) => {
    if (parentId) setPostingReply(true); else setPosting(true)
    try {
      const res = await axios.post(
        `/api/social/comments/${commentKey}`,
        { body: text, mangaId, parentId },
        { withCredentials: true }
      )
      setComments(prev => [res.data.comment, ...prev])
      if (!parentId) setBody('')
      setReplyingTo(null)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to post comment')
    }
    if (parentId) setPostingReply(false); else setPosting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this comment?')) return
    setDeletingId(id)
    try {
      await axios.delete(`/api/social/comments/${id}`, { withCredentials: true })
      setComments(prev => prev.filter(c => c._id !== id && c.parentId !== id))
    } catch {}
    setDeletingId(null)
  }

  const toggleLike = async (id: string) => {
    if (!user) return
    try {
      const res = await axios.post(`/api/social/comments/${id}/like`, {}, { withCredentials: true })
      setComments(prev => prev.map(c => c._id === id
        ? { ...c, likes: res.data.liked
            ? [...(c.likes || []), user.id]
            : (c.likes || []).filter((uid: string) => uid !== user.id) }
        : c
      ))
    } catch {}
  }

  const topLevel = comments.filter(c => !c.parentId)
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId)

  return (
    <div className="mt-10">
      {reportingId && (
        <ReportModal targetId={reportingId} targetType="comment" onClose={() => setReportingId(null)} />
      )}

      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display text-2xl text-white tracking-wide">COMMENTS</h2>
        {!loading && (
          <span className="text-sm text-text-muted font-body">
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {user ? (
        <div className="flex gap-3 mb-8">
          <Avatar name={user.name} avatar={user.avatar} />
          <div className="flex-1 flex gap-2">
            <input value={body} onChange={e => setBody(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && body.trim() && postComment(body)}
              placeholder="Share your thoughts about this manga…" maxLength={2000}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-body outline-none focus:border-primary/40 transition-colors" />
            <button onClick={() => body.trim() && postComment(body)} disabled={!body.trim() || posting}
              className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl transition-all disabled:opacity-40 flex items-center gap-2 text-sm font-body">
              <Send size={14} />
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass border border-white/10 rounded-2xl p-4 mb-8 text-center">
          <MessageCircle size={20} className="text-text-muted mx-auto mb-2 opacity-50" />
          <a href="/login" className="text-sm text-primary font-body hover:underline">Sign in to join the discussion</a>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>
      ) : topLevel.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl border border-white/5">
          <MessageCircle size={32} className="text-text-muted mx-auto mb-3 opacity-30" />
          <p className="font-body text-text-muted text-sm">No comments yet. Be the first!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {topLevel.map(c => {
            const replies = getReplies(c._id)
            const isReplying = replyingTo === c._id
            const canDelete = c.userId === user?.id || (user as any)?.role === 'admin'
            const canReport = !!user && c.userId !== user?.id

            return (
              <div key={c._id}>
                {/* Top-level comment */}
                <div className="glass border border-white/5 rounded-2xl p-4 flex gap-3 group">
                  <Avatar name={c.userName} avatar={c.userAvatar} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-body text-text font-medium">{c.userName}</span>
                        {c.userId === user?.id && <span className="text-[10px] text-primary font-body">You</span>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-text-muted font-body">{new Date(c.createdAt).toLocaleDateString()}</span>
                        {canReport && (
                          <button onClick={() => setReportingId(c._id)}
                            className="p-1 text-text-muted hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="Report comment">
                            <Flag size={11} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(c._id)} disabled={deletingId === c._id}
                            className="p-1 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-text-muted font-body leading-relaxed mt-1 break-words">{c.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={() => toggleLike(c._id)}
                        className={`flex items-center gap-1 text-xs font-body transition-colors ${
                          c.likes?.includes(user?.id || '') ? 'text-primary' : 'text-text-muted hover:text-primary'
                        }`}>
                        <Heart size={12} fill={c.likes?.includes(user?.id || '') ? 'currentColor' : 'none'} />
                        {c.likes?.length > 0 && <span>{c.likes.length}</span>}
                      </button>
                      {user && (
                        <button onClick={() => setReplyingTo(isReplying ? null : c._id)}
                          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary font-body transition-colors">
                          <CornerDownRight size={12} />
                          {replies.length > 0 ? `${replies.length} Repl${replies.length !== 1 ? 'ies' : 'y'} · ` : ''}Reply
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {replies.length > 0 && (
                  <div className="ml-10 mt-2 flex flex-col gap-2 border-l-2 border-white/5 pl-4">
                    {replies.map(r => {
                      const replyCanDelete = r.userId === user?.id || (user as any)?.role === 'admin'
                      const replyCanReport = !!user && r.userId !== user?.id
                      return (
                        <div key={r._id} className="glass border border-white/5 rounded-xl p-3 flex gap-2.5 group">
                          <Avatar name={r.userName} avatar={r.userAvatar} size={7} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-body text-text font-medium">{r.userName}</span>
                                {r.userId === user?.id && <span className="text-[10px] text-primary font-body">You</span>}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[11px] text-text-muted font-body">{new Date(r.createdAt).toLocaleDateString()}</span>
                                {replyCanReport && (
                                  <button onClick={() => setReportingId(r._id)}
                                    className="p-1 text-text-muted hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Report reply">
                                    <Flag size={10} />
                                  </button>
                                )}
                                {replyCanDelete && (
                                  <button onClick={() => handleDelete(r._id)} disabled={deletingId === r._id}
                                    className="p-1 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-text-muted font-body leading-relaxed mt-0.5 break-words">{r.body}</p>
                            <button onClick={() => toggleLike(r._id)}
                              className={`flex items-center gap-1 mt-1.5 text-xs font-body transition-colors ${
                                r.likes?.includes(user?.id || '') ? 'text-primary' : 'text-text-muted hover:text-primary'
                              }`}>
                              <Heart size={11} fill={r.likes?.includes(user?.id || '') ? 'currentColor' : 'none'} />
                              {r.likes?.length > 0 && <span>{r.likes.length}</span>}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Reply input */}
                {isReplying && (
                  <ReplyBox
                    onPost={(text) => postComment(text, c._id)}
                    onCancel={() => setReplyingTo(null)}
                    posting={postingReply}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}