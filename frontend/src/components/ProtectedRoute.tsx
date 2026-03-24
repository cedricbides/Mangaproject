// frontend/src/components/ProtectedRoute.tsx
// Redirects unauthenticated or unauthorized users at the router level.
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface Props {
  children: React.ReactNode
  requireAdmin?: boolean
  requireStaff?: boolean
}

export default function ProtectedRoute({ children, requireAdmin, requireStaff }: Props) {
  const { user, loading, isAdmin, isStaff } = useAuth()

  // Wait for auth to load before deciding
  if (loading) return null

  if (!user) return <Navigate to="/login" replace />
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />
  if (requireStaff && !isStaff) return <Navigate to="/" replace />

  return <>{children}</>
}