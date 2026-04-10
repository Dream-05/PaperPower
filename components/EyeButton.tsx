import { useState, useEffect, useRef } from 'react'

interface EyeButtonProps {
  onClick: () => void
  isOpen: boolean
  size?: number
}

export function EyeButton({ onClick, isOpen, size = 32 }: EyeButtonProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isBlinking, setIsBlinking] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        setIsBlinking(true)
        setTimeout(() => setIsBlinking(false), 150)
      }
    }, 3000)
    
    return () => clearInterval(blinkInterval)
  }, [])

  const calculateEyeOffset = () => {
    if (!buttonRef.current) return { x: 0, y: 0 }
    
    const rect = buttonRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const deltaX = mousePos.x - centerX
    const deltaY = mousePos.y - centerY
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const maxOffset = size * 0.15
    
    if (distance === 0) return { x: 0, y: 0 }
    
    const normalizedX = deltaX / distance
    const normalizedY = deltaY / distance
    
    const offset = Math.min(distance / 15, maxOffset)
    
    return {
      x: normalizedX * offset,
      y: normalizedY * offset
    }
  }

  const eyeOffset = calculateEyeOffset()
  const eyeHeight = isBlinking ? 0.1 : 1

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
      style={{ width: size, height: size }}
      title="AI智能助手"
    >
      <svg
        viewBox="0 0 100 100"
        className={`transition-all duration-300 ${isHovered ? 'drop-shadow-xl' : 'drop-shadow-lg'}`}
        style={{ 
          width: size, 
          height: size,
          transform: isOpen ? 'scale(0.95)' : 'scale(1)'
        }}
      >
        <defs>
          <linearGradient id="eyeBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="irisGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="40%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#3730a3" />
          </linearGradient>
          <radialGradient id="pupilGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0f0a1e" />
          </radialGradient>
          <filter id="eyeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366f1" floodOpacity="0.3"/>
          </filter>
          <filter id="innerGlow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <clipPath id="eyeClip">
            <ellipse cx="50" cy="50" rx="40" ry={40 * eyeHeight} />
          </clipPath>
        </defs>
        
        <ellipse
          cx="50"
          cy="50"
          rx="48"
          ry="48"
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          opacity="0.2"
          className="transition-all duration-200"
          style={{ transform: `scale(${isHovered ? 1.05 : 1})`, transformOrigin: 'center' }}
        />
        
        <ellipse
          cx="50"
          cy="50"
          rx="42"
          ry={42 * eyeHeight}
          fill="url(#eyeBgGradient)"
          stroke="#94a3b8"
          strokeWidth="1"
          filter="url(#eyeShadow)"
          className="transition-all duration-150"
        />
        
        {!isBlinking && (
          <g clipPath="url(#eyeClip)">
            <ellipse
              cx="50"
              cy="50"
              rx="38"
              ry="38"
              fill="white"
              opacity="0.5"
            />
            
            <circle
              cx={50 + eyeOffset.x * 1.5}
              cy={50 + eyeOffset.y * 1.5}
              r="18"
              fill="url(#irisGradient)"
              filter="url(#innerGlow)"
              className="transition-all duration-100"
            />
            
            <circle
              cx={50 + eyeOffset.x * 1.5}
              cy={50 + eyeOffset.y * 1.5}
              r="15"
              fill="none"
              stroke="#818cf8"
              strokeWidth="1"
              opacity="0.5"
            />
            
            <circle
              cx={50 + eyeOffset.x * 1.8}
              cy={50 + eyeOffset.y * 1.8}
              r="8"
              fill="url(#pupilGradient)"
              className="transition-all duration-100"
            />
            
            <circle
              cx={44 + eyeOffset.x * 1.2}
              cy={44 + eyeOffset.y * 1.2}
              r="4"
              fill="white"
              opacity="0.95"
              className="transition-all duration-100"
            />
            
            <circle
              cx={56 + eyeOffset.x * 0.8}
              cy={56 + eyeOffset.y * 0.8}
              r="2"
              fill="white"
              opacity="0.6"
              className="transition-all duration-100"
            />
            
            <circle
              cx={48 + eyeOffset.x * 1.4}
              cy={42 + eyeOffset.y * 1.4}
              r="1.5"
              fill="white"
              opacity="0.4"
              className="transition-all duration-100"
            />
          </g>
        )}
        
        {isHovered && !isBlinking && (
          <ellipse
            cx="50"
            cy="30"
            rx="15"
            ry="8"
            fill="white"
            opacity="0.4"
          />
        )}
        
        {isOpen && !isBlinking && (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            opacity="0.5"
            className="animate-pulse"
          />
        )}
      </svg>
      
      {isOpen && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-ping" />
      )}
    </button>
  )
}

