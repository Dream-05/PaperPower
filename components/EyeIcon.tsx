import { useState, useEffect, useRef } from 'react'

interface EyeIconProps {
  size?: number
  className?: string
  color?: string
}

export function EyeIcon({ size = 24, className = '', color = '#6366f1' }: EyeIconProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const calculateOffset = () => {
    if (!ref.current) return { x: 0, y: 0 }
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const deltaX = mousePos.x - centerX
    const deltaY = mousePos.y - centerY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const maxOffset = 12
    if (distance === 0) return { x: 0, y: 0 }
    const normalizedX = deltaX / distance
    const normalizedY = deltaY / distance
    const offset = Math.min(distance / 15, maxOffset)
    return { x: normalizedX * offset, y: normalizedY * offset }
  }

  const offset = calculateOffset()

  return (
    <svg ref={ref} className={className} width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="38" fill="white" />
      <circle cx={50 + offset.x * 1.5} cy={50 + offset.y * 1.5} r="18" fill={color} />
      <circle cx={44 + offset.x} cy={44 + offset.y} r="5" fill="white" />
    </svg>
  )
}

export function DoubleEyeIcon({ size = 32, className = '', color = '#6366f1' }: EyeIconProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const calculateOffset = (eyeX: number, eyeY: number) => {
    if (!ref.current) return { x: 0, y: 0 }
    const rect = ref.current.getBoundingClientRect()
    const scale = size / 100
    const centerX = rect.left + eyeX * scale
    const centerY = rect.top + eyeY * scale
    const deltaX = mousePos.x - centerX
    const deltaY = mousePos.y - centerY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const maxOffset = 8
    if (distance === 0) return { x: 0, y: 0 }
    const normalizedX = deltaX / distance
    const normalizedY = deltaY / distance
    const offset = Math.min(distance / 20, maxOffset)
    return { x: normalizedX * offset, y: normalizedY * offset }
  }

  const leftEyeX = 25
  const rightEyeX = 75
  const eyeY = 50
  const leftOffset = calculateOffset(leftEyeX, eyeY)
  const rightOffset = calculateOffset(rightEyeX, eyeY)

  return (
    <svg ref={ref} className={className} width={size} height={size} viewBox="0 0 100 100">
      <circle cx={leftEyeX} cy={eyeY} r="20" fill="white" />
      <circle cx={rightEyeX} cy={eyeY} r="20" fill="white" />
      <circle cx={leftEyeX + leftOffset.x * 1.2} cy={eyeY + leftOffset.y * 1.2} r="10" fill={color} />
      <circle cx={rightEyeX + rightOffset.x * 1.2} cy={eyeY + rightOffset.y * 1.2} r="10" fill={color} />
      <circle cx={leftEyeX - 5 + leftOffset.x * 0.5} cy={eyeY - 5 + leftOffset.y * 0.5} r="3" fill="white" />
      <circle cx={rightEyeX - 5 + rightOffset.x * 0.5} cy={eyeY - 5 + rightOffset.y * 0.5} r="3" fill="white" />
    </svg>
  )
}
