import { useState, useEffect } from 'react'

import { MessageCircle, Trash2, Send, ChevronDown, ChevronUp, Heart } from 'lucide-react'

import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

interface Comment {
  _id: string
  userId: string
  userName: string
  userAvatar: string
  body: string

  likes: string[]

  createdAt: string
}

interface Props {
  chapterId: string
  mangaId: string
}

export default function ChapterComments({ chapterId, mangaId }: Props) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    axios.get(`/api/social/comments/${chapterId}`)
      .then(res => setComments(res.data.comments))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [chapterId])

  const handlePost = async () => {
    if (!body.trim() || posting) return
    setPosting(true)
    try {
      const res = await axios.post(`/api/social/comments/${chapterId}`, { body, mangaId }, { withCredentials: true })
      setComments(prev => [res.data.comment, ...prev])
      setBody('')
      setExpanded(true)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to post comment')
    }
    setPosting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this comment?')) return
    setDeletingId(id)
    try {
      await axios.delete(`/api/social/comments/${id}`, { withCredentials: true })
      setComments(prev => prev.filter(c => c._id !== id))
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


  return (
    <div className="border-t border-white/5 mt-4">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-text-muted hover:text-text transition-colors">
        <div className="flex items-center gap-2 text-sm font-body">
          <MessageCircle size={15} />
          {loading ? 'Comments' : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Input */}
          {user ? (
            <div className="flex gap-2 mb-4">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-xl object-cover flex-shrink-0 mt-1" />
                : <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-sm font-display text-primary flex-shrink-0 mt-1">
                    {user.name[0]?.toUpperCase()}
                  </div>
              }
              <div className="flex-1 flex gap-2">
                <input
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePost()}
                  placeholder="Add a comment…"
                  maxLength={2000}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/40"
                />
                <button onClick={handlePost} disabled={!body.trim() || posting}
                  className="p-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-xl transition-all disabled:opacity-40">
                  <Send size={14} />
                </button>
              </div>
            </div>
          ) : (
            <a href="/login" className="block text-center text-sm text-primary font-body hover:underline mb-4">
              Sign in to comment
            </a>
          )}

          {/* Comments list */}
          {loading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-xs text-text-muted font-body py-4">No comments yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {comments.map(c => (
                <div key={c._id} className="flex gap-2.5 group">
                  {c.userAvatar
                    ? <img src={c.userAvatar} alt={c.userName} className="w-7 h-7 rounded-lg object-cover flex-shrink-0 mt-0.5" />
                    : <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-display text-text-muted flex-shrink-0 mt-0.5">
                        {c.userName[0]?.toUpperCase()}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-body text-text font-medium">{c.userName}</span>
                      <span className="text-[10px] text-text-muted font-body">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-text-muted font-body leading-relaxed mt-0.5 break-words">{c.body}</p>

                    <button onClick={() => toggleLike(c._id)}
                      className={`flex items-center gap-1 mt-1.5 text-xs font-body transition-colors ${
                        c.likes?.includes(user?.id || '') ? 'text-primary' : 'text-text-muted hover:text-primary'
                      }`}>
                      <Heart size={11} fill={c.likes?.includes(user?.id || '') ? 'currentColor' : 'none'} />
                      {c.likes?.length > 0 && <span>{c.likes.length}</span>}
                    </button>

                  </div>
                  {(c.userId === user?.id || user?.role === 'admin') && (
                    <button onClick={() => handleDelete(c._id)} disabled={deletingId === c._id}
                      className="p-1 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}