export function DoubleEyeButton({ onClick, isOpen, size = 48 }: EyeButtonProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isBlinking, setIsBlinking] = useState(false)
  const containerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (Math.random() > 0.6) {
        setIsBlinking(true)
        setTimeout(() => setIsBlinking(false), 150)
      }
    }, 4000)
    
    return () => clearInterval(blinkInterval)
  }, [])

  const calculateEyeOffset = (eyeCenterX: number, eyeCenterY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + eyeCenterX
    const centerY = rect.top + eyeCenterY
    
    const deltaX = mousePos.x - centerX
    const deltaY = mousePos.y - centerY
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const maxOffset = size * 0.1
    
    if (distance === 0) return { x: 0, y: 0 }
    
    const normalizedX = deltaX / distance
    const normalizedY = deltaY / distance
    
    const offset = Math.min(distance / 20, maxOffset)
    
    return {
      x: normalizedX * offset,
      y: normalizedY * offset
    }
  }

  const eyeSize = size * 0.5
  const eyeSpacing = size * 0.55
  const eyeHeight = isBlinking ? 0.15 : 1

  const renderEye = (_centerX: number, index: number) => {
    const eyeOffset = calculateEyeOffset(
      size * 0.6 / 2 + (index === 0 ? 0 : eyeSpacing),
      eyeSize / 2
    )

    return (
      <svg
        key={index}
        viewBox="0 0 100 100"
        className={`transition-all duration-300 ${isHovered ? 'drop-shadow-lg' : ''}`}
        style={{ 
          width: eyeSize, 
          height: eyeSize,
        }}
      >
        <defs>
          <linearGradient id={`doubleEyeBg${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id={`doubleIris${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="40%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <radialGradient id={`doublePupil${index}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0f0a1e" />
          </radialGradient>
          <clipPath id={`doubleEyeClip${index}`}>
            <ellipse cx="50" cy="50" rx="42" ry={42 * eyeHeight} />
          </clipPath>
        </defs>
        
        <ellipse
          cx="50"
          cy="50"
          rx="45"
          ry={45 * eyeHeight}
          fill={`url(#doubleEyeBg${index})`}
          stroke="#c7d2fe"
          strokeWidth="1.5"
          className="transition-all duration-150"
        />
        
        {!isBlinking && (
          <g clipPath={`url(#doubleEyeClip${index})`}>
            <ellipse
              cx="50"
              cy="50"
              rx="40"
              ry="40"
              fill="white"
              opacity="0.3"
            />
            
            <circle
              cx={50 + eyeOffset.x * 1.8}
              cy={50 + eyeOffset.y * 1.8}
              r="16"
              fill={`url(#doubleIris${index})`}
              className="transition-all duration-75"
            />
            
            <circle
              cx={50 + eyeOffset.x * 1.8}
              cy={50 + eyeOffset.y * 1.8}
              r="13"
              fill="none"
              stroke="#a5b4fc"
              strokeWidth="1"
              opacity="0.6"
            />
            
            <circle
              cx={50 + eyeOffset.x * 2.2}
              cy={50 + eyeOffset.y * 2.2}
              r="7"
              fill={`url(#doublePupil${index})`}
              className="transition-all duration-75"
            />
            
            <circle
              cx={44 + eyeOffset.x * 1.4}
              cy={44 + eyeOffset.y * 1.4}
              r="3.5"
              fill="white"
              opacity="0.95"
              className="transition-all duration-75"
            />
            
            <circle
              cx={55 + eyeOffset.x}
              cy={55 + eyeOffset.y}
              r="1.8"
              fill="white"
              opacity="0.5"
              className="transition-all duration-75"
            />
          </g>
        )}
        
        {isHovered && !isBlinking && (
          <ellipse
            cx="50"
            cy="32"
            rx="12"
            ry="6"
            fill="white"
            opacity="0.5"
          />
        )}
      </svg>
    )
  }

  return (
    <button
      ref={containerRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex items-center gap-0.5 px-1 py-1 rounded-2xl transition-all duration-200 hover:bg-indigo-50/50 cursor-pointer"
      style={{ width: size * 1.2, height: size * 0.6 }}
      title="AI智能助手"
    >
      {renderEye(eyeSize / 2, 0)}
      {renderEye(eyeSize / 2 + eyeSpacing, 1)}
      
      {isOpen && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-3">
          <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-ping" />
          <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-ping" style={{ animationDelay: '0.15s' }} />
        </div>
      )}
    </button>
  )
}
