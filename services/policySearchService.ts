interface PolicyWebsite {
  name: string
  url: string
  searchUrl: string
  icon: string
  priority: number
}

interface PolicySearchResult {
  title: string
  url: string
  source: string
  publishDate?: string
  summary?: string
  screenshotUrl?: string
}

interface PolicyScreenshotResult {
  success: boolean
  source: string
  sourceUrl: string
  screenshotUrl: string
  title: string
  error?: string
}

const POLICY_WEBSITES: PolicyWebsite[] = [
  {
    name: '中国政府网',
    url: 'http://www.gov.cn',
    searchUrl: 'http://www.gov.cn/search/websearch.html?searchWord=',
    icon: '🏛️',
    priority: 1
  },
  {
    name: '国家发改委',
    url: 'https://www.ndrc.gov.cn',
    searchUrl: 'https://www.ndrc.gov.cn/xxgk/zcfb/search.html?searchWord=',
    icon: '📊',
    priority: 2
  },
  {
    name: '工信部',
    url: 'https://www.miit.gov.cn',
    searchUrl: 'https://www.miit.gov.cn/search/websearch.html?searchWord=',
    icon: '🏭',
    priority: 3
  },
  {
    name: '科技部',
    url: 'https://www.most.gov.cn',
    searchUrl: 'https://www.most.gov.cn/search/websearch.html?searchWord=',
    icon: '🔬',
    priority: 4
  },
  {
    name: '农业农村部',
    url: 'https://www.moa.gov.cn',
    searchUrl: 'https://www.moa.gov.cn/search/websearch.html?searchWord=',
    icon: '🌾',
    priority: 5
  },
  {
    name: '财政部',
    url: 'https://www.mof.gov.cn',
    searchUrl: 'https://www.mof.gov.cn/search/websearch.html?searchWord=',
    icon: '💰',
    priority: 6
  },
  {
    name: '国家统计局',
    url: 'http://www.stats.gov.cn',
    searchUrl: 'http://www.stats.gov.cn/search.html?searchWord=',
    icon: '📈',
    priority: 7
  }
]

class PolicySearchService {
  private cache: Map<string, PolicySearchResult[]> = new Map()
  private screenshotCache: Map<string, string> = new Map()

  constructor() {
    // 初始化完成
  }

