export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  context?: {
    documentContent?: string
    currentFormat?: Record<string, unknown>
    userIntent?: string
  }
  suggestions?: string[]
  actions?: AIAction[]
}

export interface AIAction {
  type: 'format' | 'insert' | 'modify' | 'analyze' | 'navigate' | 'help'
  label: string
  description: string
  execute: () => void
  icon?: string
}

export interface ConversationContext {
  documentType: string
  recentActions: string[]
  userPreferences: Record<string, unknown>
  currentSelection?: {
    text: string
    format: Record<string, unknown>
  }
}

export class IntelligentChatEngine {
  private static conversationHistory: ChatMessage[] = []
  private static context: ConversationContext = {
    documentType: 'general',
    recentActions: [],
    userPreferences: {}
  }

  private static readonly GREETINGS = [
    '你好！我是你的智能办公助手，有什么可以帮助你的吗？',
    '嗨！我可以帮你处理文档格式、插入内容、分析文档等，试试输入"帮我格式化文档"或"插入一个表格"。',
    '欢迎！我可以理解自然语言命令，比如"把标题改成黑体"或"设置行距为1.5倍"。'
  ]

  private static readonly HELP_RESPONSES = {
    format: `我可以帮你处理各种格式问题：
• 字体设置：说"设置字体为宋体"或"改成黑体"
• 字号调整：说"字号改成14"或"设置为大号"
• 颜色修改：说"文字改成红色"或"高亮显示"
• 行距段落：说"行距1.5倍"或"段落间距加大"
• 对齐方式：说"居中对齐"或"左对齐"`,

    insert: `我可以帮你插入各种内容：
• 插入表格：说"插入3x4的表格"
• 插入图片：说"插入一张图片"
• 插入链接：说"插入链接"
• 插入日期：说"插入当前日期"`,

    document: `我可以帮你分析文档：
• 格式检查：说"检查文档格式"
• 生成摘要：说"帮我生成摘要"
• 提取关键词：说"提取文档关键词"
• 一键格式化：说"一键格式化"`,

    template: `我可以帮你应用模板：
• 公文格式：说"应用公文格式"
• 论文格式：说"应用论文格式"
• 商务文档：说"应用商务格式"
• 简历格式：说"应用简历格式"`
  }

  private static readonly CONTEXTUAL_RESPONSES: Record<string, string[]> = {
    'font_size_changed': [
      '字号已更新！还需要调整其他格式吗？',
      '好的，字号已修改。要不要同时调整行距？'
    ],
    'font_changed': [
      '字体已更换！看起来不错，还需要其他调整吗？',
      '字体已更新。如果需要加粗或斜体，请告诉我。'
    ],
    'table_inserted': [
      '表格已插入！需要调整表格样式吗？',
      '表格已添加。你可以说"添加表头"或"合并单元格"来进一步编辑。'
    ],
    'document_formatted': [
      '文档已格式化！看起来更专业了。还需要其他调整吗？',
      '格式已应用。如果需要微调，请告诉我具体需求。'
    ]
  }

  static processMessage(userInput: string, currentContext?: Partial<ConversationContext>): ChatMessage {
    if (currentContext) {
      this.context = { ...this.context, ...currentContext }
    }

    const normalizedInput = userInput.toLowerCase().trim()
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
      context: {
        userIntent: this.detectIntent(normalizedInput)
      }
    }
    
    this.conversationHistory.push(userMessage)
    
