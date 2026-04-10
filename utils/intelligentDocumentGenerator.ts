

interface DocumentSection {
  title: string
  heading: string
  content: string[]
  keyPoints: string[]
  transition?: string
}

interface DocumentStructure {
  type: 'report' | 'proposal' | 'plan' | 'analysis' | 'creative' | 'academic'
  title: string
  subtitle: string
  sections: DocumentSection[]
  conclusion: string
  metadata: {
    wordCount: number
    sectionCount: number
    generatedAt: string
    confidence: number
  }
}

const DOCUMENT_FRAMEWORKS: Record<string, {
  type: DocumentStructure['type']
  sections: Array<{ title: string; heading: string; promptHint: string }>
  conclusionPrompt: string
  styleGuide: string
}> = {
  '项目汇报': {
    type: 'report',
    sections: [
      { title: '项目背景', heading: '一、项目背景与目标', promptHint: '阐述项目起源、战略意义、核心目标' },
      { title: '执行进展', heading: '二、执行情况与关键成果', promptHint: '详述已完成工作、量化成果、技术突破' },
      { title: '问题解决', heading: '三、问题识别与解决方案', promptHint: '分析遇到的核心挑战及应对策略' },
      { title: '价值分析', heading: '四、项目价值与影响评估', promptHint: '从业务、技术、用户多维度评估价值' },
      { title: '后续规划', heading: '五、下一阶段工作计划', promptHint: '明确里程碑、资源需求、风险预案' }
    ],
    conclusionPrompt: '总结核心成就，展望未来方向，提出行动建议',
    styleGuide: '正式、数据驱动、结构清晰'
  },
  '工作总结': {
    type: 'report',
    sections: [
      { title: '工作概述', heading: '一、年度工作综述', promptHint: '概括岗位职责范围、核心工作领域、整体完成情况' },
      { title: '重点项目', heading: '二、重点项目成果详解', promptHint: '逐项列出负责项目，说明角色、贡献、可衡量结果' },
      { title: '数据分析', heading: '三、关键指标与数据表现', promptHint: '用具体数字展示KPI达成率、同比变化、突出亮点' },
      { title: '能力成长', heading: '四、个人能力提升与收获', promptHint: '反思技能成长点、知识积累、方法论改进' },
      { title: '未来规划', heading: '五、下阶段目标与行动计划', promptHint: '设定SMART目标、明确学习方向、规划职业路径' }
    ],
    conclusionPrompt: '提炼年度核心价值，表达对未来的信心和承诺',
    styleGuide: '真诚、有据可查、体现成长性'
  },
  '商业计划': {
    type: 'proposal',
    sections: [
      { title: '项目概述', heading: '一、创业项目概览', promptHint: '用一句话定义项目，说明愿景使命和核心团队优势' },
      { title: '市场机会', heading: '二、市场规模与竞争格局', promptHint: '用数据论证TAM/SAM/SOM，分析竞争对手差异化空间' },
      { title: '产品方案', heading: '三、产品/服务解决方案', promptHint: '详细描述MVP功能、技术路线图、商业模式画布' },
      { title: '运营策略', heading: '四、市场进入与增长策略', promptHint: '制定获客渠道、定价策略、合作伙伴计划' },
      { title: '财务预测', heading: '五、财务模型与融资需求', promptHint: '展示3年营收预测、成本结构、资金使用计划' }
    ],
    conclusionPrompt: '强调投资亮点，展示团队执行力，发出合作邀请',
    styleGuide: '有说服力、数据支撑、展现野心'
  },
  '产品介绍': {
    type: 'creative',
    sections: [
      { title: '产品定位', heading: '一、产品定位与用户画像', promptHint: '清晰定义目标用户群、核心痛点、独特价值主张' },
      { title: '功能详解', heading: '二、核心功能深度解析', promptHint: '按优先级逐项介绍功能，配合使用场景说明' },
      { title: '竞争优势', heading: '三、竞品对比与差异化优势', promptHint: '客观对比3-5个竞品，突出不可替代性' },
      { title: '应用场景', heading: '四、典型使用场景与案例', promptHint: '描述3个真实场景，展示产品如何解决问题' },
      { title: '客户证言', heading: '五、用户反馈与社会评价', promptHint: '引用真实用户评价、行业认可、媒体报道' }
    ],
    conclusionPrompt: '强化购买动机，提供试用或联系入口',
    styleGuide: '吸引人、场景化、以用户为中心'
  },
  '教学课件': {
    type: 'academic',
    sections: [
      { title: '课程导入', heading: '一、学习目标与知识框架', promptHint: '明确本节课的学习目标、前置知识要求、知识图谱位置' },
      { title: '概念精讲', heading: '二、核心概念深度解析', promptHint: '用类比和实例解释抽象概念，建立直观理解' },
      { title: '原理剖析', heading: '三、底层原理与方法论', promptHint: '推导关键公式/逻辑链，解释"为什么"而非仅"是什么"' },
      { title: '实战演练', heading: '四、例题讲解与练习设计', promptHint: '由浅入深设计3道题，覆盖理解/应用/创新层次' },
      { title: '课堂小结', heading: '五、知识回顾与延伸思考', promptHint: '用思维导图总结，提出开放性问题激发思考' }
    ],
    conclusionPrompt: '巩固核心知识点，布置分层作业，预告下次内容',
    styleGuide: '循序渐进、启发式、注重理解'
  },
  '培训材料': {
    type: 'plan',
    sections: [
      { title: '培训目标', heading: '一、培训目标与预期成果', promptHint: '定义培训后学员应掌握的具体能力和行为改变' },
      { title: '知识体系', heading: '二、知识框架与核心要点', promptHint: '构建完整的知识树，标注重点难点' },
      { title: '实操指南', heading: '三、操作步骤与最佳实践', promptHint: '分步骤演示标准流程，标注常见错误和注意事项' },
      { title: '案例分析', heading: '四、典型案例深度拆解', promptHint: '选取正反案例，引导学员分析决策过程' },
      { title: '考核方案', heading: '五、效果评估与持续改进', promptHint: '设计理论+实操双维度考核，建立反馈机制' }
    ],
    conclusionPrompt: '强调学以致用，提供后续学习资源，建立社群支持',
    styleGuide: '实用导向、互动性强、注重落地'
  },
  '通用文档': {
    type: 'analysis',
    sections: [
      { title: '引言', heading: '一、背景与问题陈述', promptHint: '交代写作背景，明确要讨论的核心问题' },
      { title: '现状分析', heading: '二、当前状况与数据呈现', promptHint: '用事实和数据客观描述现状' },
      { title: '深度剖析', heading: '三、原因分析与关键发现', promptHint: '挖掘现象背后的根本原因，识别关键变量' },
      { title: '方案建议', heading: '四、解决方案与实施路径', promptHint: '提出可行的解决方案，考虑资源约束' },
      { title: '总结展望', heading: '五、结论与下一步行动', promptHint: '总结核心观点，给出明确的行动建议' }
    ],
    conclusionPrompt: '凝练全文核心观点，提出前瞻性建议',
    styleGuide: '逻辑严密、论据充分、结论明确'
  }
}

