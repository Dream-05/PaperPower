export interface LocalNLPResult {
  intent: string
  entities: Entity[]
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  suggestions: string[]
  actions: RecommendedAction[]
}

export interface Entity {
  type: 'font' | 'size' | 'color' | 'alignment' | 'spacing' | 'table' | 'image' | 'number' | 'date' | 'person' | 'organization' | 'location'
  value: string | number | { rows: number; cols: number }
  text: string
  start: number
  end: number
}

export interface RecommendedAction {
  type: 'format' | 'insert' | 'modify' | 'analyze' | 'export'
  action: string
  value?: string | number | boolean | object
  description: string
  priority: 'high' | 'medium' | 'low'
}

export class LocalNLPEngine {
  private static intentPatterns = [
    { patterns: [/设置|修改|更改|调整/, /字号|字体大小|大小/], intent: 'format_fontSize' },
    { patterns: [/设置|修改|更改|调整/, /字体|字形/], intent: 'format_fontFamily' },
    { patterns: [/设置|修改|更改|调整/, /颜色|字体颜色|文字颜色/], intent: 'format_color' },
    { patterns: [/设置|修改|更改|调整/, /行距|行高|行间距/], intent: 'format_lineSpacing' },
    { patterns: [/设置|修改|更改|调整/, /对齐|对齐方式/], intent: 'format_alignment' },
    { patterns: [/加粗|粗体|bold/], intent: 'format_bold' },
    { patterns: [/斜体|倾斜|italic/], intent: 'format_italic' },
    { patterns: [/下划线|underline/], intent: 'format_underline' },
    { patterns: [/插入|添加|创建/, /表格/], intent: 'insert_table' },
    { patterns: [/插入|添加|放入/, /图片|图像/], intent: 'insert_image' },
    { patterns: [/插入|添加|创建/, /链接|超链接/], intent: 'insert_link' },
    { patterns: [/删除|移除|清除/, /表格|图片|链接/], intent: 'delete_element' },
    { patterns: [/复制|拷贝|copy/], intent: 'edit_copy' },
    { patterns: [/粘贴|黏贴|paste/], intent: 'edit_paste' },
    { patterns: [/撤销|撤回|undo/], intent: 'edit_undo' },
    { patterns: [/重做|恢复|redo/], intent: 'edit_redo' },
    { patterns: [/查找|搜索|寻找/, /替换/], intent: 'edit_findReplace' },
    { patterns: [/全选|选择全部/], intent: 'edit_selectAll' },
    { patterns: [/格式化|排版|整理/, /文档|文章/], intent: 'format_document' },
    { patterns: [/分析|解析|检查/, /文档|文章/], intent: 'analyze_document' },
    { patterns: [/导出|输出|保存/, /PDF|Word|文档/], intent: 'export_document' },
    { patterns: [/打印|输出/, /文档|文章/], intent: 'print_document' },
    { patterns: [/页面设置|页边距|纸张/], intent: 'page_setup' },
  ]

  private static fontSizePattern = /(\d+(?:\.\d+)?)\s*(pt|磅|px)?/i
  private static fontFamilyPattern = /(宋体|黑体|楷体|仿宋|微软雅黑|Arial|Times|Courier|Georgia|Verdana|Calibri)/i
  private static colorPattern = /(红色|蓝色|绿色|黄色|黑色|白色|橙色|紫色|灰色|粉色|青色|棕色)|#([0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i
  private static numberPattern = /(\d+(?:\.\d+)?)\s*(个|行|列|倍|pt|px|cm|mm|%)?/g
  private static tablePattern = /(\d+)\s*[×xX]\s*(\d+)/
  private static datePattern = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/g

  static parse(text: string): LocalNLPResult {
    const normalizedText = text.toLowerCase().trim()
    const entities = this.extractEntities(normalizedText)
    const intent = this.detectIntent(normalizedText, entities)
    const sentiment = this.analyzeSentiment(normalizedText)
    const suggestions = this.generateSuggestions(intent, entities)
    const actions = this.generateActions(intent, entities)
    const confidence = this.calculateConfidence(intent, entities, sentiment)
    
    return {
      intent,
      entities,
      sentiment,
      confidence,
      suggestions,
      actions
    }
  }

