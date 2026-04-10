import { auditLogger } from './compliance'

export interface RenameRule {
  type: 'prefix' | 'suffix' | 'replace' | 'sequence' | 'date' | 'regex' | 'lowercase' | 'uppercase' | 'capitalize'
  params: Record<string, string | number>
}

export interface RenamePreview {
  original: string
  renamed: string
  valid: boolean
  error?: string
}

export interface RenameResult {
  success: boolean
  previews: RenamePreview[]
  auditId: string
  timestamp: string
}

export class BatchRenamer {
  private static instance: BatchRenamer
  
  private constructor() {}
  
  static getInstance(): BatchRenamer {
    if (!BatchRenamer.instance) {
      BatchRenamer.instance = new BatchRenamer()
    }
    return BatchRenamer.instance
  }
  
  generatePreview(files: string[], rule: RenameRule): RenamePreview[] {
    return files.map((file, index) => {
      const ext = this.getExtension(file)
      const nameWithoutExt = this.getNameWithoutExtension(file)
      
      try {
        const newName = this.applyRule(nameWithoutExt, ext, index, rule)
        const valid = this.validateName(newName)
        
        return {
          original: file,
          renamed: newName,
          valid,
          error: valid ? undefined : '文件名包含非法字符'
        }
      } catch (error) {
        return {
          original: file,
          renamed: file,
          valid: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })
  }
  
  private applyRule(name: string, ext: string, index: number, rule: RenameRule): string {
    let newName = name
    
    switch (rule.type) {
      case 'prefix':
        newName = `${rule.params.text || ''}${name}`
        break
        
      case 'suffix':
        newName = `${name}${rule.params.text || ''}`
        break
        
      case 'replace':
        if (rule.params.from && rule.params.to !== undefined) {
          newName = name.split(rule.params.from as string).join(rule.params.to as string)
        }
        break
        
      case 'sequence':
        const start = (rule.params.start as number) || 1
        const digits = (rule.params.digits as number) || 3
        const separator = (rule.params.separator as string) || '_'
        const num = (start + index).toString().padStart(digits, '0')
        const base = rule.params.baseName as string || name
        newName = `${base}${separator}${num}`
        break
        
      case 'date':
        const now = new Date()
        const format = (rule.params.format as string) || 'YYYYMMDD'
        const dateStr = this.formatDate(now, format)
        const dateSeparator = (rule.params.separator as string) || '_'
        newName = `${dateStr}${dateSeparator}${name}`
        break
        
      case 'regex':
        try {
          const pattern = rule.params.pattern as string
          const replacement = rule.params.replacement as string || ''
          const flags = (rule.params.flags as string) || 'g'
          const regex = new RegExp(pattern, flags)
          newName = name.replace(regex, replacement)
        } catch {
          throw new Error('正则表达式无效')
        }
        break
        
      case 'lowercase':
        newName = name.toLowerCase()
        break
        
      case 'uppercase':
        newName = name.toUpperCase()
        break
        
      case 'capitalize':
        newName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
        break
    }
    
    return `${newName}${ext}`
  }
  
  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.substring(lastDot) : ''
  }
  
  private getNameWithoutExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.substring(0, lastDot) : filename
  }
  
