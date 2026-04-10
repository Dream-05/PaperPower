export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ErrorCategory = 
  | 'file' 
  | 'network' 
  | 'validation' 
  | 'permission' 
  | 'system' 
  | 'ai' 
  | 'rendering' 
  | 'unknown'

export interface AppError {
  id: string
  code: string
  message: string
  userMessage: string
  severity: ErrorSeverity
  category: ErrorCategory
  timestamp: Date
  context?: Record<string, any>
  stack?: string
  recoverable: boolean
  recoveryOptions?: RecoveryOption[]
}

export interface RecoveryOption {
  label: string
  action: () => Promise<void> | void
  primary?: boolean
}

export interface ErrorHandler {
  (error: AppError): void
}

class ErrorManager {
  private errors: AppError[] = []
  private handlers: ErrorHandler[] = []
  private maxErrors = 100

  generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  createError(
    code: string,
    message: string,
    options: {
      userMessage?: string
      severity?: ErrorSeverity
      category?: ErrorCategory
      context?: Record<string, any>
      recoverable?: boolean
      recoveryOptions?: RecoveryOption[]
      originalError?: Error
    } = {}
  ): AppError {
    const error: AppError = {
      id: this.generateId(),
      code,
      message,
      userMessage: options.userMessage || this.getUserFriendlyMessage(code, message),
      severity: options.severity || this.determineSeverity(code),
      category: options.category || this.determineCategory(code),
      timestamp: new Date(),
      context: options.context,
      stack: options.originalError?.stack,
      recoverable: options.recoverable !== undefined ? options.recoverable : this.isRecoverable(code),
      recoveryOptions: options.recoveryOptions || this.getDefaultRecoveryOptions(code)
    }

    return error
  }

  private getUserFriendlyMessage(code: string, originalMessage: string): string {
    const messages: Record<string, string> = {
      'FILE_NOT_FOUND': '文件未找到，请检查文件路径是否正确。',
      'FILE_READ_ERROR': '无法读取文件，文件可能已损坏或权限不足。',
      'FILE_WRITE_ERROR': '无法保存文件，请检查磁盘空间和写入权限。',
      'FILE_FORMAT_ERROR': '文件格式不支持或已损坏。',
      'FILE_TOO_LARGE': '文件过大，请选择较小的文件。',
      'NETWORK_ERROR': '网络连接失败，请检查网络设置。',
      'NETWORK_TIMEOUT': '网络请求超时，请稍后重试。',
      'VALIDATION_ERROR': '输入数据验证失败，请检查输入内容。',
      'PERMISSION_DENIED': '权限不足，请检查文件或系统权限。',
      'SYSTEM_ERROR': '系统错误，请重启应用程序。',
      'AI_ERROR': 'AI处理失败，请稍后重试。',
      'AI_TIMEOUT': 'AI处理超时，请简化输入内容后重试。',
      'RENDERING_ERROR': '渲染错误，请刷新页面。',
      'OUT_OF_MEMORY': '内存不足，请关闭其他应用程序后重试。',
      'UNKNOWN_ERROR': '发生未知错误，请稍后重试。'
    }

    return messages[code] || originalMessage
  }

  private determineSeverity(code: string): ErrorSeverity {
    const severityMap: Record<string, ErrorSeverity> = {
      'FILE_NOT_FOUND': 'medium',
      'FILE_READ_ERROR': 'high',
      'FILE_WRITE_ERROR': 'high',
      'FILE_FORMAT_ERROR': 'medium',
      'FILE_TOO_LARGE': 'medium',
      'NETWORK_ERROR': 'medium',
      'NETWORK_TIMEOUT': 'low',
      'VALIDATION_ERROR': 'low',
      'PERMISSION_DENIED': 'high',
      'SYSTEM_ERROR': 'critical',
      'AI_ERROR': 'medium',
      'AI_TIMEOUT': 'low',
      'RENDERING_ERROR': 'high',
      'OUT_OF_MEMORY': 'critical',
      'UNKNOWN_ERROR': 'medium'
    }

    return severityMap[code] || 'medium'
  }

  private determineCategory(code: string): ErrorCategory {
    if (code.startsWith('FILE_')) return 'file'
    if (code.startsWith('NETWORK_')) return 'network'
    if (code.startsWith('VALIDATION_')) return 'validation'
    if (code.startsWith('PERMISSION_')) return 'permission'
    if (code.startsWith('SYSTEM_')) return 'system'
    if (code.startsWith('AI_')) return 'ai'
    if (code.startsWith('RENDERING_')) return 'rendering'
    return 'unknown'
  }

  private isRecoverable(code: string): boolean {
    const nonRecoverableCodes = ['SYSTEM_ERROR', 'OUT_OF_MEMORY', 'PERMISSION_DENIED']
    return !nonRecoverableCodes.includes(code)
  }