const TOPIC_CONTENT_EXPANSION: Record<string, (topic: string, sectionIndex: number) => string[]> = {
  '背景': (topic, _) => [
    `${topic}作为当前领域的热点议题，其发展历程可以追溯到...`,
    `从宏观环境来看，${topic}所处的行业正在经历深刻变革。一方面...另一方面...`,
    `深入理解${topic}，需要把握三个关键维度：首先是...其次是...最后是...`
  ],
  '进展': (topic, _) => [
    `截至目前，${topic}项目已完成了以下阶段性目标：第一...第二...第三...`,
    `在执行过程中，团队采用了敏捷迭代的方法，确保每个里程碑都有可交付的成果。具体表现为...`,
    `从量化角度看，核心KPI达成情况如下：进度达成率XX%，质量合格率XX%，预算控制率XX%`
  ],
  '问题': (topic, _) => [
    `在推进${topic}的过程中，我们识别出以下核心挑战：一是...二是...三是...`,
    `针对上述问题，团队经过多轮讨论和验证，形成了系统性的解决方案：`,
    `这些问题的根源在于...因此我们的应对策略从三个层面展开：短期...中期...长期...`
  ],
  '成果': (topic, _) => [
    `${topic}项目的核心产出包括以下几个方面：（1）...（2）...（3）...`,
    `从业务价值角度评估，${topic}带来的直接收益体现在...间接价值则反映在...`,
    `值得一提的是，在技术层面实现了...这一突破为后续发展奠定了坚实基础`
  ],
  '规划': (topic, _) => [
    `基于当前进展和市场反馈，${topic}的下一阶段将聚焦于以下重点工作：`,
    `为确保目标达成，我们制定了详细的时间节点和里程碑：Q1...Q2...Q3...Q4...`,
    `在资源方面，需要重点关注...同时建立风险预警机制以应对可能的挑战`
  ],
  '分析': (topic, _) => [
    `对${topic}进行系统性分析，我们可以从以下几个维度展开：`,
    `数据显示，${topic}的关键指标呈现出以下趋势：...这一趋势背后的驱动因素是...`,
    `通过交叉分析和对比研究，我们发现了一个重要规律：...`
  ],
  '方案': (topic, _) => [
    `针对${topic}面临的挑战，我们提出以下解决方案：`,
    `该方案的优势在于：第一...第二...第三...`,
    `实施路径建议分为三个阶段：准备期（...）→ 执行期（...）→ 巩固期（...）`
  ],
  'default': (topic, sectionIdx) => [
    `关于${topic}的${['核心概念', '关键要素', '实施细节', '影响因素', '最佳实践'][sectionIdx % 5]}，我们需要关注以下几点：`,
    `首先，从理论和实践两个角度来看...其次，结合行业标杆案例...最后，考虑到实际落地的可行性...`,
    `综上所述，这一部分对于整体理解${topic}具有承上启下的重要作用`
  ]
}

