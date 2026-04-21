const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function mediaUrl(path?: string | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE}${path}`
}