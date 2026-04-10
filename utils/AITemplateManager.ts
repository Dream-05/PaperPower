// AI 模板管理器 - 管理 PPT/Word/Excel 模板资源

export interface Template {
  id: string
  name: string
  type: 'ppt' | 'word' | 'excel'
  category: string
  style: string
  thumbnail?: string
  content?: any
  tags: string[]
  usageCount: number
  rating: number
  createdAt: number
  updatedAt: number
  metadata?: {
    slides?: number
    pages?: number
    sheets?: number
    author?: string
    version?: string
  }
}

export interface TemplateFilter {
  type?: string
  category?: string
  style?: string
  tags?: string[]
  minRating?: number
  sortBy?: 'usage' | 'rating' | 'newest' | 'oldest'
}

class AITemplateManagerClass {
  private dbName = 'PaperPower-AI-Templates'
  private db: IDBDatabase | null = null
  private cache: Map<string, Template[]> = new Map()

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        this.preloadTemplates()
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains('templates')) {
          const store = db.createObjectStore('templates', { keyPath: 'id' })
          store.createIndex('type', 'type', { unique: false })
          store.createIndex('category', 'category', { unique: false })
          store.createIndex('style', 'style', { unique: false })
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true })
          store.createIndex('usageCount', 'usageCount', { unique: false })
          store.createIndex('rating', 'rating', { unique: false })
        }
      }
    })
  }

  /**
   * 预加载默认模板
   */
  private async preloadTemplates(): Promise<void> {
    const defaultTemplates: Template[] = [
      // PPT 模板
      {
        id: 'ppt_tech_001',
        name: '科技风项目介绍',
        type: 'ppt',
        category: 'business',
        style: '科技风',
        thumbnail: 'https://via.placeholder.com/300x200/6366f1/ffffff?text=Tech+PPT',
        tags: ['科技', '项目', '介绍', '蓝色'],
        usageCount: 156,
        rating: 4.8,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { slides: 12, author: 'PaperPower' }
      },
      {
        id: 'ppt_business_001',
        name: '商务风商业计划书',
        type: 'ppt',
        category: 'business',
        style: '商务风',
        thumbnail: 'https://via.placeholder.com/300x200/3b82f6/ffffff?text=Business+PPT',
        tags: ['商务', '商业计划', '融资'],
        usageCount: 234,
        rating: 4.9,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { slides: 15, author: 'PaperPower' }
      },
      {
        id: 'ppt_academic_001',
        name: '学术答辩模板',
        type: 'ppt',
        category: 'academic',
        style: '简约风',
        thumbnail: 'https://via.placeholder.com/300x200/10b981/ffffff?text=Academic+PPT',
        tags: ['学术', '答辩', '论文'],
        usageCount: 189,
        rating: 4.7,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { slides: 20, author: 'PaperPower' }
      },
      
      // Word 模板
      {
        id: 'word_contract_001',
        name: '标准合同模板',
        type: 'word',
        category: 'legal',
        style: '正式',
        tags: ['合同', '协议', '法律'],
        usageCount: 312,
        rating: 4.9,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { pages: 8, author: 'PaperPower' }
      },
      {
        id: 'word_report_001',
        name: '项目报告模板',
        type: 'word',
        category: 'business',
        style: '商务',
        tags: ['报告', '项目', '总结'],
        usageCount: 267,
        rating: 4.6,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { pages: 12, author: 'PaperPower' }
      },
      
      // Excel 模板
      {
        id: 'excel_budget_001',
        name: '财务预算模板',
        type: 'excel',
        category: 'finance',
        style: '专业',
        tags: ['财务', '预算', '报表'],
        usageCount: 445,
        rating: 4.9,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { sheets: 5, author: 'PaperPower' }
      },
      {
        id: 'excel_analysis_001',
        name: '数据分析模板',
        type: 'excel',
        category: 'analysis',
        style: '现代',
        tags: ['数据', '分析', '图表'],
        usageCount: 378,
        rating: 4.7,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { sheets: 3, author: 'PaperPower' }
      }
    ]

    // 检查是否已有模板
    const existing = await this.getAllTemplates()
    if (existing.length === 0) {
      await this.saveBatch(defaultTemplates)
    }
  }

  async saveTemplate(template: Template): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['templates'], 'readwrite')
      const store = transaction.objectStore('templates')
      const request = store.put(template)

      request.onsuccess = () => {
        this.invalidateCache()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['templates'], 'readonly')
      const store = transaction.objectStore('templates')
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async searchTemplates(filter: TemplateFilter): Promise<Template[]> {
    const cacheKey = JSON.stringify(filter)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['templates'], 'readonly')
      const store = transaction.objectStore('templates')
      const request = store.getAll()

      request.onsuccess = () => {
        let results = request.result as Template[]

        // 类型过滤
        if (filter.type) {
          results = results.filter(t => t.type === filter.type)
        }

        // 分类过滤
        if (filter.category) {
          results = results.filter(t => t.category === filter.category)
        }

        // 风格过滤
        if (filter.style) {
          results = results.filter(t => t.style === filter.style)
        }

        // 标签过滤
        if (filter.tags && filter.tags.length > 0) {
          results = results.filter(t =>
            filter.tags!.some(tag => t.tags.includes(tag))
          )
        }

        // 评分过滤
        if (filter.minRating) {
          results = results.filter(t => t.rating >= filter.minRating!)
        }

        // 排序
        switch (filter.sortBy || 'usage') {
          case 'usage':
            results.sort((a, b) => b.usageCount - a.usageCount)
            break
          case 'rating':
            results.sort((a, b) => b.rating - a.rating)
            break
          case 'newest':
            results.sort((a, b) => b.createdAt - a.createdAt)
            break
          case 'oldest':
            results.sort((a, b) => a.createdAt - b.createdAt)
            break
        }

        this.cache.set(cacheKey, results)
        resolve(results)
      }

      request.onerror = () => reject(request.error)
    })
  }

  async getAllTemplates(): Promise<Template[]> {
    return this.searchTemplates({})
  }

  async deleteTemplate(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['templates'], 'readwrite')
      const store = transaction.objectStore('templates')
      const request = store.delete(id)

      request.onsuccess = () => {
        this.invalidateCache()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async incrementUsage(id: string): Promise<void> {
    const template = await this.getTemplate(id)
    if (template) {
      template.usageCount++
      template.updatedAt = Date.now()
      await this.saveTemplate(template)
    }
  }

  async rateTemplate(id: string, rating: number): Promise<void> {
    const template = await this.getTemplate(id)
    if (template) {
      // 计算新评分（简单平均）
      const totalRating = template.rating * template.usageCount + rating
      template.rating = totalRating / (template.usageCount + 1)
      template.updatedAt = Date.now()
      await this.saveTemplate(template)
    }
  }

  async saveBatch(templates: Template[]): Promise<void> {
    for (const template of templates) {
      await this.saveTemplate(template)
    }
  }

  async exportTemplates(): Promise<string> {
    const templates = await this.getAllTemplates()
    return JSON.stringify(templates, null, 2)
  }

  async importTemplates(json: string): Promise<number> {
    try {
      const templates = JSON.parse(json) as Template[]
      await this.saveBatch(templates)
      return templates.length
    } catch (error) {
      console.error('Failed to import templates:', error)
      return 0
    }
  }

  private invalidateCache(): void {
    this.cache.clear()
  }

  async getStats(): Promise<{
    total: number
    byType: Record<string, number>
    byCategory: Record<string, number>
    avgRating: number
    totalUsage: number
  }> {
    const all = await this.getAllTemplates()
    
    return {
      total: all.length,
      byType: all.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byCategory: all.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      avgRating: all.length > 0 ? all.reduce((sum, t) => sum + t.rating, 0) / all.length : 0,
      totalUsage: all.reduce((sum, t) => sum + t.usageCount, 0)
    }
  }
}

export const aiTemplateManager = new AITemplateManagerClass()
