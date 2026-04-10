import { DocumentLayoutAnalyzer, DocumentStructure, ContentExtractor, TableStructureRecognizer } from './documentIntelligence'
import { FormatRecommendationEngine, AutoFormatter, FormatRecommendation, STYLE_PROFILES } from './formatRecommendation'
import { parseUserInput } from './smartInputParser'

export interface ProcessingResult {
  success: boolean
  structure?: DocumentStructure
  recommendations?: FormatRecommendation[]
  formattedContent?: string
  report?: string
  error?: string
}

export interface IntelligentEdit {
  type: 'format' | 'structure' | 'content' | 'style'
  action: string
  target: string
  value: string | number | boolean | Record<string, unknown>
  description: string
  confidence: number
}

export class IntelligentDocumentProcessor {
  static processDocument(html: string): ProcessingResult {
    try {
      const structure = DocumentLayoutAnalyzer.analyzeDocument(html)
      const recommendations = FormatRecommendationEngine.analyzeAndRecommend(structure)
      const report = FormatRecommendationEngine.generateFormatReport(structure)
      
      return {
        success: true,
        structure,
        recommendations,
        report
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '处理失败'
      }
    }
  }

  static autoFormat(html: string, profileName?: string): ProcessingResult {
    try {
      const structure = DocumentLayoutAnalyzer.analyzeDocument(html)
      const profile = profileName 
        ? STYLE_PROFILES[profileName] 
        : FormatRecommendationEngine.selectBestProfile(structure)
      
      const formattedContent = AutoFormatter.applyProfile(structure, profile)
      
      return {
        success: true,
        structure,
        formattedContent
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '格式化失败'
      }
    }
  }

  static analyzeAndSuggest(html: string): {
    structure: DocumentStructure
    suggestions: string[]
    quickActions: { label: string; action: string }[]
  } {
    const structure = DocumentLayoutAnalyzer.analyzeDocument(html)
    const recommendations = FormatRecommendationEngine.analyzeAndRecommend(structure)
    
    const suggestions: string[] = []
    const quickActions: { label: string; action: string }[] = []
    
    recommendations.forEach(rec => {
      if (rec.confidence > 0.7) {
        suggestions.push(rec.reason)
        
        if (rec.autoApplicable) {
          quickActions.push({
            label: `应用${rec.type === 'font' ? '字体' : rec.type === 'size' ? '字号' : rec.type === 'spacing' ? '行距' : rec.type === 'margin' ? '页边距' : '格式'}建议`,
            action: `auto_${rec.type}_${rec.recommendedValue}`
          })
        }
      }
    })
    
    const titles = ContentExtractor.extractTitles(structure.blocks)
    if (titles.length === 0) {
      suggestions.push('文档缺少标题，建议添加标题')
      quickActions.push({ label: '添加标题', action: 'add_title' })
    }
    
    const tables = ContentExtractor.extractTables(structure.blocks)
    tables.forEach((table, index) => {
      if (table.children && table.children.length > 0) {
        const hasHeader = table.children.some(cell => cell.type === 'header')
        if (!hasHeader) {
          suggestions.push(`表格${index + 1}缺少表头，建议添加`)
        }
      }
    })
    
    const keywords = ContentExtractor.extractKeywords(structure.blocks.map(b => b.content).join(' '))
    if (keywords.length > 0) {
      suggestions.push(`检测到关键词: ${keywords.slice(0, 5).join('、')}`)
    }
    
    return {
      structure,
      suggestions,
      quickActions
    }
  }

  static extractDocumentInfo(html: string): {
    titles: string[]
    keywords: string[]
    summary: string
    dates: string[]
    numbers: { value: number; unit?: string; context: string }[]
    entities: { type: string; value: string }[]
    tables: { rows: number; cols: number; data: string[][] }[]
  } {
    const structure = DocumentLayoutAnalyzer.analyzeDocument(html)
    const content = structure.blocks.map(b => b.content).join(' ')
    
    const titles = ContentExtractor.extractTitles(structure.blocks).map(b => b.content)
    const keywords = ContentExtractor.extractKeywords(content)
    const summary = ContentExtractor.generateSummary(content)
    const dates = ContentExtractor.extractDates(content)
    const numbers = ContentExtractor.extractNumbers(content)
    const entities = ContentExtractor.extractEntities(content)
    
    const tables: { rows: number; cols: number; data: string[][] }[] = []
    const tableBlocks = ContentExtractor.extractTables(structure.blocks)
    
    tableBlocks.forEach(table => {
      if (table.children) {
        const parser = new DOMParser()
        const doc = parser.parseFromString(table.content, 'text/html')
        const tableEl = doc.querySelector('table')
        
        if (tableEl) {
          const structure = TableStructureRecognizer.analyzeTable(tableEl)
          const data = TableStructureRecognizer.extractTableData(tableEl)
          tables.push({
            rows: structure.rows,
            cols: structure.cols,
            data
          })
        }
      }
    })
    
    return {
      titles,
      keywords,
      summary,
      dates,
      numbers,
      entities,
      tables
    }
  }

