import { useState, useRef, useEffect } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  width?: number | string
  height?: number | string
  placeholderColor?: string
  onClick?: () => void
  onLoad?: () => void
}

export default function LazyImage({
  src,
  alt,
  className = '',
  width,
  height,
  placeholderColor = '#e5e7eb',
  onClick,
  onLoad
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '50px' }
    )

    observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
      role="img"
      aria-label={alt}
    >
      {!isLoaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ backgroundColor: placeholderColor }}
          aria-hidden="true"
        >
          <svg
            className="w-8 h-8 text-gray-300 dark:text-gray-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClick}
          onLoad={() => {
            setIsLoaded(true)
            onLoad?.()
          }}
          onError={() => setHasError(true)}
        />
      )}

      {hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800"
          style={{ backgroundColor: placeholderColor }}
        >
          <span className="text-xs text-gray-400 px-2 text-center truncate max-w-[80%]">
            图片加载失败
          </span>
        </div>
      )}
    </div>
  )
}
