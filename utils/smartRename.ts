import { auditLogger } from './compliance'

export interface NameListEntry {
  studentId: string
  name: string
  class?: string
  [key: string]: string | undefined
}

export interface SmartRenameRule {
  type: 'template' | 'pattern'
  template: string
  pattern?: string
}

export interface SmartRenamePreview {
  original: string
  renamed: string
  matchedInfo: {
    studentId?: string
    name?: string
    source: 'filename' | 'content' | 'list'
  }
  valid: boolean
  error?: string
}

export interface ExtractedInfo {
  studentId?: string
  name?: string
  source: 'filename' | 'content'
}

class SmartRenamer {
  private nameList: NameListEntry[] = []
  private static instance: SmartRenamer
  
  private constructor() {}
  
  static getInstance(): SmartRenamer {
    if (!SmartRenamer.instance) {
      SmartRenamer.instance = new SmartRenamer()
    }
    return SmartRenamer.instance
  }
  
  loadNameList(data: NameListEntry[]): void {
    this.nameList = data
  }
  
  getNameList(): NameListEntry[] {
    return this.nameList
  }
  
  hasNameList(): boolean {
    return this.nameList.length > 0
  }
  
  parseNameListFromText(text: string): NameListEntry[] {
    const lines = text.split(/[\r\n]+/).filter(line => line.trim())
    const entries: NameListEntry[] = []
    
    for (const line of lines) {
      const parts = line.split(/[\t,，\s]+/).filter(p => p.trim())
      if (parts.length >= 2) {
        const studentIdMatch = parts.find(p => /^\d{6,12}$/.test(p))
        const nameMatch = parts.find(p => /^[\u4e00-\u9fa5]{2,4}$/.test(p))
        
        if (studentIdMatch && nameMatch) {
          entries.push({
            studentId: studentIdMatch,
            name: nameMatch,
            class: parts.find(p => p !== studentIdMatch && p !== nameMatch)
          })
        } else if (nameMatch) {
          entries.push({ studentId: '', name: nameMatch })
        } else if (studentIdMatch) {
          entries.push({ studentId: studentIdMatch, name: '' })
        }
      }
    }
    
    this.nameList = entries
    return entries
  }
  
  parseNameListFromCSV(content: string): NameListEntry[] {
    const lines = content.split(/[\r\n]+/).filter(line => line.trim())
    if (lines.length < 2) return []
    
    const headers = lines[0].split(/[,，\t]/).map(h => h.trim().toLowerCase())
    const idIndex = headers.findIndex(h => h.includes('学号') || h.includes('id') || h.includes('工号'))
    const nameIndex = headers.findIndex(h => h.includes('姓名') || h.includes('name') || h.includes('名字'))
    const classIndex = headers.findIndex(h => h.includes('班级') || h.includes('class'))
    
    const entries: NameListEntry[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[,，\t]/).map(v => v.trim())
      if (values.length >= 2) {
        entries.push({
          studentId: idIndex >= 0 ? values[idIndex] : '',
          name: nameIndex >= 0 ? values[nameIndex] : '',
          class: classIndex >= 0 ? values[classIndex] : undefined
        })
      }
    }
    
