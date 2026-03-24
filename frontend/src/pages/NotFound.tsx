import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-5 text-center">

      {/* Logo */}
      <Link to="/" className="inline-flex items-center gap-2 mb-12">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(232,57,77,0.5)]">
          <BookOpen size={18} className="text-white" />
        </div>
        <span className="font-display text-2xl tracking-wider text-white">MANGAVERSE</span>
      </Link>

      {/* 404 */}
      <div className="relative mb-6 select-none">
        <span className="font-display text-[10rem] leading-none text-white/5 absolute inset-0 flex items-center justify-center">
          404
        </span>
        <div className="relative z-10 w-32 h-32 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <BookOpen size={48} className="text-primary opacity-60" />
        </div>
      </div>

      <h1 className="font-display text-3xl text-white tracking-wide mb-3">PAGE NOT FOUND</h1>
      <p className="font-body text-text-muted text-sm max-w-sm leading-relaxed mb-10">
        The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-body text-sm rounded-xl transition-all hover:shadow-[0_0_20px_rgba(232,57,77,0.4)]">
          <Home size={15} /> Go Home
        </Link>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 py-2.5 glass border border-white/10 hover:border-white/20 text-text-muted hover:text-text font-body text-sm rounded-xl transition-all">
          <ArrowLeft size={15} /> Go Back
        </button>
        <Link to="/browse"
          className="flex items-center gap-2 px-5 py-2.5 glass border border-white/10 hover:border-white/20 text-text-muted hover:text-text font-body text-sm rounded-xl transition-all">
          <Search size={15} /> Browse Manga
        </Link>
      </div>
    </div>
  )
}