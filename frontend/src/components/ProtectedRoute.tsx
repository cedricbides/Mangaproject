// frontend/src/components/ProtectedRoute.tsx
// Redirects unauthenticated or unauthorized users at the router level.
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface Props {
  children: React.ReactNode
  requireAdmin?: boolean
  requireStaff?: boolean
}

export default function ProtectedRoute({ children, requireAdmin, requireStaff }: Props) {
  const { user, loading, isAdmin, isStaff } = useAuth()
  const location = useLocation()

  // Wait for auth to load before deciding
  if (loading) return null

  // Guests must sign in first (Register is one click away); remember the page they wanted
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />
  if (requireStaff && !isStaff) return <Navigate to="/" replace />

  return <>{children}</>
}