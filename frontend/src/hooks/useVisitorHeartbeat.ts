import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

// Generate or retrieve a stable session ID for this browser tab
function getSessionId(): string {
  let id = sessionStorage.getItem('mv_session_id')
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem('mv_session_id', id)
  }
  return id
}

const INTERVAL_MS = 30_000 // ping every 30s

export function useVisitorHeartbeat() {
  const location = useLocation()
  const { loading: authLoading } = useAuth()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionId = useRef(getSessionId())

  const ping = (path: string) => {
    // Don't ping until auth has resolved — otherwise logged-in users
    // appear as guests on the first heartbeat
    if (authLoading) return
    axios.post(
      '/api/visitors/heartbeat',
      {
        sessionId: sessionId.current,
        page: path,
        pageTitle: document.title,
        referrer: document.referrer || undefined,
      },
      { withCredentials: true }
    ).catch(() => {}) // silent fail — never block the UI
  }

  // Re-ping once auth finishes loading (catches the initial logged-in state)
  useEffect(() => {
    if (!authLoading) {
      ping(location.pathname)
    }
  }, [authLoading])

  // Ping on every route change (after auth is ready)
  useEffect(() => {
    if (!authLoading) {
      ping(location.pathname)
    }
  }, [location.pathname])

  // Keep-alive interval
  useEffect(() => {
    timerRef.current = setInterval(() => ping(location.pathname), INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [location.pathname])
}