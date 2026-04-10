import { nlpProcessor, NLPResult } from './nlpProcessor'
import { contextManager } from './contextManager'
import { auditLogger } from './compliance'

export interface ResponseContext {
  nlpResult: NLPResult
  userLanguage: 'en' | 'zh'
  activeDocument: { type: string; name: string } | null
  recentActions: string[]
  conversationHistory: { role: string; content: string }[]
}

export interface GeneratedResponse {
  text: string
  actions: SuggestedAction[]
  followUp: string[]
  confidence: number
  auditId: string
}

export interface SuggestedAction {
  type: 'primary' | 'secondary' | 'tertiary'
  label: string
  description: string
  command: string
}

export class ResponseGenerator {
  private static instance: ResponseGenerator
  
  private responseTemplates: Map<string, (ctx: ResponseContext) => string> = new Map()
  
  private constructor() {
    this.initializeTemplates()
  }
  
  static getInstance(): ResponseGenerator {
    if (!ResponseGenerator.instance) {
      ResponseGenerator.instance = new ResponseGenerator()
    }
    return ResponseGenerator.instance
  }
  
  private initializeTemplates(): void {
    this.responseTemplates.set('create_document', (ctx) => {
      const docType = ctx.nlpResult.intent.slots['type'] || 'document'
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `正在创建${docType}文档...\n\n已为您准备好空白文档，您可以：\n• 开始输入内容\n• 使用模板快速开始\n• 让AI帮助生成内容`
        : `Creating ${docType} document...\n\nYour blank document is ready. You can:\n• Start typing content\n• Use a template to get started\n• Let AI help generate content`
    })
    
    this.responseTemplates.set('format_document', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      const activeDoc = ctx.activeDocument
      
      if (!activeDoc) {
        return isZh
          ? '请先打开一个文档，然后我可以帮您进行格式化。'
          : 'Please open a document first, then I can help you format it.'
      }
      
      return isZh
        ? `正在分析文档"${activeDoc.name}"的格式...\n\n检测到以下可优化项：\n• 标题格式统一\n• 段落间距调整\n• 字体大小规范化\n\n是否应用标准格式？`
        : `Analyzing format of "${activeDoc.name}"...\n\nDetected optimization opportunities:\n• Unify title formats\n• Adjust paragraph spacing\n• Standardize font sizes\n\nApply standard format?`
    })
    
