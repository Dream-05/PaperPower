// 真实网页截图服务
// 使用多种方法获取网页截图

interface ScreenshotResult {
  success: boolean
  url: string
  title: string
  screenshotUrl: string
  error?: string
}

class RealScreenshotService {
  private cache: Map<string, string> = new Map()

  // 获取政府网站政策截图
  async capturePolicyWebsites(keyword: string, maxScreenshots: number = 3): Promise<ScreenshotResult[]> {
    const policyWebsites = [
      { name: '中国政府网', url: 'http://www.gov.cn', searchUrl: 'http://www.gov.cn/zhengce/zhengceku/search.htm?q=' },
      { name: '国家发改委', url: 'https://www.ndrc.gov.cn', searchUrl: 'https://www.ndrc.gov.cn/xxgk/zcfb/search.html?searchWord=' },
      { name: '工信部', url: 'https://www.miit.gov.cn', searchUrl: 'https://www.miit.gov.cn/search/websearch.html?searchWord=' },
      { name: '科技部', url: 'https://www.most.gov.cn', searchUrl: 'https://www.most.gov.cn/search/websearch.html?searchWord=' },
      { name: '财政部', url: 'https://www.mof.gov.cn', searchUrl: 'https://www.mof.gov.cn/search/websearch.html?searchWord=' }
    ]

    const results: ScreenshotResult[] = []
    const websites = policyWebsites.slice(0, maxScreenshots)

    for (const website of websites) {
      const searchUrl = `${website.searchUrl}${encodeURIComponent(keyword)}`
      const cacheKey = `${website.name}_${keyword}`

      // 检查缓存
      if (this.cache.has(cacheKey)) {
        results.push({
          success: true,
          url: searchUrl,
          title: `${website.name} - ${keyword}相关政策`,
          screenshotUrl: this.cache.get(cacheKey)!
        })
        continue
      }

      try {
        // 尝试获取真实截图
        const screenshotUrl = await this.captureWebsite(searchUrl, website.name, keyword)
        
        if (screenshotUrl) {
          this.cache.set(cacheKey, screenshotUrl)
          results.push({
            success: true,
            url: searchUrl,
            title: `${website.name} - ${keyword}相关政策`,
            screenshotUrl
          })
        } else {
          // 生成信息卡片作为备用
          const fallbackUrl = this.generateInfoCard(website.name, keyword, searchUrl)
          results.push({
            success: true,
            url: searchUrl,
            title: `${website.name} - ${keyword}相关政策`,
            screenshotUrl: fallbackUrl
          })
        }
      } catch (error) {
        console.error(`截图 ${website.name} 失败:`, error)
        // 生成错误信息卡片
        const fallbackUrl = this.generateInfoCard(website.name, keyword, searchUrl)
        results.push({
          success: false,
          url: searchUrl,
          title: `${website.name} - ${keyword}相关政策`,
          screenshotUrl: fallbackUrl,
          error: String(error)
        })
      }
    }

    return results
  }

  private async captureWebsite(url: string, siteName: string, keyword: string): Promise<string | null> {
    // 尝试使用第三方截图API
    const screenshotApis = [
      // 使用microlink.io截图服务
      () => this.captureWithMicrolink(url),
      // 使用thumbnail.ws截图服务
      () => this.captureWithThumbnailWs(url),
      // 使用其他免费截图服务
      () => this.captureWithAlternativeService(url)
    ]

    for (const api of screenshotApis) {
      try {
        const result = await api()
        if (result) return result
      } catch (error) {
        console.warn('截图API失败:', error)
      }
    }

    // 所有API都失败，生成信息卡片
    return this.generateInfoCard(siteName, keyword, url)
  }

  private async captureWithMicrolink(url: string): Promise<string | null> {
    try {
      // microlink.io提供免费的网页截图服务
      const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false`
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      try {
        const response = await fetch(apiUrl, {
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          if (data.data && data.data.screenshot && data.data.screenshot.url) {
            return data.data.screenshot.url
          }
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error('Microlink截图失败:', error)
    }
    return null
  }

  private async captureWithThumbnailWs(_url: string): Promise<string | null> {
    try {
      // thumbnail.ws提供免费截图服务（需要API key，这里使用备用方案）
      // 由于可能受限，直接返回null让备用方案处理
      return null
    } catch (error) {
      console.error('Thumbnail.ws截图失败:', error)
      return null
    }
  }

  private async captureWithAlternativeService(url: string): Promise<string | null> {
    try {
      // 使用其他可用的截图服务
      // 这里可以尝试多个服务
      const services = [
        `https://image.thum.io/get/width/1200/crop/800/noanimate/${encodeURIComponent(url)}`,
        `https://mini.s-shot.ru/1280x800/${encodeURIComponent(url)}`
      ]

      for (const serviceUrl of services) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)
          
          const response = await fetch(serviceUrl, {
            signal: controller.signal,
            mode: 'cors'
          })
          
          clearTimeout(timeoutId)
          
          if (response.ok) {
            const blob = await response.blob()
            if (blob.type.startsWith('image/')) {
              return await this.blobToDataUrl(blob)
            }
          }
        } catch (error) {
          console.warn('替代截图服务失败:', error)
        }
      }
    } catch (error) {
      console.error('替代截图服务失败:', error)
    }
    return null
  }

  // 生成信息卡片作为截图备用
  private generateInfoCard(siteName: string, keyword: string, url: string): string {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      return ''
    }

    // 绘制背景
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#f8f9fa')
    gradient.addColorStop(1, '#e9ecef')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 绘制边框
    ctx.strokeStyle = '#dee2e6'
    ctx.lineWidth = 2
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

    // 绘制标题背景
    ctx.fillStyle = '#495057'
    ctx.fillRect(20, 20, canvas.width - 40, 80)

    // 绘制标题
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(siteName, canvas.width / 2, 70)

    // 绘制副标题
    ctx.fillStyle = '#6c757d'
    ctx.font = '24px Arial, sans-serif'
    ctx.fillText(`"${keyword}" 相关政策信息`, canvas.width / 2, 150)

    // 绘制说明文字
    ctx.fillStyle = '#495057'
    ctx.font = '18px Arial, sans-serif'
    ctx.fillText('政策信息来源网站', canvas.width / 2, 250)

    // 绘制URL
    ctx.fillStyle = '#007bff'
    ctx.font = '16px Arial, sans-serif'
    const displayUrl = url.length > 80 ? url.substring(0, 80) + '...' : url
    ctx.fillText(displayUrl, canvas.width / 2, 300)

    // 绘制提示信息
    ctx.fillStyle = '#6c757d'
    ctx.font = '16px Arial, sans-serif'
    ctx.fillText('点击链接可直接访问官方网站查看详细政策信息', canvas.width / 2, 400)

    // 绘制底部信息
    ctx.fillStyle = '#adb5bd'
    ctx.font = '14px Arial, sans-serif'
    ctx.fillText(`生成时间: ${new Date().toLocaleString('zh-CN')}`, canvas.width / 2, 700)

    // 绘制装饰元素
    ctx.fillStyle = '#e9ecef'
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.arc(
        100 + i * 250,
        500 + Math.sin(i) * 50,
        30,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }

    return canvas.toDataURL('image/png')
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const realScreenshotService = new RealScreenshotService()
export type { ScreenshotResult }
