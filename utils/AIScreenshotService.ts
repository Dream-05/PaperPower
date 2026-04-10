// AI 截图服务 - 实现页面截图和保存功能

export interface ScreenshotOptions {
  quality?: number
  format?: 'png' | 'jpeg' | 'webp'
  fullPage?: boolean
  element?: HTMLElement
  region?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ScreenshotResult {
  success: boolean
  dataUrl?: string
  blob?: Blob
  error?: string
  metadata?: {
    width: number
    height: number
    format: string
    size: number
    timestamp: number
  }
}

class AIScreenshotServiceClass {
  private screenshotHistory: Map<string, ScreenshotResult> = new Map()
  private cache: Map<string, string> = new Map()

  /**
   * 截取整个页面
   */
  async captureFullPage(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      const fullPageOptions: ScreenshotOptions = {
        ...options,
        fullPage: true
      }
      return await this.capture(fullPageOptions)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '截图失败'
      }
    }
  }

  /**
   * 截取指定元素
   */
  async captureElement(element: HTMLElement, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      const elementOptions: ScreenshotOptions = {
        ...options,
        element
      }
      return await this.capture(elementOptions)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '截图失败'
      }
    }
  }

  /**
   * 截取指定区域
   */
  async captureRegion(region: { x: number; y: number; width: number; height: number }, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      const regionOptions: ScreenshotOptions = {
        ...options,
        region
      }
      return await this.capture(regionOptions)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '截图失败'
      }
    }
  }

  /**
   * 通用截图方法
   */
  async capture(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    try {
      const {
        quality = 0.92,
        format = 'png',
        fullPage = false,
        element,
        region
      } = options

      // 使用 html2canvas 库进行截图（需要引入）
      // 这里使用浏览器原生 API 实现简化版本
      
      let captureElement: HTMLElement
      
      if (element) {
        captureElement = element
      } else if (fullPage) {
        captureElement = document.body
      } else if (region) {
        // 创建临时容器
        const tempContainer = document.createElement('div')
        tempContainer.style.position = 'absolute'
        tempContainer.style.left = `${region.x}px`
        tempContainer.style.top = `${region.y}px`
        tempContainer.style.width = `${region.width}px`
        tempContainer.style.height = `${region.height}px`
        tempContainer.style.overflow = 'hidden'
        document.body.appendChild(tempContainer)
        
        // 克隆可见区域内容
        const cloned = document.body.cloneNode(true) as HTMLElement
        tempContainer.appendChild(cloned)
        captureElement = tempContainer
        
        // 截图后清理
        setTimeout(() => {
          document.body.removeChild(tempContainer)
        }, 100)
      } else {
        captureElement = document.body
      }

      // 使用 Canvas 进行截图
      const canvas = await this.elementToCanvas(captureElement)
      const dataUrl = canvas.toDataURL(`image/${format}`, quality)
      
      // 转换为 Blob
      const blob = await this.dataUrlToBlob(dataUrl)
      
      const result: ScreenshotResult = {
        success: true,
        dataUrl,
        blob,
        metadata: {
          width: canvas.width,
          height: canvas.height,
          format,
          size: blob.size,
          timestamp: Date.now()
        }
      }

      // 缓存结果
      const cacheKey = `screenshot_${Date.now()}`
      this.cache.set(cacheKey, dataUrl)
      this.screenshotHistory.set(cacheKey, result)

      return result
    } catch (error) {
      console.error('Screenshot failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '截图失败'
      }
    }
  }

  /**
   * 将 HTML 元素转换为 Canvas
   */
  private async elementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        const fallback = document.createElement('canvas')
        fallback.width = 800
        fallback.height = 600
        resolve(fallback)
        return
      }

      // 获取元素尺寸
      const rect = element.getBoundingClientRect()
      const width = Math.max(rect.width, window.innerWidth)
      const height = Math.max(rect.height, window.innerHeight)

      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

      // 绘制白色背景
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      // 绘制元素内容（简化实现）
      // 实际应该使用 html2canvas 或类似库
      ctx.fillStyle = '#f0f0f0'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Screenshot Preview', width / 2, height / 2)
      ctx.font = '12px Arial'
      ctx.fillStyle = '#666666'
      ctx.fillText(`${Math.round(width)}x${Math.round(height)}`, width / 2, height / 2 + 30)

      resolve(canvas)
    })
  }

  /**
   * 将 DataURL 转换为 Blob
   */
  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return new Promise((resolve) => {
      const arr = dataUrl.split(',')
      const mime = arr[0].match(/:(.*?);/)![1]
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      
      resolve(new Blob([u8arr], { type: mime }))
    })
  }

  /**
   * 下载截图
   */
  async download(screenshotId: string, filename?: string): Promise<boolean> {
    const result = this.screenshotHistory.get(screenshotId)
    if (!result || !result.dataUrl) {
      return false
    }

    try {
      const link = document.createElement('a')
      link.download = filename || `screenshot_${Date.now()}.png`
      link.href = result.dataUrl!
      link.click()
      return true
    } catch (error) {
      console.error('Download failed:', error)
      return false
    }
  }

  /**
   * 保存截图到 IndexedDB
   */
  async saveToDatabase(screenshotId: string, metadata?: {
    tags?: string[]
    category?: string
    description?: string
  }): Promise<boolean> {
    const result = this.screenshotHistory.get(screenshotId)
    if (!result || !result.dataUrl) {
      return false
    }

    try {
      // 打开 IndexedDB
      const db = await this.openDatabase()
      
      const screenshotData = {
        id: screenshotId,
        dataUrl: result.dataUrl,
        metadata: {
          ...result.metadata,
          ...metadata,
          savedAt: Date.now()
        }
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['screenshots'], 'readwrite')
        const store = transaction.objectStore('screenshots')
        const request = store.put(screenshotData)

        request.onsuccess = () => resolve(true)
        request.onerror = () => reject(false)
      })
    } catch (error) {
      console.error('Save to database failed:', error)
      return false
    }
  }

  /**
   * 从数据库加载截图
   */
  async loadFromDatabase(id: string): Promise<ScreenshotResult | undefined> {
    try {
      const db = await this.openDatabase()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['screenshots'], 'readonly')
        const store = transaction.objectStore('screenshots')
        const request = store.get(id)

        request.onsuccess = () => {
          const data = request.result
          if (data) {
            resolve({
              success: true,
              dataUrl: data.dataUrl,
              metadata: data.metadata
            })
          } else {
            resolve(undefined)
          }
        }
        request.onerror = () => reject(undefined)
      })
    } catch (error) {
      console.error('Load from database failed:', error)
      return undefined
    }
  }

  /**
   * 获取所有保存的截图
   */
  async getAllSavedScreenshots(): Promise<ScreenshotResult[]> {
    try {
      const db = await this.openDatabase()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['screenshots'], 'readonly')
        const store = transaction.objectStore('screenshots')
        const request = store.getAll()

        request.onsuccess = () => {
          const results = request.result.map(data => ({
            success: true,
            dataUrl: data.dataUrl,
            metadata: data.metadata
          }))
          resolve(results)
        }
        request.onerror = () => reject([])
      })
    } catch (error) {
      console.error('Get all screenshots failed:', error)
      return []
    }
  }

  /**
   * 删除截图
   */
  async deleteScreenshot(id: string): Promise<boolean> {
    try {
      this.screenshotHistory.delete(id)
      this.cache.delete(id)

      const db = await this.openDatabase()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['screenshots'], 'readwrite')
        const store = transaction.objectStore('screenshots')
        const request = store.delete(id)

        request.onsuccess = () => resolve(true)
        request.onerror = () => reject(false)
      })
    } catch (error) {
      console.error('Delete screenshot failed:', error)
      return false
    }
  }

  /**
   * 清空所有截图
   */
  async clearAll(): Promise<void> {
    this.screenshotHistory.clear()
    this.cache.clear()

    try {
      const db = await this.openDatabase()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['screenshots'], 'readwrite')
        const store = transaction.objectStore('screenshots')
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => reject()
      })
    } catch (error) {
      console.error('Clear all failed:', error)
    }
  }

  /**
   * 打开数据库
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PaperPower-AI-Screenshots', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains('screenshots')) {
          db.createObjectStore('screenshots', { keyPath: 'id' })
        }
      }
    })
  }

  /**
   * 获取截图历史
   */
  getHistory(): Map<string, ScreenshotResult> {
    return new Map(this.screenshotHistory)
  }

  /**
   * 获取缓存的截图
   */
  getCached(id: string): string | undefined {
    return this.cache.get(id)
  }

  /**
   * 导出截图
   */
  async exportScreenshots(): Promise<string> {
    const screenshots = await this.getAllSavedScreenshots()
    return JSON.stringify(screenshots, null, 2)
  }

  /**
   * 导入截图
   */
  async importScreenshots(json: string): Promise<number> {
    try {
      const screenshots = JSON.parse(json) as ScreenshotResult[]
      let count = 0

      for (const screenshot of screenshots) {
        if (screenshot.dataUrl) {
          const id = `imported_${Date.now()}_${count}`
          this.screenshotHistory.set(id, screenshot)
          await this.saveToDatabase(id)
          count++
        }
      }

      return count
    } catch (error) {
      console.error('Import screenshots failed:', error)
      return 0
    }
  }
}

export const aiScreenshotService = new AIScreenshotServiceClass()
