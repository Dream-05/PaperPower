/**
 * 真实图片搜索下载服务
 * 使用Lorem Picsum和Unsplash Source获取真实图片
 */

export interface DownloadedImage {
  url: string
  base64: string
  width: number
  height: number
  format: string
  description: string
  photographer: string
  source: string
}

class RealImageServiceClass {
  private cache: Map<string, DownloadedImage> = new Map()
  
  async searchAndDownloadImage(keyword: string, width: number = 800, height: number = 400): Promise<DownloadedImage | null> {
    console.log('开始搜索图片:', keyword)
    const cacheKey = `${keyword}_${width}x${height}`
    
    if (this.cache.has(cacheKey)) {
      console.log('从缓存获取图片:', keyword)
      return this.cache.get(cacheKey)!
    }
    
    // 使用Unsplash Source - 不需要API密钥
    try {
      console.log('从Unsplash Source获取图片:', keyword)
      const image = await this.getUnsplashSourceImage(keyword, width, height)
      if (image) {
        console.log('Unsplash Source获取成功:', keyword)
        this.cache.set(cacheKey, image)
        return image
      }
    } catch (error) {
      console.warn('Unsplash Source失败:', error)
    }
    
    // 使用Lorem Picsum作为备用
    try {
      console.log('从Lorem Picsum获取图片:', keyword)
      const image = await this.getLoremPicsumImage(keyword, width, height)
      if (image) {
        console.log('Lorem Picsum获取成功:', keyword)
        this.cache.set(cacheKey, image)
        return image
      }
    } catch (error) {
      console.warn('Lorem Picsum失败:', error)
    }
    
    console.log('所有图片获取都失败:', keyword)
    return null
  }
  
  private async getUnsplashSourceImage(keyword: string, width: number, height: number): Promise<DownloadedImage | null> {
    try {
      // Unsplash Source - 根据关键词获取相关图片
      const imageUrl = `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(keyword)}&sig=${Date.now()}`
      
      const base64 = await this.downloadImageToBase64(imageUrl)
      
      if (base64) {
        return {
          url: imageUrl,
          base64: base64,
          width: width,
          height: height,
          format: 'image/jpeg',
          description: keyword,
          photographer: 'Unsplash Contributor',
          source: 'Unsplash'
        }
      }
    } catch (error) {
      console.error('Unsplash Source错误:', error)
    }
    
    return null
  }
  
  private async getLoremPicsumImage(keyword: string, width: number, height: number): Promise<DownloadedImage | null> {
    try {
      // Lorem Picsum - 随机高质量图片
      const randomId = Math.floor(Math.random() * 1000)
      const imageUrl = `https://picsum.photos/id/${randomId}/${width}/${height}`
      
      const base64 = await this.downloadImageToBase64(imageUrl)
      
      if (base64) {
        return {
          url: imageUrl,
          base64: base64,
          width: width,
          height: height,
          format: 'image/jpeg',
          description: keyword,
          photographer: 'Picsum Photographer',
          source: 'Lorem Picsum'
        }
      }
    } catch (error) {
      console.error('Lorem Picsum错误:', error)
    }
    
    return null
  }
  
  private async downloadImageToBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'image/webp,image/jpeg,image/png,*/*'
        }
      })
      
      if (!response.ok) {
        console.warn('图片下载失败:', response.status)
        return null
      }
      
      const blob = await response.blob()
      return await this.blobToBase64(blob)
    } catch (error) {
      console.error('图片下载错误:', error)
      return null
    }
  }
  
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to convert blob to base64'))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }
  
  async downloadImage(keyword: string, width: number = 400, height: number = 300): Promise<DownloadedImage | null> {
    return this.searchAndDownloadImage(keyword, width, height)
  }
  
  async downloadImages(keywords: string[], width: number = 400, height: number = 300): Promise<(DownloadedImage | null)[]> {
    return Promise.all(
      keywords.map(keyword => this.searchAndDownloadImage(keyword, width, height))
    )
  }
  
  async generateImageHTML(keyword: string, caption: string, figureNum: number): Promise<string> {
    const image = await this.searchAndDownloadImage(keyword)
    
    if (image && image.base64) {
      return `
        <div style="text-align: center; margin: 20px 0;">
          <img src="${image.base64}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" alt="${caption}" />
          <p style="font-size: 10pt; color: #666; margin-top: 8px;">图${figureNum}：${caption}（来源：${image.source}）</p>
        </div>
      `
    }
    
    return `
      <div style="border: 1px dashed #999; padding: 40px; text-align: center; margin: 15px 0; background: #f9f9f9;">
        <p style="color: #999; margin: 0;">【图片加载失败：${keyword}】</p>
        <p style="font-size: 10pt; color: #666; margin-top: 10px;">图${figureNum}：${caption}</p>
      </div>
    `
  }
  
  clearCache(): void {
    this.cache.clear()
  }
}

export const realImageService = new RealImageServiceClass()
