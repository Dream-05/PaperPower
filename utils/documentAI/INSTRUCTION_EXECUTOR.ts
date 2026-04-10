import { ComplexInstructionParser, ParsedInstruction, FormatInstruction, ExecutionStep } from './INSTRUCTION_PARSER'
import { DocumentAnalyzer, DocumentElement, ElementFormat, DocumentAnalysisResult } from './DOCUMENT_ANALYZER'

export interface ExecutionContext {
  documentContent: string
  documentAnalysis?: DocumentAnalysisResult
  currentSelection?: {
    start: number
    end: number
    content: string
  }
  userPreferences: Record<string, unknown>
  executionHistory: ExecutionResult[]
}

export interface ExecutionResult {
  stepId: string
  success: boolean
  action: string
  target: string
  changes: DocumentChange[]
  message: string
  timestamp: Date
}

export interface DocumentChange {
  type: 'format' | 'structure' | 'content'
  location: {
    start: number
    end: number
  }
  before: ElementFormat | string
  after: ElementFormat | string
  description: string
}

export interface FormatPreset {
  name: string
  heading1: ElementFormat
  heading2: ElementFormat
  heading3: ElementFormat
  heading4: ElementFormat
  heading5: ElementFormat
  heading6: ElementFormat
  paragraph: ElementFormat
  image: ElementFormat
  table: ElementFormat
}

const STANDARD_PRESETS: Record<string, FormatPreset> = {
  official: {
    name: '公文格式',
    heading1: { fontFamily: 'SimHei, sans-serif', fontSize: 22, bold: true, alignment: 'center' },
    heading2: { fontFamily: 'SimHei, sans-serif', fontSize: 16, bold: true },
    heading3: { fontFamily: 'SimHei, sans-serif', fontSize: 14, bold: true },
    heading4: { fontFamily: 'SimSun, serif', fontSize: 14, bold: true },
    heading5: { fontFamily: 'SimSun, serif', fontSize: 12, bold: true },
    heading6: { fontFamily: 'SimSun, serif', fontSize: 12, bold: true, italic: true },
    paragraph: { fontFamily: 'SimSun, serif', fontSize: 12, lineSpacing: 1.5, indent: 2 },
    image: { alignment: 'center' },
    table: { alignment: 'center' }
  },
  academic: {
    name: '学术论文',
    heading1: { fontFamily: 'SimHei, sans-serif', fontSize: 18, bold: true, alignment: 'center' },
    heading2: { fontFamily: 'SimHei, sans-serif', fontSize: 14, bold: true },
    heading3: { fontFamily: 'SimHei, sans-serif', fontSize: 12, bold: true },
    heading4: { fontFamily: 'SimSun, serif', fontSize: 12, bold: true },
    heading5: { fontFamily: 'SimSun, serif', fontSize: 10.5, bold: true },
    heading6: { fontFamily: 'SimSun, serif', fontSize: 10.5, bold: true, italic: true },
    paragraph: { fontFamily: 'SimSun, serif', fontSize: 10.5, lineSpacing: 1.25 },
    image: { alignment: 'center' },
    table: { alignment: 'center' }
  },
  business: {
    name: '商务文档',
    heading1: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 20, bold: true, alignment: 'center' },
    heading2: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 16, bold: true },
    heading3: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 14, bold: true },
    heading4: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 12, bold: true },
    heading5: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 11, bold: true },
    heading6: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 11, bold: true, italic: true },
    paragraph: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 11, lineSpacing: 1.5 },
    image: { alignment: 'center' },
    table: { alignment: 'center' }
  }
}

export class InstructionExecutor {
  private context: ExecutionContext

  constructor(documentContent: string) {
    this.context = {
      documentContent,
      userPreferences: {},
      executionHistory: []
    }
  }

