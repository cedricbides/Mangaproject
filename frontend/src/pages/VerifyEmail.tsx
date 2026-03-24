import { useEffect, useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // If already logged in and verified, redirect home
  useEffect(() => {
    if (user?.emailVerified) navigate('/', { replace: true })
  }, [user, navigate])

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      setMessage('No verification token found. Please use the link from your email.')
      return
    }

    axios.post('/api/auth/verify-email', { token }, { withCredentials: true })
      .then((res) => {
        setStatus('success')
        // Auth context will be refreshed on next /me call; redirect after brief delay
        setTimeout(() => navigate('/'), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.error || 'Verification failed. The link may have expired.')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        </div>

        <div className="glass rounded-3xl p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 size={40} className="text-primary mx-auto mb-4 animate-spin" />
              <h2 className="font-display text-xl text-white mb-2">Verifying your email…</h2>
              <p className="text-text-muted text-sm font-body">Just a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h2 className="font-display text-xl text-white mb-2">Email verified!</h2>
              <p className="text-text-muted text-sm font-body">
                Your account is now active. Redirecting you to the homepage…
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-red-400" />
              </div>
              <h2 className="font-display text-xl text-white mb-2">Verification failed</h2>
              <p className="text-text-muted text-sm font-body mb-6 leading-relaxed">{message}</p>
              <Link
                to="/login"
                className="inline-block px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-body text-sm rounded-xl transition-all"
              >
                Back to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}