class IntelligentDocumentGenerator {
  private cache: Map<string, DocumentStructure> = new Map()
  private readonly maxCacheSize = 50

  detectDocumentType(topic: string): string {
    const typeKeywords: Array<{ keywords: string[]; type: string }> = [
      { keywords: ['汇报', '总结', '报告', 'review', 'report'], type: '项目汇报' },
      { keywords: ['工作', '年度', '季度', '绩效', 'annual'], type: '工作总结' },
      { keywords: ['商业', '计划书', '创业', '融资', 'business plan'], type: '商业计划' },
      { keywords: ['产品', '介绍', '发布', '推广', 'product'], type: '产品介绍' },
      { keywords: ['教学', '课件', '课程', '培训', 'education'], type: '教学课件' },
      { keywords: ['培训', '材料', '指南', 'manual', 'training'], type: '培训材料' }
    ]

    const lowerTopic = topic.toLowerCase()
    for (const { keywords, type } of typeKeywords) {
      if (keywords.some(kw => lowerTopic.includes(kw.toLowerCase()))) {
        return type
      }
    }

    return '通用文档'
  }

  generateSectionContent(topic: string, sectionTitle: string, _promptHint: string, sectionIndex: number, totalSections: number, _language: 'zh' | 'en'): string[] {
    const contentPatterns = Object.entries(TOPIC_CONTENT_EXPANSION)
    let matchedPattern = TOPIC_CONTENT_EXPANSION['default']

    for (const [key, pattern] of contentPatterns) {
      if (key !== 'default' && (sectionTitle.includes(key) || _promptHint.includes(key))) {
        matchedPattern = pattern
        break
      }
    }

    const baseContent = matchedPattern(topic, sectionIndex)

    if (sectionIndex > 0) {
      baseContent.push(`（承接上一节内容，本节将进一步探讨...）`)
    }

    if (sectionIndex < totalSections - 1) {
      baseContent.push(`（本节内容将为下一节的讨论奠定基础...）`)
    }

    return baseContent
  }

  generateKeyPoints(_topic: string, sectionTitle: string): string[] {
    const pointTemplates = [
      `【核心要点】${sectionTitle}的关键在于把握...`,
      `【实践建议】在实际操作中，应特别注意...`,
      `【常见误区】需要避免的错误做法包括...`,
      `【数据支撑】根据相关研究和统计...`
    ]

    return pointTemplates.slice(0, 3)
  }

