import { ChineseNLPProcessor } from './chineseNLP'

export interface MarkedElement {
  id: string
  type: 'title' | 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list' | 'table' | 'image'
  content: string
  element: HTMLElement | null
  metadata?: {
    fontSize?: number
    fontFamily?: string
    isBold?: boolean
    isItalic?: boolean
    alignment?: string
  }
}

export interface ParsedInstruction {
  id: string
  action: string
  targetType: 'title' | 'heading' | 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list' | 'table' | 'image' | 'all'
  targetIds: string[]
  description: string
  executed: boolean
  originalContent?: string
  contentData?: {
    html?: string
    topic?: string
    style?: string
    images?: Array<{ src: string; alt: string; description?: string }>
  }
}

export interface ExecutionPlan {
  instructions: ParsedInstruction[]
  summary: string
  requiresConfirmation: boolean
}

export class DocumentMarker {
  private static elementCounter = 0
  private static markedElements: Map<string, MarkedElement> = new Map()
  
  static markDocument(editorElement: HTMLElement): MarkedElement[] {
    this.markedElements.clear()
    this.elementCounter = 0
    
    const elements = this.processNode(editorElement)
    return elements
  }
  
  private static processNode(node: Node): MarkedElement[] {
    const elements: MarkedElement[] = []
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      
      let elementType: MarkedElement['type'] | null = null
      
      if (tagName === 'h1') {
        elementType = 'heading1'
      } else if (tagName === 'h2') {
        elementType = 'heading2'
      } else if (tagName === 'h3') {
        elementType = 'heading3'
      } else if (tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
        elementType = 'heading3'
      } else if (tagName === 'p') {
        if (this.isTitle(element)) {
          elementType = 'title'
        } else {
          elementType = 'paragraph'
        }
      } else if (tagName === 'ul' || tagName === 'ol') {
        elementType = 'list'
      } else if (tagName === 'table') {
        elementType = 'table'
      } else if (tagName === 'img') {
        elementType = 'image'
      }
      
      if (elementType) {
        const id = `elem_${this.elementCounter++}`
        const htmlElement = element as HTMLElement
        
        htmlElement.setAttribute('data-ai-id', id)
        htmlElement.setAttribute('data-ai-type', elementType)
        
        const markedElement: MarkedElement = {
          id,
          type: elementType,
          content: element.textContent || '',
          element: htmlElement,
          metadata: {
            fontSize: this.getFontSize(element),
            fontFamily: this.getFontFamily(element),
            isBold: this.isBold(element),
            isItalic: this.isItalic(element),
            alignment: this.getAlignment(element),
          }
        }
        
        this.markedElements.set(id, markedElement)
        elements.push(markedElement)
      }
      
      for (const child of Array.from(element.childNodes)) {
        elements.push(...this.processNode(child))
      }
    }
    
    return elements
  }
  
  static getMarkedElements(): MarkedElement[] {
    return Array.from(this.markedElements.values())
  }
  
  static getElementById(id: string): MarkedElement | null {
    return this.markedElements.get(id) || null
  }
  
  static getElementsByType(type: MarkedElement['type'] | 'heading'): MarkedElement[] {
    const elements = Array.from(this.markedElements.values())
    if (type === 'heading') {
      return elements.filter(el => 
        el.type === 'title' || el.type === 'heading1' || el.type === 'heading2' || el.type === 'heading3'
      )
    }
    return elements.filter(el => el.type === type)
  }
  
  static clearMarks(editorElement: HTMLElement): void {
    const markedElements = editorElement.querySelectorAll('[data-ai-id]')
    markedElements.forEach(el => {
      el.removeAttribute('data-ai-id')
      el.removeAttribute('data-ai-type')
    })
    this.markedElements.clear()
  }
  
  private static isTitle(element: Element): boolean {
    const style = window.getComputedStyle(element)
    const fontSize = parseFloat(style.fontSize)
    const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600
    
    const text = element.textContent?.trim() || ''
    
    // 只有同时满足以下条件才认为是标题：
    // 1. 字体大小 >= 28 且加粗
    // 2. 或者文本符合【xxx】格式
    // 不再仅凭居中+加粗+短文本就判断为标题，避免误判
    if (fontSize >= 28 && isBold) return true
    if (/^【.+】$/.test(text)) return true
    
    return false
  }
  
  private static getFontSize(element: Element): number {
    const style = window.getComputedStyle(element)
    return parseFloat(style.fontSize)
  }
  
  private static getFontFamily(element: Element): string {
    const style = window.getComputedStyle(element)
    return style.fontFamily
  }
  
  private static isBold(element: Element): boolean {
    const style = window.getComputedStyle(element)
    return style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600
  }
  
  private static isItalic(element: Element): boolean {
    const style = window.getComputedStyle(element)
    return style.fontStyle === 'italic'
  }
  
  private static getAlignment(element: Element): string {
    const style = window.getComputedStyle(element)
    return style.textAlign
  }
}

