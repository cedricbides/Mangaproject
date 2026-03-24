import { useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { BookOpen, Lock, AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import axios from 'axios'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!password) { setError('Password is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (!token) { setError('Missing reset token. Please use the link from your email.'); return }

    setLoading(true)
    try {
      await axios.post('/api/auth/reset-password', { token, password }, { withCredentials: true })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. The link may have expired.')
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
          <h1 className="font-display text-2xl text-white tracking-wide">Reset Password</h1>
          <p className="text-text-muted text-sm font-body mt-1">
            Choose a new password for your account
          </p>
        </div>

        <div className="glass rounded-3xl p-8">
          {!token ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <h2 className="font-display text-lg text-white mb-2">Invalid link</h2>
              <p className="text-text-muted text-sm font-body mb-6">
                This reset link is invalid. Please request a new one.
              </p>
              <Link to="/forgot-password" className="text-primary hover:underline font-body text-sm">
                Request new reset link
              </Link>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h2 className="font-display text-lg text-white mb-2">Password updated!</h2>
              <p className="text-text-muted text-sm font-body mb-4">
                Your password has been changed. Redirecting you to sign in…
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-body">
                <ArrowLeft size={14} /> Go to Sign In
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <Lock size={15} className="text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="New password (min. 8 characters)"
                  className="bg-transparent text-sm text-text placeholder-text-muted outline-none flex-1 font-body"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="text-text-muted hover:text-text transition-colors">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <Lock size={15} className="text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="Confirm new password"
                  className="bg-transparent text-sm text-text placeholder-text-muted outline-none flex-1 font-body"
                />
              </div>

              {/* Strength indicator */}
              {password.length > 0 && (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(level => {
                    const strength = password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 4
                      : password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
                      : password.length >= 8 ? 2 : 1
                    return (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= strength
                            ? strength >= 4 ? 'bg-green-400' : strength >= 3 ? 'bg-yellow-400' : strength >= 2 ? 'bg-orange-400' : 'bg-red-400'
                            : 'bg-white/10'
                        }`}
                      />
                    )
                  })}
                </div>
              )}

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
                {loading ? 'Updating…' : 'Set New Password'}
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