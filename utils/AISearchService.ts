// AI 网络搜索服务 - 实现真正的网络搜索功能
// 支持多种搜索后端：DuckDuckGo、SerpAPI、自定义后端

export interface SearchResult {
  id: string
  title: string
  url: string
  snippet: string
  content?: string
  source: string
  publishedAt?: string
  relevance: number
}

export interface SearchQuery {
  keywords: string[]
  timeRange?: 'any' | 'day' | 'week' | 'month' | 'year'
  language?: string
  limit?: number
}

export interface SearchProvider {
  name: string
  search(query: string, limit: number): Promise<SearchResult[]>
}

class DuckDuckGoProvider implements SearchProvider {
  name = 'DuckDuckGo'

  async search(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status}`)
      }

      const data = await response.json()
      const results: SearchResult[] = []

      if (data.AbstractText && data.AbstractURL) {
        results.push({
          id: `ddg_main_${Date.now()}`,
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText,
          source: 'DuckDuckGo',
          relevance: 0.95,
        })
      }

      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, limit - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              id: `ddg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 50),
              url: topic.FirstURL,
              snippet: topic.Text,
              source: 'DuckDuckGo',
              relevance: 0.85 - results.length * 0.05,
            })
          }
        }
      }

      return results.slice(0, limit)
    } catch (error) {
      console.error('DuckDuckGo search failed:', error)
      return []
    }
  }
}

class WikipediaProvider implements SearchProvider {
  name = 'Wikipedia'

  async search(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const searchResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&format=json&origin=*`
      )

      if (!searchResponse.ok) {
        throw new Error(`Wikipedia API error: ${searchResponse.status}`)
      }

      const data = await searchResponse.json()
      const [, titles, descriptions, urls] = data
      const results: SearchResult[] = []

      for (let i = 0; i < titles.length; i++) {
        results.push({
          id: `wiki_${Date.now()}_${i}`,
          title: titles[i],
          url: urls[i],
          snippet: descriptions[i] || '',
          source: 'Wikipedia',
          relevance: 0.9 - i * 0.05,
        })
      }

      return results
    } catch (error) {
      console.error('Wikipedia search failed:', error)
      return []
    }
  }
}

class SerpAPIProvider implements SearchProvider {
  name = 'SerpAPI'
  private apiKey: string | null = null

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null
  }

  setApiKey(key: string) {
    this.apiKey = key
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    if (!this.apiKey) {
      console.warn('SerpAPI key not configured, skipping')
      return []
    }

    try {
      const response = await fetch(
        `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${this.apiKey}&num=${limit}`
      )

      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status}`)
      }

      const data = await response.json()
      const results: SearchResult[] = []

      if (data.organic_results) {
        for (const item of data.organic_results.slice(0, limit)) {
          results.push({
            id: `serp_${item.position || Date.now()}`,
            title: item.title,
            url: item.link,
            snippet: item.snippet || '',
            source: 'SerpAPI',
            publishedAt: item.date,
            relevance: 0.95 - (item.position || 0) * 0.03,
          })
        }
      }

      return results
    } catch (error) {
      console.error('SerpAPI search failed:', error)
      return []
    }
  }
}

class CustomBackendProvider implements SearchProvider {
  name = 'CustomBackend'
  private endpoint: string

  constructor(endpoint: string = '/api/search') {
    this.endpoint = endpoint
  }

  setEndpoint(url: string) {
    this.endpoint = url
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit }),
      })

      if (!response.ok) {
        throw new Error(`Custom backend error: ${response.status}`)
      }

      const data = await response.json()
      return (data.results || []).map((item: any, index: number) => ({
        id: item.id || `custom_${Date.now()}_${index}`,
        title: item.title,
        url: item.url,
        snippet: item.snippet || item.description || '',
        source: item.source || 'CustomBackend',
        publishedAt: item.publishedAt || item.date,
        relevance: item.relevance || 0.9 - index * 0.05,
      }))
    } catch (error) {
      console.error('Custom backend search failed:', error)
      return []
    }
  }
}

class AISearchServiceClass {
  private searchHistory: Map<string, SearchResult[]> = new Map()
  private cache: Map<string, SearchResult[]> = new Map()
  private providers: SearchProvider[] = []
  private cacheTimeout: number = 5 * 60 * 1000

  constructor() {
    this.providers = [
      new DuckDuckGoProvider(),
      new WikipediaProvider(),
      new SerpAPIProvider(),
      new CustomBackendProvider(),
    ]
  }