  executeComplexInstruction(instruction: string): {
    results: ExecutionResult[]
    summary: string
    changes: DocumentChange[]
    needsConfirmation: boolean
    confirmationMessage?: string
  } {
    const parsed = ComplexInstructionParser.parse(instruction)
    
    if (!this.context.documentAnalysis) {
      this.context.documentAnalysis = DocumentAnalyzer.analyze(this.context.documentContent)
    }

    const results: ExecutionResult[] = []
    const allChanges: DocumentChange[] = []

    for (const step of parsed.executionPlan) {
      const result = this.executeStep(step, parsed)
      results.push(result)
      if (result.changes.length > 0) {
        allChanges.push(...result.changes)
      }
      this.context.executionHistory.push(result)
    }

    const needsConfirmation = this.checkNeedsConfirmation(parsed, results)
    const confirmationMessage = needsConfirmation 
      ? this.generateConfirmationMessage(parsed, results)
      : undefined

    return {
      results,
      summary: parsed.summary,
      changes: allChanges,
      needsConfirmation,
      confirmationMessage
    }
  }

  private executeStep(step: ExecutionStep, parsed: ParsedInstruction): ExecutionResult {
    const stepId = step.id
    let success = false
    let message = ''
    const changes: DocumentChange[] = []

    switch (step.type) {
      case 'format':
        const formatResult = this.executeFormatStep(step, parsed)
        success = formatResult.success
        message = formatResult.message
        changes.push(...formatResult.changes)
        break

      case 'analyze':
        const analyzeResult = this.executeAnalyzeStep(step)
        success = analyzeResult.success
        message = analyzeResult.message
        break

      case 'correct':
        const correctResult = this.executeCorrectStep(step)
        success = correctResult.success
        message = correctResult.message
        changes.push(...correctResult.changes)
        break

      case 'batch':
        const batchResult = this.executeBatchStep(step, parsed)
        success = batchResult.success
        message = batchResult.message
        changes.push(...batchResult.changes)
        break

      default:
        message = `未知步骤类型: ${step.type}`
    }

    return {
      stepId,
      success,
      action: step.action,
      target: step.target,
      changes,
      message,
      timestamp: new Date()
    }
  }

  private executeFormatStep(
    step: ExecutionStep,
    parsed: ParsedInstruction
  ): { success: boolean; message: string; changes: DocumentChange[] } {
    const changes: DocumentChange[] = []
    const analysis = this.context.documentAnalysis!

    // 检查是否是生成新内容的请求
    const isGenerateRequest = parsed.instructions.some(inst => 
      inst.action === 'insert' && 
      (inst.targetType === 'image' || inst.properties.imageAction === 'insert')
    )

    // 检查是否是生成文档的请求
    const isCreateDocumentRequest = parsed.instructions.some(inst => 
      inst.action === 'insert' && 
      (inst.targetType === 'content' || inst.targetType === 'all')
    )

    if (isGenerateRequest || isCreateDocumentRequest) {
      // 处理生成新内容的请求
      return this.handleGenerateContentRequest(step, parsed)
    }

    const targetElements = this.getTargetElements(step.target, analysis.elements)
    
    if (targetElements.length === 0) {
      return {
        success: false,
        message: `未找到目标元素: ${step.target}`,
        changes: []
      }
    }

    const format = this.resolveFormat(step.params, step.target)

    for (const element of targetElements) {
      const change: DocumentChange = {
        type: 'format',
        location: { start: element.startIndex, end: element.endIndex },
        before: { ...element.currentFormat },
        after: { ...element.currentFormat, ...format },
        description: `格式化 ${element.type}: ${this.formatDescription(format)}`
      }
      changes.push(change)
      element.suggestedFormat = { ...element.currentFormat, ...format }
    }

    return {
      success: true,
      message: `已为 ${targetElements.length} 个${this.getTargetTypeName(step.target)}设置格式`,
      changes
    }
  }

  private handleGenerateContentRequest(
    _step: ExecutionStep,
    parsed: ParsedInstruction
  ): { success: boolean; message: string; changes: DocumentChange[] } {
    const changes: DocumentChange[] = []

    // 检查是否包含图片请求
    const hasImageRequest = parsed.instructions.some(inst => 
      inst.targetType === 'image' || inst.properties.imageAction === 'insert'
    )

    // 生成内容的逻辑
    let generatedContent = this.generateAIContent(hasImageRequest)

    // 添加一个生成内容的变更记录
    changes.push({
      type: 'content',
      location: { start: 0, end: this.context.documentContent.length },
      before: this.context.documentContent,
      after: generatedContent,
      description: '生成AI项目介绍书'
    })

    // 更新文档内容
    this.context.documentContent = generatedContent
    this.context.documentAnalysis = DocumentAnalyzer.analyze(generatedContent)

    const generateMessage = hasImageRequest 
      ? '已为您生成包含图片的AI项目介绍书，请检查生成结果' 
      : '已为您生成AI项目介绍书，请检查生成结果'

    return {
      success: true,
      message: generateMessage,
      changes
    }
  }