  async generate(topic: string, options: {
    type?: string
    language?: 'zh' | 'en'
    maxLength?: number
    style?: 'formal' | 'casual' | 'academic' | 'creative'
  } = {}): Promise<DocumentStructure> {
    const {
      language = 'zh',
      style = 'formal'
    } = options

    const cacheKey = `${topic}_${language}_${style}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const docType = options.type || this.detectDocumentType(topic)
    const framework = DOCUMENT_FRAMEWORKS[docType] || DOCUMENT_FRAMEWORKS['通用文档']

    const sections: DocumentSection[] = []
    const totalSections = framework.sections.length

    for (let i = 0; i < framework.sections.length; i++) {
      const sectionTemplate = framework.sections[i]
      const content = this.generateSectionContent(
        topic,
        sectionTemplate.title,
        sectionTemplate.promptHint,
        i,
        totalSections,
        language
      )

      const keyPoints = this.generateKeyPoints(topic, sectionTemplate.title)

      const transition = i < totalSections - 1
        ? `了解了${sectionTemplate.title}之后，让我们进一步探讨${framework.sections[i + 1]?.title || '相关内容'}...`
        : undefined

      sections.push({
        title: sectionTemplate.title,
        heading: sectionTemplate.heading,
        content,
        keyPoints,
        transition
      })
    }

    const conclusion = this.generateConclusion(topic, framework.conclusionPrompt, language)

    const result: DocumentStructure = {
      type: framework.type,
      title: topic,
      subtitle: language === 'zh'
        ? `${topic}—智能生成文档`
        : `${topic} - Intelligent Generated Document`,
      sections,
      conclusion,
      metadata: {
        wordCount: sections.reduce((sum, s) => sum + s.content.join('').length, 0) + conclusion.length,
        sectionCount: sections.length,
        generatedAt: new Date().toISOString(),
        confidence: 0.85
      }
    }

    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(cacheKey, result)

    return result
  }

  private generateConclusion(topic: string, _promptHint: string, language: 'zh' | 'en'): string {
    if (language === 'zh') {
      return `综上所述，关于${topic}的全面分析表明：

【核心回顾】本文从多个维度对${topic}进行了系统梳理，涵盖了背景、现状、问题和解决方案等关键方面。

【主要发现】通过深入分析，我们可以得出以下核心结论：首先...其次...最后...

【行动建议】基于以上分析，建议采取以下措施：（1）...（2）...（3）...

【展望】展望未来，${topic}的发展趋势将朝着...方向演进。我们有理由相信，通过持续的优化和创新，必将取得更大的突破。

本文由PaperPower AI智能文档引擎辅助生成，建议根据实际情况进行审核和调整。`
    }

    return `In conclusion, our comprehensive analysis of ${topic} reveals:

【Key Takeaways】This document has systematically examined ${topic} across multiple dimensions including background, current status, challenges, and solutions.

【Main Findings】Our analysis leads to several core conclusions: First... Second... Finally...

【Recommendations】Based on the above analysis, we recommend the following actions: (1)... (2)... (3)...

【Future Outlook】Looking ahead, ${topic} is expected to evolve towards... With continuous optimization and innovation, significant breakthroughs are achievable.

Generated by PaperPower AI Intelligent Document Engine. Please review and adjust according to your specific needs.`
  }

  generateOutline(topic: string, _depth: number = 2): string {
    const docType = this.detectDocumentType(topic)
    const framework = DOCUMENT_FRAMEWORKS[docType] || DOCUMENT_FRAMEWORKS['通用文档']

    let outline = `# ${topic}\n\n`

    framework.sections.forEach((section, index) => {
      outline += `${index + 1}. ${section.heading}\n`
      outline += `   └─ ${section.promptHint}\n\n`
    })

    outline += `\n## 总结与展望\n└─ ${framework.conclusionPrompt}\n`

    return outline
  }

  exportToMarkdown(document: DocumentStructure): string {
    let md = `# ${document.title}\n\n`

    if (document.subtitle) {
      md += `> ${document.subtitle}\n\n`
    }

    md += `---\n\n`

    for (let i = 0; i < document.sections.length; i++) {
      const section = document.sections[i]
      md += `## ${section.heading}\n\n`

      for (const para of section.content) {
        md += `${para}\n\n`
      }

      if (section.keyPoints.length > 0) {
        md += `**关键要点：**\n`
        for (const point of section.keyPoints) {
          md += `- ${point}\n`
        }
        md += `\n`
      }

      if (section.transition) {
        md += `*${section.transition}*\n\n`
      }

      md += `---\n\n`
    }

    md += `## 总结\n\n${document.conclusion}\n\n`

    md += `---\n\n*文档由 PaperPower AI 智能引擎生成 | ${document.metadata.generatedAt}*`

    return md
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const intelligentDocGen = new IntelligentDocumentGenerator()

export type { DocumentStructure, DocumentSection }
