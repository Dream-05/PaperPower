export interface GeneratedContent {
  title: string
  subtitle?: string
  sections: ContentSection[]
}

export interface ContentSection {
  title: string
  points: string[]
  notes?: string
}

export interface AIGenerationOptions {
  topic: string
  slideCount?: number
  style?: 'formal' | 'casual' | 'academic' | 'creative'
  language?: 'zh' | 'en'
  includeOutline?: boolean
}

const contentTemplates: Record<string, GeneratedContent> = {
  '项目汇报': {
    title: '项目汇报',
    subtitle: '项目进展与成果展示',
    sections: [
      { title: '项目背景', points: ['项目起源与目标', '市场需求分析', '项目意义与价值'] },
      { title: '项目进展', points: ['已完成工作', '当前进度', '关键里程碑'] },
      { title: '核心成果', points: ['主要产出物', '技术突破', '业务价值'] },
      { title: '问题与挑战', points: ['遇到的问题', '解决方案', '经验总结'] },
      { title: '下一步计划', points: ['后续工作安排', '资源需求', '预期目标'] }
    ]
  },
  '工作总结': {
    title: '工作总结',
    subtitle: '年度工作回顾与展望',
    sections: [
      { title: '工作概述', points: ['岗位职责', '主要工作内容', '工作成果概览'] },
      { title: '重点项目', points: ['项目一：描述与成果', '项目二：描述与成果', '项目三：描述与成果'] },
      { title: '数据成果', points: ['关键指标达成', '同比环比分析', '突出贡献'] },
      { title: '自我提升', points: ['技能成长', '学习收获', '能力提升'] },
      { title: '未来规划', points: ['下阶段目标', '改进计划', '职业发展'] }
    ]
  },
  '产品介绍': {
    title: '产品介绍',
    subtitle: '产品功能与价值主张',
    sections: [
      { title: '产品概述', points: ['产品定位', '目标用户', '核心价值'] },
      { title: '核心功能', points: ['功能一：详细说明', '功能二：详细说明', '功能三：详细说明'] },
      { title: '产品优势', points: ['技术优势', '用户体验', '性价比'] },
      { title: '应用场景', points: ['场景一', '场景二', '场景三'] },
      { title: '客户案例', points: ['案例一：效果展示', '案例二：效果展示', '客户评价'] }
    ]
  },
  '教学课件': {
    title: '教学课件',
    subtitle: '课程内容讲解',
    sections: [
      { title: '课程导入', points: ['学习目标', '知识回顾', '本节重点'] },
      { title: '核心概念', points: ['概念定义', '关键特征', '相关理论'] },
      { title: '详细讲解', points: ['知识点一', '知识点二', '知识点三'] },
      { title: '案例分析', points: ['案例背景', '分析过程', '结论总结'] },
      { title: '课堂小结', points: ['重点回顾', '思考题', '课后作业'] }
    ]
  },
  '商业计划': {
    title: '商业计划书',
    subtitle: '创业项目商业计划',
    sections: [
      { title: '项目简介', points: ['项目概述', '愿景使命', '核心团队'] },
      { title: '市场分析', points: ['市场规模', '竞争格局', '目标市场'] },
      { title: '产品服务', points: ['产品介绍', '商业模式', '核心竞争力'] },
      { title: '运营策略', points: ['营销策略', '运营计划', '风险控制'] },
      { title: '财务规划', points: ['收入预测', '成本结构', '融资需求'] }
    ]
  },
  '培训材料': {
    title: '培训课程',
    subtitle: '员工技能培训',
    sections: [
      { title: '培训目标', points: ['学习目标', '培训内容', '预期成果'] },
      { title: '基础知识', points: ['概念介绍', '基本原理', '入门要点'] },
      { title: '实操演练', points: ['操作步骤', '注意事项', '常见问题'] },
      { title: '案例分析', points: ['成功案例', '失败教训', '经验总结'] },
      { title: '考核评估', points: ['考核标准', '练习题', '证书颁发'] }
    ]
  }
}

export class AIContentGenerator {
  private static instance: AIContentGenerator
  
  private constructor() {}
  
  static getInstance(): AIContentGenerator {
    if (!AIContentGenerator.instance) {
      AIContentGenerator.instance = new AIContentGenerator()
    }
    return AIContentGenerator.instance
  }
  
  generateContent(options: AIGenerationOptions): GeneratedContent {
    const { topic, slideCount = 5, language = 'zh' } = options
    
    const matchedTemplate = this.findBestTemplate(topic)
    if (matchedTemplate) {
      return this.customizeTemplate(matchedTemplate, topic, slideCount)
    }
    
    return this.generateFromTopic(topic, slideCount, language)
  }
  
  private findBestTemplate(topic: string): GeneratedContent | null {
    const keywords = Object.keys(contentTemplates)
    for (const keyword of keywords) {
      if (topic.includes(keyword) || keyword.includes(topic)) {
        return contentTemplates[keyword]
      }
    }
    return null
  }
  
