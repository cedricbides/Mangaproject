import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BookOpen, AlertCircle, Mail, CheckCircle } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  const { loginWithEmail } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!email || !password) { setError('Email and password are required'); return }
    setError('')
    setLoading(true)
    try {
      await loginWithEmail(email, password, rememberMe)
      navigate('/')
    } catch (err: any) {
      const data = err?.response?.data
      if (data?.pendingVerification) {
        setPendingEmail(data.email || email)
        setPendingVerification(true)
        setLoading(false)
        return
      }
      setError(data?.error || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    try {
      await axios.post('/api/auth/resend-verification', { email: pendingEmail }, { withCredentials: true })
      setResendSent(true)
    } catch {
      setResendSent(true)
    } finally {
      setResendLoading(false)
    }
  }

  // ── Pending verification screen ───────────────────────────────────────────
  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-5">
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(232,57,77,0.5)]">
            <BookOpen size={18} className="text-white" />
          </div>
          <span className="font-display text-3xl tracking-wider text-white">MANGAVERSE</span>
        </Link>
        <div className="w-full max-w-sm glass rounded-2xl overflow-hidden">
          <div className="h-1 bg-primary w-full" />
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Mail size={28} className="text-primary" />
            </div>
            <h2 className="font-display text-xl text-white mb-2">Check your inbox</h2>
            <p className="text-text-muted text-sm font-body mb-6 leading-relaxed">
              We sent a verification link to <span className="text-white font-medium">{pendingEmail}</span>.
              Click it to activate your account. The link expires in 24 hours.
            </p>
            {resendSent ? (
              <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-body">
                <CheckCircle size={14} /> Email resent! Check your inbox.
              </div>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendLoading}
                className="text-sm text-primary hover:underline font-body disabled:opacity-50"
              >
                {resendLoading ? 'Sending…' : "Didn't receive it? Resend"}
              </button>
            )}
            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={() => { setPendingVerification(false); setError('') }}
                className="text-sm text-text-muted hover:text-text font-body"
              >
                Back to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main login form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-5">

      <Link to="/" className="inline-flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(232,57,77,0.5)]">
          <BookOpen size={18} className="text-white" />
        </div>
        <span className="font-display text-3xl tracking-wider text-white">MANGAVERSE</span>
      </Link>

      <div className="w-full max-w-sm glass rounded-2xl overflow-hidden">
        <div className="h-1 bg-primary w-full" />
        <div className="p-8">
          <h1 className="font-display text-xl text-white text-center mb-6 tracking-wide">
            Sign in to your account
          </h1>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-text-muted font-body">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
                className="w-full bg-white/5 border border-white/10 focus:border-primary rounded-lg px-4 py-2.5 text-sm text-white placeholder-text-muted outline-none transition-colors font-body"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-text-muted font-body">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-white/5 border border-white/10 focus:border-primary rounded-lg px-4 py-2.5 text-sm text-white placeholder-text-muted outline-none transition-colors font-body"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="accent-primary w-3.5 h-3.5"
                />
                <span className="text-xs font-body text-text-muted">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-xs font-body text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm font-body bg-red-400/10 rounded-lg px-4 py-3">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-body font-semibold text-sm rounded-lg transition-all hover:shadow-[0_0_20px_rgba(232,57,77,0.4)] disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </div>

        <div className="px-8 py-4 bg-white/5 border-t border-white/10 text-center">
          <span className="text-sm font-body text-text-muted">New user? </span>
          <Link to="/register" className="text-sm font-body text-primary hover:underline">Register</Link>
        </div>
      </div>
    </div>
  )
}