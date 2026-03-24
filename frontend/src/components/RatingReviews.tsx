import { useState, useEffect } from 'react'

import { Star, Edit2, Trash2, X, Flag } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

const DEFAULT_CAT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#1e1e30"/><stop offset="100%" stop-color="#0d0d14"/></radialGradient><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e8394d" stop-opacity="0.2"/><stop offset="100%" stop-color="#e8394d" stop-opacity="0"/></radialGradient><clipPath id="circ"><circle cx="100" cy="100" r="100"/></clipPath></defs><circle cx="100" cy="100" r="100" fill="url(#bg)"/><circle cx="100" cy="120" r="75" fill="url(#glow)"/><g clip-path="url(#circ)"><rect x="52" y="158" width="96" height="50" fill="#e8900a"/><ellipse cx="100" cy="158" rx="48" ry="20" fill="#e8900a"/><path d="M 52 165 Q 20 160 18 185 Q 16 200 38 198 Q 50 196 55 185" fill="#e8900a"/><path d="M 22 178 Q 18 185 22 190" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M 24 188 Q 20 193 25 196" stroke="#7a4a00" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="110" rx="42" ry="40" fill="#f0a012"/><polygon points="68,80 58,55 85,74" fill="#f0a012"/><polygon points="132,80 142,55 115,74" fill="#f0a012"/><polygon points="72,78 64,60 84,74" fill="#c06a20" opacity="0.5"/><polygon points="128,78 136,60 116,74" fill="#c06a20" opacity="0.5"/><path d="M 82 108 Q 87 104 92 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 108 108 Q 113 104 118 108" stroke="#7a4a00" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M 87 113 Q 87 119 92 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M 113 113 Q 113 119 108 118" stroke="#7a4a00" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="100" cy="122" r="3" fill="#7a4a00"/><path d="M 100 125 Q 96 130 100 132 Q 104 130 100 125" fill="#7a4a00"/><ellipse cx="80" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/><ellipse cx="120" cy="124" rx="8" ry="4" fill="#e8394d" opacity="0.18"/></g><circle cx="100" cy="100" r="97" fill="none" stroke="#e8394d" stroke-width="1.5" opacity="0.4"/></svg>')}`

interface Review {
  _id: string
  userId: string
  userName: string
  userAvatar: string
  rating: number
  body: string
  createdAt: string
}

interface Props {
  mangaId: string
}

function StarRating({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => {
        const filled = (hover || value) > i
        return (
          <button key={i} type="button"
            onClick={() => onChange?.(i + 1)}
            onMouseEnter={() => onChange && setHover(i + 1)}
            onMouseLeave={() => onChange && setHover(0)}
            className={`transition-colors ${onChange ? 'cursor-pointer' : 'cursor-default'} ${filled ? 'text-yellow-400' : 'text-white/20'}`}
            disabled={!onChange}>
            <Star size={size} fill={filled ? 'currentColor' : 'none'} />
          </button>
        )
      })}
    </div>
  )
}

