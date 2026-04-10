// 内容类型分析系统
// 用于识别内容类型并返回相应的Special Tokens

export type ContentType = 
  | 'technology'    // 科技类
  | 'business'      // 商业类
  | 'education'     // 教育类
  | 'medical'       // 医疗类
  | 'finance'       // 金融类
  | 'marketing'     // 营销类
  | 'research'      // 研究类
  | 'creative'      // 创意类
  | 'general'       // 通用类

export interface ContentAnalysisResult {
  type: ContentType
  confidence: number
  keywords: string[]
  layoutTokens: LayoutSpecialTokens
  expansionTokens: ExpansionSpecialTokens
}

// 排版Special Tokens - 专门用于页面布局和视觉设计
export interface LayoutSpecialTokens {
  // 颜色系统
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  
  // 字体系统
  fontFamily: string
  headingFont: string
  bodyFont: string
  
  // 图标系统
  iconSet: string[]
  iconStyle: 'flat' | 'outline' | 'filled'
  
  // 装饰元素
  decorativeElements: string[]
  backgroundPattern: string
  
  // 布局风格
  layoutStyle: 'modern' | 'classic' | 'creative' | 'professional' | 'minimalist'
  spacing: 'compact' | 'normal' | 'spacious'
  alignment: 'left' | 'center' | 'right'
  
  // 响应式设置
  breakpoints: {
    small: number
    medium: number
    large: number
  }
}

// 扩写Special Tokens - 专门用于内容生成和扩展
export interface ExpansionSpecialTokens {
  // 词汇系统
  domainVocabulary: string[]
  technicalTerms: string[]
  commonPhrases: string[]
  
  // 内容结构
  introductionStarters: string[]
  conclusionStarters: string[]
  transitionPhrases: string[]
  
  // 数据和例子
  dataPoints: string[]
  realWorldExamples: string[]
  caseStudies: string[]
  
  // 论证支持
  supportingEvidence: string[]
  statisticalFrameworks: string[]
  expertQuotes: string[]
  
  // 风格调整
  tone: 'formal' | 'informal' | 'technical' | 'conversational'
  complexity: 'basic' | 'intermediate' | 'advanced'
  lengthPreference: 'concise' | 'detailed' | 'comprehensive'
}

// 内容类型关键词库
const CONTENT_KEYWORDS: Record<ContentType, string[]> = {
  technology: [
    '人工智能', 'AI', '机器学习', '深度学习', '神经网络', '算法', '数据', '云计算',
    '大数据', '区块链', '物联网', '5G', '量子计算', '编程', '代码', '软件', '硬件',
    '芯片', '半导体', '机器人', '自动化', '数字化', '智能化', '科技', '创新',
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'algorithm', 'data', 'cloud computing', 'big data', 'blockchain', 'IoT'
  ],
  business: [
    '商业', '市场', '营销', '销售', '客户', '品牌', '战略', '管理', '企业', '公司',
    '投资', '融资', '创业', '商业模式', '竞争优势', '市场份额', '利润', '营收',
    '增长', '发展', '合作', '伙伴', '供应链', '渠道', '推广', '运营',
    'business', 'market', 'marketing', 'sales', 'customer', 'brand', 'strategy'
  ],
  education: [
    '教育', '学习', '教学', '课程', '学生', '教师', '学校', '培训', '知识', '考试',
    '成绩', '作业', '课堂', '教案', '教材', '教育改革', '素质教育', '在线教育',
    '远程学习', '教学大纲', '学分', '学位', '毕业', '招生', '就业',
    'education', 'learning', 'teaching', 'course', 'student', 'teacher', 'school'
  ],
  medical: [
    '医疗', '健康', '医院', '医生', '患者', '诊断', '治疗', '药物', '临床', '医学',
    '疾病', '预防', '康复', '护理', '手术', '检查', '症状', '病因', '疗效',
    '医学研究', '临床试验', '医疗设备', '医疗技术', '健康管理',
    'medical', 'health', 'hospital', 'doctor', 'patient', 'diagnosis', 'treatment'
  ],
  finance: [
    '金融', '银行', '投资', '股票', '基金', '债券', '期货', '外汇', '理财', '资产',
    '负债', '现金流', '收益率', '风险', '回报', '投资组合', '财务', '会计',
    '审计', '税务', '保险', '信贷', '融资', '资本市场', '证券',
    'finance', 'bank', 'investment', 'stock', 'fund', 'bond', 'futures', 'forex'
  ],
  marketing: [
    '营销', '推广', '广告', '品牌', '宣传', '活动', '策划', '传播', '媒体', '社交',
    '内容', '用户', '流量', '转化', '留存', '获客', '品牌形象', '市场定位',
    '目标受众', '营销策略', '数字营销', '社交媒体', '内容营销',
    'marketing', 'promotion', 'advertising', 'brand', 'campaign', 'media', 'social'
  ],
  research: [
    '研究', '论文', '实验', '数据', '分析', '方法', '结果', '结论', '假设', '验证',
    '文献', '引用', '学术', '期刊', '会议', '课题', '项目', '基金', '合作研究',
    '研究成果', '创新点', '研究方法', '数据分析', '实证研究',
    'research', 'paper', 'experiment', 'data', 'analysis', 'method', 'result'
  ],
  creative: [
    '创意', '设计', '艺术', '美学', '视觉', '色彩', '风格', '灵感', '创作', '作品',
    '概念', '主题', '表现', '形式', '空间', '构图', '质感', '氛围', '情感',
    '艺术表达', '设计理念', '视觉语言', '创意思维', '艺术创作',
    'creative', 'design', 'art', 'aesthetic', 'visual', 'color', 'style', 'inspiration'
  ],
  general: [
    '报告', '总结', '计划', '方案', '概述', '简介', '介绍', '说明', '分析', '建议'
  ]
}

