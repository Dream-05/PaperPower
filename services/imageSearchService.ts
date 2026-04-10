interface ImageSearchResult {
  id: string
  url: string
  thumbnailUrl: string
  title: string
  source: string
  width: number
  height: number
  color: string
  localPath?: string
}

interface UnsplashImage {
  id: string
  urls: {
    raw: string
    full: string
    regular: string
    small: string
    thumb: string
  }
  alt_description: string
  description: string | null
  width: number
  height: number
  color: string
  user: {
    name: string
    username: string
  }
  links: {
    download: string
    html: string
  }
}

interface PexelsImage {
  id: number
  width: number
  height: number
  url: string
  photographer: string
  photographer_url: string
  src: {
    original: string
    large2x: string
    large: string
    medium: string
    small: string
    portrait: string
    landscape: string
    tiny: string
  }
  alt: string
}

interface PixabayImage {
  id: number
  webformatURL: string
  largeImageURL: string
  imageWidth: number
  imageHeight: number
  previewWidth: number
  previewHeight: number
  tags: string
  user: string
  pageURL: string
}

class ImageSearchService {
  private cache: Map<string, ImageSearchResult[]> = new Map()
  private downloadQueue: Map<string, Promise<string>> = new Map()
  
  private getStoredApiKey(service: 'unsplash' | 'pexels' | 'pixabay'): string {
    try {
      const keys = JSON.parse(localStorage.getItem('api_keys') || '{}')
      return keys[service] || 'demo'
    } catch {
      return 'demo'
    }
  }

  async searchImages(
    query: string, 
    count: number = 4,
    sources: ('unsplash' | 'pexels' | 'pixabay')[] = ['unsplash', 'pexels', 'pixabay']
  ): Promise<ImageSearchResult[]> {
    const cacheKey = `${query}_${count}_${sources.join(',')}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    
    const results: ImageSearchResult[] = []
    const perSource = Math.ceil(count / sources.length)
    
    const searchPromises = sources.map(async (source) => {
      try {
        switch (source) {
          case 'unsplash':
            return await this.searchUnsplash(query, perSource)
          case 'pexels':
            return await this.searchPexels(query, perSource)
          case 'pixabay':
            return await this.searchPixabay(query, perSource)
          default:
            return []
        }
      } catch (error) {
        console.error(`${source}搜索失败:`, error)
        return []
      }
    })
    
    const searchResults = await Promise.all(searchPromises)
    searchResults.forEach(sourceResults => {
      results.push(...sourceResults)
    })
    
    const finalResults = results.slice(0, count)
    this.cache.set(cacheKey, finalResults)
    
    return finalResults
  }

  private async searchUnsplash(query: string, count: number): Promise<ImageSearchResult[]> {
    const apiKey = this.getStoredApiKey('unsplash')
    
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape&lang=zh`,
        {
          headers: {
            'Authorization': `Client-ID ${apiKey}`,
            'Accept-Version': 'v1'
          }
        }
      )
      
      if (!response.ok) {
        console.warn('Unsplash API调用失败，使用备用方案')
        return this.getFallbackImages(query, count, 'unsplash')
      }
      
      const data = await response.json()
      
