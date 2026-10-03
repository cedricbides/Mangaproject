import { useState } from 'react'
import LogoMark from '@/components/LogoMark'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AlertCircle, CheckCircle } from 'lucide-react'
import axios from 'axios'
import BotShield, { captchaEnabled } from '@/components/BotShield'
import PasswordInput from '@/components/PasswordInput'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [honeypotValue, setHoneypotValue] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)

  const resetCaptcha = () => { setTurnstileToken(null); setCaptchaReset(k => k + 1) }

  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Username is required'); return }
    if (!email) { setError('Email is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setError('')
    setLoading(true)
    try {
      await axios.post('/api/auth/register', {
        name: name.trim(), email, password,
        website: honeypotValue,
        turnstileToken,
      }, { withCredentials: true })
      setSuccess(true)
      setTimeout(() => navigate('/login', { state: location.state }), 2000)
    } catch (err: any) {
      const data = err?.response?.data
      resetCaptcha()
      if (err?.response?.status === 403) {
        setError('Registration is currently closed. Please check back later.')
      } else {
        setError(data?.error || 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-5">

      <Link to="/" className="inline-flex items-center gap-2 mb-8">
        <LogoMark size={48} />
        <span className="font-display text-3xl tracking-wider text-text">MANGAVERSE</span>
      </Link>

      <div className="w-full max-w-sm glass rounded-2xl overflow-hidden">
        <div className="h-1 bg-primary w-full" />
        <div className="p-8">

          {success ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h1 className="font-display text-xl text-text tracking-wide">Account Created!</h1>
              <p className="text-sm text-text-muted font-body">
                Your account has been created successfully.<br />
                Redirecting to login...
              </p>
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mt-2" />
              <Link to="/login" state={location.state} className="text-sm text-primary hover:underline font-body">
                Go to Login now →
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs text-primary text-right font-body mb-2">* Required fields</p>
              <h1 className="font-display text-xl text-text text-center mb-6 tracking-wide">Register</h1>

              <div className="flex flex-col gap-4">

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-text-muted font-body">
                    Username <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                    className="w-full bg-[var(--card)] border border-[var(--border)] focus:border-primary rounded-lg px-4 py-2.5 text-sm text-text placeholder-text-muted outline-none transition-colors font-body"
                    placeholder="Your username"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-text-muted font-body">
                    Password <span className="text-primary">*</span>
                  </label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-text-muted font-body">
                    Confirm password <span className="text-primary">*</span>
                  </label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-text-muted font-body">
                    Email <span className="text-primary">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    className="w-full bg-[var(--card)] border border-[var(--border)] focus:border-primary rounded-lg px-4 py-2.5 text-sm text-text placeholder-text-muted outline-none transition-colors font-body"
                    placeholder="you@example.com"
                  />
                </div>

                <BotShield onToken={setTurnstileToken} onHoneypot={setHoneypotValue} resetKey={captchaReset} />

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm font-body bg-red-400/10 rounded-lg px-4 py-3">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Link to="/login" state={location.state} className="text-sm text-primary hover:underline font-body text-center">
                  « Back to Login
                </Link>

                <button
                  onClick={handleSubmit}
                  disabled={loading || (captchaEnabled && !turnstileToken)}
                  className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-body font-semibold text-sm rounded-lg transition-all hover:shadow-[0_0_20px_rgba(232,57,77,0.4)] disabled:opacity-50"
                >
                  {loading ? 'Creating account…' : 'Register'}
                </button>

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}