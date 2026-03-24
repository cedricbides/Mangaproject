// frontend/src/hooks/usePushNotifications.ts

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading')
  const [error, setError] = useState<string | null>(null)

  // Check current state on mount
  useEffect(() => {
    async function checkState() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        setState(sub ? 'subscribed' : 'unsubscribed')
      } catch {
        setState('unsubscribed')
      }
    }
    checkState()
  }, [])

  const subscribe = useCallback(async () => {
    setError(null)
    setState('loading')
    try {
      // 1. Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // 2. Get VAPID public key from backend
      const { data } = await axios.get('/api/push/vapid-public-key', { withCredentials: true })
      const applicationServerKey = urlBase64ToUint8Array(data.publicKey).buffer as ArrayBuffer

      // 3. Request push subscription
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        setError('Notification permission was denied.')
        return
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      // 4. Send subscription to backend
      await axios.post('/api/push/subscribe', subscription.toJSON(), { withCredentials: true })

      setState('subscribed')
    } catch (err: any) {
      setError(err.message || 'Failed to enable push notifications')
      setState('unsubscribed')
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setError(null)
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await axios.post('/api/push/unsubscribe', { endpoint: sub.endpoint }, { withCredentials: true })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch (err: any) {
      setError(err.message || 'Failed to disable push notifications')
      setState('subscribed')
    }
  }, [])

  return { state, error, subscribe, unsubscribe }
}