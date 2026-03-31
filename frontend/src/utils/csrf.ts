let csrfToken = ''

// Keep hardcoded backend URL for Render deployment.
// Relative URLs don't work because the nginx proxy points to a Docker-internal
// hostname (mangaverse-backend:5000) that doesn't exist on Render.
export async function initCsrf(): Promise<void> {
  try {
    const res = await fetch(`https://mangaproject.onrender.com/api/csrf-token`, { credentials: 'include' })
    const data = await res.json()
    csrfToken = data.token
  } catch (err) {
    console.error('[csrf] Failed to fetch CSRF token:', err)
  }
}

export function getCsrfToken(): string {
  return csrfToken
}