  static interpretUserCommand(command: string): IntelligentEdit[] {
    const edits: IntelligentEdit[] = []
    const parsed = parseUserInput(command)
    
    if (parsed.fontSize) {
      edits.push({
        type: 'format',
        action: 'setFontSize',
        target: 'selection',
        value: parsed.fontSize,
        description: `设置字号为 ${parsed.fontSize}pt`,
        confidence: 0.95
      })
    }
    
    if (parsed.fontFamily) {
      edits.push({
        type: 'format',
        action: 'setFontFamily',
        target: 'selection',
        value: parsed.fontFamily,
        description: `设置字体为 ${parsed.fontFamily.split(',')[0]}`,
        confidence: 0.95
      })
    }
    
    if (parsed.color) {
      edits.push({
        type: 'format',
        action: 'setColor',
        target: 'selection',
        value: parsed.color,
        description: `设置颜色为 ${parsed.color}`,
        confidence: 0.95
      })
    }
    
    if (parsed.spacing) {
      edits.push({
        type: 'format',
        action: 'setLineSpacing',
        target: 'document',
        value: parsed.spacing,
        description: `设置行距为 ${parsed.spacing}倍`,
        confidence: 0.9
      })
    }
    
    if (parsed.alignment) {
      edits.push({
        type: 'format',
        action: 'setAlignment',
        target: 'selection',
        value: parsed.alignment,
        description: `设置对齐方式为 ${parsed.alignment}`,
        confidence: 0.95
      })
    }
    
    if (parsed.bold !== undefined) {
      edits.push({
        type: 'format',
        action: 'setBold',
        target: 'selection',
        value: parsed.bold,
        description: parsed.bold ? '设置加粗' : '取消加粗',
        confidence: 0.95
      })
    }
    
    if (parsed.italic !== undefined) {
      edits.push({
        type: 'format',
        action: 'setItalic',
        target: 'selection',
        value: parsed.italic,
        description: parsed.italic ? '设置斜体' : '取消斜体',
        confidence: 0.95
      })
    }
    
    if (parsed.underline !== undefined) {
      edits.push({
        type: 'format',
        action: 'setUnderline',
        target: 'selection',
        value: parsed.underline,
        description: parsed.underline ? '设置下划线' : '取消下划线',
        confidence: 0.95
      })
    }
    
    const lowerCommand = command.toLowerCase()
    
    if (lowerCommand.includes('一键格式化') || lowerCommand.includes('自动格式化')) {
      edits.push({
        type: 'style',
        action: 'autoFormat',
        target: 'document',
        value: true,
        description: '自动应用最佳格式配置',
        confidence: 0.9
      })
    }
    
    if (lowerCommand.includes('公文格式') || lowerCommand.includes('公文样式')) {
      edits.push({
        type: 'style',
        action: 'applyProfile',
        target: 'document',
        value: 'official',
        description: '应用公文格式',
        confidence: 0.95
      })
    }
    
    if (lowerCommand.includes('论文格式') || lowerCommand.includes('学术论文')) {
      edits.push({
        type: 'style',
        action: 'applyProfile',
        target: 'document',
        value: 'academic',
        description: '应用学术论文格式',
        confidence: 0.95
      })
    }
    
    if (lowerCommand.includes('插入表格')) {
      const match = command.match(/(\d+)\s*[×xX]\s*(\d+)/)
      if (match) {
        edits.push({
          type: 'structure',
          action: 'insertTable',
          target: 'cursor',
          value: { rows: parseInt(match[1]), cols: parseInt(match[2]) },
          description: `插入 ${match[1]}×${match[2]} 表格`,
          confidence: 0.95
        })
      } else {
        edits.push({
          type: 'structure',
          action: 'insertTable',
          target: 'cursor',
          value: { rows: 3, cols: 3 },
          description: '插入 3×3 表格',
          confidence: 0.8
        })
      }
    }
    
    if (lowerCommand.includes('插入图片')) {
      edits.push({
        type: 'structure',
        action: 'insertImage',
        target: 'cursor',
        value: true,
        description: '打开图片插入对话框',
        confidence: 0.9
      })
    }
    
    if (lowerCommand.includes('页面设置') || lowerCommand.includes('页边距')) {
      edits.push({
        type: 'structure',
        action: 'openPageSetup',
        target: 'document',
        value: true,
        description: '打开页面设置对话框',
        confidence: 0.9
      })
    }
    
    if (lowerCommand.includes('打印预览') || lowerCommand.includes('打印')) {
      edits.push({
        type: 'structure',
        action: 'openPrintPreview',
        target: 'document',
        value: true,
        description: '打开打印预览',
        confidence: 0.9
      })
    }
    
    if (lowerCommand.includes('提取关键词') || lowerCommand.includes('关键词')) {
      edits.push({
        type: 'content',
        action: 'extractKeywords',
        target: 'document',
        value: true,
        description: '提取文档关键词',
        confidence: 0.9
      })
    }
    
    if (lowerCommand.includes('生成摘要') || lowerCommand.includes('摘要')) {
      edits.push({
        type: 'content',
        action: 'generateSummary',
        target: 'document',
        value: true,
        description: '生成文档摘要',
        confidence: 0.9
      })
    }
    
    if (lowerCommand.includes('格式检查') || lowerCommand.includes('检查格式')) {
      edits.push({
        type: 'content',
        action: 'checkFormat',
        target: 'document',
        value: true,
        description: '检查文档格式',
        confidence: 0.9
      })
    }
    
    return edits
  }