  private static extractEntities(text: string): Entity[] {
    const entities: Entity[] = []
    
    const fontSizeMatch = text.match(this.fontSizePattern)
    if (fontSizeMatch) {
      entities.push({
        type: 'size',
        value: parseFloat(fontSizeMatch[1]),
        text: fontSizeMatch[0],
        start: fontSizeMatch.index!,
        end: fontSizeMatch.index! + fontSizeMatch[0].length
      })
    }
    
    const fontFamilyMatch = text.match(this.fontFamilyPattern)
    if (fontFamilyMatch) {
      entities.push({
        type: 'font',
        value: this.normalizeFont(fontFamilyMatch[1]),
        text: fontFamilyMatch[0],
        start: fontFamilyMatch.index!,
        end: fontFamilyMatch.index! + fontFamilyMatch[0].length
      })
    }
    
    const colorMatch = text.match(this.colorPattern)
    if (colorMatch) {
      entities.push({
        type: 'color',
        value: this.normalizeColor(colorMatch[1]),
        text: colorMatch[0],
        start: colorMatch.index!,
        end: colorMatch.index! + colorMatch[0].length
      })
    }
    
    const tableMatch = text.match(this.tablePattern)
    if (tableMatch) {
      entities.push({
        type: 'table',
        value: { rows: parseInt(tableMatch[1]), cols: parseInt(tableMatch[2]) },
        text: tableMatch[0],
        start: tableMatch.index!,
        end: tableMatch.index! + tableMatch[0].length
      })
    }
    
    const numberMatches = Array.from(text.matchAll(new RegExp(this.numberPattern.source, 'g')))
    numberMatches.forEach((match: RegExpMatchArray) => {
      entities.push({
        type: 'number',
        value: parseFloat(match[1]),
        text: match[0],
        start: match.index!,
        end: match.index! + match[0].length
      })
    })
    
    const dateMatches = Array.from(text.matchAll(new RegExp(this.datePattern.source, 'g')))
    dateMatches.forEach((match: RegExpMatchArray) => {
      entities.push({
        type: 'date',
        value: match[0],
        text: match[0],
        start: match.index!,
        end: match.index! + match[0].length
      })
    })
    
    return entities
  }

  private static detectIntent(text: string, entities: Entity[]): string {
    for (const intentPattern of this.intentPatterns) {
      let matchCount = 0
      for (const pattern of intentPattern.patterns) {
        if (pattern.test(text)) {
          matchCount++
        }
      }
      if (matchCount > 0) {
        return intentPattern.intent
      }
    }
    
    if (entities.some(e => e.type === 'size')) return 'format_fontSize'
    if (entities.some(e => e.type === 'font')) return 'format_fontFamily'
    if (entities.some(e => e.type === 'color')) return 'format_color'
    if (entities.some(e => e.type === 'table')) return 'insert_table'
    
    return 'unknown'
  }

  private static analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['请', '帮我', '想要', '需要', '设置', '应用', '添加', '插入', '创建']
    const negativeWords = ['删除', '移除', '清除', '取消', '不要', '错误', '问题', '修复']
    
    const hasPositive = positiveWords.some(word => text.includes(word))
    const hasNegative = negativeWords.some(word => text.includes(word))
    
