import { useState, useEffect, useCallback } from 'react'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'
export type Orientation = 'portrait' | 'landscape'

export interface DeviceInfo {
  type: DeviceType
  orientation: Orientation
  width: number
  height: number
  isTouchDevice: boolean
  pixelRatio: number
}

export function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    orientation: 'landscape',
    width: window.innerWidth,
    height: window.innerHeight,
    isTouchDevice: false,
    pixelRatio: window.devicePixelRatio || 1
  })

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      let type: DeviceType = 'desktop'
      if (width < 768) {
        type = 'mobile'
      } else if (width < 1024) {
        type = 'tablet'
      }

      const orientation: Orientation = width > height ? 'landscape' : 'portrait'
      
      const isTouchDevice = 
        'ontouchstart' in window || 
        navigator.maxTouchPoints > 0

      setDeviceInfo({
        type,
        orientation,
        width,
        height,
        isTouchDevice,
        pixelRatio: window.devicePixelRatio || 1
      })
    }

    updateDeviceInfo()
    window.addEventListener('resize', updateDeviceInfo)
    window.addEventListener('orientationchange', updateDeviceInfo)

    return () => {
      window.removeEventListener('resize', updateDeviceInfo)
      window.removeEventListener('orientationchange', updateDeviceInfo)
    }
  }, [])

  return deviceInfo
}

export function useResponsiveValue<T>(values: {
  mobile?: T
  tablet?: T
  desktop?: T
}): T | undefined {
  const deviceInfo = useDeviceDetect()
  
  if (deviceInfo.type === 'mobile') return values.mobile
  if (deviceInfo.type === 'tablet') return values.tablet
  return values.desktop
}

export function useBreakpoint() {
  const deviceInfo = useDeviceDetect()
  
  return {
    isMobile: deviceInfo.type === 'mobile',
    isTablet: deviceInfo.type === 'tablet',
    isDesktop: deviceInfo.type === 'desktop',
    isPortrait: deviceInfo.orientation === 'portrait',
    isLandscape: deviceInfo.orientation === 'landscape',
    isTouchDevice: deviceInfo.isTouchDevice
  }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
}

export function useResponsiveLayout() {
  const deviceInfo = useDeviceDetect()
  
  const getGridColumns = useCallback((items: number) => {
    if (deviceInfo.type === 'mobile') {
      return Math.min(items, 1)
    }
    if (deviceInfo.type === 'tablet') {
      return Math.min(items, 2)
    }
    return items
  }, [deviceInfo.type])

  const getFontSize = useCallback((baseSize: number) => {
    if (deviceInfo.type === 'mobile') {
      return baseSize * 0.85
    }
    if (deviceInfo.type === 'tablet') {
      return baseSize * 0.95
    }
    return baseSize
  }, [deviceInfo.type])

  const getSpacing = useCallback((baseSpacing: number) => {
    if (deviceInfo.type === 'mobile') {
      return baseSpacing * 0.75
    }
    if (deviceInfo.type === 'tablet') {
      return baseSpacing * 0.9
    }
    return baseSpacing
  }, [deviceInfo.type])

  const getSidebarWidth = useCallback(() => {
    if (deviceInfo.type === 'mobile') {
      return '100%'
    }
    if (deviceInfo.type === 'tablet') {
      return '280px'
    }
    return '320px'
  }, [deviceInfo.type])

  const shouldShowMobileMenu = useCallback(() => {
    return deviceInfo.type === 'mobile'
  }, [deviceInfo.type])

  const shouldCollapseSidebar = useCallback(() => {
    return deviceInfo.type === 'mobile' || deviceInfo.type === 'tablet'
  }, [deviceInfo.type])

  return {
    deviceInfo,
    getGridColumns,
    getFontSize,
    getSpacing,
    getSidebarWidth,
    shouldShowMobileMenu,
    shouldCollapseSidebar
  }
}

export function getResponsiveClasses(deviceType: DeviceType): {
  container: string
  grid: string
  padding: string
  fontSize: string
} {
  switch (deviceType) {
    case 'mobile':
      return {
        container: 'w-full px-4',
        grid: 'grid-cols-1',
        padding: 'p-4',
        fontSize: 'text-sm'
      }
    case 'tablet':
      return {
        container: 'max-w-4xl mx-auto px-6',
        grid: 'grid-cols-2',
        padding: 'p-5',
        fontSize: 'text-base'
      }
    case 'desktop':
    default:
      return {
        container: 'max-w-5xl mx-auto px-8',
        grid: 'grid-cols-4',
        padding: 'p-6',
        fontSize: 'text-base'
      }
  }
}

export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement>,
  options?: {
    onSwipeLeft?: () => void
    onSwipeRight?: () => void
    onSwipeUp?: () => void
    onSwipeDown?: () => void
    onPinch?: (scale: number) => void
    onTap?: () => void
    threshold?: number
  }
) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchDistance, setTouchDistance] = useState<number | null>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        setTouchStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        })
      } else if (e.touches.length === 2) {
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        setTouchDistance(distance)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchDistance !== null && options?.onPinch) {
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        const scale = currentDistance / touchDistance
        options.onPinch(scale)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart) return

      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY
      }

      const deltaX = touchEnd.x - touchStart.x
      const deltaY = touchEnd.y - touchStart.y
      const threshold = options?.threshold || 50

      if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
        options?.onTap?.()
      } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > threshold) {
          options?.onSwipeRight?.()
        } else if (deltaX < -threshold) {
          options?.onSwipeLeft?.()
        }
      } else {
        if (deltaY > threshold) {
          options?.onSwipeDown?.()
        } else if (deltaY < -threshold) {
          options?.onSwipeUp?.()
        }
      }

      setTouchStart(null)
      setTouchDistance(null)
    }

    element.addEventListener('touchstart', handleTouchStart)
    element.addEventListener('touchmove', handleTouchMove)
    element.addEventListener('touchend', handleTouchEnd)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [elementRef, touchStart, touchDistance, options])
}

export function useVirtualKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      const windowHeight = window.innerHeight
      const heightDiff = windowHeight - viewportHeight

      if (heightDiff > 150) {
        setIsKeyboardOpen(true)
        setKeyboardHeight(heightDiff)
      } else {
        setIsKeyboardOpen(false)
        setKeyboardHeight(0)
      }
    }

    window.visualViewport?.addEventListener('resize', handleResize)
    return () => window.visualViewport?.removeEventListener('resize', handleResize)
  }, [])

  return { isKeyboardOpen, keyboardHeight }
}