  private validateName(name: string): boolean {
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(name)) return false
    if (name.length === 0 || name.length > 255) return false
    if (name === '.' || name === '..') return false
    return true
  }
  
  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    const second = date.getSeconds().toString().padStart(2, '0')
    
    return format
      .replace('YYYY', year.toString())
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second)
  }
  
  createAuditLog(files: string[], previews: RenamePreview[]): string {
    const auditLog = auditLogger.createAuditLog(
      { fileCount: files.length, ruleType: 'batch_rename' },
      previews.map((preview, index) => ({
        step: index + 1,
        operation: 'rename_preview',
        method: 'deterministic_transform',
        input: { original: preview.original },
        output: { renamed: preview.renamed, valid: preview.valid },
        evidence: preview.valid ? 'valid' : `error: ${preview.error}`
      })),
      { success: previews.every(p => p.valid) }
    )
    
    return auditLog.auditId
  }
  
  parseNaturalLanguageRule(input: string): RenameRule | null {
    const lowerInput = input.toLowerCase()
    
    if (lowerInput.includes('添加前缀') || lowerInput.includes('加前缀')) {
      const match = input.match(/["「『]([^"」』]+)["」』]/)
      return {
        type: 'prefix',
        params: { text: match ? match[1] : '' }
      }
    }
    
    if (lowerInput.includes('添加后缀') || lowerInput.includes('加后缀')) {
      const match = input.match(/["「『]([^"」』]+)["」』]/)
      return {
        type: 'suffix',
        params: { text: match ? match[1] : '' }
      }
    }
    
    if (lowerInput.includes('替换') || lowerInput.includes('把') || lowerInput.includes('将')) {
      const matches = input.match(/["「『]([^"」』]+)["」』]/g)
      if (matches && matches.length >= 2) {
        const from = matches[0].replace(/["「』」]/g, '')
        const to = matches[1].replace(/["「』」]/g, '')
        return {
          type: 'replace',
          params: { from, to }
        }
      }
    }
    
    if (lowerInput.includes('序号') || lowerInput.includes('编号') || lowerInput.includes('数字')) {
      const startMatch = input.match(/从\s*(\d+)/)
      const baseMatch = input.match(/["「『]([^"」』]+)["」』]/)
      return {
        type: 'sequence',
        params: {
          start: startMatch ? parseInt(startMatch[1]) : 1,
          digits: 3,
          separator: '_',
          baseName: baseMatch ? baseMatch[1] : ''
        }
      }
    }
    
    if (lowerInput.includes('日期') || lowerInput.includes('时间') || lowerInput.includes('今天')) {
      return {
        type: 'date',
        params: { format: 'YYYYMMDD', separator: '_' }
      }
    }
    
    if (lowerInput.includes('小写') || lowerInput.includes('转小写')) {
      return { type: 'lowercase', params: {} }
    }
    
    if (lowerInput.includes('大写') || lowerInput.includes('转大写')) {
      return { type: 'uppercase', params: {} }
    }
    
    if (lowerInput.includes('首字母大写') || lowerInput.includes('首字大写')) {
      return { type: 'capitalize', params: {} }
    }
    
    return null
  }
  
  suggestRules(files: string[]): { rule: RenameRule; description: string }[] {
    const suggestions: { rule: RenameRule; description: string }[] = []
    
    const hasNumbers = files.some(f => /\d+/.test(f))
    if (hasNumbers) {
      suggestions.push({
        rule: { type: 'sequence', params: { start: 1, digits: 3, separator: '_' } },
        description: '使用序号重命名'
      })
    }
    
    const hasSpaces = files.some(f => f.includes(' '))
    if (hasSpaces) {
      suggestions.push({
        rule: { type: 'replace', params: { from: ' ', to: '_' } },
        description: '将空格替换为下划线'
      })
    }
    
    const hasChinese = files.some(f => /[\u4e00-\u9fa5]/.test(f))
    if (hasChinese) {
      suggestions.push({
        rule: { type: 'date', params: { format: 'YYYYMMDD', separator: '_' } },
        description: '添加日期前缀'
      })
    }
    
    const extensions = new Set(files.map(f => f.split('.').pop()?.toLowerCase()))
    if (extensions.size === 1) {
      suggestions.push({
        rule: { type: 'sequence', params: { start: 1, digits: 3, separator: '_', baseName: '文件' } },
        description: '统一命名格式'
      })
    }
    
    suggestions.push({
      rule: { type: 'lowercase', params: {} },
      description: '全部转为小写'
    })
    
    return suggestions
  }
}

export const batchRenamer = BatchRenamer.getInstance()
