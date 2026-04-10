import { SkillExecutionResult, SkillDefinition } from './types'

export interface PPTGenerateParams {
  user_input: string
  style?: string
  page_count?: number
  custom_structure?: string[]
  uploaded_images?: string[]
  language?: string
}

export interface PPTContentParams {
  page_type: string
  topic: string
  context?: Record<string, unknown>
}

export interface PPTLayoutParams {
  page_type: string
  content: Record<string, unknown>
  assets?: unknown[]
}

export interface ImageSearchParams {
  query: string
  num_results?: number
  sources?: string[]
}

export interface AssetSearchParams {
  keywords: string[]
  style?: string
  asset_type?: string
  count?: number
}

export interface WebSearchParams {
  query: string
  num_results?: number
  search_type?: string
}

export interface DocumentStructureParams {
  action: string
  text?: string
  style_name?: string
  margins?: { top: number; bottom: number; left: number; right: number }
}

export interface ContentGenerateParams {
  instruction: string
  document_type?: string
  style?: string
  search_enabled?: boolean
}

export interface ContentRewriteParams {
  text: string
  style?: 'formal' | 'concise' | 'vivid' | 'academic'
}

export interface FormulaGenerateParams {
  user_intent: string
  context?: Record<string, unknown>
}

export interface FormulaExplainParams {
  formula: string
}

export interface FormulaDiagnoseParams {
  formula: string
  error_value: string
}

export interface FinancialAnalyzeParams {
  data: Record<string, unknown>[]
  config?: Record<string, unknown>
}

export interface BudgetVarianceParams {
  budget_data: Record<string, unknown>[]
  actual_data: Record<string, unknown>[]
  category_column: string
  amount_column: string
}

export interface CashflowAnalyzeParams {
  data: Record<string, unknown>[]
  date_column: string
  amount_column: string
  type_column?: string
}

export interface BreakevenParams {
  fixed_costs: number
  variable_cost_per_unit: number
  price_per_unit: number
}

export interface MultiSheetMergeParams {
  file_paths: string[]
  config?: Record<string, unknown>
}

export interface DataAnalyzeParams {
  data: number[]
  detect_anomalies?: boolean
  forecast?: boolean
  forecast_periods?: number
}

export interface DocumentAnalyzeParams {
  content: string
}

export interface TextSimilarityParams {
  text1: string
  text2: string
}

export interface FeedbackCollectParams {
  feedback_type: 'select' | 'delete' | 'rate' | 'modify'
  content_type: string
  content_id: string
  user_id: string
  score?: number
  metadata?: Record<string, unknown>
}

export interface MemorySystemParams {
  action: 'get_context' | 'add_message' | 'get_preferences' | 'update_preferences'
  session_id?: string
  user_id?: string
  content?: string
}

export interface TaskSubmitParams {
  task_type: string
  params: Record<string, unknown>
  user_id: string
  priority?: 'high' | 'medium' | 'low'
}