// 排版Special Tokens配置
const LAYOUT_TOKENS: Record<ContentType, LayoutSpecialTokens> = {
  technology: {
    primaryColor: '#0066CC',
    secondaryColor: '#00A3E0',
    accentColor: '#FF6B00',
    backgroundColor: '#F0F8FF',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['⚡', '🔧', '💻', '🔬', '📊', '🤖', '🌐', '⚙️'],
    iconStyle: 'outline',
    decorativeElements: ['circuit', 'grid', 'dots', 'lines', 'hexagon'],
    backgroundPattern: 'grid',
    layoutStyle: 'modern',
    spacing: 'normal',
    alignment: 'left',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  },
  business: {
    primaryColor: '#1E3A5F',
    secondaryColor: '#4A90D9',
    accentColor: '#FFD700',
    backgroundColor: '#FFFFFF',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['💼', '📈', '🎯', '🤝', '💰', '📊', '🏢', '📋'],
    iconStyle: 'filled',
    decorativeElements: ['bars', 'arrows', 'circles', 'squares'],
    backgroundPattern: 'none',
    layoutStyle: 'professional',
    spacing: 'normal',
    alignment: 'left',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  },
  education: {
    primaryColor: '#2E7D32',
    secondaryColor: '#66BB6A',
    accentColor: '#FF9800',
    backgroundColor: '#F1F8E9',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['📚', '🎓', '✏️', '📖', '🧠', '💡', '📝', '🏫'],
    iconStyle: 'flat',
    decorativeElements: ['books', 'pencils', 'stars', 'ribbons'],
    backgroundPattern: 'subtle',
    layoutStyle: 'classic',
    spacing: 'spacious',
    alignment: 'center',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  },
  medical: {
    primaryColor: '#00796B',
    secondaryColor: '#4DB6AC',
    accentColor: '#E53935',
    backgroundColor: '#E0F2F1',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['🏥', '⚕️', '💊', '🩺', '❤️', '🧬', '🔬', '💉'],
    iconStyle: 'filled',
    decorativeElements: ['crosses', 'circles', 'waves', 'leaves'],
    backgroundPattern: 'none',
    layoutStyle: 'professional',
    spacing: 'normal',
    alignment: 'left',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  },
  finance: {
    primaryColor: '#1565C0',
    secondaryColor: '#42A5F5',
    accentColor: '#4CAF50',
    backgroundColor: '#E3F2FD',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['💰', '📊', '📈', '💹', '🏦', '💳', '💵', '📉'],
    iconStyle: 'outline',
    decorativeElements: ['charts', 'graphs', 'coins', 'arrows'],
    backgroundPattern: 'grid',
    layoutStyle: 'professional',
    spacing: 'compact',
    alignment: 'left',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  },
  marketing: {
    primaryColor: '#E91E63',
    secondaryColor: '#F48FB1',
    accentColor: '#FFC107',
    backgroundColor: '#FCE4EC',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['📢', '🎯', '💡', '🔥', '✨', '🚀', '📱', '💬'],
    iconStyle: 'filled',
    decorativeElements: ['shapes', 'waves', 'circles', 'sparkles'],
    backgroundPattern: 'abstract',
    layoutStyle: 'creative',
    spacing: 'normal',
    alignment: 'center',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  },
  research: {
    primaryColor: '#5E35B1',
    secondaryColor: '#9575CD',
    accentColor: '#00BCD4',
    backgroundColor: '#EDE7F6',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['🔬', '📚', '📊', '🧪', '📝', '🎓', '💡', '🔍'],
    iconStyle: 'outline',
    decorativeElements: ['grid', 'lines', 'dots', 'circles'],
    backgroundPattern: 'subtle',
    layoutStyle: 'classic',
    spacing: 'normal',
    alignment: 'left',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  },
  creative: {
    primaryColor: '#FF6B6B',
    secondaryColor: '#FFA07A',
    accentColor: '#4ECDC4',
    backgroundColor: '#FFF8E7',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['🎨', '✨', '🌟', '💫', '🎭', '🎪', '🌈', '🎭'],
    iconStyle: 'filled',
    decorativeElements: ['shapes', 'waves', 'circles', 'patterns'],
    backgroundPattern: 'abstract',
    layoutStyle: 'creative',
    spacing: 'spacious',
    alignment: 'center',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  },
  general: {
    primaryColor: '#333333',
    secondaryColor: '#666666',
    accentColor: '#0066CC',
    backgroundColor: '#FFFFFF',
    textColor: '#333333',
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    headingFont: 'Microsoft YaHei, Arial, sans-serif',
    bodyFont: 'Microsoft YaHei, Arial, sans-serif',
    iconSet: ['📄', '📋', '📌', '📎', '📝', '📊', '💼', '📁'],
    iconStyle: 'outline',
    decorativeElements: ['lines', 'shapes', 'borders'],
    backgroundPattern: 'none',
    layoutStyle: 'classic',
    spacing: 'normal',
    alignment: 'left',
    breakpoints: {
      small: 768,
      medium: 1024,
      large: 1440
    }
  }
}