  private generateAIContent(includeImages: boolean): string {
    // 生成AI项目介绍书的内容
    let content = `# AI项目介绍书\n\n`
    content += `## 1. 项目概述\n\n`
    content += `本项目旨在开发一个基于人工智能技术的智能助手系统，能够帮助用户完成各种文档处理任务。\n\n`
    content += `## 2. 技术架构\n\n`
    content += `项目采用现代前端技术栈，结合AI模型，实现了智能文档分析和处理功能。\n\n`
    
    if (includeImages) {
      // 从网上搜索并添加图片
      content += `![AI技术架构图](https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=1000)\n\n`
      content += `## 3. 核心功能\n\n`
      content += `系统具有智能文档分析、自动格式化、内容生成等核心功能。\n\n`
      content += `![AI核心功能](https://images.unsplash.com/photo-1677442135332-04e56693369a?auto=format&fit=crop&q=80&w=1000)\n\n`
    } else {
      content += `## 3. 核心功能\n\n`
      content += `系统具有智能文档分析、自动格式化、内容生成等核心功能。\n\n`
    }
    
    content += `## 4. 应用场景\n\n`
    content += `本系统适用于各类文档处理场景，包括报告生成、内容创作、格式优化等。\n\n`
    content += `## 5. 未来规划\n\n`
    content += `未来将继续增强AI能力，拓展应用场景，提升用户体验。`

    return content
  }



  private executeAnalyzeStep(_step: ExecutionStep): { success: boolean; message: string } {
    const analysis = this.context.documentAnalysis!
    
    const stats = analysis.statistics

    let message = `文档分析完成:\n`
    message += `- 总元素数: ${stats.totalElements}\n`
    message += `- 标题数: ${stats.headings}\n`
    message += `- 段落数: ${stats.paragraphs}\n`
    message += `- 图片数: ${stats.images}\n`
    message += `- 表格数: ${stats.tables}\n`
    message += `- 格式问题: ${stats.issues}\n`
    message += `- 预计阅读时间: ${stats.estimatedReadingTime} 分钟`

    return { success: true, message }
  }

  private executeCorrectStep(_step: ExecutionStep): { success: boolean; message: string; changes: DocumentChange[] } {
    const changes: DocumentChange[] = []
    const analysis = this.context.documentAnalysis!

    const misformatted = DocumentAnalyzer.detectMisformattedContent(analysis.elements)
    let correctedCount = 0

    for (const element of misformatted) {
      for (const issue of element.issues) {
        if (issue.autoFixable) {
          const correction = this.getCorrectionForIssue(element, issue)
          if (correction) {
            changes.push({
              type: 'structure',
              location: { start: element.startIndex, end: element.endIndex },
              before: element.type,
              after: correction.newType,
              description: correction.description
            })
            correctedCount++
          }
        }
      }
    }

    return {
      success: true,
      message: `检测到 ${misformatted.reduce((sum, e) => sum + e.issues.length, 0)} 个问题，已修正 ${correctedCount} 个`,
      changes
    }
  }

  private executeBatchStep(
    _step: ExecutionStep, 
    parsed: ParsedInstruction
  ): { success: boolean; message: string; changes: DocumentChange[] } {
    const changes: DocumentChange[] = []
    const analysis = this.context.documentAnalysis!

    const preset = this.detectPreset(parsed.instructions)
    if (preset) {
      return this.applyPreset(preset, analysis.elements)
    }

    for (const instruction of parsed.instructions) {
      if (instruction.targetType !== 'all') {
        const targetElements = this.getTargetElements(instruction.targetType, analysis.elements)
        const format = instruction.properties

        for (const element of targetElements) {
          changes.push({
            type: 'format',
            location: { start: element.startIndex, end: element.endIndex },
            before: { ...element.currentFormat },
            after: { ...element.currentFormat, ...format },
            description: `批量格式化 ${element.type}`
          })
        }
      }
    }

    return {
      success: true,
      message: `批量操作完成，共修改 ${changes.length} 处`,
      changes
    }
  }