  static getStyleProfiles(): { id: string; name: string; description: string }[] {
    return Object.entries(STYLE_PROFILES).map(([id, profile]) => ({
      id,
      name: profile.name,
      description: profile.description
    }))
  }

  static getProfileCSS(profileId: string): string {
    const profile = STYLE_PROFILES[profileId]
    return profile ? AutoFormatter.generateCSS(profile) : ''
  }

  static compareDocuments(html1: string, html2: string): {
    similarity: number
    differences: string[]
    details: {
      structure1: DocumentStructure
      structure2: DocumentStructure
    }
  } {
    const structure1 = DocumentLayoutAnalyzer.analyzeDocument(html1)
    const structure2 = DocumentLayoutAnalyzer.analyzeDocument(html2)
    
    const { DocumentComparator } = require('./documentIntelligence')
    const comparison = DocumentComparator.compareDocuments(structure1, structure2)
    
    return {
      similarity: comparison.similarity,
      differences: comparison.differences,
      details: {
        structure1,
        structure2
      }
    }
  }
}

export class DocumentLearningEngine {
  private static userPreferences: Map<string, { profile: string; customizations: Record<string, unknown> }> = new Map()
  
  static learnFromUserAction(documentType: string, action: string, value: unknown): void {
    const existing = this.userPreferences.get(documentType) || {
      profile: 'business',
      customizations: {}
    }
    
    existing.customizations[action] = value
    this.userPreferences.set(documentType, existing)
  }
  
  static getUserPreference(documentType: string): { profile: string; customizations: Record<string, unknown> } | undefined {
    return this.userPreferences.get(documentType)
  }
  
  static suggestBasedOnHistory(documentType: string): FormatRecommendation[] {
    const preference = this.userPreferences.get(documentType)
    if (!preference) return []
    
    const recommendations: FormatRecommendation[] = []
    const profile = STYLE_PROFILES[preference.profile]
    
    if (!profile) return []
    
    Object.entries(preference.customizations).forEach(([action, value]) => {
      if (action === 'fontSize') {
        recommendations.push({
          type: 'size',
          currentValue: profile.fontSize,
          recommendedValue: value as number,
          reason: '根据您的使用习惯推荐',
          confidence: 0.9,
          autoApplicable: true
        })
      }
      
      if (action === 'fontFamily') {
        recommendations.push({
          type: 'font',
          currentValue: profile.fontFamily,
          recommendedValue: value as string,
          reason: '根据您的使用习惯推荐',
          confidence: 0.9,
          autoApplicable: true
        })
      }
      
      if (action === 'lineSpacing') {
        recommendations.push({
          type: 'spacing',
          currentValue: profile.lineHeight,
          recommendedValue: value as number,
          reason: '根据您的使用习惯推荐',
          confidence: 0.9,
          autoApplicable: true
        })
      }
    })
    
    return recommendations
  }
}
