import { useId } from 'react'

// MangaVerse mark: an "M" drawn as a fox face. The two sharp peaks are the ears,
// the cheeks taper to a chin, and the small triangle is the nose.
// Uses the brand red → amber gradient;
// (amber nose is visible on the light, dim and dark themes).
export default function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const gid = useId().replace(/:/g, '')
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"
      className={`flex-shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8394d" />
          <stop offset="1" stopColor="#f5a623" />
        </linearGradient>
      </defs>
      <path d="M14 43 L6.5 6 L24 24 L41.5 6 L34 43" fill="none" stroke={`url(#${gid})`}
        strokeWidth="6.5" strokeLinejoin="miter" strokeMiterlimit="12" />
      <path d="M19.5 34 H28.5 L24 41 Z" fill="#f5a623" />
    </svg>
  )
}
