const isDev = typeof process !== 'undefined' && (process.env.NODE_ENV !== 'production')

const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log('[智办AI]', ...args)
  },
  error: (...args: any[]) => {
    if (isDev) console.error('[智办AI]', ...args)
    else {
      const errorMsg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      if (typeof window !== 'undefined' && (window as any).__APP_ERROR_HANDLER) {
        (window as any).__APP_ERROR_HANDLER(errorMsg)
      }
    }
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn('[智办AI]', ...args)
  },
}

export default logger
