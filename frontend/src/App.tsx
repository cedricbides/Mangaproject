import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import ProtectedRoute from '@/components/ProtectedRoute'
import ErrorBoundary from '@/components/ErrorBoundary'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Navbar from '@/components/Navbar'
import { useVisitorHeartbeat } from '@/hooks/useVisitorHeartbeat'
import axios from 'axios'

const Home            = lazy(() => import('@/pages/Home'))
const Browse          = lazy(() => import('@/pages/Browse'))
const Catalog         = lazy(() => import('@/pages/Catalog'))
const MangaDetail     = lazy(() => import('@/pages/MangaDetail'))
const Reader          = lazy(() => import('@/pages/Reader'))
const Favorites       = lazy(() => import('@/pages/Favorites'))
const Profile         = lazy(() => import('@/pages/Profile'))
const Login           = lazy(() => import('@/pages/Login'))
const Register        = lazy(() => import('@/pages/Register'))
const Admin           = lazy(() => import('@/pages/Admin'))
const LocalMangaDetail = lazy(() => import('@/pages/LocalMangaDetail'))
const LocalReader     = lazy(() => import('@/pages/LocalReader'))
const ManualReader    = lazy(() => import('@/pages/ManualReader'))
const Feed            = lazy(() => import('@/pages/Feed'))
const PublicProfile   = lazy(() => import('@/pages/PublicProfile'))
const MangaRequests   = lazy(() => import('@/pages/MangaRequests'))
const MyDownloads     = lazy(() => import('@/pages/MyDownloads'))
const Downloads       = lazy(() => import('@/pages/Downloads'))
const VerifyEmail     = lazy(() => import('@/pages/VerifyEmail'))
const ForgotPassword  = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword   = lazy(() => import('@/pages/ResetPassword'))
const MyList          = lazy(() => import('@/pages/Mylist'))
const Stats           = lazy(() => import('@/pages/Stats'))
const NotFound        = lazy(() => import('@/pages/NotFound'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary fallback={
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
              <p className="text-white font-display text-xl">Something went wrong</p>
              <p className="text-text-muted font-body text-sm">This page had an error. Try refreshing.</p>
              <button onClick={() => { reset(); window.location.reload() }}
                className="px-4 py-2 bg-primary/20 border border-primary/40 text-primary rounded-xl text-sm font-body hover:bg-primary/30 transition-colors">
                Reload page
              </button>
            </div>
          }>
            {children}
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </div>
  )
}

function HeartbeatMount() {
  useVisitorHeartbeat()
  return null
}

// ── Maintenance gate — wraps entire app ───────────────────────────────────────
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [maintenance, setMaintenance] = useState<{ on: boolean; message: string } | null>(null)

  const isAdmin = user && ['admin', 'superadmin', 'moderator'].includes((user as any).role)

  // Allow access to login/auth pages even during maintenance so admins can sign in
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].includes(location.pathname)

  useEffect(() => {
    axios.get('/api/admin/site-status')
      .then(res => setMaintenance({
        on: !!res.data.maintenanceMode,
        message: res.data.maintenanceMessage || 'We are down for maintenance. Check back soon.',
      }))
      .catch(() => setMaintenance({ on: false, message: '' }))
  }, [])

  // Wait for both auth and maintenance check to resolve
  if (loading || maintenance === null) return <PageLoader />

  // Admins bypass — show floating badge + full site
  if (isAdmin || !maintenance.on || isAuthPage) {
    return (
      <>
        {maintenance.on && isAdmin && (
          <a
            href="/admin"
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 transition-colors rounded-xl shadow-lg shadow-red-900/40 border border-red-400/30"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <span className="text-white text-xs font-body font-semibold tracking-wide">Maintenance Mode ON</span>
          </a>
        )}
        {children}
      </>
    )
  }

  // Everyone else — full block page, no navbar, no navigation
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <h1 className="font-display text-3xl text-white mb-3">Down for Maintenance</h1>
        <p className="text-[#6b7280] font-body text-sm leading-relaxed mb-6">{maintenance.message}</p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-body transition-colors"
        >
          Admin sign in
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HeartbeatMount />
        <MaintenanceGate>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"                   element={<Layout><Home /></Layout>} />
              <Route path="/browse"             element={<Layout><Browse /></Layout>} />
              <Route path="/catalog"            element={<Layout><Catalog /></Layout>} />
              <Route path="/trending"           element={<Layout><Browse /></Layout>} />
              <Route path="/manga/:id"          element={<Layout><MangaDetail /></Layout>} />
              <Route path="/read/:chapterId"    element={<Reader />} />
              <Route path="/favorites"          element={<ProtectedRoute><Layout><Favorites /></Layout></ProtectedRoute>} />
              <Route path="/profile"            element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
              <Route path="/downloads"          element={<Layout><Downloads /></Layout>} />
              <Route path="/my-downloads"       element={<ProtectedRoute><Layout><MyDownloads /></Layout></ProtectedRoute>} />
              <Route path="/my-list"            element={<Layout><MyList /></Layout>} />
              <Route path="/stats"              element={<ProtectedRoute><Layout><Stats /></Layout></ProtectedRoute>} />
              <Route path="/login"              element={<Login />} />
              <Route path="/register"           element={<Register />} />
              <Route path="/admin"              element={<ProtectedRoute requireAdmin><Layout><Admin /></Layout></ProtectedRoute>} />
              <Route path="/local/:id"          element={<Layout><LocalMangaDetail /></Layout>} />
              <Route path="/read/local/:chapterId"  element={<LocalReader />} />
              <Route path="/read/manual/:chapterId" element={<ManualReader />} />
              <Route path="/feed"               element={<Layout><Feed /></Layout>} />
              <Route path="/profile/:userId"    element={<Layout><PublicProfile /></Layout>} />
              <Route path="/requests"           element={<Layout><MangaRequests /></Layout>} />
              <Route path="/verify-email"       element={<VerifyEmail />} />
              <Route path="/forgot-password"    element={<ForgotPassword />} />              <Route path="/reset-password"     element={<ResetPassword />} />
              <Route path="*"                   element={<NotFound />} />
            </Routes>
          </Suspense>
        </MaintenanceGate>
      </AuthProvider>
    </BrowserRouter>
  )
}