import { useState, useRef } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  ripple?: boolean
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  ripple = true,
  className = '',
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  const baseStyles = 'relative overflow-hidden font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2'
  
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md hover:shadow-lg active:shadow-md',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300',
    outline: 'border-2 border-blue-500 text-blue-500 hover:bg-blue-50 active:bg-blue-100',
    ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
    danger: 'bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 shadow-md hover:shadow-lg'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (ripple && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const id = Date.now()
      
      setRipples(prev => [...prev, { x, y, id }])
      
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id))
      }, 600)
    }
    
    onClick?.(e)
  }
  
  return (
    <button
      ref={buttonRef}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} 
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full animate-ripple"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20
          }}
        />
      ))}
      {loading ? (
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  tooltip?: string
}

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  tooltip,
  className = '',
  ...props
}: IconButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }
  
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    outline: 'border border-gray-300 text-gray-600 hover:bg-gray-50',
    ghost: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
  }
  
  return (
    <div className="relative inline-block">
      <button
        className={`${sizes[size]} ${variants[variant]} rounded-full flex items-center justify-center
          transition-all duration-200 hover:scale-110 active:scale-95 ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        {...props}
      >
        {icon}
      </button>
      {tooltip && showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 
          bg-gray-800 text-white text-xs rounded whitespace-nowrap animate-fadeIn z-50">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 
            border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  )
}

interface ToggleButtonProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function ToggleButton({ checked, onChange, label, disabled }: ToggleButtonProps) {
  return (
    <label className={`flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={e => !disabled && onChange(e.target.checked)}
        />
        <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
          checked ? 'bg-blue-500' : 'bg-gray-300'
        }`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow 
            transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
        </div>
      </div>
      {label && <span className="ml-3 text-gray-700">{label}</span>}
    </label>
  )
}

interface FloatingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}

export function FloatingButton({
  icon,
  children,
  position = 'bottom-right',
  className = '',
  ...props
}: FloatingButtonProps) {
  const positions = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  }
  
  return (
    <button
      className={`fixed ${positions[position]} w-14 h-14 rounded-full 
        bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg
        flex items-center justify-center
        hover:shadow-xl hover:scale-110 active:scale-95
        transition-all duration-200 ${className}`}
      {...props}
    >
      {icon || children}
    </button>
  )
}