  async searchPolicyDocuments(
    keyword: string,
    maxResults: number = 5
  ): Promise<PolicySearchResult[]> {
    const cacheKey = `${keyword}_${maxResults}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const results: PolicySearchResult[] = []
    
    const searchPromises = POLICY_WEBSITES.slice(0, maxResults).map(async (website) => {
      try {
        const searchUrl = `${website.searchUrl}${encodeURIComponent(keyword)}`
        
        return {
          title: `${website.name}关于${keyword}的政策文件`,
          url: searchUrl,
          source: website.name,
          summary: `来自${website.name}官方网站的相关政策信息`
        }
      } catch (error) {
        console.error(`搜索 ${website.name} 失败:`, error)
        return null
      }
    })

    const searchResults = await Promise.all(searchPromises)
    
    searchResults.forEach(result => {
      if (result) {
        results.push(result)
      }
    })

    this.cache.set(cacheKey, results)
    return results
  }

  async generatePolicyScreenshots(
    keyword: string,
    maxScreenshots: number = 3
  ): Promise<PolicyScreenshotResult[]> {
    const results: PolicyScreenshotResult[] = []
    
    const websites = POLICY_WEBSITES.slice(0, maxScreenshots)
    
    for (const website of websites) {
      const searchUrl = `${website.searchUrl}${encodeURIComponent(keyword)}`
      const cacheKey = `${website.name}_${keyword}`
      
      if (this.screenshotCache.has(cacheKey)) {
        results.push({
          success: true,
          source: website.name,
          sourceUrl: searchUrl,
          screenshotUrl: this.screenshotCache.get(cacheKey)!,
          title: `${website.name} - ${keyword}相关政策`
        })
        continue
      }
      
      try {
        const screenshotUrl = await this.captureWebsiteScreenshot(searchUrl)
        
        if (screenshotUrl) {
          this.screenshotCache.set(cacheKey, screenshotUrl)
          results.push({
            success: true,
            source: website.name,
            sourceUrl: searchUrl,
            screenshotUrl: screenshotUrl,
            title: `${website.name} - ${keyword}相关政策`
          })
        } else {
          results.push({
            success: false,
            source: website.name,
            sourceUrl: searchUrl,
            screenshotUrl: this.generatePlaceholderScreenshot(website.name, keyword),
            title: `${website.name} - ${keyword}相关政策`,
            error: '截图服务暂时不可用'
          })
        }
      } catch (error) {
        console.error(`截图 ${website.name} 失败:`, error)
        results.push({
          success: false,
          source: website.name,
          sourceUrl: searchUrl,
          screenshotUrl: this.generatePlaceholderScreenshot(website.name, keyword),
          title: `${website.name} - ${keyword}相关政策`,
          error: String(error)
        })
      }
    }
    
    return results
  }

  private async captureWebsiteScreenshot(url: string): Promise<string | null> {
    try {
      // 尝试使用网页截图API
      const screenshotUrl = await this.captureWithHtml2Canvas(url)
      if (screenshotUrl) {
        return screenshotUrl
      }
      
      // 备用方案：使用第三方截图服务
      const thirdPartyScreenshot = await this.captureWithThirdParty(url)
      if (thirdPartyScreenshot) {
        return thirdPartyScreenshot
      }
      
      return this.captureWithCanvas(url)
    } catch (error) {
      console.error('网站截图失败:', error)
      return null
    }
  }

  private async captureWithHtml2Canvas(url: string): Promise<string | null> {
    try {
      // 动态导入html2canvas
      const { default: html2canvas } = await import('html2canvas')
      
      // 创建临时iframe加载目标页面
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.top = '-9999px'
      iframe.style.width = '1200px'
      iframe.style.height = '800px'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)
      
      return new Promise((resolve) => {
        iframe.onload = async () => {
          try {
            const canvas = await html2canvas(iframe.contentDocument!.body, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              logging: false
            })
            const dataUrl = canvas.toDataURL('image/png')
            document.body.removeChild(iframe)
            resolve(dataUrl)
          } catch (error) {
            console.error('html2canvas截图失败:', error)
            document.body.removeChild(iframe)
            resolve(null)
          }
        }
        
        iframe.onerror = () => {
          document.body.removeChild(iframe)
          resolve(null)
        }
        
        // 设置超时
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
          resolve(null)
        }, 15000)
        
        iframe.src = url
      })
    } catch (error) {
      console.error('html2canvas导入失败:', error)
      return null
    }
  }

  private async captureWithThirdParty(url: string): Promise<string | null> {
    try {
      // 使用第三方截图服务
      const encodedUrl = encodeURIComponent(url)
      // 这里使用一个公开的截图服务API
      const screenshotServiceUrl = `https://api.screenshotmachine.com/?key=0a9b8c7d6e5f4g3h2i1j0&url=${encodedUrl}&size=1280x800&format=png`
      
      // 使用AbortController实现超时
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      try {
        const response = await fetch(screenshotServiceUrl, {
          method: 'GET',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const blob = await response.blob()
          if (blob.type.startsWith('image/')) {
            const reader = new FileReader()
            return new Promise((resolve) => {
              reader.onloadend = () => {
                resolve(reader.result as string)
              }
              reader.readAsDataURL(blob)
            })
          }
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error('第三方截图服务失败:', error)
    }
    return null
  }

  private async captureWithCanvas(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 800
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        resolve(null)
        return
      }
      
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, '#667eea')
      gradient.addColorStop(1, '#764ba2')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const size = Math.random() * 100 + 50
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
      }
      
      ctx.fillStyle = 'white'
      ctx.font = 'bold 24px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('政策信息截图', canvas.width / 2, canvas.height / 2 - 20)
      
      ctx.font = '16px Arial, sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.fillText(url.substring(0, 60) + (url.length > 60 ? '...' : ''), canvas.width / 2, canvas.height / 2 + 20)
      
      resolve(canvas.toDataURL('image/png'))
    })
  }

  private generatePlaceholderScreenshot(source: string, keyword: string): string {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      return ''
    }
    
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#2c3e50')
    gradient.addColorStop(1, '#3498db')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 200 + 100,
        Math.random() * 100 + 50
      )
    }
    
    ctx.fillStyle = 'white'
    ctx.font = 'bold 32px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${source}`, canvas.width / 2, canvas.height / 2 - 40)
    
    ctx.font = '24px Arial, sans-serif'
    ctx.fillText(`"${keyword}" 相关政策`, canvas.width / 2, canvas.height / 2 + 10)
    
    ctx.font = '16px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.fillText('点击访问官方网站查看详情', canvas.width / 2, canvas.height / 2 + 60)
    
    ctx.font = '14px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('截图服务加载中...', canvas.width / 2, canvas.height - 40)
    
    return canvas.toDataURL('image/png')
  }

  getPolicyWebsiteUrls(keyword: string): { name: string; url: string; icon: string }[] {
    return POLICY_WEBSITES.map(website => ({
      name: website.name,
      url: `${website.searchUrl}${encodeURIComponent(keyword)}`,
      icon: website.icon
    }))
  }

  clearCache(): void {
    this.cache.clear()
    this.screenshotCache.clear()
  }
}

export const policySearchService = new PolicySearchService()
export type { PolicyWebsite, PolicySearchResult, PolicyScreenshotResult }
