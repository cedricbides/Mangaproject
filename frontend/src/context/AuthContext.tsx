import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import axios from 'axios'
import type { User } from '@/types'

export type Theme = 'dark' | 'dim' | 'light'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isModerator: boolean
  isStaff: boolean
  hasPerm: (perm: string) => boolean
  theme: Theme
  setTheme: (theme: Theme) => void
  logout: () => void
  loginWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  toggleFavorite: (mangaId: string) => Promise<void>
  isFavorite: (mangaId: string) => boolean
  updateProfile: (fields: { avatar?: string; bannerUrl?: string; bio?: string; theme?: Theme }) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function applyTheme(t: Theme) {
  const html = document.documentElement
  html.classList.remove('theme-dark', 'theme-dim', 'theme-light')
  html.classList.add(`theme-${t}`)
  localStorage.setItem('theme', t)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize from localStorage immediately to avoid flash
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })

  // Apply theme class whenever it changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Load user — sync theme from profile if logged in
  useEffect(() => {
    axios.get('/api/auth/me', { withCredentials: true })
      .then((res) => {
        const u = res.data.user
        setUser(u)
        if (u?.theme) setThemeState(u.theme)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const setTheme = useCallback(async (t: Theme) => {
    setThemeState(t)
    if (user) {
      try {
        await axios.patch('/api/auth/profile', { theme: t }, { withCredentials: true })
        setUser(prev => prev ? { ...prev, theme: t } : null)
      } catch {}
    }
  }, [user])

  const loginWithEmail = async (email: string, password: string, rememberMe = true) => {
    const res = await axios.post('/api/auth/login', { email, password, rememberMe }, { withCredentials: true })
    if (res.data.pendingVerification) {
      const err: any = new Error('pendingVerification')
      err.response = { data: { pendingVerification: true, email: res.data.email } }
      throw err
    }
    const u = res.data.user
    setUser(u)
    if (u?.theme) setThemeState(u.theme)
  }

  const register = async (name: string, email: string, password: string) => {
    const res = await axios.post('/api/auth/register', { name, email, password }, { withCredentials: true })
    if (res.data.pendingVerification) {
      const err: any = new Error('pendingVerification')
      err.response = { data: { pendingVerification: true, email }, status: 201 }
      throw err
    }
    setUser(res.data.user)
  }

  const logout = async () => {
    await axios.get('/api/auth/logout', { withCredentials: true })
    setUser(null)
    window.location.href = '/'
  }

  const toggleFavorite = async (mangaId: string) => {
    if (!user) { window.location.href = '/login'; return }
    const res = await axios.post('/api/favorites/toggle', { mangaId }, { withCredentials: true })
    setUser(prev => prev ? { ...prev, favorites: res.data.favorites } : null)
  }

  const updateProfile = async (fields: { avatar?: string; bannerUrl?: string; bio?: string; theme?: Theme }) => {
    await axios.patch('/api/auth/profile', fields, { withCredentials: true })
    setUser(prev => prev ? { ...prev, ...fields } : null)
    if (fields.theme) setThemeState(fields.theme)
  }

  const isFavorite = (mangaId: string) => user?.favorites?.includes(mangaId) ?? false
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const isSuperAdmin = user?.role === 'superadmin'
  const isModerator = user?.role === 'moderator'
  const isStaff = user?.role === 'moderator' || user?.role === 'admin' || user?.role === 'superadmin'

  const hasPerm = (perm: string) => {
    if (!user) return false
    if (user.role === 'superadmin') return true
    return user.adminPermissions?.includes(perm) ?? false
  }

  return (
    <AuthContext.Provider value={{
      user, loading, isAdmin, isSuperAdmin, isModerator, isStaff, hasPerm,
      theme, setTheme,
      logout, loginWithEmail, register, toggleFavorite, isFavorite, updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}