  private customizeTemplate(
    template: GeneratedContent,
    topic: string,
    slideCount: number
  ): GeneratedContent {
    const customizedTitle = topic || template.title
    const sections = template.sections.slice(0, slideCount)
    
    return {
      title: customizedTitle,
      subtitle: template.subtitle,
      sections: sections.map(section => ({
        ...section,
        title: section.title
      }))
    }
  }
  
  private generateFromTopic(
    topic: string,
    slideCount: number,

    language: string
  ): GeneratedContent {
    const sections: ContentSection[] = []
    
    const introSection: ContentSection = {
      title: language === 'zh' ? '概述' : 'Overview',
      points: [
        language === 'zh' ? `${topic}的背景介绍` : `Background of ${topic}`,
        language === 'zh' ? `${topic}的核心概念` : `Core concepts of ${topic}`,
        language === 'zh' ? `${topic}的重要意义` : `Importance of ${topic}`
      ]
    }
    sections.push(introSection)
    
    for (let i = 1; i < slideCount - 1; i++) {
      const section: ContentSection = {
        title: language === 'zh' ? `第${i + 1}部分` : `Part ${i + 1}`,
        points: [
          language === 'zh' ? `要点${i}-1` : `Point ${i}-1`,
          language === 'zh' ? `要点${i}-2` : `Point ${i}-2`,
          language === 'zh' ? `要点${i}-3` : `Point ${i}-3`
        ]
      }
      sections.push(section)
    }
    
    const conclusionSection: ContentSection = {
      title: language === 'zh' ? '总结' : 'Conclusion',
      points: [
        language === 'zh' ? '核心要点回顾' : 'Key points review',
        language === 'zh' ? '未来展望' : 'Future outlook',
        language === 'zh' ? '行动建议' : 'Action recommendations'
      ]
    }
    sections.push(conclusionSection)
    
    return {
      title: topic,
      subtitle: language === 'zh' ? `${topic}专题演示` : `Presentation on ${topic}`,
      sections
    }
  }
  
  expandPoint(point: string, context: string): string[] {
    const expansions: string[] = []
    
    if (point.includes('背景')) {
      expansions.push(`关于${context}的背景分析`)
      expansions.push(`相关历史发展脉络`)
      expansions.push(`当前现状描述`)
    } else if (point.includes('目标') || point.includes('目的')) {
      expansions.push(`主要目标设定`)
      expansions.push(`具体指标要求`)
      expansions.push(`达成标准说明`)
    } else if (point.includes('方法') || point.includes('方案')) {
      expansions.push(`方法论介绍`)
      expansions.push(`具体实施步骤`)
      expansions.push(`注意事项提醒`)
    } else if (point.includes('成果') || point.includes('效果')) {
      expansions.push(`量化成果展示`)
      expansions.push(`质化效果分析`)
      expansions.push(`对比数据说明`)
    } else {
      expansions.push(`${point}的详细说明`)
      expansions.push(`相关案例分析`)
      expansions.push(`实践建议`)
    }
    
    return expansions
  }
  
  generateOutline(topic: string, depth: number = 2): string {
    const content = this.generateContent({ topic, slideCount: depth * 2 + 1 })
    let outline = `# ${content.title}\n\n`
    
    if (content.subtitle) {
      outline += `> ${content.subtitle}\n\n`
    }
    
    content.sections.forEach((section, index) => {
      outline += `## ${index + 1}. ${section.title}\n`
      section.points.forEach((point, pIndex) => {
        outline += `   ${pIndex + 1}. ${point}\n`
      })
      outline += '\n'
    })
    
    return outline
  }
  
  suggestTopics(category: string): string[] {
    const suggestions: Record<string, string[]> = {
      business: ['季度工作汇报', '年度总结报告', '项目进展汇报', '产品发布会', '商业计划书'],
      education: ['教学课件', '学术报告', '论文答辩', '培训课程', '知识分享'],
      creative: ['创意提案', '设计展示', '品牌故事', '营销策划', '活动方案'],
      technology: ['技术分享', '架构设计', '产品演示', '技术方案', '研发报告'],
      general: ['项目介绍', '团队建设', '流程优化', '问题分析', '解决方案']
    }
    
    return suggestions[category] || suggestions.general
  }
  
  parseUserIntent(input: string): AIGenerationOptions | null {
    const topicMatch = input.match(/生成|制作|创建|做一个|帮我写|关于|主题是/)
    if (!topicMatch) return null
    
    let topic = input
      .replace(/生成|制作|创建|做一个|帮我写|关于|主题是|PPT|ppt|演示文稿|幻灯片/g, '')
      .trim()
    
    if (!topic) return null
    
    const slideCountMatch = input.match(/(\d+)[页张个]/)
    const slideCount = slideCountMatch ? parseInt(slideCountMatch[1]) : 5
    
    let style: 'formal' | 'casual' | 'academic' | 'creative' = 'formal'
    if (input.includes('学术') || input.includes('论文') || input.includes('答辩')) {
      style = 'academic'
    } else if (input.includes('创意') || input.includes('活泼') || input.includes('有趣')) {
      style = 'creative'
    } else if (input.includes('轻松') || input.includes('随意')) {
      style = 'casual'
    }
    
    return { topic, slideCount, style }
  }
}

export const aiContentGenerator = AIContentGenerator.getInstance()
