import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  errorManager, 
  handleError, 
  wrapAsync, 
  withErrorBoundary,
  ErrorCodes
} from '../utils/errorHandling'

describe('ErrorHandling', () => {
  beforeEach(() => {
    errorManager.clearErrors()
  })

  describe('errorManager', () => {
    it('should create error with correct properties', () => {
      const error = errorManager.createError(
        ErrorCodes.FILE_NOT_FOUND,
        'File not found at path /test/file.txt'
      )
      
      expect(error.code).toBe(ErrorCodes.FILE_NOT_FOUND)
      expect(error.message).toBe('File not found at path /test/file.txt')
      expect(error.severity).toBe('medium')
      expect(error.category).toBe('file')
      expect(error.recoverable).toBe(true)
      expect(error.recoveryOptions).toBeDefined()
      expect(error.recoveryOptions!.length).toBeGreaterThan(0)
    })

    it('should determine correct severity', () => {
      const criticalError = errorManager.createError(ErrorCodes.SYSTEM_ERROR, 'System crash')
      expect(criticalError.severity).toBe('critical')
      
      const lowError = errorManager.createError(ErrorCodes.NETWORK_TIMEOUT, 'Timeout')
      expect(lowError.severity).toBe('low')
    })

    it('should determine correct category', () => {
      const fileError = errorManager.createError(ErrorCodes.FILE_READ_ERROR, 'Read error')
      expect(fileError.category).toBe('file')
      
      const networkError = errorManager.createError(ErrorCodes.NETWORK_ERROR, 'Network error')
      expect(networkError.category).toBe('network')
      
      const aiError = errorManager.createError(ErrorCodes.AI_ERROR, 'AI error')
      expect(aiError.category).toBe('ai')
    })

    it('should provide user-friendly messages', () => {
      const error = errorManager.createError(
        ErrorCodes.FILE_NOT_FOUND,
        'Technical error message'
      )
      
      expect(error.userMessage).not.toBe('Technical error message')
      expect(error.userMessage).toContain('文件')
    })

    it('should report and store errors', () => {
      const error = errorManager.createError(ErrorCodes.VALIDATION_ERROR, 'Test error')
      errorManager.report(error)
      
      const errors = errorManager.getErrors()
      expect(errors.length).toBe(1)
      expect(errors[0].id).toBe(error.id)
    })

    it('should limit stored errors', () => {
      for (let i = 0; i < 150; i++) {
        const error = errorManager.createError(ErrorCodes.VALIDATION_ERROR, `Error ${i}`)
        errorManager.report(error)
      }
      
      const errors = errorManager.getErrors()
      expect(errors.length).toBeLessThanOrEqual(100)
    })

    it('should get recent errors', () => {
      for (let i = 0; i < 20; i++) {
        const error = errorManager.createError(ErrorCodes.VALIDATION_ERROR, `Error ${i}`)
        errorManager.report(error)
      }
      
      const recentErrors = errorManager.getRecentErrors(5)
      expect(recentErrors.length).toBe(5)
    })

    it('should detect critical errors', () => {
      const normalError = errorManager.createError(ErrorCodes.VALIDATION_ERROR, 'Normal')
      errorManager.report(normalError)
      expect(errorManager.hasCriticalErrors()).toBe(false)
      
      const criticalError = errorManager.createError(ErrorCodes.SYSTEM_ERROR, 'Critical')
      errorManager.report(criticalError)
      expect(errorManager.hasCriticalErrors()).toBe(true)
    })
  })

  describe('handleError', () => {
    it('should create and report error', () => {
      const error = handleError(
        ErrorCodes.FILE_READ_ERROR,
        'Failed to read file',
        { context: { filename: 'test.txt' } }
      )
      
      expect(error.code).toBe(ErrorCodes.FILE_READ_ERROR)
      expect(errorManager.hasErrors()).toBe(true)
    })

    it('should accept custom options', () => {
      const recoveryOptions = [
        { label: 'Retry', action: () => {}, primary: true }
      ]
      
      const error = handleError(
        ErrorCodes.NETWORK_ERROR,
        'Network failed',
        {
          userMessage: 'Custom message',
          severity: 'high',
          recoveryOptions
        }
      )
      
      expect(error.userMessage).toBe('Custom message')
      expect(error.severity).toBe('high')
      expect(error.recoveryOptions).toEqual(recoveryOptions)
    })
  })

  describe('wrapAsync', () => {
    it('should return result on success', async () => {
      const successFn = async () => 'success'
      const result = await wrapAsync(successFn, ErrorCodes.UNKNOWN_ERROR)
      
      expect(result).toBe('success')
      expect(errorManager.hasErrors()).toBe(false)
    })

    it('should handle errors and return null', async () => {
      const failFn = async () => {
        throw new Error('Async error')
      }
      
      const result = await wrapAsync(failFn, ErrorCodes.AI_ERROR)
      
      expect(result).toBeNull()
      expect(errorManager.hasErrors()).toBe(true)
    })
  })

  describe('withErrorBoundary', () => {
    it('should return result on success', () => {
      const successFn = () => 'success'
      const result = withErrorBoundary(successFn, ErrorCodes.UNKNOWN_ERROR)
      
      expect(result).toBe('success')
      expect(errorManager.hasErrors()).toBe(false)
    })

    it('should handle errors and return null', () => {
      const failFn = () => {
        throw new Error('Sync error')
      }
      
      const result = withErrorBoundary(failFn, ErrorCodes.RENDERING_ERROR)
      
      expect(result).toBeNull()
      expect(errorManager.hasErrors()).toBe(true)
    })
  })

  describe('subscription', () => {
    it('should notify subscribers on error', () => {
      const handler = vi.fn()
      errorManager.subscribe(handler)
      
      const error = errorManager.createError(ErrorCodes.VALIDATION_ERROR, 'Test')
      errorManager.report(error)
      
      expect(handler).toHaveBeenCalledWith(error)
    })

    it('should unsubscribe correctly', () => {
      const handler = vi.fn()
      const unsubscribe = errorManager.subscribe(handler)
      
      unsubscribe()
      
      const error = errorManager.createError(ErrorCodes.VALIDATION_ERROR, 'Test')
      errorManager.report(error)
      
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