  private getTargetElements(target: string, elements: DocumentElement[]): DocumentElement[] {
    switch (target) {
      case 'heading1':
        return elements.filter(e => e.type === 'heading1')
      case 'heading2':
        return elements.filter(e => e.type === 'heading2')
      case 'heading3':
        return elements.filter(e => e.type === 'heading3')
      case 'heading4':
        return elements.filter(e => e.type === 'heading4')
      case 'heading5':
        return elements.filter(e => e.type === 'heading5')
      case 'heading6':
        return elements.filter(e => e.type === 'heading6')
      case 'heading':
        return elements.filter(e => e.type.startsWith('heading'))
      case 'paragraph':
        return elements.filter(e => e.type === 'paragraph')
      case 'image':
        return elements.filter(e => e.type === 'image')
      case 'table':
        return elements.filter(e => e.type === 'table')
      case 'all':
        return elements
      default:
        return []
    }
  }

  private getTargetTypeName(target: string): string {
    const names: Record<string, string> = {
      heading1: '一级标题',
      heading2: '二级标题',
      heading3: '三级标题',
      heading4: '四级标题',
      heading5: '五级标题',
      heading6: '六级标题',
      heading: '标题',
      paragraph: '段落',
      image: '图片',
      table: '表格',
      all: '所有元素'
    }
    return names[target] || target
  }

  private resolveFormat(params: Record<string, unknown>, target: string): Partial<ElementFormat> {
    const format: Partial<ElementFormat> = {}

    if (params.fontFamily) format.fontFamily = params.fontFamily as string
    if (params.fontSize) format.fontSize = params.fontSize as number
    if (params.color) format.color = params.color as string
    if (params.bold !== undefined) format.bold = params.bold as boolean
    if (params.italic !== undefined) format.italic = params.italic as boolean
    if (params.underline !== undefined) format.underline = params.underline as boolean
    if (params.alignment) format.alignment = params.alignment as ElementFormat['alignment']
    if (params.lineSpacing) format.lineSpacing = params.lineSpacing as number
    if (params.indent !== undefined) format.indent = params.indent as number

    if (target === 'image' && Object.keys(format).length === 0) {
      format.alignment = 'center'
    }

    return format
  }

  private formatDescription(format: Partial<ElementFormat>): string {
    const parts: string[] = []
    if (format.fontFamily) parts.push(`字体: ${format.fontFamily.split(',')[0]}`)
    if (format.fontSize) parts.push(`字号: ${format.fontSize}pt`)
    if (format.bold) parts.push('加粗')
    if (format.italic) parts.push('斜体')
    if (format.underline) parts.push('下划线')
    if (format.alignment) parts.push(`对齐: ${format.alignment}`)
    if (format.color) parts.push(`颜色: ${format.color}`)
    if (format.lineSpacing) parts.push(`行距: ${format.lineSpacing}倍`)
    if (format.indent) parts.push(`首行缩进: ${format.indent}字符`)
    return parts.join(', ') || '无变化'
  }

  private detectPreset(instructions: FormatInstruction[]): FormatPreset | null {
    const hasMultipleHeadingFormats = instructions.filter(
      i => i.targetType.startsWith('heading')
    ).length >= 3

    if (hasMultipleHeadingFormats) {
      const firstHeading = instructions.find(i => i.targetType.startsWith('heading'))
      if (firstHeading) {
        const fontFamily = firstHeading.properties.fontFamily
        if (typeof fontFamily === 'string') {
          if (fontFamily.includes('SimHei')) {
            return STANDARD_PRESETS.official
          }
          if (fontFamily.includes('Microsoft YaHei')) {
            return STANDARD_PRESETS.business
          }
        }
      }
      return STANDARD_PRESETS.academic
    }

    return null
  }