export interface TaskStatusParams {
  task_id: string
}

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map()
  private handlers: Map<string, (args: Record<string, unknown>) => Promise<SkillExecutionResult>> = new Map()

  constructor() {
    this.registerAllSkills()
  }

  private registerAllSkills(): void {
    this.registerPPTSkills()
    this.registerWordSkills()
    this.registerExcelSkills()
    this.registerFileSkills()
    this.registerAISkills()
    this.registerLearningSkills()
    this.registerTaskSkills()
    this.registerZhibanSkills()
    this.registerLocalAISkills()
  }

  private registerPPTSkills(): void {
    this.registerSkill({
      name: 'ppt_generate',
      description: '智能生成PPT演示文稿，包括需求解析、内容生成、图片处理、专业排版和PPTX输出',
      triggers: ['生成PPT', '创建演示文稿', '制作幻灯片', 'generate ppt', 'create presentation', '做一个PPT'],
      handler: 'ppt_generator',
      parameters: [
        { name: 'user_input', type: 'string', required: true, description: '用户输入的主题描述' },
        { name: 'style', type: 'string', required: false, description: 'PPT风格', default: 'professional' },
        { name: 'page_count', type: 'number', required: false, description: '页数', default: 12 },
        { name: 'custom_structure', type: 'array', required: false, description: '自定义章节结构' },
        { name: 'language', type: 'string', required: false, description: '语言', default: 'zh-CN' }
      ]
    })

    this.registerSkill({
      name: 'ppt_content_generate',
      description: '为PPT页面生成专业的标题、要点、副标题和讲者备注',
      triggers: ['生成PPT内容', 'PPT文案', 'ppt content', '幻灯片内容'],
      handler: 'ppt_content_generator',
      parameters: [
        { name: 'page_type', type: 'string', required: true, description: '页面类型' },
        { name: 'topic', type: 'string', required: true, description: '主题' },
        { name: 'context', type: 'object', required: false, description: '上下文信息' }
      ]
    })

    this.registerSkill({
      name: 'ppt_layout',
      description: '根据页面类型、内容量和素材情况，智能选择最佳布局方案',
      triggers: ['PPT布局', '幻灯片排版', 'ppt layout', 'slide layout'],
      handler: 'ppt_layout_engine',
      parameters: [
        { name: 'page_type', type: 'string', required: true, description: '页面类型' },
        { name: 'content', type: 'object', required: true, description: '页面内容' },
        { name: 'assets', type: 'array', required: false, description: '素材列表' }
      ]
    })

    this.registerSkill({
      name: 'image_manage',
      description: '图片上传、下载、截图保存、分类管理、使用统计和质量评分',
      triggers: ['管理图片', '上传图片', '图片管理', 'manage image', 'upload image'],
      handler: 'image_manager',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作类型' },
        { name: 'file_data', type: 'string', required: false, description: '图片数据' },
        { name: 'url', type: 'string', required: false, description: '图片URL' },
        { name: 'description', type: 'string', required: false, description: '描述' },
        { name: 'tags', type: 'array', required: false, description: '标签列表' }
      ]
    })

    this.registerSkill({
      name: 'asset_search',
      description: '多源图片获取（必应、Unsplash、Pixabay）、素材处理与标准化',
      triggers: ['搜索素材', '找素材', 'search assets', 'asset search'],
      handler: 'asset_manager',
      parameters: [
        { name: 'keywords', type: 'array', required: true, description: '关键词列表' },
        { name: 'style', type: 'string', required: false, description: '风格' },
        { name: 'asset_type', type: 'string', required: false, description: '素材类型' },
        { name: 'count', type: 'number', required: false, description: '数量', default: 20 }
      ]
    })

    this.registerSkill({
      name: 'intent_parse',
      description: '解析用户输入，提取关键词、检测风格、预估页数、建议PPT结构',
      triggers: ['解析意图', '分析需求', 'parse intent', 'analyze requirement'],
      handler: 'intent_parser',
      parameters: [
        { name: 'user_input', type: 'string', required: true, description: '用户输入文本' }
      ]
    })

    this.registerSkill({
      name: 'ppt_workflow',
      description: '整合搜索、图片管理、AI内容生成、自主学习的完整PPT生成工作流',
      triggers: ['PPT工作流', '完整生成PPT', 'ppt workflow'],
      handler: 'ppt_workflow_engine',
      parameters: [
        { name: 'user_input', type: 'string', required: true, description: '用户输入' },
        { name: 'auto_select_images', type: 'boolean', required: false, description: '是否自动选择图片', default: true }
      ]
    })

    this.registerSkill({
      name: 'model_manage',
      description: '支持本地小模型、免费大模型和自定义API的模型管理系统',
      triggers: ['管理模型', '切换模型', 'manage model', 'switch model'],
      handler: 'model_manager',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作类型' },
        { name: 'model_name', type: 'string', required: false, description: '模型名称' },
        { name: 'api_key', type: 'string', required: false, description: 'API密钥' }
      ]
    })
  }

  private registerWordSkills(): void {
    this.registerSkill({
      name: 'document_structure',
      description: '分页分节控制、样式管理、格式排版等核心文档处理功能',
      triggers: ['文档结构', '设置格式', 'document structure', 'format document'],
      handler: 'document_engine',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作类型' },
        { name: 'text', type: 'string', required: false, description: '文本内容' },
        { name: 'style_name', type: 'string', required: false, description: '样式名称' },
        { name: 'margins', type: 'object', required: false, description: '页边距设置' }
      ]
    })

    this.registerSkill({
      name: 'content_generate',
      description: '智能内容生成、改写、续写、摘要等功能，支持多种文档类型模板',
      triggers: ['生成内容', '写文章', 'generate content', 'write article', '帮我写'],
      handler: 'content_generator',
      parameters: [
        { name: 'instruction', type: 'string', required: true, description: '用户指令' },
        { name: 'document_type', type: 'string', required: false, description: '文档类型' },
        { name: 'style', type: 'string', required: false, description: '写作风格' },
        { name: 'search_enabled', type: 'boolean', required: false, description: '是否启用搜索', default: true }
      ]
    })

    this.registerSkill({
      name: 'content_rewrite',
      description: '根据指定风格改写文本内容',
      triggers: ['改写内容', '重写', 'rewrite content', 'rewrite'],
      handler: 'content_rewriter',
      parameters: [
        { name: 'text', type: 'string', required: true, description: '原始文本' },
        { name: 'style', type: 'string', required: false, description: '目标风格', default: 'formal' }
      ]
    })

    this.registerSkill({
      name: 'document_image_fetch',
      description: '多源图片搜索、智能裁剪、版权筛选等功能',
      triggers: ['获取文档图片', '搜索文档配图', 'fetch document image'],
      handler: 'document_image_fetcher',
      parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索关键词' },
        { name: 'num_results', type: 'number', required: false, description: '结果数量', default: 10 },
        { name: 'license_filter', type: 'string', required: false, description: '版权筛选' }
      ]
    })

    this.registerSkill({
      name: 'template_learn',
      description: '解析Word模板、学习样式、风格迁移等功能',
      triggers: ['学习模板', '应用模板样式', 'learn template', 'apply template'],
      handler: 'template_learner',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作类型' },
        { name: 'template_name', type: 'string', required: false, description: '模板名称' },
        { name: 'content', type: 'string', required: false, description: '内容' }
      ]
    })
  }

  private registerExcelSkills(): void {
    this.registerSkill({
      name: 'formula_generate',
      description: '智能公式推荐、公式解释、错误诊断等功能',
      triggers: ['生成公式', 'Excel公式', 'generate formula', 'excel formula', '帮我写公式'],
      handler: 'formula_generator',
      parameters: [
        { name: 'user_intent', type: 'string', required: true, description: '用户意图描述' },
        { name: 'context', type: 'object', required: false, description: '上下文信息' }
      ]
    })

    this.registerSkill({
      name: 'formula_explain',
      description: '解释Excel公式的含义和参数',
      triggers: ['解释公式', '公式说明', 'explain formula', 'formula explanation'],
      handler: 'formula_explainer',
      parameters: [
        { name: 'formula', type: 'string', required: true, description: 'Excel公式' }
      ]
    })

    this.registerSkill({
      name: 'formula_diagnose',
      description: '诊断Excel公式错误并提供解决方案',
      triggers: ['诊断公式错误', '公式报错', 'diagnose formula', 'formula error'],
      handler: 'formula_diagnostic',
      parameters: [
        { name: 'formula', type: 'string', required: true, description: 'Excel公式' },
        { name: 'error_value', type: 'string', required: true, description: '错误值' }
      ]
    })

    this.registerSkill({
      name: 'financial_analyze',
      description: '财务报表分析、指标计算、趋势预测等功能',
      triggers: ['财务分析', '分析财务报表', 'financial analysis', 'analyze financial'],
      handler: 'financial_analyzer',
      parameters: [
        { name: 'data', type: 'array', required: true, description: '财务数据' },
        { name: 'config', type: 'object', required: false, description: '分析配置' }
      ]
    })

    this.registerSkill({
      name: 'budget_variance',
      description: '分析预算与实际支出的差异',
      triggers: ['预算差异分析', '预算对比', 'budget variance', 'budget analysis'],
      handler: 'budget_variance_analyzer',
      parameters: [
        { name: 'budget_data', type: 'array', required: true, description: '预算数据' },
        { name: 'actual_data', type: 'array', required: true, description: '实际数据' },
        { name: 'category_column', type: 'string', required: true, description: '类别列名' },
        { name: 'amount_column', type: 'string', required: true, description: '金额列名' }
      ]
    })

    this.registerSkill({
      name: 'cashflow_analyze',
      description: '分析现金流情况',
      triggers: ['现金流分析', '分析现金流', 'cashflow analysis', 'cash flow'],
      handler: 'cashflow_analyzer',
      parameters: [
        { name: 'data', type: 'array', required: true, description: '现金流数据' },
        { name: 'date_column', type: 'string', required: true, description: '日期列名' },
        { name: 'amount_column', type: 'string', required: true, description: '金额列名' }
      ]
    })

    this.registerSkill({
      name: 'breakeven_analyze',
      description: '计算盈亏平衡点',
      triggers: ['盈亏平衡分析', '计算盈亏点', 'breakeven analysis', 'break even'],
      handler: 'breakeven_analyzer',
      parameters: [
        { name: 'fixed_costs', type: 'number', required: true, description: '固定成本' },
        { name: 'variable_cost_per_unit', type: 'number', required: true, description: '单位变动成本' },
        { name: 'price_per_unit', type: 'number', required: true, description: '单价' }
      ]
    })

    this.registerSkill({
      name: 'multi_sheet_merge',
      description: '多文件读取、数据合并、智能匹配、汇总计算等功能',
      triggers: ['合并表格', '多表汇总', 'merge sheets', 'multi sheet merge'],
      handler: 'multi_sheet_engine',
      parameters: [
        { name: 'file_paths', type: 'array', required: true, description: '文件路径列表' },
        { name: 'config', type: 'object', required: false, description: '合并配置' }
      ]
    })

    this.registerSkill({
      name: 'summary_report',
      description: '创建汇总报告，支持财务和库存等类型',
      triggers: ['生成汇总报告', '汇总报告', 'summary report', 'generate report'],
      handler: 'summary_report_generator',
      parameters: [
        { name: 'file_paths', type: 'array', required: true, description: '文件路径列表' },
        { name: 'summary_type', type: 'string', required: false, description: '汇总类型', default: 'general' }
      ]
    })
  }

  private registerFileSkills(): void {
    this.registerSkill({
      name: 'unified_search',
      description: '多源搜索架构，支持网页搜索、图片搜索、学术搜索、模板搜索',
      triggers: ['搜索', '查找', 'search', 'find'],
      handler: 'unified_search_engine',
      parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索关键词' },
        { name: 'search_type', type: 'string', required: false, description: '搜索类型', default: 'web' },
        { name: 'max_results', type: 'number', required: false, description: '最大结果数', default: 10 }
      ]
    })

    this.registerSkill({
      name: 'web_search',
      description: '支持Google Custom Search、Bing Search、DuckDuckGo等搜索引擎',
      triggers: ['网页搜索', '网络搜索', 'web search', 'search web'],
      handler: 'web_search_service',
      parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索关键词' },
        { name: 'num_results', type: 'number', required: false, description: '结果数量', default: 10 }
      ]
    })

    this.registerSkill({
      name: 'image_search',
      description: '支持Unsplash、Pexels、Pixabay等图片源搜索，提供高质量图片资源',
      triggers: ['搜索图片', '找图片', 'image search', 'search image'],
      handler: 'image_search_service',
      parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索关键词' },
        { name: 'num_results', type: 'number', required: false, description: '结果数量', default: 20 }
      ]
    })

    this.registerSkill({
      name: 'keyword_expand',
      description: '扩展搜索关键词，支持风格同义词和主题扩展',
      triggers: ['扩展关键词', '关键词扩展', 'expand keywords', 'keyword expansion'],
      handler: 'keyword_expander',
      parameters: [
        { name: 'query', type: 'string', required: true, description: '原始关键词' },
        { name: 'max_expansions', type: 'number', required: false, description: '最大扩展数量', default: 5 }
      ]
    })

    this.registerSkill({
      name: 'file_batch_rename',
      description: '批量重命名文件',
      triggers: ['批量重命名', '重命名文件', 'batch rename', 'rename files'],
      handler: 'batch_renamer',
      parameters: [
        { name: 'directory', type: 'string', required: true, description: '目录路径' },
        { name: 'pattern', type: 'string', required: true, description: '命名模式' },
        { name: 'preview', type: 'boolean', required: false, description: '是否预览', default: true }
      ]
    })
  }

  private registerAISkills(): void {
    this.registerSkill({
      name: 'ai_process',
      description: '统一AI处理接口，支持文本、文档、数据等多种类型处理',
      triggers: ['AI处理', '智能处理', 'ai process', 'process with ai'],
      handler: 'ai_processor',
      parameters: [
        { name: 'input', type: 'string', required: true, description: '输入内容' },
        { name: 'type', type: 'string', required: true, description: '类型' },
        { name: 'context', type: 'object', required: false, description: '上下文' },
        { name: 'options', type: 'object', required: false, description: '选项配置' }
      ]
    })

    this.registerSkill({
      name: 'document_analyze',
      description: '分析文档结构、质量、实体、主题、情感等',
      triggers: ['分析文档', '文档分析', 'analyze document', 'document analysis'],
      handler: 'document_analyzer',
      parameters: [
        { name: 'content', type: 'string', required: true, description: '文档内容' }
      ]
    })

    this.registerSkill({
      name: 'data_analyze',
      description: '统计分析、趋势检测、异常检测、预测',
      triggers: ['分析数据', '数据分析', 'analyze data', 'data analysis'],
      handler: 'data_analyzer',
      parameters: [
        { name: 'data', type: 'array', required: true, description: '数值数据' },
        { name: 'detect_anomalies', type: 'boolean', required: false, description: '是否检测异常', default: true },
        { name: 'forecast', type: 'boolean', required: false, description: '是否预测', default: true },
        { name: 'forecast_periods', type: 'number', required: false, description: '预测周期数', default: 5 }
      ]
    })

    this.registerSkill({
      name: 'text_similarity',
      description: '计算两段文本的相似度',
      triggers: ['计算相似度', '文本相似度', 'text similarity', 'calculate similarity'],
      handler: 'text_similarity_calculator',
      parameters: [
        { name: 'text1', type: 'string', required: true, description: '第一段文本' },
        { name: 'text2', type: 'string', required: true, description: '第二段文本' }
      ]
    })

    this.registerSkill({
      name: 'chart_create',
      description: '创建数据图表',
      triggers: ['创建图表', '生成图表', 'create chart', 'generate chart'],
      handler: 'chart_creator',
      parameters: [
        { name: 'data', type: 'array', required: true, description: '图表数据' },
        { name: 'type', type: 'string', required: false, description: '图表类型', default: 'bar' },
        { name: 'title', type: 'string', required: false, description: '图表标题' }
      ]
    })
  }

  private registerLearningSkills(): void {
    this.registerSkill({
      name: 'feedback_collect',
      description: '收集用户反馈事件，支持选择、删除、评分、修改等类型',
      triggers: ['收集反馈', '提交反馈', 'collect feedback', 'submit feedback'],
      handler: 'feedback_collector',
      parameters: [
        { name: 'feedback_type', type: 'string', required: true, description: '反馈类型' },
        { name: 'content_type', type: 'string', required: true, description: '内容类型' },
        { name: 'content_id', type: 'string', required: true, description: '内容ID' },
        { name: 'user_id', type: 'string', required: true, description: '用户ID' },
        { name: 'score', type: 'number', required: false, description: '评分' }
      ]
    })

    this.registerSkill({
      name: 'content_score',
      description: '计算内容的综合评分，基于选择次数、删除次数、评分等',
      triggers: ['计算评分', '内容评分', 'calculate score', 'content score'],
      handler: 'content_score_calculator',
      parameters: [
        { name: 'content_id', type: 'string', required: true, description: '内容ID' },
        { name: 'content_type', type: 'string', required: true, description: '内容类型' }
      ]
    })

    this.registerSkill({
      name: 'style_evolve',
      description: '根据用户反馈调整风格推荐权重',
      triggers: ['风格进化', '调整风格', 'style evolve', 'adjust style'],
      handler: 'style_evolver',
      parameters: [
        { name: 'style_id', type: 'string', required: true, description: '风格ID' },
        { name: 'style_name', type: 'string', required: true, description: '风格名称' },
        { name: 'user_id', type: 'string', required: true, description: '用户ID' },
        { name: 'is_positive', type: 'boolean', required: true, description: '是否正面反馈' }
      ]
    })

    this.registerSkill({
      name: 'memory_system',
      description: '会话记忆、用户记忆、全局记忆三层记忆管理',
      triggers: ['记忆管理', '获取上下文', 'memory system', 'get context'],
      handler: 'memory_manager',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作类型' },
        { name: 'session_id', type: 'string', required: false, description: '会话ID' },
        { name: 'user_id', type: 'string', required: false, description: '用户ID' },
        { name: 'content', type: 'string', required: false, description: '内容' }
      ]
    })

    this.registerSkill({
      name: 'content_recommend',
      description: '基于用户偏好和全局趋势推荐内容',
      triggers: ['推荐内容', '内容推荐', 'recommend content', 'content recommendation'],
      handler: 'content_recommender',
      parameters: [
        { name: 'user_id', type: 'string', required: true, description: '用户ID' },
        { name: 'item_type', type: 'string', required: true, description: '内容类型' },
        { name: 'limit', type: 'number', required: false, description: '数量限制', default: 10 }
      ]
    })
  }

  private registerTaskSkills(): void {
    this.registerSkill({
      name: 'task_submit',
      description: '提交异步任务到任务队列',
      triggers: ['提交任务', '创建任务', 'submit task', 'create task'],
      handler: 'task_submitter',
      parameters: [
        { name: 'task_type', type: 'string', required: true, description: '任务类型' },
        { name: 'params', type: 'object', required: true, description: '任务参数' },
        { name: 'user_id', type: 'string', required: true, description: '用户ID' },
        { name: 'priority', type: 'string', required: false, description: '优先级', default: 'medium' }
      ]
    })

    this.registerSkill({
      name: 'task_status',
      description: '查询任务执行状态',
      triggers: ['查询任务状态', '任务状态', 'task status', 'check task'],
      handler: 'task_status_checker',
      parameters: [
        { name: 'task_id', type: 'string', required: true, description: '任务ID' }
      ]
    })
  }

  private registerZhibanSkills(): void {
    this.registerSkill({
      name: 'jarvis_mode',
      description: '贾维斯模式控制，专业简洁贴心，主动提醒总结优化',
      triggers: ['贾维斯模式', 'jarvis mode', '开启贾维斯', '关闭贾维斯', '启用贾维斯'],
      handler: 'jarvis_mode',
      parameters: [
        { name: 'action', type: 'string', required: false, description: '操作: enable/disable/status', default: 'status' }
      ]
    })

    this.registerSkill({
      name: 'voice_control',
      description: '语音控制，支持语音合成、语音唤醒、语音打断',
      triggers: ['语音', '说话', '朗读', 'voice', 'speak', '唤醒词'],
      handler: 'voice_control',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作: speak/stop/add_wake_word' },
        { name: 'text', type: 'string', required: false, description: '要朗读的文本' },
        { name: 'wake_word', type: 'string', required: false, description: '唤醒词' }
      ]
    })

    this.registerSkill({
      name: 'memory_control',
      description: '长期记忆控制，永久保存对话历史、偏好、习惯',
      triggers: ['记忆', '历史', '偏好', 'memory', 'history', '对话记录'],
      handler: 'memory_control',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作: get_history/set_preference/get_preference/get_status' },
        { name: 'key', type: 'string', required: false, description: '偏好键名' },
        { name: 'value', type: 'string', required: false, description: '偏好值' },
        { name: 'limit', type: 'number', required: false, description: '历史记录数量限制' }
      ]
    })

    this.registerSkill({
      name: 'self_learning',
      description: '自学习系统，自动总结对话、提取偏好、构建知识库',
      triggers: ['学习', '总结', '知识库', 'learning', 'summary', '每日总结'],
      handler: 'self_learning',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作: daily_summary/record_feedback/get_patterns' },
        { name: 'date', type: 'string', required: false, description: '日期' },
        { name: 'feedback', type: 'boolean', required: false, description: '反馈' },
        { name: 'conversation_id', type: 'string', required: false, description: '对话ID' }
      ]
    })

    this.registerSkill({
      name: 'daemon_control',
      description: '守护进程控制，开机自启、崩溃重启、24小时运行',
      triggers: ['守护进程', '后台服务', 'daemon', '自启动', '常驻'],
      handler: 'daemon_control',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作: start/stop/status/restart' }
      ]
    })
  }

  private registerLocalAISkills(): void {
    this.registerSkill({
      name: 'local_chat',
      description: '本地大模型对话，离线运行，隐私保护',
      triggers: ['本地对话', '离线聊天', 'local chat', '本地模型', '离线模型'],
      handler: 'local_chat',
      parameters: [
        { name: 'messages', type: 'array', required: true, description: '对话消息列表' },
        { name: 'model', type: 'string', required: false, description: '模型名称' },
        { name: 'temperature', type: 'number', required: false, description: '温度参数', default: 0.7 },
        { name: 'max_tokens', type: 'number', required: false, description: '最大token数', default: 2048 },
        { name: 'stream', type: 'boolean', required: false, description: '是否流式输出', default: false }
      ]
    })

    this.registerSkill({
      name: 'local_embeddings',
      description: '本地文本嵌入，生成向量表示',
      triggers: ['文本嵌入', '向量化', 'embeddings', 'embedding'],
      handler: 'local_embeddings',
      parameters: [
        { name: 'text', type: 'string', required: true, description: '要嵌入的文本' },
        { name: 'model', type: 'string', required: false, description: '嵌入模型名称' }
      ]
    })

    this.registerSkill({
      name: 'local_tts',
      description: '本地语音合成，离线TTS',
      triggers: ['本地语音', '离线朗读', 'local tts', '本地朗读'],
      handler: 'local_tts',
      parameters: [
        { name: 'text', type: 'string', required: true, description: '要合成的文本' },
        { name: 'voice', type: 'string', required: false, description: '语音类型', default: 'default' }
      ]
    })

    this.registerSkill({
      name: 'local_stt',
      description: '本地语音识别，离线STT',
      triggers: ['本地语音识别', '离线转文字', 'local stt', '本地转录'],
      handler: 'local_stt',
      parameters: [
        { name: 'audio_data', type: 'string', required: true, description: '音频数据(base64或blob)' },
        { name: 'language', type: 'string', required: false, description: '语言', default: 'zh' }
      ]
    })

    this.registerSkill({
      name: 'local_image',
      description: '本地图像生成，离线AI绘图',
      triggers: ['本地绘图', '离线生成图片', 'local image', '本地AI画图'],
      handler: 'local_image',
      parameters: [
        { name: 'prompt', type: 'string', required: true, description: '图像描述' },
        { name: 'model', type: 'string', required: false, description: '模型名称' },
        { name: 'size', type: 'string', required: false, description: '图像尺寸', default: '512x512' }
      ]
    })

    this.registerSkill({
      name: 'model_manager',
      description: '本地模型管理，下载、切换、删除模型',
      triggers: ['模型管理', '下载模型', '切换模型', 'model manager', '安装模型'],
      handler: 'model_manager',
      parameters: [
        { name: 'action', type: 'string', required: true, description: '操作: list/install/select/status' },
        { name: 'model_id', type: 'string', required: false, description: '模型ID' }
      ]
    })
  }

  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill)
  }

  registerHandler(skillName: string, handler: (args: Record<string, unknown>) => Promise<SkillExecutionResult>): void {
    this.handlers.set(skillName, handler)
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  getHandler(name: string): ((args: Record<string, unknown>) => Promise<SkillExecutionResult>) | undefined {
    return this.handlers.get(name)
  }

  findSkillByTrigger(trigger: string): SkillDefinition | undefined {
    const triggerLower = trigger.toLowerCase()
    for (const skill of this.skills.values()) {
      if (skill.triggers.some(t => triggerLower.includes(t.toLowerCase()))) {
        return skill
      }
    }
    return undefined
  }

  findMatchingSkills(trigger: string): SkillDefinition[] {
    const triggerLower = trigger.toLowerCase()
    const matches: Array<{ skill: SkillDefinition; score: number }> = []
    
    for (const skill of this.skills.values()) {
      for (const t of skill.triggers) {
        if (triggerLower.includes(t.toLowerCase())) {
          const score = t.length / trigger.length
          matches.push({ skill, score })
          break
        }
      }
    }
    
    return matches
      .sort((a, b) => b.score - a.score)
      .map(m => m.skill)
  }

  async executeSkill(name: string, args: Record<string, unknown>): Promise<SkillExecutionResult> {
    // 先查找技能定义
    const skill = this.skills.get(name)
    if (!skill) {
      return {
        success: false,
        output: null,
        error: `Skill not found: ${name}`
      }
    }

    // 使用技能定义中的handler字段查找处理器
    const handler = this.handlers.get(skill.handler)
    if (!handler) {
      return {
        success: false,
        output: null,
        error: `No handler registered for skill: ${name} (handler: ${skill.handler})`
      }
    }

    try {
      return await handler(args)
    } catch (error) {
      return {
        success: false,
        output: null,
        error: String(error)
      }
    }
  }

  getSkillsByCategory(): Record<string, SkillDefinition[]> {
    const categories: Record<string, SkillDefinition[]> = {
      'PPT生成': [],
      'Word文档': [],
      'Excel处理': [],
      '文件管理': [],
      'AI辅助': [],
      '学习记忆': [],
      '任务调度': [],
      '智办核心': [],
      '本地模型': [],
    }

    const pptSkills = ['ppt_generate', 'ppt_content_generate', 'ppt_layout', 'image_manage', 'asset_search', 'intent_parse', 'ppt_workflow', 'model_manage']
    const wordSkills = ['document_structure', 'content_generate', 'content_rewrite', 'document_image_fetch', 'template_learn']
    const excelSkills = ['formula_generate', 'formula_explain', 'formula_diagnose', 'financial_analyze', 'budget_variance', 'cashflow_analyze', 'breakeven_analyze', 'multi_sheet_merge', 'summary_report']
    const fileSkills = ['unified_search', 'web_search', 'image_search', 'keyword_expand', 'file_batch_rename']
    const aiSkills = ['ai_process', 'document_analyze', 'data_analyze', 'text_similarity', 'chart_create']
    const learningSkills = ['feedback_collect', 'content_score', 'style_evolve', 'memory_system', 'content_recommend']
    const taskSkills = ['task_submit', 'task_status']
    const zhibanSkills = ['jarvis_mode', 'voice_control', 'memory_control', 'self_learning', 'daemon_control']
    const localAISkills = ['local_chat', 'local_embeddings', 'local_tts', 'local_stt', 'local_image', 'model_manager']

    for (const skill of this.skills.values()) {
      if (pptSkills.includes(skill.name)) categories['PPT生成'].push(skill)
      else if (wordSkills.includes(skill.name)) categories['Word文档'].push(skill)
      else if (excelSkills.includes(skill.name)) categories['Excel处理'].push(skill)
      else if (fileSkills.includes(skill.name)) categories['文件管理'].push(skill)
      else if (aiSkills.includes(skill.name)) categories['AI辅助'].push(skill)
      else if (learningSkills.includes(skill.name)) categories['学习记忆'].push(skill)
      else if (taskSkills.includes(skill.name)) categories['任务调度'].push(skill)
      else if (zhibanSkills.includes(skill.name)) categories['智办核心'].push(skill)
      else if (localAISkills.includes(skill.name)) categories['本地模型'].push(skill)
    }

    return categories
  }
}

export const skillRegistry = new SkillRegistry()
