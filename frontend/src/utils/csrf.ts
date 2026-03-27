let csrfToken = ''

export async function initCsrf(): Promise<void> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL ?? ''
    const res = await fetch(`${apiUrl}/api/csrf-token`, { credentials: 'include' })
    const data = await res.json()
    csrfToken = data.token
  } catch (err) {
    console.error('[csrf] Failed to fetch CSRF token:', err)
  }
}

export function getCsrfToken(): string {
  return csrfToken
}