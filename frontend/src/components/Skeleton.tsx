export function MangaCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="skeleton rounded-xl" style={{ aspectRatio: '2/3' }} />
      <div className="mt-2.5 space-y-1.5">
        <div className="skeleton h-3.5 rounded w-full" />
        <div className="skeleton h-3 rounded w-2/3" />
      </div>
    </div>
  )
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => <MangaCardSkeleton key={i} />)}
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-5 pt-24 pb-16 animate-pulse">
      <div className="skeleton h-48 rounded-2xl mb-4 w-full" />
      <div className="flex items-end gap-4 -mt-12 px-4 mb-6">
        <div className="skeleton w-24 h-24 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2 pb-2">
          <div className="skeleton h-6 rounded w-48" />
          <div className="skeleton h-4 rounded w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-5 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="skeleton h-3.5 rounded w-32" />
              <div className="skeleton h-3 rounded w-20" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="skeleton h-3 rounded w-full" />
            <div className="skeleton h-3 rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-5 pt-28 pb-16 animate-pulse">
      <div className="skeleton h-8 rounded w-64 mb-2" />
      <div className="skeleton h-4 rounded w-40 mb-8" />
      <GridSkeleton count={12} />
    </div>
  )
}