// 扩写Special Tokens配置
const EXPANSION_TOKENS: Record<ContentType, ExpansionSpecialTokens> = {
  technology: {
    domainVocabulary: ['技术', '创新', '突破', '优化', '性能', '效率', '智能', '自动化'],
    technicalTerms: ['人工智能', '机器学习', '深度学习', '神经网络', '算法', '大数据', '云计算', '物联网'],
    commonPhrases: [
      '基于先进的算法技术',
      '通过深度学习模型',
      '利用大数据分析',
      '采用云计算架构',
      '实现智能化处理',
      '提升系统性能',
      '优化用户体验',
      '推动技术创新'
    ],
    introductionStarters: [
      '随着科技的快速发展',
      '在当今数字化时代',
      '技术创新正在改变我们的生活',
      '近年来，人工智能技术取得了重大突破'
    ],
    conclusionStarters: [
      '综上所述，技术创新将',
      '通过以上分析，我们可以看到',
      '未来，随着技术的不断进步',
      '总的来说，这项技术将'
    ],
    transitionPhrases: [
      '从技术角度来看',
      '基于以上分析',
      '进一步地',
      '与此同时',
      '值得注意的是'
    ],
    dataPoints: [
      '性能提升XX%',
      '处理速度提高XX倍',
      '准确率达到XX%',
      '响应时间缩短XX毫秒',
      '数据处理量达XXTB/天'
    ],
    realWorldExamples: [
      '例如，在图像识别领域...',
      '以自动驾驶技术为例...',
      '在智能制造场景中...',
      '以智慧城市项目为例...'
    ],
    caseStudies: [
      '谷歌的AlphaGo项目展示了...',
      '特斯拉的自动驾驶技术案例...',
      '阿里巴巴的云计算平台...',
      '华为的5G技术应用...'
    ],
    supportingEvidence: [
      '根据最新的技术报告',
      '研究表明',
      '行业数据显示',
      '专家预测'
    ],
    statisticalFrameworks: [
      '采用机器学习算法分析',
      '通过大数据挖掘',
      '基于神经网络模型',
      '使用统计分析方法'
    ],
    expertQuotes: [
      '正如技术专家所说',
      '行业领袖指出',
      '著名科学家认为',
      '技术评论家表示'
    ],
    tone: 'technical',
    complexity: 'advanced',
    lengthPreference: 'detailed'
  },
  business: {
    domainVocabulary: ['市场', '战略', '竞争', '优势', '增长', '价值', '客户', '品牌'],
    technicalTerms: ['商业模式', '市场份额', '竞争优势', '营销策略', '客户 retention', '品牌价值', '营收增长', '投资回报率'],
    commonPhrases: [
      '从市场角度分析',
      '基于竞争战略',
      '通过差异化定位',
      '实现可持续增长',
      '提升品牌价值',
      '优化客户体验',
      '构建竞争优势',
      '拓展市场份额'
    ],
    introductionStarters: [
      '在当今竞争激烈的市场环境中',
      '随着全球化的深入发展',
      '企业面临着前所未有的挑战',
      '商业环境正在发生深刻变化'
    ],
    conclusionStarters: [
      '综上所述，企业需要',
      '通过以上分析，我们建议',
      '未来，企业应该',
      '总的来说，成功的企业需要'
    ],
    transitionPhrases: [
      '从商业角度来看',
      '基于市场分析',
      '进一步分析',
      '与此同时',
      '需要指出的是'
    ],
    dataPoints: [
      '市场份额增长XX%',
      '客户满意度达XX%',
      '营收同比增长XX%',
      '用户留存率XX%',
      '品牌认知度提升XX%'
    ],
    realWorldExamples: [
      '以成功企业为例...',
      '在市场竞争中...',
      '从客户反馈来看...',
      '以行业标杆为例...'
    ],
    caseStudies: [
      '苹果公司的品牌策略...',
      '亚马逊的客户体验创新...',
      '特斯拉的市场定位...',
      '阿里巴巴的商业模式...'
    ],
    supportingEvidence: [
      '根据市场研究报告',
      '行业数据显示',
      '客户调查结果',
      '财务分析表明'
    ],
    statisticalFrameworks: [
      '采用SWOT分析',
      '通过波特五力模型',
      '基于PEST分析',
      '使用波士顿矩阵'
    ],
    expertQuotes: [
      '管理大师彼得·德鲁克曾说',
      '营销专家菲利普·科特勒认为',
      '商业领袖指出',
      '行业分析师表示'
    ],
    tone: 'formal',
    complexity: 'intermediate',
    lengthPreference: 'comprehensive'
  },
  education: {
    domainVocabulary: ['学习', '教学', '知识', '能力', '培养', '发展', '教育', '成长'],
    technicalTerms: ['教学设计', '学习理论', '认知发展', '教育心理学', '课程设计', '教学评估', '学习成果', '教育技术'],
    commonPhrases: [
      '从教育理念出发',
      '基于学习理论',
      '通过教学实践',
      '培养学生的能力',
      '促进全面发展',
      '提升教学质量',
      '优化学习体验',
      '实现教育目标'
    ],
    introductionStarters: [
      '教育是培养人才的重要途径',
      '在知识经济时代',
      '教育改革正在深入推进',
      '学习方式正在发生深刻变化'
    ],
    conclusionStarters: [
      '综上所述，教育应该',
      '通过以上分析，我们认为',
      '未来，教育将',
      '总的来说，优质教育需要'
    ],
    transitionPhrases: [
      '从教育角度来看',
      '基于教学经验',
      '进一步探讨',
      '与此同时',
      '值得关注的是'
    ],
    dataPoints: [
      '学习效率提升XX%',
      '知识掌握率达XX%',
      '学生满意度XX%',
      '教学效果提升XX%',
      '考试成绩提高XX分'
    ],
    realWorldExamples: [
      '以优秀教学案例为例...',
      '在教育实践中...',
      '从学生反馈来看...',
      '以成功教育模式为例...'
    ],
    caseStudies: [
      '芬兰的教育改革案例...',
      '新加坡的数学教学方法...',
      '美国的STEM教育计划...',
      '中国的素质教育实践...'
    ],
    supportingEvidence: [
      '根据教育研究',
      '教学实验结果',
      '学生发展数据',
      '教师反馈表明'
    ],
    statisticalFrameworks: [
      '采用教育测量方法',
      '通过学习分析',
      '基于教育评估体系',
      '使用教学效果评估'
    ],
    expertQuotes: [
      '教育学家约翰·杜威曾说',
      '心理学家皮亚杰认为',
      '教育改革专家指出',
      '著名教师表示'
    ],
    tone: 'formal',
    complexity: 'intermediate',
    lengthPreference: 'detailed'
  },
  medical: {
    domainVocabulary: ['健康', '治疗', '诊断', '预防', '康复', '护理', '医学', '临床'],
    technicalTerms: ['临床诊断', '治疗方案', '药物治疗', '手术治疗', '康复护理', '预防医学', '健康教育', '医疗技术'],
    commonPhrases: [
      '从医学角度分析',
      '基于临床研究',
      '通过诊断技术',
      '实现精准治疗',
      '促进患者康复',
      '提升医疗质量',
      '优化护理服务',
      '预防疾病发生'
    ],
    introductionStarters: [
      '健康是人类最宝贵的财富',
      '在医疗技术不断进步的今天',
      '疾病预防和治疗是医疗的核心',
      '医学研究正在为人类健康带来新希望'
    ],
    conclusionStarters: [
      '综上所述，医疗服务需要',
      '通过以上分析，我们建议',
      '未来，医疗技术将',
      '总的来说，健康管理需要'
    ],
    transitionPhrases: [
      '从医学角度来看',
      '基于临床经验',
      '进一步分析',
      '与此同时',
      '需要注意的是'
    ],
    dataPoints: [
      '治愈率达XX%',
      '诊断准确率XX%',
      '康复时间缩短XX天',
      '并发症发生率降低XX%',
      '患者满意度XX%'
    ],
    realWorldExamples: [
      '以临床案例为例...',
      '在医疗实践中...',
      '从治疗效果来看...',
      '以先进医疗技术为例...'
    ],
    caseStudies: [
      '癌症治疗的最新进展...',
      '心血管疾病的预防措施...',
      '传染病的控制策略...',
      '慢性病的管理方案...'
    ],
    supportingEvidence: [
      '根据临床研究',
      '医学文献表明',
      '患者治疗数据',
      '专家共识指出'
    ],
    statisticalFrameworks: [
      '采用临床对照试验',
      '通过meta分析',
      '基于流行病学研究',
      '使用生存分析方法'
    ],
    expertQuotes: [
      '医学专家指出',
      '临床医生认为',
      '公共卫生专家表示',
      '医学研究者强调'
    ],
    tone: 'formal',
    complexity: 'advanced',
    lengthPreference: 'comprehensive'
  },
  finance: {
    domainVocabulary: ['投资', '收益', '风险', '资产', '资金', '财务', '金融', '市场'],
    technicalTerms: ['投资组合', '风险管理', '资产配置', '财务分析', '市场分析', '金融工具', '投资策略', '收益预期'],
    commonPhrases: [
      '从金融角度分析',
      '基于投资策略',
      '通过风险管理',
      '实现资产增值',
      '优化投资组合',
      '提升收益水平',
      '控制投资风险',
      '把握市场机遇'
    ],
    introductionStarters: [
      '金融市场是经济的核心',
      '在全球经济一体化的背景下',
      '投资决策需要科学的分析',
      '风险管理是金融的重要组成部分'
    ],
    conclusionStarters: [
      '综上所述，投资策略需要',
      '通过以上分析，我们建议',
      '未来，金融市场将',
      '总的来说，财富管理需要'
    ],
    transitionPhrases: [
      '从金融角度来看',
      '基于市场分析',
      '进一步评估',
      '与此同时',
      '需要关注的是'
    ],
    dataPoints: [
      '年化收益率XX%',
      '风险敞口降低XX%',
      '资产规模增长XX%',
      '投资回报率XX%',
      '资金周转率XX次'
    ],
    realWorldExamples: [
      '以投资案例为例...',
      '在金融市场中...',
      '从投资回报来看...',
      '以成功投资策略为例...'
    ],
    caseStudies: [
      '沃伦·巴菲特的投资策略...',
      '索罗斯的量子基金案例...',
      '指数基金的长期表现...',
      '房地产投资信托的收益分析...'
    ],
    supportingEvidence: [
      '根据市场数据',
      '财务分析表明',
      '投资研究显示',
      '经济指标分析'
    ],
    statisticalFrameworks: [
      '采用现代投资组合理论',
      '通过风险收益分析',
      '基于资本资产定价模型',
      '使用技术分析方法'
    ],
    expertQuotes: [
      '投资大师沃伦·巴菲特曾说',
      '金融学家默顿·米勒认为',
      '投资分析师指出',
      '经济学家表示'
    ],
    tone: 'formal',
    complexity: 'advanced',
    lengthPreference: 'detailed'
  },
  marketing: {
    domainVocabulary: ['营销', '推广', '品牌', '用户', '流量', '转化', '传播', '影响'],
    technicalTerms: ['数字营销', '内容营销', '社交媒体营销', '搜索引擎优化', '用户体验', '品牌定位', '营销漏斗', '转化率优化'],
    commonPhrases: [
      '从营销角度分析',
      '基于用户需求',
      '通过精准推广',
      '实现品牌传播',
      '提升用户转化',
      '扩大市场影响',
      '优化营销策略',
      '增强品牌认知'
    ],
    introductionStarters: [
      '在数字时代，营销方式正在发生深刻变化',
      '品牌建设是企业成功的关键',
      '用户需求是营销的核心',
      '社交媒体正在重塑营销格局'
    ],
    conclusionStarters: [
      '综上所述，营销策略需要',
      '通过以上分析，我们建议',
      '未来，营销将',
      '总的来说，成功的营销需要'
    ],
    transitionPhrases: [
      '从营销角度来看',
      '基于用户分析',
      '进一步优化',
      '与此同时',
      '值得注意的是'
    ],
    dataPoints: [
      '用户增长XX%',
      '转化率提升XX%',
      '品牌曝光量XX万次',
      '用户留存率XX%',
      '营销ROI达XX%'
    ],
    realWorldExamples: [
      '以营销案例为例...',
      '在市场推广中...',
      '从用户反馈来看...',
      '以成功营销活动为例...'
    ],
    caseStudies: [
      '苹果的品牌营销案例...',
      '可口可乐的营销活动...',
      '耐克的社交媒体策略...',
      '亚马逊的个性化推荐营销...'
    ],
    supportingEvidence: [
      '根据营销研究',
      '用户行为分析',
      '市场调查结果',
      '营销效果数据'
    ],
    statisticalFrameworks: [
      '采用A/B测试',
      '通过用户行为分析',
      '基于营销漏斗分析',
      '使用客户生命周期价值分析'
    ],
    expertQuotes: [
      '营销大师菲利普·科特勒曾说',
      '品牌专家凯文·凯勒认为',
      '数字营销专家指出',
      '社交媒体营销顾问表示'
    ],
    tone: 'conversational',
    complexity: 'intermediate',
    lengthPreference: 'detailed'
  },
  research: {
    domainVocabulary: ['研究', '实验', '分析', '数据', '方法', '结论', '创新', '发现'],
    technicalTerms: ['研究方法', '实验设计', '数据分析', '假设检验', '文献综述', '研究结论', '创新发现', '学术贡献'],
    commonPhrases: [
      '从研究角度分析',
      '基于实验数据',
      '通过科学方法',
      '得出研究结论',
      '验证研究假设',
      '发现新的规律',
      '提出创新观点',
      '推动学术发展'
    ],
    introductionStarters: [
      '科学研究是推动社会进步的重要力量',
      '在学术领域，不断有新的发现',
      '研究方法的创新促进了科学的发展',
      '实验数据为理论提供了有力支持'
    ],
    conclusionStarters: [
      '综上所述，研究结果表明',
      '通过以上分析，我们得出',
      '未来的研究方向应该',
      '总的来说，这项研究'
    ],
    transitionPhrases: [
      '从研究角度来看',
      '基于实验结果',
      '进一步分析',
      '与此同时',
      '需要说明的是'
    ],
    dataPoints: [
      '样本量XX个',
      '置信度XX%',
      '相关系数XX',
      'P值小于0.05',
      '效应量XX'
    ],
    realWorldExamples: [
      '以研究案例为例...',
      '在实验过程中...',
      '从数据分析来看...',
      '以典型研究为例...'
    ],
    caseStudies: [
      '爱因斯坦的相对论研究...',
      '达尔文的进化论研究...',
      '居里夫人的放射性研究...',
      '霍金的黑洞研究...'
    ],
    supportingEvidence: [
      '根据实验数据',
      '研究结果表明',
      '文献综述显示',
      '统计分析结果'
    ],
    statisticalFrameworks: [
      '采用方差分析',
      '通过回归分析',
      '基于因子分析',
      '使用结构方程模型'
    ],
    expertQuotes: [
      '科学家爱因斯坦曾说',
      '研究方法专家指出',
      '学术期刊发表的研究表明',
      '领域专家认为'
    ],
    tone: 'formal',
    complexity: 'advanced',
    lengthPreference: 'comprehensive'
  },
  creative: {
    domainVocabulary: ['创意', '设计', '艺术', '美学', '视觉', '风格', '灵感', '表达'],
    technicalTerms: ['创意设计', '视觉艺术', '美学原理', '设计风格', '艺术表达', '创意过程', '视觉效果', '艺术价值'],
    commonPhrases: [
      '从设计角度分析',
      '基于美学原理',
      '通过视觉表达',
      '实现创意呈现',
      '提升艺术价值',
      '展现独特风格',
      '激发创作灵感',
      '传递情感表达'
    ],
    introductionStarters: [
      '创意是艺术的灵魂',
      '在设计领域，创新是永恒的主题',
      '艺术表达是人类情感的重要载体',
      '视觉效果能够传递丰富的信息'
    ],
    conclusionStarters: [
      '综上所述，创意设计需要',
      '通过以上分析，我们认为',
      '未来，艺术将',
      '总的来说，优秀的创意需要'
    ],
    transitionPhrases: [
      '从设计角度来看',
      '基于美学分析',
      '进一步探索',
      '与此同时',
      '值得关注的是'
    ],
    dataPoints: [
      '用户满意度XX%',
      '设计效率提升XX%',
      '创意评分XX分',
      '视觉吸引力提升XX%',
      '品牌认知度提升XX%'
    ],
    realWorldExamples: [
      '以设计案例为例...',
      '在创作过程中...',
      '从视觉效果来看...',
      '以优秀设计作品为例...'
    ],
    caseStudies: [
      '苹果产品的设计理念...',
      '毕加索的艺术风格...',
      '宫崎骏的动画创作...',
      '扎哈·哈迪德的建筑设计...'
    ],
    supportingEvidence: [
      '根据设计研究',
      '用户审美偏好调查',
      '艺术理论分析',
      '创意效果评估'
    ],
    statisticalFrameworks: [
      '采用用户体验测试',
      '通过视觉效果评估',
      '基于美学评分体系',
      '使用创意评估方法'
    ],
    expertQuotes: [
      '设计大师乔布斯曾说',
      '艺术家毕加索认为',
      '设计师密斯·凡·德罗表示',
      '创意总监指出'
    ],
    tone: 'conversational',
    complexity: 'intermediate',
    lengthPreference: 'detailed'
  },
  general: {
    domainVocabulary: ['分析', '总结', '建议', '计划', '方案', '措施', '目标', '效果'],
    technicalTerms: ['分析方法', '总结报告', '建议方案', '行动计划', '实施方案', '评估措施', '目标设定', '效果评估'],
    commonPhrases: [
      '从整体角度分析',
      '基于实际情况',
      '通过有效措施',
      '实现预期目标',
      '取得良好效果',
      '提出改进建议',
      '制定详细计划',
      '落实具体方案'
    ],
    introductionStarters: [
      '面对当前的情况',
      '基于实际需求',
      '为了解决这一问题',
      '根据相关分析'
    ],
    conclusionStarters: [
      '综上所述，我们建议',
      '通过以上分析，我们认为',
      '未来，我们应该',
      '总的来说，需要'
    ],
    transitionPhrases: [
      '从整体来看',
      '基于以上分析',
      '进一步说明',
      '与此同时',
      '需要指出的是'
    ],
    dataPoints: [
      '完成率XX%',
      '效率提升XX%',
      '满意度XX%',
      '达标率XX%',
      '改进幅度XX%'
    ],
    realWorldExamples: [
      '以实际案例为例...',
      '在工作实践中...',
      '从效果来看...',
      '以成功经验为例...'
    ],
    caseStudies: [
      '某公司的管理改进案例...',
      '项目实施的成功经验...',
      '问题解决的有效方法...',
      '团队协作的最佳实践...'
    ],
    supportingEvidence: [
      '根据实际数据',
      '分析结果表明',
      '实践经验显示',
      '评估结果显示'
    ],
    statisticalFrameworks: [
      '采用SWOT分析',
      '通过PDCA循环',
      '基于5W2H分析',
      '使用鱼骨图分析'
    ],
    expertQuotes: [
      '管理专家指出',
      '行业人士认为',
      '实践经验表明',
      '专家建议'
    ],
    tone: 'formal',
    complexity: 'basic',
    lengthPreference: 'concise'
  }
}