  private getDefaultRecoveryOptions(code: string): RecoveryOption[] {
    const options: Record<string, RecoveryOption[]> = {
      'FILE_NOT_FOUND': [
        { 
          label: '选择其他文件', 
          action: async () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.docx,.doc,.txt,.xlsx,.xls,.pptx,.ppt'
            input.click()
          }, 
          primary: true 
        },
        { label: '取消', action: () => {} }
      ],
      'FILE_READ_ERROR': [
        { 
          label: '重试', 
          action: async () => {
            console.log('重试读取文件...')
          }, 
          primary: true 
        },
        { 
          label: '选择其他文件', 
          action: async () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.click()
          } 
        }
      ],
      'FILE_WRITE_ERROR': [
        { 
          label: '另存为', 
          action: async () => {
            const filename = prompt('请输入文件名:', '未命名文档')
            if (filename) {
              console.log('另存为:', filename)
            }
          }, 
          primary: true 
        },
        { 
          label: '重试', 
          action: async () => {
            console.log('重试保存文件...')
          } 
        }
      ],
      'NETWORK_ERROR': [
        { 
          label: '重试', 
          action: async () => {
            console.log('重试网络请求...')
          }, 
          primary: true 
        },
        { 
          label: '离线模式', 
          action: () => {
            console.log('切换到离线模式')
          } 
        }
      ],
      'NETWORK_TIMEOUT': [
        { 
          label: '重试', 
          action: async () => {
            console.log('重试请求...')
          }, 
          primary: true 
        },
        { label: '取消', action: () => {} }
      ],
      'AI_ERROR': [
        { 
          label: '重试', 
          action: async () => {
            console.log('重试AI操作...')
          }, 
          primary: true 
        },
        { 
          label: '使用默认设置', 
          action: () => {
            console.log('使用默认AI设置')
          } 
        }
      ],
      'AI_TIMEOUT': [
        { 
          label: '简化内容后重试', 
          action: async () => {
            console.log('简化内容并重试...')
          }, 
          primary: true 
        },
        { label: '取消', action: () => {} }
      ],
      'RENDERING_ERROR': [
        { label: '刷新页面', action: () => window.location.reload(), primary: true }
      ],
      'VALIDATION_ERROR': [
        { 
          label: '修改输入', 
          action: () => {
            console.log('请修改您的输入')
          }, 
          primary: true 
        },
        { label: '取消', action: () => {} }
      ]
    }

    return options[code] || [{ label: '确定', action: () => {} }]
  }

  report(error: AppError): void {
    this.errors.push(error)
    
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }

    this.handlers.forEach(handler => {
      try {
        handler(error)
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError)
      }
    })

    console.error(`[${error.severity.toUpperCase()}] ${error.code}: ${error.message}`, error)
  }

  subscribe(handler: ErrorHandler): () => void {
    this.handlers.push(handler)
    return () => {
      const index = this.handlers.indexOf(handler)
      if (index > -1) {
        this.handlers.splice(index, 1)
      }
    }
  }

  getErrors(): AppError[] {
    return [...this.errors]
  }

  getRecentErrors(count: number = 10): AppError[] {
    return this.errors.slice(-count)
  }

  clearErrors(): void {
    this.errors = []
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  hasCriticalErrors(): boolean {
    return this.errors.some(e => e.severity === 'critical')
  }
}

export const errorManager = new ErrorManager()

export function handleError(
  code: string,
  message: string,
  options?: {
    userMessage?: string
    severity?: ErrorSeverity
    category?: ErrorCategory
    context?: Record<string, any>
    recoverable?: boolean
    recoveryOptions?: RecoveryOption[]
    originalError?: Error
  }
): AppError {
  const error = errorManager.createError(code, message, options)
  errorManager.report(error)
  return error
}

export function wrapAsync<T>(
  fn: () => Promise<T>,
  errorCode: string = 'UNKNOWN_ERROR'
): Promise<T | null> {
  return fn().catch(error => {
    handleError(errorCode, error.message, {
      originalError: error,
      context: { functionName: fn.name }
    })
    return null
  })
}

export function withErrorBoundary<T>(
  fn: () => T,
  errorCode: string = 'UNKNOWN_ERROR'
): T | null {
  try {
    return fn()
  } catch (error: any) {
    handleError(errorCode, error.message, {
      originalError: error,
      context: { functionName: fn.name }
    })
    return null
  }
}

export function createRecoveryAction(
  label: string,
  action: () => Promise<void> | void,
  primary: boolean = false
): RecoveryOption {
  return { label, action, primary }
}

export const ErrorCodes = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  FILE_FORMAT_ERROR: 'FILE_FORMAT_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  AI_ERROR: 'AI_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  RENDERING_ERROR: 'RENDERING_ERROR',
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export function useErrorRecovery() {
  const recover = async (error: AppError, optionIndex: number = 0) => {
    const option = error.recoveryOptions?.[optionIndex]
    if (option) {
      try {
        await option.action()
      } catch (recoveryError: any) {
        handleError('SYSTEM_ERROR', 'Recovery action failed', {
          originalError: recoveryError,
          context: { originalErrorId: error.id }
        })
      }
    }
  }

  return { recover }
}
