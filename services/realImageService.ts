// 真实图片搜索和下载服务
// 使用多个可靠的图片源

interface ImageResult {
  id: string
  url: string
  thumbnailUrl: string
  title: string
  source: string
  width: number
  height: number
}

class RealImageService {
  private cache: Map<string, ImageResult[]> = new Map()

  // 使用Lorem Picsum获取真实图片
  async searchRealImages(query: string, count: number = 6): Promise<ImageResult[]> {
    const cacheKey = `${query}_${count}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const results: ImageResult[] = []
    
    // 使用多个可靠的图片服务
    const imageServices = [
      // Lorem Picsum - 可靠的占位图片服务
      () => this.getLoremPicsumImages(count),
      // Unsplash Source (备用)
      () => this.getUnsplashImages(query, count),
      // 使用picsum.photos
      () => this.getPicsumImages(count)
    ]

    for (const service of imageServices) {
      try {
        const images = await service()
        if (images.length > 0) {
          results.push(...images)
          if (results.length >= count) break
        }
      } catch (error) {
        console.warn('图片服务失败:', error)
      }
    }

    // 如果所有服务都失败，使用确定性图片
    if (results.length === 0) {
      return this.getDeterministicImages(query, count)
    }

    const finalResults = results.slice(0, count)
    this.cache.set(cacheKey, finalResults)
    return finalResults
  }

  private async getLoremPicsumImages(count: number): Promise<ImageResult[]> {
    const results: ImageResult[] = []
    
    for (let i = 0; i < count; i++) {
      const seed = Math.floor(Math.random() * 1000) + i
      results.push({
        id: `picsum-${seed}`,
        url: `https://picsum.photos/seed/${seed}/1200/800`,
        thumbnailUrl: `https://picsum.photos/seed/${seed}/400/300`,
        title: `图片 ${i + 1}`,
        source: 'Lorem Picsum',
        width: 1200,
        height: 800
      })
    }
    
    return results
  }

  private async getUnsplashImages(query: string, count: number): Promise<ImageResult[]> {
    const results: ImageResult[] = []
    
    for (let i = 0; i < count; i++) {
      const seed = `${query}-${i}-${Date.now()}`
      results.push({
        id: `unsplash-${i}`,
        url: `https://source.unsplash.com/1200x800/?${encodeURIComponent(query)}&sig=${seed}`,
        thumbnailUrl: `https://source.unsplash.com/400x300/?${encodeURIComponent(query)}&sig=${seed}`,
        title: `${query} - 图片 ${i + 1}`,
        source: 'Unsplash',
        width: 1200,
        height: 800
      })
    }
    
    return results
  }

  private async getPicsumImages(count: number): Promise<ImageResult[]> {
    const results: ImageResult[] = []
    
    for (let i = 0; i < count; i++) {
      const id = Math.floor(Math.random() * 1000) + i
      results.push({
        id: `picsum-id-${id}`,
        url: `https://picsum.photos/id/${id}/1200/800`,
        thumbnailUrl: `https://picsum.photos/id/${id}/400/300`,
        title: `图片 ${i + 1}`,
        source: 'Picsum Photos',
        width: 1200,
        height: 800
      })
    }
    
    return results
  }

  private getDeterministicImages(query: string, count: number): ImageResult[] {
    const results: ImageResult[] = []
    
    for (let i = 0; i < count; i++) {
      // 使用确定性种子确保每次搜索相同主题得到相同图片
      const seed = this.hashString(`${query}-${i}`)
      results.push({
        id: `det-${seed}`,
        url: `https://picsum.photos/seed/${seed}/1200/800`,
        thumbnailUrl: `https://picsum.photos/seed/${seed}/400/300`,
        title: `${query} - 图片 ${i + 1}`,
        source: 'Deterministic',
        width: 1200,
        height: 800
      })
    }
    
    return results
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  // 下载图片并转换为Data URL
  async downloadImageAsDataUrl(url: string): Promise<string> {
    try {
      // 尝试直接下载
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      
      // 验证是否为图片
      if (!blob.type.startsWith('image/')) {
        throw new Error('下载的不是图片文件')
      }

      return await this.blobToDataUrl(blob)
    } catch (error) {
      console.error('图片下载失败:', error)
      // 返回原始URL作为备用
      return url
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // 批量下载图片
  async downloadImages(
    images: ImageResult[],
    onProgress?: (current: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = []
    
    for (let i = 0; i < images.length; i++) {
      try {
        const dataUrl = await this.downloadImageAsDataUrl(images[i].url)
        results.push(dataUrl)
        onProgress?.(i + 1, images.length)
      } catch (error) {
        console.error(`下载图片 ${i} 失败:`, error)
        results.push(images[i].url)
      }
    }
    
    return results
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const realImageService = new RealImageService()
export type { ImageResult }
