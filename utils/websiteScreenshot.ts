// 由于axios导入失败，暂时使用fetch代替
// import axios from 'axios'

interface ScreenshotResult {
  url: string
  title: string
  screenshotUrl: string
  timestamp: number
}

interface PolicyWebsite {
  name: string
  url: string
  searchUrl: string
}

// 政府政策网站列表
const POLICY_WEBSITES: PolicyWebsite[] = [
  {
    name: '中国政府网',
    url: 'http://www.gov.cn',
    searchUrl: 'http://www.gov.cn/search/websearch.html?searchWord='
  },
  {
    name: '国家发改委',
    url: 'https://www.ndrc.gov.cn',
    searchUrl: 'https://www.ndrc.gov.cn/xxgk/zcfb/search.html?searchWord='
  },
  {
    name: '工信部',
    url: 'https://www.miit.gov.cn',
    searchUrl: 'https://www.miit.gov.cn/search/websearch.html?searchWord='
  },
  {
    name: '科技部',
    url: 'https://www.most.gov.cn',
    searchUrl: 'https://www.most.gov.cn/search/websearch.html?searchWord='
  },
  {
    name: '农业农村部',
    url: 'https://www.moa.gov.cn',
    searchUrl: 'https://www.moa.gov.cn/search/websearch.html?searchWord='
  }
]

class WebsiteScreenshotService {
  // private apiKey: string
  private apiEndpoint: string

  constructor() {
    this.apiEndpoint = 'https://trae-api-cn.mchost.guru/api/ide/v1'
  }

  async captureWebsite(url: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        url: url,
        width: '1200',
        height: '800',
        fullPage: 'false'
      })
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      const response = await fetch(`${this.apiEndpoint}/screenshot?${params}`, {
        method: 'GET',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data && data.screenshot) {
        return data.screenshot
      }

      return null
    } catch (error) {
      console.error('网站截图失败:', error)
      return null
    }
  }

  async searchPolicyWebsites(keyword: string): Promise<ScreenshotResult[]> {
    const results: ScreenshotResult[] = []
    
    const searchPromises = POLICY_WEBSITES.map(async (website) => {
      try {
        const searchUrl = `${website.searchUrl}${encodeURIComponent(keyword)}`
        const screenshotUrl = await this.captureWebsite(searchUrl)
        
        if (screenshotUrl) {
          results.push({
            url: searchUrl,
            title: `${website.name} - ${keyword}相关政策`,
            screenshotUrl: screenshotUrl,
            timestamp: Date.now()
          })
        }
      } catch (error) {
        console.error(`搜索 ${website.name} 失败:`, error)
      }
    })

    await Promise.all(searchPromises)
    
    return results
  }

  async captureMultipleWebsites(urls: string[]): Promise<ScreenshotResult[]> {
    const results: ScreenshotResult[] = []
    
    const capturePromises = urls.map(async (url) => {
      try {
        const screenshotUrl = await this.captureWebsite(url)
        
        if (screenshotUrl) {
          results.push({
            url: url,
            title: `政策页面截图`,
            screenshotUrl: screenshotUrl,
            timestamp: Date.now()
          })
        }
      } catch (error) {
        console.error(`截图 ${url} 失败:`, error)
      }
    })

    await Promise.all(capturePromises)
    
    return results
  }

  async generatePolicyScreenshots(keyword: string): Promise<string[]> {
    const screenshots: string[] = []
    
    try {
      const results = await this.searchPolicyWebsites(keyword)
      
      for (const result of results) {
        if (result.screenshotUrl) {
          screenshots.push(result.screenshotUrl)
        }
      }
    } catch (error) {
      console.error('生成政策截图失败:', error)
    }
    
    return screenshots
  }

  async getPolicyWebsiteUrls(keyword: string): Promise<{name: string, url: string}[]> {
    return POLICY_WEBSITES.map(website => ({
      name: website.name,
      url: `${website.searchUrl}${encodeURIComponent(keyword)}`
    }))
  }
}

export const websiteScreenshotService = new WebsiteScreenshotService()
export type { ScreenshotResult, PolicyWebsite }
