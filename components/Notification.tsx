import { useState, useEffect, useCallback, createContext, useContext } from 'react'

type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration: number
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (type: NotificationType, title: string, message: string, duration?: number) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  const addNotification = useCallback((type: NotificationType, title: string, message: string, duration = 4000) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setNotifications(prev => [...prev, { id, type, title, message, duration }])
  }, [])
  
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])
  
  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
    </NotificationContext.Provider>
  )
}

function NotificationContainer({ 
  notifications, 
  removeNotification 
}: { 
  notifications: Notification[]
  removeNotification: (id: string) => void 
}) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {notifications.map(notification => (
        <NotificationItem 
          key={notification.id} 
          notification={notification} 
          onClose={() => removeNotification(notification.id)} 
        />
      ))}
    </div>
  )
}

function NotificationItem({ 
  notification, 
  onClose 
}: { 
  notification: Notification
  onClose: () => void 
}) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  
  useEffect(() => {
    const startTime = Date.now()
    const duration = notification.duration
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      
      if (remaining <= 0) {
        clearInterval(interval)
        handleClose()
      }
    }, 50)
    
    return () => clearInterval(interval)
  }, [notification.duration])
  
  const handleClose = () => {
    setIsExiting(true)
    setTimeout(onClose, 300)
  }
  
  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  
  const colors = {
    success: 'from-green-400 to-green-500',
    error: 'from-red-400 to-red-500',
    warning: 'from-yellow-400 to-orange-500',
    info: 'from-blue-400 to-blue-500'
  }
  
  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  }
  
  const textColors = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  }
  
  return (
    <div
      className={`transform transition-all duration-300 ${
        isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100 animate-slideInRight'
      }`}
    >
      <div className={`${bgColors[notification.type]} border rounded-lg shadow-lg overflow-hidden`}>
        <div className="p-4 flex items-start space-x-3">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[notification.type]} 
            flex items-center justify-center text-white flex-shrink-0`}>
            {icons[notification.type]}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${textColors[notification.type]}`}>
              {notification.title}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {notification.message}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-1 bg-gray-200">
          <div 
            className={`h-full bg-gradient-to-r ${colors[notification.type]} transition-all duration-100`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