export default function RatingReviews({ mangaId }: Props) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [avg, setAvg] = useState<number | null>(null)
  const [count, setCount] = useState(0)
  const [myReview, setMyReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formRating, setFormRating] = useState(0)
  const [formBody, setFormBody] = useState('')
  const [saving, setSaving] = useState(false)

  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportSending, setReportSending] = useState(false)
  const [reportDone, setReportDone] = useState(false)


  const fetchReviews = async () => {
    try {
      const [allRes, mineRes] = await Promise.all([
        axios.get(`/api/social/reviews/${mangaId}`),
        user ? axios.get(`/api/social/reviews/${mangaId}/mine`, { withCredentials: true }) : Promise.resolve({ data: { review: null } })
      ])
      setReviews(allRes.data.reviews)
      setAvg(allRes.data.avg)
      setCount(allRes.data.count)
      if (user) {
        setMyReview(mineRes.data.review)
        if (mineRes.data.review) {
          setFormRating(mineRes.data.review.rating)
          setFormBody(mineRes.data.review.body)
        }
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchReviews() }, [mangaId, user])

  const handleSubmit = async () => {
    if (!formRating) return
    setSaving(true)
    try {
      await axios.post(`/api/social/reviews/${mangaId}`, { rating: formRating, body: formBody }, { withCredentials: true })
      setShowForm(false)
      await fetchReviews()
    } catch {}
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete your review?')) return
    await axios.delete(`/api/social/reviews/${mangaId}`, { withCredentials: true })
    setMyReview(null)
    setFormRating(0)
    setFormBody('')
    await fetchReviews()
  }


  const submitReport = async (reason: string) => {
    if (!reportingId) return
    setReportSending(true)
    try {
      await axios.post('/api/social/reports', { targetType: 'review', targetId: reportingId, reason }, { withCredentials: true })
      setReportDone(true)
      setTimeout(() => { setReportingId(null); setReportDone(false); setReportReason('') }, 1500)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit report')
    }
    setReportSending(false)
  }

  const reportPresets = ['Spam', 'Harassment', 'Inappropriate content', 'Spoilers', 'Other']

  return (
    <div className="mt-8">
      {/* Report modal */}
      {reportingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setReportingId(null)}>
          <div className="bg-[#13131a] border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            {reportDone ? (
              <div className="text-center py-4">
                <p className="text-green-400 font-body text-sm font-medium">✓ Report submitted</p>
                <p className="text-text-muted font-body text-xs mt-1">Our team will review it shortly.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-base text-white tracking-wide">Report Review</h3>
                  <button onClick={() => setReportingId(null)} className="text-text-muted hover:text-white"><X size={15} /></button>
                </div>
                <p className="text-xs text-text-muted font-body mb-3">Why are you reporting this?</p>
                <div className="flex flex-col gap-2 mb-3">
                  {reportPresets.map(p => (
                    <button key={p} onClick={() => submitReport(p)} disabled={reportSending}
                      className="text-left px-3 py-2 glass border border-white/10 hover:border-primary/30 hover:text-primary text-sm text-text-muted font-body rounded-xl transition-all disabled:opacity-40">
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={reportReason} onChange={e => setReportReason(e.target.value)}
                    placeholder="Other reason…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text font-body outline-none focus:border-primary/40" />
                  <button onClick={() => reportReason.trim() && submitReport(reportReason.trim())} disabled={!reportReason.trim() || reportSending}
                    className="px-3 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl disabled:opacity-40 transition-all">
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* Header + average */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-2xl text-white tracking-wide">RATINGS & REVIEWS</h2>
          {count > 0 && avg !== null && (
            <div className="flex items-center gap-2">
              <span className="font-display text-3xl text-yellow-400">{avg.toFixed(1)}</span>
              <div>
                <StarRating value={Math.round(avg)} size={14} />
                <p className="text-xs text-text-muted font-body mt-0.5">{count} review{count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}
        </div>
        {user && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 glass border border-white/10 text-text-muted hover:text-text hover:border-primary/30 rounded-xl text-sm font-body transition-all">
            <Edit2 size={14} />
            {myReview ? 'Edit Review' : 'Write Review'}
          </button>
        )}
      </div>

      {/* Write/edit form */}
      {showForm && (
        <div className="glass border border-white/10 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-body text-sm text-text">{myReview ? 'Edit your review' : 'Write a review'}</p>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text">
              <X size={16} />
            </button>
          </div>
          <div className="mb-4">
            <p className="text-xs text-text-muted font-body mb-2 uppercase tracking-widest">Your Rating</p>
            <StarRating value={formRating} onChange={setFormRating} size={22} />
            {formRating > 0 && (
              <p className="text-xs text-yellow-400 font-body mt-1">{formRating}/10</p>
            )}
          </div>
          <textarea
            value={formBody}
            onChange={e => setFormBody(e.target.value)}
            placeholder="Share your thoughts (optional)..."
            rows={3}
            maxLength={1000}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-body outline-none focus:border-primary/40 resize-none mb-4"
          />
          <div className="flex gap-2 justify-between items-center">
            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={!formRating || saving}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-body rounded-xl transition-all disabled:opacity-40">
                {saving ? 'Saving…' : myReview ? 'Update' : 'Submit'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 glass border border-white/10 text-text-muted text-sm font-body rounded-xl hover:text-text transition-all">
                Cancel
              </button>
            </div>
            {myReview && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-body transition-colors">
                <Trash2 size={12} /> Delete review
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl border border-white/5">
          <Star size={32} className="text-text-muted mx-auto mb-3 opacity-30" />
          <p className="font-body text-text-muted text-sm">No reviews yet. Be the first!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map(r => (
            <div key={r._id} className={`glass border rounded-2xl p-4 ${r.userId === user?.id ? 'border-primary/20' : 'border-white/5'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {r.userAvatar
                    ? <img src={r.userAvatar} alt={r.userName} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />

                    : <img src={DEFAULT_CAT_AVATAR} alt={r.userName} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />

                  }
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-body text-sm text-text font-medium truncate">{r.userName}</p>
                      {r.userId === user?.id && <span className="text-[10px] text-primary font-body">You</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRating value={r.rating} size={11} />
                      <span className="text-xs text-yellow-400 font-mono">{r.rating}/10</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-text-muted font-body">{new Date(r.createdAt).toLocaleDateString()}</span>

                  {user && r.userId !== user?.id && (
                    <button onClick={() => setReportingId(r._id)}
                      className="p-1 text-text-muted hover:text-amber-400 transition-colors"
                      title="Report review">
                      <Flag size={12} />
                    </button>
                  )}

                  {(r.userId === user?.id) && (
                    <button onClick={() => { setFormRating(r.rating); setFormBody(r.body); setShowForm(true) }}
                      className="p-1 text-text-muted hover:text-primary transition-colors">
                      <Edit2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              {r.body && (
                <p className="mt-3 text-sm text-text-muted font-body leading-relaxed">{r.body}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}