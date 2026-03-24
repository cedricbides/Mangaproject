import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import axios from 'axios'


export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email) { setError('Email is required'); return }
    setError('')
    setLoading(true)
    try {
      await axios.post('/api/auth/forgot-password', { email }, { withCredentials: true })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-5">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(232,57,77,0.5)]">
              <BookOpen size={18} className="text-white" />
            </div>
            <span className="font-display text-3xl tracking-wider text-white">MANGAVERSE</span>
          </Link>
          <h1 className="font-display text-2xl text-white tracking-wide">Forgot Password</h1>
          <p className="text-text-muted text-sm font-body mt-1">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <div className="glass rounded-3xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h2 className="font-display text-lg text-white mb-2">Check your inbox</h2>
              <p className="text-text-muted text-sm font-body mb-6 leading-relaxed">
                If an account with <span className="text-text font-medium">{email}</span> exists,
                we've sent a password reset link. It expires in <strong className="text-text">1 hour</strong>.
              </p>
              <p className="text-xs text-text-muted font-body mb-6">
                Didn't receive it? Check your spam folder, or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-primary hover:underline"
                >
                  try again
                </button>.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text font-body transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <Mail size={15} className="text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="Email address"
                  className="bg-transparent text-sm text-text placeholder-text-muted outline-none flex-1 font-body"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm font-body bg-red-400/10 rounded-xl px-4 py-3">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-body font-medium text-sm rounded-xl transition-all hover:shadow-[0_0_20px_rgba(232,57,77,0.4)] disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm text-text-muted hover:text-text font-body transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}