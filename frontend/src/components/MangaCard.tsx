import { Link } from 'react-router-dom'
import { Heart, BookOpen, Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import type { Manga } from '@/types'
import { getCoverUrl, getMangaTitle, getMangaTags, getStatusColor } from '@/utils/manga'
import { useAuth } from '@/context/AuthContext'
import axios from 'axios'

interface Props {
  manga: Manga
  index?: number
}

// Simple cache so we don't refetch ratings on every render
const ratingCache: Record<string, { avg: number | null; count: number }> = {}

function RetryImage({
  src,
  alt,
  className,
  fallbackText,
}: {
  src: string
  alt: string
  className?: string
  fallbackText: string
}) {
  const [imgSrc, setImgSrc] = useState(src)
  const retriesRef = useRef(0)
  const maxRetries = 3

  // Reset when src changes (e.g. different manga)
  useEffect(() => {
    setImgSrc(src)
    retriesRef.current = 0
  }, [src])

  const handleError = () => {
    if (retriesRef.current < maxRetries) {
      retriesRef.current += 1
      const delay = 500 * retriesRef.current // 500ms, 1s, 1.5s
      setTimeout(() => {
        // Append a cache-bust param so the browser actually re-requests
        const separator = src.includes('?') ? '&' : '?'
        setImgSrc(`${src}${separator}_retry=${retriesRef.current}`)
      }, delay)
    } else {
      setImgSrc(
        `https://placehold.co/256x384/111118/6b6b8a?text=${encodeURIComponent(
          fallbackText.slice(0, 12)
        )}`
      )
    }
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={handleError}
    />
  )
}

export default function MangaCard({ manga, index = 0 }: Props) {
  const { toggleFavorite, isFavorite } = useAuth()
  const title = getMangaTitle(manga)
  const tags = getMangaTags(manga)
  const cover = getCoverUrl(manga, 256)
  const fav = isFavorite(manga.id)
  const [rating, setRating] = useState<{ avg: number | null; count: number } | null>(
    ratingCache[manga.id] || null
  )

  useEffect(() => {
    if (ratingCache[manga.id]) {
      setRating(ratingCache[manga.id])
      return
    }
    axios.get(`/api/social/reviews/${manga.id}`)
      .then(res => {
        const data = { avg: res.data.avg, count: res.data.count }
        ratingCache[manga.id] = data
        setRating(data)
      })
      .catch(() => {})
  }, [manga.id])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="manga-card group relative"
    >
      <Link to={`/manga/${manga.id}`} className="block">
        <div className="relative overflow-hidden rounded-xl">
          <RetryImage
            src={cover}
            alt={title}
            className="manga-cover"
            fallbackText={title}
          />

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl flex flex-col justify-end p-3">
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.slice(0, 2).map((tag) => (
                <span key={tag} className="badge bg-primary/20 text-primary border border-primary/30">{tag}</span>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-white/80 font-body">
              <BookOpen size={11} />
              <span>{manga.attributes.status}</span>
              <span
                className="w-1.5 h-1.5 rounded-full ml-1"
                style={{ background: getStatusColor(manga.attributes.status) }}
              />
            </div>
          </div>

          {/* Favorite button */}
          <button
            onClick={(e) => { e.preventDefault(); toggleFavorite(manga.id) }}
            className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all duration-200 ${
              fav ? 'bg-primary text-white' : 'bg-black/50 text-white/60 opacity-0 group-hover:opacity-100'
            }`}
          >
            <Heart size={13} fill={fav ? 'currentColor' : 'none'} />
          </button>

          {/* Star rating badge */}
          {rating && rating.avg !== null && rating.count > 0 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
              <Star size={11} className="text-yellow-400" fill="currentColor" />
              <span className="text-xs font-body text-white font-medium">
                {(rating.avg / 2).toFixed(1)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-2.5 px-0.5">
          <p className="font-body text-sm text-text font-medium line-clamp-2 leading-snug">{title}</p>
          <div className="flex items-center justify-between mt-0.5">
            {manga.attributes.year && (
              <p className="font-mono text-xs text-text-muted">{manga.attributes.year}</p>
            )}
            {rating && rating.avg !== null && rating.count > 0 && (
              <div className="flex items-center gap-1">
                <Star size={10} className="text-yellow-400" fill="currentColor" />
                <span className="font-mono text-xs text-text-muted">
                  {(rating.avg / 2).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}