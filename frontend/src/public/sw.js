// frontend/public/sw.js
// Place this file at frontend/public/sw.js — Vite will serve it at /sw.js

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'MangaVerse', body: event.data.text(), link: '/' }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { link: payload.link || '/' },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(link)
          return
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(link)
    })
  )
})