    const response = this.generateResponse(normalizedInput)
    
    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
      suggestions: response.suggestions,
      actions: response.actions
    }
    
    this.conversationHistory.push(assistantMessage)
    
    return assistantMessage
  }

  private static detectIntent(input: string): string {
    if (/你好|嗨|hi|hello/.test(input)) return 'greeting'
    if (/帮助|help|怎么|如何|用法/.test(input)) return 'help'
    if (/格式化|排版|整理/.test(input)) return 'format_document'
    if (/字号|字体大小|大小/.test(input)) return 'change_font_size'
    if (/字体|字形/.test(input)) return 'change_font'
    if (/颜色|色彩/.test(input)) return 'change_color'
    if (/行距|行高/.test(input)) return 'change_line_spacing'
    if (/对齐/.test(input)) return 'change_alignment'
    if (/加粗|粗体/.test(input)) return 'toggle_bold'
    if (/斜体|倾斜/.test(input)) return 'toggle_italic'
    if (/下划线/.test(input)) return 'toggle_underline'
    if (/插入表格|添加表格/.test(input)) return 'insert_table'
    if (/插入图片|添加图片/.test(input)) return 'insert_image'
    if (/插入链接|添加链接/.test(input)) return 'insert_link'
    if (/摘要|总结/.test(input)) return 'generate_summary'
    if (/关键词/.test(input)) return 'extract_keywords'
    if (/检查|分析/.test(input)) return 'analyze_document'
    if (/公文|论文|商务|简历|合同/.test(input)) return 'apply_template'
    if (/打印|预览/.test(input)) return 'print_preview'
    if (/页面设置|页边距/.test(input)) return 'page_setup'
    
    return 'unknown'
  }

  private static generateResponse(input: string): {
    message: string
    suggestions: string[]
    actions: AIAction[]
  } {
    const intent = this.detectIntent(input)

    switch (intent) {
      case 'greeting':
        return {
          message: this.GREETINGS[Math.floor(Math.random() * this.GREETINGS.length)],
          suggestions: ['帮我格式化文档', '插入一个表格', '如何使用？'],
          actions: []
        }

      case 'help':
        const helpType = this.detectHelpType(input) as keyof typeof this.HELP_RESPONSES
        return {
          message: this.HELP_RESPONSES[helpType] || this.HELP_RESPONSES.format,
          suggestions: ['格式化文档', '插入表格', '应用模板'],
          actions: []
        }

      case 'change_font_size':
        const sizeMatch = input.match(/(\d+(?:\.\d+)?)/)
        const size = sizeMatch ? parseFloat(sizeMatch[1]) : 12
        return {
          message: `好的，我来帮你设置字号为 ${size}pt。这样字体会${size > 14 ? '更大更醒目' : size < 12 ? '更紧凑' : '适中'}。`,
          suggestions: ['同时调整行距', '修改字体', '加粗文字'],
          actions: [{
            type: 'format',
            label: `应用 ${size}pt 字号`,
            description: `设置字号为 ${size}pt`,
            execute: () => {}
          }]
        }

      case 'change_font':
        const fontMap: Record<string, string> = {
          '宋体': 'SimSun',
          '黑体': 'SimHei',
          '楷体': 'KaiTi',
          '仿宋': 'FangSong',
          '微软雅黑': 'Microsoft YaHei'
        }
        let detectedFont = '宋体'
        for (const [name, ] of Object.entries(fontMap)) {
          if (input.includes(name)) {
            detectedFont = name
            break
          }
        }
        return {
          message: `好的，我来帮你设置字体为${detectedFont}。${detectedFont === '宋体' ? '宋体适合正式文档' : detectedFont === '黑体' ? '黑体适合标题' : '这个字体很有特色'}。`,
          suggestions: ['调整字号', '加粗', '修改颜色'],
          actions: [{
            type: 'format',
            label: `应用${detectedFont}`,
            description: `设置字体为${detectedFont}`,
            execute: () => {}
          }]
        }

      case 'change_color':
        const colorMap: Record<string, string> = {
          '红': '红色', '蓝': '蓝色', '绿': '绿色', '黄': '黄色',
          '橙': '橙色', '紫': '紫色', '灰': '灰色', '黑': '黑色'
        }
        let detectedColor = '黑色'
        for (const [key, name] of Object.entries(colorMap)) {
          if (input.includes(key)) {
            detectedColor = name
            break
          }
        }
        return {
          message: `好的，我来帮你把文字颜色改为${detectedColor}。需要我同时调整其他格式吗？`,
          suggestions: ['调整字号', '修改字体', '加粗'],
          actions: [{
            type: 'format',
            label: `应用${detectedColor}`,
            description: `设置颜色为${detectedColor}`,
            execute: () => {}
          }]
        }

      case 'change_line_spacing':
        const spacingMatch = input.match(/(\d+(?:\.\d+)?)/)
        const spacing = spacingMatch ? parseFloat(spacingMatch[1]) : 1.5
        return {
          message: `好的，我来帮你设置行距为 ${spacing} 倍。${spacing > 1.5 ? '这样阅读起来会更舒适' : spacing < 1.5 ? '这样内容会更紧凑' : '这是常用的行距设置'}。`,
          suggestions: ['调整字号', '修改段落间距', '对齐方式'],
          actions: [{
            type: 'format',
            label: `应用 ${spacing} 倍行距`,
            description: `设置行距为 ${spacing} 倍`,
            execute: () => {}
          }]
        }

      case 'change_alignment':
        const alignMap: Record<string, string> = {
          '左': '左对齐', '居中': '居中对齐', '右': '右对齐', '两端': '两端对齐'
        }
        let detectedAlign = '左对齐'
        for (const [key, name] of Object.entries(alignMap)) {
          if (input.includes(key)) {
            detectedAlign = name
            break
          }
        }
        return {
          message: `好的，我来帮你设置${detectedAlign}。`,
          suggestions: ['调整字号', '修改行距', '继续编辑'],
          actions: [{
            type: 'format',
            label: `应用${detectedAlign}`,
            description: `设置${detectedAlign}`,
            execute: () => {}
          }]
        }

      case 'insert_table':
        const tableMatch = input.match(/(\d+)\s*[×xX]\s*(\d+)/)
        const rows = tableMatch ? parseInt(tableMatch[1]) : 3
        const cols = tableMatch ? parseInt(tableMatch[2]) : 3
        return {
          message: `好的，我来帮你插入一个 ${rows}行×${cols}列 的表格。插入后你可以右键点击表格进行更多操作。`,
          suggestions: ['添加表头', '调整列宽', '继续编辑'],
          actions: [{
            type: 'insert',
            label: `插入 ${rows}×${cols} 表格`,
            description: `插入 ${rows}行×${cols}列 的表格`,
            execute: () => {}
          }]
        }

      case 'insert_image':
        return {
          message: `好的，我来帮你插入图片。你可以选择本地图片文件或输入图片URL。`,
          suggestions: ['调整图片大小', '设置对齐方式', '继续编辑'],
          actions: [{
            type: 'insert',
            label: '插入图片',
            description: '打开图片插入对话框',
            execute: () => {}
          }]
        }

      case 'format_document':
        return {
          message: `好的，我来帮你一键格式化文档。我会根据文档类型自动应用最佳格式配置，包括字体、字号、行距、页边距等。`,
          suggestions: ['应用公文格式', '应用论文格式', '自定义格式'],
          actions: [{
            type: 'format',
            label: '一键格式化',
            description: '自动应用最佳格式配置',
            execute: () => {}
          }]
        }

      case 'apply_template':
        const templateMap: Record<string, string> = {
          '公文': 'official', '论文': 'academic', '商务': 'business',
          '简历': 'resume', '合同': 'contract'
        }
        let detectedTemplate = '公文'
        for (const [name,] of Object.entries(templateMap)) {
          if (input.includes(name)) {
            detectedTemplate = name
            break
          }
        }
        return {
          message: `好的，我来帮你应用${detectedTemplate}格式模板。这会自动调整字体、字号、行距和页边距等设置。`,
          suggestions: ['自定义调整', '检查格式', '继续编辑'],
          actions: [{
            type: 'format',
            label: `应用${detectedTemplate}格式`,
            description: `应用${detectedTemplate}格式模板`,
            execute: () => {}
          }]
        }

      case 'generate_summary':
        return {
          message: `好的，我来帮你生成文档摘要。我会分析文档内容，提取主要观点和关键信息。`,
          suggestions: ['提取关键词', '检查格式', '继续编辑'],
          actions: [{
            type: 'analyze',
            label: '生成摘要',
            description: '生成文档摘要',
            execute: () => {}
          }]
        }

      case 'extract_keywords':
        return {
          message: `好的，我来帮你提取文档关键词。我会分析文档内容，找出最重要的关键词。`,
          suggestions: ['生成摘要', '检查格式', '继续编辑'],
          actions: [{
            type: 'analyze',
            label: '提取关键词',
            description: '提取文档关键词',
            execute: () => {}
          }]
        }

      case 'print_preview':
        return {
          message: `好的，我来帮你打开打印预览。你可以在预览中调整缩放比例，检查打印效果。`,
          suggestions: ['页面设置', '导出PDF', '继续编辑'],
          actions: [{
            type: 'navigate',
            label: '打印预览',
            description: '打开打印预览',
            execute: () => {}
          }]
        }

      case 'page_setup':
        return {
          message: `好的，我来帮你打开页面设置。你可以调整纸张大小、方向和页边距等。`,
          suggestions: ['打印预览', '应用模板', '继续编辑'],
          actions: [{
            type: 'navigate',
            label: '页面设置',
            description: '打开页面设置对话框',
            execute: () => {}
          }]
        }

      default:
        return {
          message: `我理解你想"${input}"。虽然我不太确定具体操作，但你可以尝试更具体的描述，比如"设置字号为14"或"插入一个3x4的表格"。需要帮助的话，可以说"帮助"查看更多用法。`,
          suggestions: ['如何使用', '格式化文档', '插入表格'],
          actions: []
        }
    }
  }

  private static detectHelpType(input: string): string {
    if (/格式|字体|字号|颜色|行距/.test(input)) return 'format'
    if (/插入|表格|图片|链接/.test(input)) return 'insert'
    if (/模板|公文|论文/.test(input)) return 'template'
    if (/文档|摘要|关键词|检查/.test(input)) return 'document'
    return 'format'
  }

  static getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory]
  }

  static clearHistory(): void {
    this.conversationHistory = []
  }

  static getContextualSuggestion(lastAction: string): string[] {
    const responses = this.CONTEXTUAL_RESPONSES[lastAction]
    if (responses) {
      return [responses[Math.floor(Math.random() * responses.length)]]
    }
    return []
  }

  static analyzeUserPattern(): {
    frequentActions: string[]
    preferredFormats: Record<string, unknown>
    suggestions: string[]
  } {
    const actionCounts: Record<string, number> = {}
    
    this.conversationHistory
      .filter(msg => msg.role === 'user')
      .forEach(msg => {
        const intent = msg.context?.userIntent || 'unknown'
        actionCounts[intent] = (actionCounts[intent] || 0) + 1
      })
    
    const sortedActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([action]) => action)
    
    const suggestions: string[] = []
    if (sortedActions.includes('change_font_size')) {
      suggestions.push('你经常调整字号，试试"一键格式化"可以自动优化所有格式')
    }
    if (sortedActions.includes('insert_table')) {
      suggestions.push('你经常插入表格，试试右键表格可以快速编辑')
    }
    
    return {
      frequentActions: sortedActions,
      preferredFormats: this.context.userPreferences,
      suggestions
    }
  }
}