    this.nameList = entries
    return entries
  }
  
  extractFromFilename(filename: string): ExtractedInfo {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
    const info: ExtractedInfo = { source: 'filename' }
    
    const studentIdMatch = nameWithoutExt.match(/(\d{6,12})/)
    if (studentIdMatch) {
      info.studentId = studentIdMatch[1]
    }
    
    const chineseNameMatch = nameWithoutExt.match(/[\u4e00-\u9fa5]{2,4}/)
    if (chineseNameMatch) {
      const potentialName = chineseNameMatch[0]
      if (this.nameList.some(e => e.name === potentialName)) {
        info.name = potentialName
      } else if (!info.studentId) {
        info.name = potentialName
      }
    }
    
    return info
  }
  
  extractFromContent(content: string): ExtractedInfo {
    const info: ExtractedInfo = { source: 'content' }
    
    const studentIdMatch = content.match(/学号[：:]\s*(\d{6,12})/) || content.match(/(\d{6,12})/)
    if (studentIdMatch) {
      info.studentId = studentIdMatch[1]
    }
    
    const namePatterns = [
      /姓名[：:]\s*([\u4e00-\u9fa5]{2,4})/,
      /名字[：:]\s*([\u4e00-\u9fa5]{2,4})/,
      /作者[：:]\s*([\u4e00-\u9fa5]{2,4})/,
      /提交人[：:]\s*([\u4e00-\u9fa5]{2,4})/
    ]
    
    for (const pattern of namePatterns) {
      const match = content.match(pattern)
      if (match) {
        info.name = match[1]
        break
      }
    }
    
    return info
  }
  
  matchWithList(info: ExtractedInfo): NameListEntry | null {
    if (!this.hasNameList()) return null
    
    if (info.studentId) {
      const match = this.nameList.find(e => e.studentId === info.studentId)
      if (match) return match
    }
    
    if (info.name) {
      const match = this.nameList.find(e => e.name === info.name)
      if (match) return match
    }
    
    return null
  }
  
  generateNewName(
    originalFilename: string,
    template: string,
    fileInfo?: ExtractedInfo,
    contentInfo?: ExtractedInfo
  ): { name: string; matchedInfo: SmartRenamePreview['matchedInfo'] } {
    const ext = originalFilename.includes('.') 
      ? '.' + originalFilename.split('.').pop() 
      : ''
    
    let studentId = ''
    let name = ''
    let source: 'filename' | 'content' | 'list' = 'filename'
    
    if (fileInfo) {
      studentId = fileInfo.studentId || ''
      name = fileInfo.name || ''
      source = 'filename'
    }
    
    if (!studentId && !name && contentInfo) {
      studentId = contentInfo.studentId || ''
      name = contentInfo.name || ''
      source = 'content'
    }
    
    const listMatch = this.matchWithList({ studentId, name, source })
    if (listMatch) {
      if (!studentId && listMatch.studentId) {
        studentId = listMatch.studentId
        source = 'list'
      }
      if (!name && listMatch.name) {
        name = listMatch.name
        source = 'list'
      }
    }
    
    let newName = template
      .replace(/{学号}/g, studentId || '未知学号')
      .replace(/{studentId}/g, studentId || '未知学号')
      .replace(/{姓名}/g, name || '未知姓名')
      .replace(/{name}/g, name || '未知姓名')
      .replace(/{班级}/g, listMatch?.class || '')
      .replace(/{class}/g, listMatch?.class || '')
    
    return {
      name: newName + ext,
      matchedInfo: { studentId, name, source }
    }
  }
  
  generateSmartPreview(
    files: Array<{ name: string; content?: string }>,
    template: string
  ): SmartRenamePreview[] {
    return files.map(file => {
      try {
        const fileInfo = this.extractFromFilename(file.name)
        const contentInfo = file.content ? this.extractFromContent(file.content) : undefined
        
        const { name: newName, matchedInfo } = this.generateNewName(
          file.name,
          template,
          fileInfo,
          contentInfo
        )
        
        const valid = this.validateName(newName)
        
        return {
          original: file.name,
          renamed: newName,
          matchedInfo,
          valid,
          error: valid ? undefined : '文件名包含非法字符或信息不完整'
        }
      } catch (error) {
        return {
          original: file.name,
          renamed: file.name,
          matchedInfo: { source: 'filename' },
          valid: false,
          error: error instanceof Error ? error.message : '处理失败'
        }
      }
    })
  }
  
  private validateName(name: string): boolean {
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(name)) return false
    if (name.length === 0 || name.length > 255) return false
    if (name === '.' || name === '..') return false
    if (name.includes('未知')) return false
    return true
  }
  
  parseTemplateFromInput(input: string): string | null {
    const templateMatch = input.match(/重命名为[：:]?\s*(.+)/i)
    if (templateMatch) {
      return templateMatch[1].trim()
    }
    
    if (input.includes('学号') && input.includes('姓名')) {
      if (input.includes('+')) {
        return '{学号}+{姓名}'
      }
      if (input.includes('-')) {
        return '{学号}-{姓名}'
      }
      if (input.includes('_')) {
        return '{学号}_{姓名}'
      }
      return '{学号}{姓名}'
    }
    
    if (input.includes('姓名') && input.includes('学号')) {
      if (input.includes('+')) {
        return '{姓名}+{学号}'
      }
      if (input.includes('-')) {
        return '{姓名}-{学号}'
      }
      return '{姓名}{学号}'
    }
    
    return null
  }
  
  createAuditLog(files: string[], previews: SmartRenamePreview[]): string {
    const auditLog = auditLogger.createAuditLog(
      { fileCount: files.length, operation: 'smart_rename' },
      previews.map((preview, index) => ({
        step: index + 1,
        operation: 'smart_rename_preview',
        method: 'intelligent_matching',
        input: { 
          original: preview.original,
          matchedInfo: preview.matchedInfo
        },
        output: { 
          renamed: preview.renamed, 
          valid: preview.valid 
        },
        evidence: preview.valid ? 'matched' : `error: ${preview.error}`
      })),
      { success: previews.every(p => p.valid) }
    )
    
    return auditLog.auditId
  }
  
  getUnmatchedFiles(previews: SmartRenamePreview[]): SmartRenamePreview[] {
    return previews.filter(p => 
      !p.matchedInfo.studentId && !p.matchedInfo.name
    )
  }
  
  getFilesNeedingContent(previews: SmartRenamePreview[]): SmartRenamePreview[] {
    return previews.filter(p => 
      p.matchedInfo.source === 'filename' && 
      (!p.matchedInfo.studentId || !p.matchedInfo.name)
    )
  }
}

export const smartRenamer = SmartRenamer.getInstance()