export class InstructionParser {
  static parseInstruction(input: string, sessionId: string = 'default'): ExecutionPlan {
    const instructions: ParsedInstruction[] = []
    
    const segments = this.smartSplit(input)
    console.log('🔍 分词结果:', segments)
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      console.log(`📝 解析指令 ${i + 1}:`, segment)
      const parsed = this.parseSingleInstruction(segment, i, sessionId)
      if (parsed) {
        console.log(`✅ 解析成功:`, parsed)
        instructions.push(parsed)
      } else {
        console.log(`❌ 解析失败:`, segment)
      }
    }
    
    const summary = this.generateSummary(instructions)
    console.log('📋 执行计划:', summary)
    
    return {
      instructions,
      summary,
      requiresConfirmation: instructions.length > 0
    }
  }
  
  private static smartSplit(input: string): string[] {
    console.log('🔤 使用中文NLP处理器分词...')
    
    const instructions = ChineseNLPProcessor.splitInstructions(input)
    console.log('📋 分词结果:', instructions)
    
    if (instructions.length === 0) {
      const delimiters = /[，,；;。\n]+/
      const fallbackParts = input.split(delimiters).map(s => s.trim()).filter(s => s.length > 0)
      console.log('⚠️ 使用备用分词:', fallbackParts)
      return fallbackParts.length > 0 ? fallbackParts : [input]
    }
    
    return instructions
  }
  
  private static parseSingleInstruction(sentence: string, index: number = 0, sessionId: string = 'default'): ParsedInstruction | null {
    console.log(`  解析句子: "${sentence}"`)
    
    const analysis = ChineseNLPProcessor.analyze(sentence, sessionId)
    console.log(`  语义分析结果:`, analysis)
    
    if (analysis.intent === 'unknown') {
      console.log(`  未识别到有效指令`)
      return null
    }
    
    let action = ''
    let targetType: ParsedInstruction['targetType'] = 'all'
    let contentData: ParsedInstruction['contentData']
    
    if (analysis.actions.length > 0) {
      action = analysis.actions[0].type
      console.log(`  找到动作: ${action}`)
      
      if (analysis.actions[0].parameters) {
        const params = analysis.actions[0].parameters as Record<string, unknown>
        if (params.topic) {
          contentData = { topic: params.topic as string }
        }
        if (params.docType) {
          contentData = { ...contentData, style: params.docType as string }
        }
      }
    }
    
    if (analysis.targets.length > 0) {
      targetType = analysis.targets[0].type as ParsedInstruction['targetType']
      console.log(`  找到目标类型: ${targetType}`)
    }
    
    const elements = DocumentMarker.getMarkedElements()
    let targetIds: string[] = []
    
    if (targetType === 'heading') {
      targetIds = elements
        .filter(el => ['title', 'heading1', 'heading2', 'heading3'].includes(el.type))
        .map(el => el.id)
    } else if (targetType === 'all') {
      targetIds = elements.map(el => el.id)
    } else {
      targetIds = elements
        .filter(el => el.type === targetType)
        .map(el => el.id)
    }
    
    console.log(`  目标元素数量: ${targetIds.length}`)
    
    const description = this.generateDescription(action, targetType, targetIds.length)
    
    return {
      id: `inst_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      targetType,
      targetIds,
      description,
      executed: false,
      contentData
    }
  }
  
  private static generateDescription(
    action: string,
    targetType: string,
    count: number
  ): string {
    const actionNames: Record<string, string> = {
      alignCenter: '居中',
      alignLeft: '左对齐',
      alignRight: '右对齐',
      indent: '首行缩进',
      bold: '加粗',
      italic: '斜体',
      underline: '下划线',
      increaseFontSize: '增大字号',
      decreaseFontSize: '减小字号',
      strikethrough: '删除线',
      clearFormat: '清除格式',
      generateDocument: '生成文档',
      generateContent: '生成内容',
      insertIntoWord: '插入到Word',
      enrichImage: '丰富图片内容',
    }
    
    const typeNames: Record<string, string> = {
      title: '一级标题',
      heading: '标题',
      heading1: '一级标题',
      heading2: '二级标题',
      heading3: '三级标题',
      paragraph: '正文',
      list: '列表',
      table: '表格',
      image: '图片',
      all: '所有元素',
    }
    
    const actionName = actionNames[action] || action
    const typeName = typeNames[targetType] || targetType
    
    if (['generateDocument', 'generateContent', 'insertIntoWord', 'enrichImage'].includes(action)) {
      return actionName
    }
    
    return `${actionName} ${count} 个${typeName}`
  }
  
  private static generateSummary(instructions: ParsedInstruction[]): string {
    if (instructions.length === 0) {
      return '未能识别任何有效指令'
    }
    
    const parts = instructions.map(inst => inst.description)
    return `将执行以下操作：\n${parts.map(p => `• ${p}`).join('\n')}`
  }
}

export class InstructionExecutor {
  static execute(instruction: ParsedInstruction): { success: boolean; message: string; data?: unknown } {
    if (['generateDocument', 'generateContent', 'insertIntoWord', 'enrichImage'].includes(instruction.action)) {
      return this.executeContentAction(instruction)
    }
    
    const targetElements: HTMLElement[] = []
    
    for (const id of instruction.targetIds) {
      const markedElement = DocumentMarker.getElementById(id)
      if (markedElement && markedElement.element) {
        targetElements.push(markedElement.element)
      }
    }
    
    if (targetElements.length === 0) {
      return {
        success: false,
        message: '未找到目标元素'
      }
    }
    
    for (const element of targetElements) {
      const result = this.applyActionToElement(instruction.action, element)
      if (!result.success) {
        return {
          success: false,
          message: result.message
        }
      }
    }
    
    return {
      success: true,
      message: `成功对 ${targetElements.length} 个元素执行了${instruction.description}`
    }
  }
  
  private static executeContentAction(instruction: ParsedInstruction): { success: boolean; message: string; data?: unknown } {
    switch (instruction.action) {
      case 'generateDocument':
        return {
          success: true,
          message: '准备生成文档，请提供HTML文件或主题内容',
          data: { action: 'generateDocument', requiresInput: true }
        }
      
      case 'generateContent':
        return {
          success: true,
          message: '准备生成内容，请告诉我您需要什么内容',
          data: { action: 'generateContent', requiresInput: true }
        }
      
      case 'insertIntoWord':
        return {
          success: true,
          message: '准备将内容插入Word文档，请提供HTML文件',
          data: { action: 'insertIntoWord', requiresInput: true }
        }
      
      case 'enrichImage':
        return {
          success: true,
          message: '准备为图片添加文字描述，请提供图片',
          data: { action: 'enrichImage', requiresInput: true }
        }
      
      default:
        return {
          success: false,
          message: `未知操作: ${instruction.action}`
        }
    }
  }
  
  private static applyActionToElement(
    action: string,
    element: HTMLElement
  ): { success: boolean; message: string } {
    switch (action) {
      case 'alignCenter':
        element.style.textAlign = 'center'
        break
      case 'alignLeft':
        element.style.textAlign = 'left'
        break
      case 'alignRight':
        element.style.textAlign = 'right'
        break
      case 'indent':
        // 首行缩进：根据文本长度计算缩进值
        const text = element.textContent || ''
        const textLength = text.length
        const indentValue = textLength > 40 ? 2 : (textLength > 20 ? 1 : 0)
        element.style.textIndent = `${indentValue}em`
        break
      case 'bold':
        this.toggleStyle(element, 'fontWeight', 'bold', 'normal')
        break
      case 'italic':
        this.toggleStyle(element, 'fontStyle', 'italic', 'normal')
        break
      case 'underline':
        this.toggleStyle(element, 'textDecoration', 'underline', 'normal')
        break
      case 'strikethrough':
        this.toggleStyle(element, 'textDecoration', 'line-through', 'none')
        break
      case 'clearFormat':
        element.removeAttribute('style')
        break
      case 'increaseFontSize':
        this.adjustFontSize(element, 2)
        break
      case 'decreaseFontSize':
        this.adjustFontSize(element, -2)
        break
      default:
        return { success: false, message: `未知操作: ${action}` }
    }
    
    return { success: true, message: '操作成功' }
  }
  
  private static toggleStyle(
    element: HTMLElement,
    property: string,
    onValue: string,
    offValue: string
  ): void {
    const currentValue = element.style.getPropertyValue(property)
    
    if (currentValue === onValue) {
      element.style.setProperty(property, offValue)
    } else {
      element.style.setProperty(property, onValue)
    }
  }
  
  private static adjustFontSize(element: HTMLElement, delta: number): void {
    const currentSize = parseFloat(window.getComputedStyle(element).fontSize)
    const newSize = Math.max(8, Math.min(72, currentSize + delta))
    element.style.fontSize = `${newSize}px`
  }
}