// 分析内容类型
export function analyzeContent(text: string): ContentAnalysisResult {
  const lowerText = text.toLowerCase()
  const scores: Record<ContentType, number> = {
    technology: 0,
    business: 0,
    education: 0,
    medical: 0,
    finance: 0,
    marketing: 0,
    research: 0,
    creative: 0,
    general: 0
  }
  
  const foundKeywords: Record<ContentType, string[]> = {
    technology: [],
    business: [],
    education: [],
    medical: [],
    finance: [],
    marketing: [],
    research: [],
    creative: [],
    general: []
  }
  
  // 计算每个类型的得分
  for (const [type, keywords] of Object.entries(CONTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[type as ContentType] += 1
        foundKeywords[type as ContentType].push(keyword)
      }
    }
  }
  
  // 找出得分最高的类型
  let maxType: ContentType = 'general'
  let maxScore = 0
  
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      maxType = type as ContentType
    }
  }
  
  // 计算置信度
  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0)
  const confidence = totalScore > 0 ? maxScore / totalScore : 0
  
  return {
    type: maxType,
    confidence,
    keywords: foundKeywords[maxType],
    layoutTokens: LAYOUT_TOKENS[maxType],
    expansionTokens: EXPANSION_TOKENS[maxType]
  }
}

// 获取排版建议
export function getLayoutSuggestions(contentType: ContentType): LayoutSpecialTokens {
  return LAYOUT_TOKENS[contentType]
}