  configure(config: {
    serpApiKey?: string
    customEndpoint?: string
    cacheTimeout?: number
  }) {
    if (config.serpApiKey) {
      const serpProvider = this.providers.find(p => p.name === 'SerpAPI') as SerpAPIProvider
      if (serpProvider) {
        serpProvider.setApiKey(config.serpApiKey)
      }
    }
    if (config.customEndpoint) {
      const customProvider = this.providers.find(p => p.name === 'CustomBackend') as CustomBackendProvider
      if (customProvider) {
        customProvider.setEndpoint(config.customEndpoint)
      }
    }
    if (config.cacheTimeout) {
      this.cacheTimeout = config.cacheTimeout
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey(query)

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    if (this.searchHistory.has(cacheKey)) {
      return this.searchHistory.get(cacheKey)!
    }

    try {
      const searchQuery = query.keywords.join(' ')
      const limit = query.limit || 10
      const allResults: SearchResult[] = []

      const searchPromises = this.providers.map(provider =>
        provider.search(searchQuery, limit).catch(error => {
          console.warn(`Provider ${provider.name} failed:`, error)
          return []
        })
      )

      const providerResults = await Promise.all(searchPromises)

      for (const results of providerResults) {
        allResults.push(...results)
      }

      const uniqueResults = this.deduplicateResults(allResults)
      const sortedResults = uniqueResults.sort((a, b) => b.relevance - a.relevance)
      const finalResults = sortedResults.slice(0, limit)

      this.cache.set(cacheKey, finalResults)
      this.searchHistory.set(cacheKey, finalResults)

      setTimeout(() => {
        this.cache.delete(cacheKey)
      }, this.cacheTimeout)

      return finalResults
    } catch (error) {
      console.error('Search failed:', error)
      return []
    }
  }

  async searchWeb(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    return this.search({
      keywords: query.split(/\s+/).filter(k => k.length > 0),
      limit: options?.maxResults || 10,
    })
  }

  async fetchUrlContent(url: string): Promise<string> {
    try {
      const response = await fetch(url)
      const html = await response.text()

      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      doc.querySelectorAll('script, style, nav, footer, header, aside, iframe, noscript').forEach(el => el.remove())

      const main = doc.querySelector('main') || doc.querySelector('article') || doc.querySelector('.content') || doc.body
      const text = main?.textContent || ''

      const cleaned = text.replace(/\s+/g, ' ').trim()
      return cleaned.substring(0, 10000)
    } catch (error) {
      console.error('Content fetch failed:', error)
      return ''
    }
  }

  async searchAndSummarize(query: string): Promise<{ results: SearchResult[]; summary: string }> {
    const results = await this.searchWeb(query)

    if (results.length === 0) {
      return { results: [], summary: '未找到相关结果。' }
    }

    const topResults = results.slice(0, 3)
    const summaries: string[] = []

    for (const result of topResults) {
      if (result.snippet) {
        summaries.push(`【${result.title}】${result.snippet}`)
      }
    }

    const summary = summaries.length > 0
      ? `找到 ${results.length} 个相关结果：\n\n${summaries.join('\n\n')}`
      : `找到 ${results.length} 个相关结果，请查看详情。`

    return { results, summary }
  }

  async downloadTemplate(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const content = await this.fetchUrlContent(url)
      if (content) {
        return { success: true, content }
      }
      return { success: false, error: '无法获取内容' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载失败',
      }
    }
  }

  async extractContent(url: string): Promise<string> {
    return this.fetchUrlContent(url)
  }

  async searchAndSaveImages(keywords: string[], limit: number = 10): Promise<string[]> {
    const searchResults = await this.search({ keywords, limit })
    const imageUrls: string[] = []

    for (const result of searchResults) {
      try {
        const content = await this.fetchUrlContent(result.url)
        const imgMatches = content.match(/https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp)/gi) || []
        imageUrls.push(...imgMatches.slice(0, 3))

        if (imageUrls.length >= limit) break
      } catch (error) {
        console.error('Failed to extract images from:', result.url, error)
      }
    }

    return imageUrls.slice(0, limit)
  }

  getCachedResults(query: SearchQuery): SearchResult[] | undefined {
    const cacheKey = this.generateCacheKey(query)
    return this.cache.get(cacheKey)
  }

  clearCache(): void {
    this.cache.clear()
  }

  getSearchHistory(): Map<string, SearchResult[]> {
    return new Map(this.searchHistory)
  }

  clearHistory(): void {
    this.searchHistory.clear()
  }

  private generateCacheKey(query: SearchQuery): string {
    return JSON.stringify({
      keywords: query.keywords.sort(),
      timeRange: query.timeRange || 'any',
      language: query.language || 'zh',
      limit: query.limit || 10,
    })
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = `${result.title}-${result.url}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

export const aiSearchService = new AISearchServiceClass()

export type { AISearchServiceClass }