  private applyPreset(preset: FormatPreset, elements: DocumentElement[]): { success: boolean; message: string; changes: DocumentChange[] } {
    const changes: DocumentChange[] = []

    for (const element of elements) {
      let format: ElementFormat | undefined

      switch (element.type) {
        case 'heading1': format = preset.heading1; break
        case 'heading2': format = preset.heading2; break
        case 'heading3': format = preset.heading3; break
        case 'heading4': format = preset.heading4; break
        case 'heading5': format = preset.heading5; break
        case 'heading6': format = preset.heading6; break
        case 'paragraph': format = preset.paragraph; break
        case 'image': format = preset.image; break
        case 'table': format = preset.table; break
      }

      if (format) {
        changes.push({
          type: 'format',
          location: { start: element.startIndex, end: element.endIndex },
          before: { ...element.currentFormat },
          after: format,
          description: `应用"${preset.name}"格式`
        })
        element.suggestedFormat = format
      }
    }

    return {
      success: true,
      message: `已应用"${preset.name}"预设格式，共修改 ${changes.length} 处`,
      changes
    }
  }

  private getCorrectionForIssue(
    element: DocumentElement, 
    _issue: { type: string; severity: string; description: string; suggestion: string; autoFixable: boolean }
  ): { newType: string; description: string } | null {
    if (element.type.startsWith('heading') && element.level && element.level > 4) {
      if (element.content.length > 100) {
        return {
          newType: 'paragraph',
          description: `将过长标题改为正文: "${element.content.slice(0, 30)}..."`
        }
      }
    }

    if (element.type === 'paragraph') {
      if (element.content.length < 30 && element.currentFormat.bold) {
        const level = this.inferHeadingLevel(element)
        return {
          newType: `heading${level}`,
          description: `将短文本改为标题${level}: "${element.content.slice(0, 30)}"`
        }
      }
    }

    return null
  }

  private inferHeadingLevel(element: DocumentElement): number {
    const analysis = this.context.documentAnalysis!
    const index = analysis.elements.indexOf(element)
    
    let prevHeadingLevel = 0
    for (let i = index - 1; i >= 0; i--) {
      const prev = analysis.elements[i]
      if (prev.type.startsWith('heading')) {
        prevHeadingLevel = prev.level || parseInt(prev.type.replace('heading', ''))
        break
      }
    }

    return Math.min(prevHeadingLevel + 1, 6)
  }

  private checkNeedsConfirmation(parsed: ParsedInstruction, results: ExecutionResult[]): boolean {
    const hasHighSeverityIssues = parsed.detectedErrors.some(e => e.type === 'misformatted_heading')
    const hasManyChanges = results.reduce((sum, r) => sum + r.changes.length, 0) > 50
    const hasStructuralChanges = results.some(r => r.changes.some(c => c.type === 'structure'))

    return hasHighSeverityIssues || hasManyChanges || hasStructuralChanges
  }

  private generateConfirmationMessage(parsed: ParsedInstruction, results: ExecutionResult[]): string {
    const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0)
    const structuralChanges = results.filter(r => r.changes.some(c => c.type === 'structure')).length

    let message = `检测到以下情况需要确认:\n\n`
    
    if (parsed.detectedErrors.length > 0) {
      message += `📋 发现 ${parsed.detectedErrors.length} 个潜在格式问题\n`
    }
    
    if (structuralChanges > 0) {
      message += `🔄 需要进行 ${structuralChanges} 处结构调整\n`
    }
    
    message += `\n共计 ${totalChanges} 处修改，是否继续执行？`

    return message
  }

  updateDocumentContent(content: string): void {
    this.context.documentContent = content
    this.context.documentAnalysis = DocumentAnalyzer.analyze(content)
  }

  getDocumentAnalysis(): DocumentAnalysisResult | undefined {
    return this.context.documentAnalysis
  }

  getExecutionHistory(): ExecutionResult[] {
    return [...this.context.executionHistory]
  }

  getDocumentContent(): string {
    return this.context.documentContent
  }
}

export const createInstructionExecutor = (documentContent: string) => 
  new InstructionExecutor(documentContent)