// 获取扩写建议
export function getExpansionSuggestions(contentType: ContentType): ExpansionSpecialTokens {
  return EXPANSION_TOKENS[contentType]
}

// 根据内容类型生成扩写内容
export function generateExpandedContent(
  originalText: string,
  contentType: ContentType
): string {
  const tokens = EXPANSION_TOKENS[contentType]
  const words = originalText.split(/\s+/)
  
  let expandedText = originalText
  let phraseIndex = 0
  
  // 添加引言开头
  if (words.length > 5 && tokens.introductionStarters.length > 0) {
    const intro = tokens.introductionStarters[phraseIndex % tokens.introductionStarters.length]
    expandedText = `${intro}，${expandedText}`
    phraseIndex++
  }
  
  // 添加过渡短语
  if (words.length > 10 && tokens.transitionPhrases.length > 0) {
    const transition = tokens.transitionPhrases[phraseIndex % tokens.transitionPhrases.length]
    expandedText += `\n\n${transition}，`
    phraseIndex++
  }
  
  // 添加数据点（如果可用）
  if (tokens.dataPoints && tokens.dataPoints.length > 0 && phraseIndex < 3) {
    const dataPoint = tokens.dataPoints[phraseIndex % tokens.dataPoints.length]
    expandedText += `\n\n${dataPoint}`
    phraseIndex++
  }
  
  // 添加真实例子（如果可用）
  if (tokens.realWorldExamples && tokens.realWorldExamples.length > 0 && phraseIndex < 3) {
    const example = tokens.realWorldExamples[phraseIndex % tokens.realWorldExamples.length]
    expandedText += `\n\n${example}`
    phraseIndex++
  }
  
  // 添加案例研究（如果可用）
  if (tokens.caseStudies && tokens.caseStudies.length > 0 && phraseIndex < 3) {
    const caseStudy = tokens.caseStudies[phraseIndex % tokens.caseStudies.length]
    expandedText += `\n\n${caseStudy}`
    phraseIndex++
  }
  
  // 添加支持证据（如果可用）
  if (tokens.supportingEvidence && tokens.supportingEvidence.length > 0 && phraseIndex < 3) {
    const evidence = tokens.supportingEvidence[phraseIndex % tokens.supportingEvidence.length]
    expandedText += `\n\n${evidence}，`
    phraseIndex++
  }
  
  // 添加专家引用（如果可用）
  if (tokens.expertQuotes && tokens.expertQuotes.length > 0 && phraseIndex < 3) {
    const quote = tokens.expertQuotes[phraseIndex % tokens.expertQuotes.length]
    expandedText += `\n\n${quote}，`
    phraseIndex++
  }
  
  // 添加结论
  if (tokens.conclusionStarters.length > 0) {
    const conclusion = tokens.conclusionStarters[phraseIndex % tokens.conclusionStarters.length]
    expandedText += `\n\n${conclusion}`
  }
  
  // 根据长度偏好调整内容
  if (tokens.lengthPreference === 'concise') {
    // 保持简洁
    const sentences = expandedText.split('。')
    if (sentences.length > 4) {
      expandedText = sentences.slice(0, 4).join('。') + '。'
    }
  } else if (tokens.lengthPreference === 'comprehensive' && tokens.commonPhrases.length > 0) {
    // 增加详细内容
    const phrase = tokens.commonPhrases[phraseIndex % tokens.commonPhrases.length]
    expandedText += `\n\n${phrase}。`
  }
  
  return expandedText
}
