import { useEffect, useState } from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ size = 'md', text, fullScreen = false }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  }
  
  const content = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div className={`${sizes[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" 
          style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
      </div>
      {text && (
        <p className="text-gray-500 text-sm animate-pulse">{text}</p>
      )}
    </div>
  )
  
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    )
  }
  
  return content
}

export function LoadingDots({ text }: { text?: string }) {
  return (
    <div className="flex items-center space-x-2">
      <div className="flex space-x-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      {text && <span className="text-gray-500 text-sm ml-2">{text}</span>}
    </div>
  )
}

export function LoadingProgress({ progress, text }: { progress: number; text?: string }) {
  return (
    <div className="w-full max-w-md">
      <div className="flex justify-between mb-2">
        <span className="text-sm text-gray-600">{text || '处理中...'}</span>
        <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  )
}

export function PageTransition({ children, isLoading }: { children: React.ReactNode; isLoading: boolean }) {
  const [showContent, setShowContent] = useState(!isLoading)
  
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
    }
  }, [isLoading])
  
  return (
    <div className={`transition-all duration-300 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {children}
    </div>
  )
}

export function TypewriterText({ text, speed = 50 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  
  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)
      return () => clearTimeout(timer)
    }
  }, [currentIndex, text, speed])
  
  return (
    <span>
      {displayedText}
      {currentIndex < text.length && (
        <span className="inline-block w-0.5 h-4 bg-current ml-1 animate-blink" />
      )}
    </span>
  )
}

export function PulseDot({ color = 'blue' }: { color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500'
  }
  
  return (
    <span className="relative flex h-3 w-3">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[color]} opacity-75`}></span>
      <span className={`relative inline-flex rounded-full h-3 w-3 ${colors[color]}`}></span>
    </span>
  )
}