    if (hasPositive && !hasNegative) return 'positive'
    if (hasNegative && !hasPositive) return 'negative'
    return 'neutral'
  }

  private static generateSuggestions(intent: string, _entities: Entity[]): string[] {
    const suggestions: string[] = []
    
    if (intent.includes('format')) {
      suggestions.push('您可能想要调整文档格式')
      suggestions.push('可以尝试使用一键格式化功能')
    }
    
    if (intent.includes('insert')) {
      suggestions.push('您可能想要插入内容')
      suggestions.push('可以使用插入菜单快速添加元素')
    }
    
    return suggestions
  }

  private static generateActions(intent: string, entities: Entity[]): RecommendedAction[] {
    const actions: RecommendedAction[] = []
    
    const fontSizeEntity = entities.find(e => e.type === 'size')
    if (fontSizeEntity) {
      actions.push({
        type: 'format',
        action: 'setFontSize',
        value: fontSizeEntity.value,
        description: `设置字号为 ${fontSizeEntity.value}pt`,
        priority: 'high'
      })
    }
    
    const fontEntity = entities.find(e => e.type === 'font')
    if (fontEntity) {
      actions.push({
        type: 'format',
        action: 'setFontFamily',
        value: fontEntity.value,
        description: `设置字体为 ${fontEntity.text}`,
        priority: 'high'
      })
    }
    
    const colorEntity = entities.find(e => e.type === 'color')
    if (colorEntity) {
      actions.push({
        type: 'format',
        action: 'setColor',
        value: colorEntity.value,
        description: `设置颜色为 ${colorEntity.text}`,
        priority: 'medium'
      })
    }
    
    const tableEntity = entities.find(e => e.type === 'table')
    if (tableEntity) {
      const tableValue = tableEntity.value as { rows: number; cols: number }
      actions.push({
        type: 'insert',
        action: 'insertTable',
        value: tableValue,
        description: `插入 ${tableValue.rows}×${tableValue.cols} 表格`,
        priority: 'high'
      })
    }
    
    if (intent === 'format_document') {
      actions.push({
        type: 'format',
        action: 'autoFormat',
        description: '自动应用最佳格式配置',
        priority: 'high'
      })
    }
    
    return actions
  }

  private static calculateConfidence(
    intent: string, 
    entities: Entity[], 
    sentiment: string
  ): number {
    let confidence = 0.5
    
    if (intent !== 'unknown') confidence += 0.2
    if (entities.length > 0) confidence += 0.2
    if (sentiment === 'positive') confidence += 0.1
    
    return Math.min(1, confidence)
  }

  private static normalizeFont(font: string): string {
    const fontMap: Record<string, string> = {
      '宋体': 'SimSun, serif',
      '黑体': 'SimHei, sans-serif',
      '楷体': 'KaiTi, serif',
      '仿宋': 'FangSong, serif',
      '微软雅黑': '"Microsoft YaHei", sans-serif',
      'Arial': 'Arial, sans-serif',
      'Times': '"Times New Roman", serif',
      'Courier': '"Courier New", monospace',
      'Georgia': 'Georgia, serif',
      'Verdana': 'Verdana, sans-serif',
      'Calibri': 'Calibri, sans-serif'
    }
    return fontMap[font] || font
  }

  private static normalizeColor(color: string): string {
    const colorMap: Record<string, string> = {
      '红色': '#FF0000',
      '蓝色': '#0000FF',
      '绿色': '#008000',
      '黄色': '#FFD700',
      '黑色': '#000000',
      '白色': '#FFFFFF',
      '橙色': '#FFA500',
      '紫色': '#800080',
      '灰色': '#808080',
      '粉色': '#FFC0CB',
      '青色': '#00FFFF',
      '棕色': '#8B4513'
    }
    
    if (color.startsWith('#')) {
      return color.length === 4 ? 
        '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3] : 
        color
    }
    
    return colorMap[color] || color
  }

  static processCommand(text: string): LocalNLPResult {
    return this.parse(text)
  }

  static getQuickActions(): RecommendedAction[] {
    return [
      { type: 'format', action: 'setFontSize', value: 12, description: '设置字号为12pt', priority: 'high' },
      { type: 'format', action: 'setFontSize', value: 14, description: '设置字号为14pt', priority: 'high' },
      { type: 'format', action: 'setFontFamily', value: 'SimSun, serif', description: '设置字体为宋体', priority: 'medium' },
      { type: 'format', action: 'setFontFamily', value: 'SimHei, sans-serif', description: '设置字体为黑体', priority: 'medium' },
      { type: 'format', action: 'autoFormat', description: '一键格式化', priority: 'high' }
    ]
  }
}
