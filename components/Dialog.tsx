import { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'

interface DialogOptions {
  title?: string
  message: string
  type?: 'info' | 'warning' | 'error' | 'success'
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  inputType?: 'text' | 'number' | 'password'
  inputValue?: string
  inputPlaceholder?: string
  inputValidator?: (value: string) => string | null
}

interface DialogResult {
  confirmed: boolean
  value?: string
}

function DialogComponent({ 
  options, 
  onResult 
}: { 
  options: DialogOptions
  onResult: (result: DialogResult) => void 
}) {
  const [inputValue, setInputValue] = useState(options.inputValue || '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onResult({ confirmed: false })
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onResult])

  const handleConfirm = useCallback(() => {
    if (options.inputType !== undefined) {
      if (options.inputValidator) {
        const validationError = options.inputValidator(inputValue)
        if (validationError) {
          setError(validationError)
          return
        }
      }
      onResult({ confirmed: true, value: inputValue })
    } else {
      onResult({ confirmed: true })
    }
  }, [options, inputValue, onResult])

  const handleCancel = useCallback(() => {
    onResult({ confirmed: false })
  }, [onResult])

  const typeStyles = {
    info: 'text-blue-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    success: 'text-green-500'
  }

  const typeIcons = {
    info: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    error: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    success: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {options.title && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">{options.title}</h3>
          </div>
        )}
        
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            {options.type && (
              <div className={typeStyles[options.type]}>
                {typeIcons[options.type]}
              </div>
            )}
            
            <div className="flex-1">
              <p className="text-gray-700 text-base leading-relaxed">{options.message}</p>
              
              {options.inputType !== undefined && (
                <div className="mt-4">
                  <input
                    type={options.inputType}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                      setError(null)
                    }}
                    placeholder={options.inputPlaceholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleConfirm()
                      }
                    }}
                  />
                  {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          {options.showCancel && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors"
            >
              {options.cancelText || '取消'}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {options.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}

let dialogContainer: HTMLDivElement | null = null
let dialogRoot: ReturnType<typeof createRoot> | null = null

function ensureDialogContainer() {
  if (!dialogContainer) {
    dialogContainer = document.createElement('div')
    dialogContainer.id = 'dialog-container'
    document.body.appendChild(dialogContainer)
    dialogRoot = createRoot(dialogContainer)
  }
}

export function showDialog(options: DialogOptions): Promise<DialogResult> {
  return new Promise((resolve) => {
    ensureDialogContainer()
    
    const handleResult = (result: DialogResult) => {
      resolve(result)
      if (dialogRoot && dialogContainer) {
        dialogRoot.render(null)
      }
    }

    dialogRoot!.render(
      <DialogComponent options={options} onResult={handleResult} />
    )
  })
}

export async function alert(message: string, title?: string): Promise<void> {
  await showDialog({
    title,
    message,
    type: 'info',
    confirmText: '确定'
  })
}

export async function confirm(message: string, title?: string): Promise<boolean> {
  const result = await showDialog({
    title,
    message,
    type: 'warning',
    confirmText: '确定',
    cancelText: '取消',
    showCancel: true
  })
  return result.confirmed
}

export async function prompt(
  message: string, 
  defaultValue?: string, 
  title?: string,
  options?: {
    inputType?: 'text' | 'number' | 'password'
    placeholder?: string
    validator?: (value: string) => string | null
  }
): Promise<string | null> {
  const result = await showDialog({
    title,
    message,
    type: 'info',
    confirmText: '确定',
    cancelText: '取消',
    showCancel: true,
    inputType: options?.inputType || 'text',
    inputValue: defaultValue,
    inputPlaceholder: options?.placeholder,
    inputValidator: options?.validator
  })
  return result.confirmed ? result.value || '' : null
}

export async function showSuccess(message: string, title?: string): Promise<void> {
  await showDialog({
    title,
    message,
    type: 'success',
    confirmText: '确定'
  })
}

export async function showError(message: string, title?: string): Promise<void> {
  await showDialog({
    title,
    message,
    type: 'error',
    confirmText: '确定'
  })
}

export async function showWarning(message: string, title?: string): Promise<void> {
  await showDialog({
    title,
    message,
    type: 'warning',
    confirmText: '确定'
  })
}

export async function showInfo(message: string, title?: string): Promise<void> {
  await showDialog({
    title,
    message,
    type: 'info',
    confirmText: '确定'
  })
}

export const Dialog = {
  alert,
  confirm,
  prompt,
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  show: showDialog
}