      return data.results.map((img: UnsplashImage) => ({
        id: `unsplash-${img.id}`,
        url: img.urls.regular,
        thumbnailUrl: img.urls.thumb,
        title: img.alt_description || img.description || query,
        source: `Unsplash - ${img.user.name}`,
        width: img.width,
        height: img.height,
        color: img.color
      }))
    } catch (error) {
      console.error('Unsplash搜索错误:', error)
      return this.getFallbackImages(query, count, 'unsplash')
    }
  }

  private async searchPexels(query: string, count: number): Promise<ImageSearchResult[]> {
    const apiKey = this.getStoredApiKey('pexels')
    
    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
        {
          headers: {
            'Authorization': apiKey
          }
        }
      )
      
      if (!response.ok) {
        console.warn('Pexels API调用失败，使用备用方案')
        return this.getFallbackImages(query, count, 'pexels')
      }
      
      const data = await response.json()
      
      return data.photos.map((img: PexelsImage) => ({
        id: `pexels-${img.id}`,
        url: img.src.large,
        thumbnailUrl: img.src.small,
        title: img.alt || query,
        source: `Pexels - ${img.photographer}`,
        width: img.width,
        height: img.height,
        color: '#ffffff'
      }))
    } catch (error) {
      console.error('Pexels搜索错误:', error)
      return this.getFallbackImages(query, count, 'pexels')
    }
  }

  private async searchPixabay(query: string, count: number): Promise<ImageSearchResult[]> {
    const apiKey = this.getStoredApiKey('pixabay')
    
    try {
      const response = await fetch(
        `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${count}&image_type=photo&orientation=horizontal&lang=zh`
      )
      
      if (!response.ok) {
        console.warn('Pixabay API调用失败，使用备用方案')
        return this.getFallbackImages(query, count, 'pixabay')
      }
      
      const data = await response.json()
      
      return data.hits.map((img: PixabayImage) => ({
        id: `pixabay-${img.id}`,
        url: img.largeImageURL,
        thumbnailUrl: img.webformatURL,
        title: img.tags,
        source: `Pixabay - ${img.user}`,
        width: img.imageWidth,
        height: img.imageHeight,
        color: '#ffffff'
      }))
    } catch (error) {
      console.error('Pixabay搜索错误:', error)
      return this.getFallbackImages(query, count, 'pixabay')
    }
  }

  private getFallbackImages(query: string, count: number, source: string): ImageSearchResult[] {
    const colors = ['3498db', '2ecc71', 'e74c3c', 'f39c12', '9b59b6', '1abc9c', 'e67e22', '34495e']
    const results: ImageSearchResult[] = []
    
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length]
      const seed = Date.now() + i
      results.push({
        id: `${source}-fallback-${seed}`,
        url: `https://source.unsplash.com/800x400/?${encodeURIComponent(query)}&sig=${seed}`,
        thumbnailUrl: `https://source.unsplash.com/200x100/?${encodeURIComponent(query)}&sig=${seed}`,
        title: `${query} - 图片 ${i + 1}`,
        source: `${source} (备用)`,
        width: 800,
        height: 400,
        color: `#${color}`
      })
    }
    
    return results
  }

  async downloadImage(url: string, filename: string): Promise<string> {
    if (this.downloadQueue.has(url)) {
      return this.downloadQueue.get(url)!
    }
    
    const downloadPromise = this._downloadImageInternal(url, filename)
    this.downloadQueue.set(url, downloadPromise)
    
    try {
      const result = await downloadPromise
      return result
    } finally {
      this.downloadQueue.delete(url)
    }
  }

  private async _downloadImageInternal(url: string, filename: string): Promise<string> {
    try {
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url
      }
      
      // 真实下载图片
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      
      if (!response.ok) {
        console.warn(`下载图片失败: ${response.status}`)
        // 尝试使用备用下载方式
        return this._downloadWithFallback(url)
      }
      
      const blob = await response.blob()
      
      // 验证图片格式
      if (!blob.type.startsWith('image/')) {
        console.warn('下载的不是图片文件')
        return this._downloadWithFallback(url)
      }
      
      const objectUrl = URL.createObjectURL(blob)
      
      // 保存到本地存储
      this._saveToLocalStorage(blob, filename)
      
      return objectUrl
    } catch (error) {
      console.error('图片下载错误:', error)
      return this._downloadWithFallback(url)
    }
  }

  private async _downloadWithFallback(url: string): Promise<string> {
    try {
      // 使用代理服务下载
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      
      // 使用AbortController实现超时
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      try {
        const response = await fetch(proxyUrl, {
          mode: 'cors',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const blob = await response.blob()
          if (blob.type.startsWith('image/')) {
            return URL.createObjectURL(blob)
          }
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error('备用下载方式失败:', error)
    }
    
    // 最终备用：直接返回原始URL
    return url
  }

  private _saveToLocalStorage(blob: Blob, filename: string): void {
    try {
      // 检查localStorage容量
      if (blob.size > 5 * 1024 * 1024) {
        console.warn('图片过大，跳过本地存储')
        return
      }
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const imageCache = JSON.parse(localStorage.getItem('image_cache') || '{}')
        imageCache[filename] = {
          dataUrl,
          timestamp: Date.now(),
          size: blob.size
        }
        // 清理旧缓存
        this._cleanupImageCache()
        localStorage.setItem('image_cache', JSON.stringify(imageCache))
      }
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error('保存到本地存储失败:', error)
    }
  }

  private _cleanupImageCache(): void {
    try {
      const imageCache = JSON.parse(localStorage.getItem('image_cache') || '{}') as Record<string, { dataUrl: string; timestamp: number; size: number }>
      const now = Date.now()
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7天
      const maxSize = 10 * 1024 * 1024 // 10MB
      
      // 清理过期缓存
      Object.keys(imageCache).forEach(key => {
        if (now - imageCache[key].timestamp > maxAge) {
          delete imageCache[key]
        }
      })
      
      // 清理超出大小的缓存
      let currentCacheSize = Object.values(imageCache).reduce((total, item) => total + item.size, 0)
      if (currentCacheSize > maxSize) {
        // 按时间排序，删除最旧的
        const sortedKeys = Object.keys(imageCache).sort((a, b) => 
          imageCache[a].timestamp - imageCache[b].timestamp
        )
        
        while (currentCacheSize > maxSize && sortedKeys.length > 0) {
          const key = sortedKeys.shift()
          if (key) {
            currentCacheSize -= imageCache[key].size
            delete imageCache[key]
          }
        }
      }
      
      localStorage.setItem('image_cache', JSON.stringify(imageCache))
    } catch (error) {
      console.error('清理缓存失败:', error)
    }
  }

  async downloadMultipleImages(
    images: ImageSearchResult[], 
    onProgress?: (current: number, total: number) => void
  ): Promise<ImageSearchResult[]> {
    const results: ImageSearchResult[] = []
    
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      try {
        const localUrl = await this.downloadImage(img.url, `image-${img.id}.jpg`)
        results.push({
          ...img,
          localPath: localUrl
        })
      } catch (error) {
        console.error(`下载图片 ${img.id} 失败:`, error)
        results.push({
          ...img,
          localPath: img.url
        })
      }
      
      onProgress?.(i + 1, images.length)
    }
    
    return results
  }

  async searchAndDownload(
    query: string,
    count: number = 4,
    onProgress?: (stage: string, current: number, total: number) => void
  ): Promise<ImageSearchResult[]> {
    onProgress?.('搜索图片', 0, 1)
    const images = await this.searchImages(query, count)
    
    onProgress?.('下载图片', 0, images.length)
    const downloadedImages = await this.downloadMultipleImages(images, (current, total) => {
      onProgress?.('下载图片', current, total)
    })
    
    return downloadedImages
  }

  clearCache(): void {
    this.cache.clear()
    this.downloadQueue.clear()
  }
}

export const imageSearchService = new ImageSearchService()
export type { ImageSearchResult, UnsplashImage, PexelsImage, PixabayImage }