    this.responseTemplates.set('analyze_data', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      const activeDoc = ctx.activeDocument
      
      if (!activeDoc || activeDoc.type !== 'excel') {
        return isZh
          ? '请先打开一个Excel文件，然后我可以帮您分析数据。'
          : 'Please open an Excel file first, then I can help analyze the data.'
      }
      
      return isZh
        ? `开始数据分析...\n\n分析维度：\n• 数据概览统计\n• 趋势识别\n• 异常值检测\n• 相关性分析\n\n正在处理中，请稍候...`
        : `Starting data analysis...\n\nAnalysis dimensions:\n• Data overview statistics\n• Trend identification\n• Anomaly detection\n• Correlation analysis\n\nProcessing, please wait...`
    })
    
    this.responseTemplates.set('organize_files', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `智能文件整理助手已启动！\n\n我可以帮您：\n• 按类型分类（文档、图片、视频等）\n• 按日期归档\n• 按项目分组\n• 批量重命名\n\n请选择整理方式或描述您的需求。`
        : `Smart file organizer is ready!\n\nI can help you:\n• Sort by type (documents, images, videos, etc.)\n• Archive by date\n• Group by project\n• Batch rename\n\nPlease select an organization method or describe your needs.`
    })
    
    this.responseTemplates.set('batch_rename', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `批量重命名工具已就绪！\n\n支持的命名规则：\n• 序号命名：文件_001、文件_002...\n• 日期前缀：2024-01-15_文件名\n• 查找替换：批量替换文件名中的文字\n• 添加前缀/后缀\n\n请选择文件并设置规则。`
        : `Batch rename tool is ready!\n\nSupported naming rules:\n• Sequential: File_001, File_002...\n• Date prefix: 2024-01-15_Filename\n• Find & Replace: Replace text in filenames\n• Add prefix/suffix\n\nPlease select files and set the rules.`
    })
    
    this.responseTemplates.set('create_presentation', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      const topic = ctx.nlpResult.intent.slots['topic'] || ctx.nlpResult.keywords[0] || ''
      
      return isZh
        ? `正在生成PPT${topic ? `：${topic}` : ''}...\n\n自动规划内容：\n• 封面页\n• 目录页\n• 内容页（3-5页）\n• 总结页\n\n正在生成中...`
        : `Generating presentation${topic ? `: ${topic}` : ''}...\n\nAuto-planned content:\n• Cover page\n• Table of contents\n• Content pages (3-5)\n• Summary page\n\nGenerating...`
    })
    
    this.responseTemplates.set('translate', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      const targetLang = ctx.nlpResult.intent.slots['targetLang'] || 'English'
      
      return isZh
        ? `翻译功能已启动！\n\n目标语言：${targetLang}\n\n请选择要翻译的文本，或直接输入内容。`
        : `Translation feature activated!\n\nTarget language: ${targetLang}\n\nPlease select text to translate, or type content directly.`
    })
    
    this.responseTemplates.set('summarize', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `摘要生成中...\n\n将提取：\n• 核心观点\n• 关键数据\n• 重要结论\n\n正在分析文档内容...`
        : `Generating summary...\n\nWill extract:\n• Core points\n• Key data\n• Important conclusions\n\nAnalyzing document content...`
    })
    
    this.responseTemplates.set('help', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `欢迎使用PaperPower助手！\n\n我可以帮您：\n\n📄 文档处理\n• 创建和编辑文档\n• 一键格式化排版\n• 生成文档摘要\n\n📊 数据分析\n• Excel数据处理\n• 统计分析\n• 图表生成\n\n📽️ 演示文稿\n• 自动生成PPT\n• 美化幻灯片\n• 内容建议\n\n📁 文件管理\n• 批量重命名\n• 智能分类归档\n• 快速搜索\n\n直接用自然语言告诉我您想做什么！`
        : `Welcome to PaperPower Assistant!\n\nI can help you with:\n\n📄 Document Processing\n• Create and edit documents\n• One-click formatting\n• Generate document summaries\n\n📊 Data Analysis\n• Excel data processing\n• Statistical analysis\n• Chart generation\n\n📽️ Presentations\n• Auto-generate PPT\n• Beautify slides\n• Content suggestions\n\n📁 File Management\n• Batch rename\n• Smart categorization\n• Quick search\n\nJust tell me what you want to do in natural language!`
    })
    
    this.responseTemplates.set('greeting', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `你好！我是PaperPower AI助手，很高兴为您服务。请问有什么我可以帮助您的吗？`
        : `Hello! I'm PaperPower AI assistant, nice to meet you. How can I help you today?`
    })
    
    this.responseTemplates.set('introduce', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `我是PaperPower AI助手，一个智能办公助手，专为帮助您处理文档、数据分析和演示文稿而设计。我可以帮助您创建文档、分析数据、生成PPT、管理文件等多种办公任务。`
        : `I'm PaperPower AI assistant, an intelligent office assistant designed to help you with document processing, data analysis, and presentations. I can help you create documents, analyze data, generate PPT, manage files, and more.`
    })
    
    this.responseTemplates.set('capabilities', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `我是PaperPower AI助手，具备以下功能：\n\n📄 文档处理：创建、编辑、格式化文档\n📊 数据分析：Excel数据处理、统计分析、图表生成\n📽️ 演示文稿：自动生成PPT、美化幻灯片\n📁 文件管理：批量重命名、智能分类归档\n\n您可以直接用自然语言告诉我您想做什么，我会为您提供帮助！`
        : `I'm PaperPower AI assistant with the following capabilities:\n\n📄 Document Processing: create, edit, format documents\n📊 Data Analysis: Excel data processing, statistical analysis, chart generation\n📽️ Presentations: auto-generate PPT, beautify slides\n📁 File Management: batch rename, smart categorization\n\nYou can tell me what you want to do in natural language, and I'll help you!`
    })
    
    this.responseTemplates.set('thanks', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `不客气！很高兴能够帮助到您。如果您还有其他需求，随时告诉我。`
        : `You're welcome! I'm glad I could help. If you have any other needs, feel free to let me know.`
    })
    
    this.responseTemplates.set('complaint', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `抱歉给您带来了困扰！我正在不断学习和改进。请告诉我您具体的需求，我会更加努力地为您提供准确的帮助。`
        : `I'm sorry for the trouble! I'm constantly learning and improving. Please tell me your specific needs, and I'll work harder to provide you with accurate help.`
    })
    
    this.responseTemplates.set('question', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `我理解您的问题。请问您需要关于哪方面的具体信息？我可以帮您解答办公相关的各种问题。`
        : `I understand your question. What specific information do you need? I can help you with various office-related questions.`
    })
    
    this.responseTemplates.set('request', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `好的，我会帮您完成这项任务。请提供更多细节，以便我能够更准确地为您服务。`
        : `Alright, I'll help you with this task. Please provide more details so I can serve you more accurately.`
    })
    
    this.responseTemplates.set('feedback', (ctx) => {
      const isZh = ctx.userLanguage === 'zh'
      
      return isZh
        ? `感谢您的反馈！我会认真考虑您的意见，不断改进我的服务质量。`
        : `Thank you for your feedback! I'll carefully consider your opinions and continue to improve my service quality.`
    })
  }
  
  generate(userInput: string, userLanguage: 'en' | 'zh'): GeneratedResponse {
    const nlpResult = nlpProcessor.process(userInput)
    const context = contextManager.getContext()
    
    const responseContext: ResponseContext = {
      nlpResult,
      userLanguage,
      activeDocument: context.activeDocument ? {
        type: context.activeDocument.type,
        name: context.activeDocument.name
      } : null,
      recentActions: context.userPreferences.frequentActions,
      conversationHistory: context.messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }))
    }
    
    const templateGenerator = this.responseTemplates.get(nlpResult.intent.name)
    let responseText: string
    
    if (templateGenerator) {
      responseText = templateGenerator(responseContext)
    } else {
      responseText = this.generateGenericResponse(responseContext)
    }
    
    const actions = this.generateSuggestedActions(responseContext)
    const followUp = this.generateFollowUpQuestions(responseContext)
    
    const auditLog = auditLogger.createAuditLog(
      {
        intent: nlpResult.intent.name,
        confidence: nlpResult.intent.confidence,
        sentiment: nlpResult.sentiment.label
      },
      [{
        step: 1,
        operation: 'response_generation',
        method: 'template_based',
        input: { intent: nlpResult.intent.name, language: userLanguage },
        output: { responseLength: responseText.length, actionsCount: actions.length },
        evidence: `intent_confidence: ${nlpResult.intent.confidence.toFixed(2)}`
      }],
      { success: true }
    )
    
    contextManager.addMessage({
      role: 'assistant',
      content: responseText,
      intent: nlpResult.intent.name,
      entities: nlpResult.entities.map(e => e.text),
      sentiment: nlpResult.sentiment.label
    })
    
    return {
      text: responseText,
      actions,
      followUp,
      confidence: nlpResult.intent.confidence,
      auditId: auditLog.auditId
    }
  }
  
  private generateGenericResponse(ctx: ResponseContext): string {
    const isZh = ctx.userLanguage === 'zh'
    const keywords = ctx.nlpResult.keywords.slice(0, 3)
    
    if (isZh) {
      return `我理解您的需求。\n\n检测到的关键词：${keywords.join('、')}\n\n请问您需要我具体帮您做什么？`
    }
    
    return `I understand your request.\n\nDetected keywords: ${keywords.join(', ')}\n\nWhat specifically would you like me to help you with?`
  }
  
  private generateSuggestedActions(ctx: ResponseContext): SuggestedAction[] {
    const actions: SuggestedAction[] = []
    const isZh = ctx.userLanguage === 'zh'
    const intent = ctx.nlpResult.intent.name
    
    switch (intent) {
      case 'create_document':
        actions.push({
          type: 'primary',
          label: isZh ? '开始编辑' : 'Start Editing',
          description: isZh ? '打开空白文档开始编辑' : 'Open blank document to edit',
          command: 'open_editor'
        })
        actions.push({
          type: 'secondary',
          label: isZh ? '使用模板' : 'Use Template',
          description: isZh ? '从模板库选择模板' : 'Select from template library',
          command: 'open_templates'
        })
        break
        
      case 'format_document':
        actions.push({
          type: 'primary',
          label: isZh ? '应用标准格式' : 'Apply Standard Format',
          description: isZh ? '一键应用标准文档格式' : 'One-click apply standard document format',
          command: 'apply_format'
        })
        actions.push({
          type: 'secondary',
          label: isZh ? '自定义格式' : 'Custom Format',
          description: isZh ? '手动选择格式选项' : 'Manually select format options',
          command: 'custom_format'
        })
        break
        
      case 'analyze_data':
        actions.push({
          type: 'primary',
          label: isZh ? '查看分析报告' : 'View Analysis Report',
          description: isZh ? '显示完整的数据分析结果' : 'Display complete data analysis results',
          command: 'show_analysis'
        })
        actions.push({
          type: 'secondary',
          label: isZh ? '生成图表' : 'Generate Chart',
          description: isZh ? '为数据创建可视化图表' : 'Create visual charts for data',
          command: 'create_chart'
        })
        break
        
      default:
        actions.push({
          type: 'primary',
          label: isZh ? '确认执行' : 'Confirm',
          description: isZh ? '执行当前操作' : 'Execute current operation',
          command: 'confirm'
        })
    }
    
    return actions
  }
  
  private generateFollowUpQuestions(ctx: ResponseContext): string[] {
    const questions: string[] = []
    const isZh = ctx.userLanguage === 'zh'
    const intent = ctx.nlpResult.intent.name
    
    switch (intent) {
      case 'create_document':
        questions.push(isZh ? '需要使用特定模板吗？' : 'Need to use a specific template?')
        questions.push(isZh ? '文档的主题是什么？' : 'What is the document topic?')
        break
        
      case 'format_document':
        questions.push(isZh ? '要应用哪种格式标准？' : 'Which format standard to apply?')
        questions.push(isZh ? '需要保留原有格式吗？' : 'Keep original formatting?')
        break
        
      case 'analyze_data':
        questions.push(isZh ? '需要导出分析报告吗？' : 'Export the analysis report?')
        questions.push(isZh ? '关注哪些数据指标？' : 'Which metrics to focus on?')
        break
    }
    
    return questions
  }
}

export const responseGenerator = ResponseGenerator.getInstance()
