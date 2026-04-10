import { modelService } from './localAI/ModelService'
import { HTMLParser, HTMLContent } from './htmlParser'
import { intelligentDocGen } from './intelligentDocumentGenerator'

export interface GeneratedContent {
  title: string
  sections: ContentSection[]
  images: ImageWithDescription[]
  metadata: {
    generatedAt: string
    topic: string
    type: string
    wordCount: number
  }
}

export interface ContentSection {
  heading: string
  content: string
  level: number
}

export interface ImageWithDescription {
  src: string
  alt: string
  description: string
  position: 'before' | 'after' | 'inline'
}

export interface DocumentTemplate {
  type: string
  sections: string[]
  style: 'formal' | 'casual' | 'technical'
}

export class ContentGenerator {
  private static readonly DOCUMENT_TEMPLATES: Record<string, DocumentTemplate> = {
    project: {
      type: 'project',
      sections: ['项目概述', '项目背景', '项目目标', '实施计划', '预期成果', '风险评估', '预算估算'],
      style: 'formal'
    },
    report: {
      type: 'report',
      sections: ['摘要', '背景介绍', '主要内容', '分析结果', '结论与建议'],
      style: 'formal'
    },
    plan: {
      type: 'plan',
      sections: ['计划概述', '目标设定', '实施步骤', '时间安排', '资源配置', '预期效果'],
      style: 'formal'
    },
    document: {
      type: 'document',
      sections: ['概述', '详细说明', '注意事项', '参考资料'],
      style: 'casual'
    },
    presentation: {
      type: 'presentation',
      sections: ['标题页', '目录', '主要内容', '总结', '问答环节'],
      style: 'technical'
    }
  }
  
  static async generateDocument(
    topic: string,
    docType: string,
    options?: {
      style?: 'formal' | 'casual' | 'technical'
      length?: 'short' | 'medium' | 'long'
      includeImages?: boolean
    }
  ): Promise<GeneratedContent> {
    const template = this.DOCUMENT_TEMPLATES[docType] || this.DOCUMENT_TEMPLATES.document
    const style = options?.style || template.style
    const length = options?.length || 'medium'
    
    const sections: ContentSection[] = []
    let totalWordCount = 0
    
    for (const sectionTitle of template.sections) {
      const sectionContent = await this.generateSection(
        topic,
        sectionTitle,
        style,
        length
      )
      
      sections.push({
        heading: sectionTitle,
        content: sectionContent,
        level: this.getHeadingLevel(sectionTitle, template.sections)
      })
      
      totalWordCount += sectionContent.length
    }
    
    return {
      title: this.generateTitle(topic, docType),
      sections,
      images: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        topic,
        type: docType,
        wordCount: totalWordCount
      }
    }
  }
  
  static async generateSection(
    topic: string,
    sectionTitle: string,
    style: string,
    length: string
  ): Promise<string> {
    const lengthGuide = {
      short: '100-200字',
      medium: '200-400字',
      long: '400-600字'
    }
    
    const styleGuide = {
      formal: '使用正式、专业的语言风格',
      casual: '使用轻松、易懂的语言风格',
      technical: '使用技术性、精确的语言风格'
    }
    
    const prompt = `请为"${topic}"项目文档的"${sectionTitle}"部分撰写内容。

要求：
- ${styleGuide[style as keyof typeof styleGuide] || styleGuide.formal}
- 字数：${lengthGuide[length as keyof typeof lengthGuide] || lengthGuide.medium}
- 内容要具体、有实际意义
- 避免空洞的套话

请直接输出内容，不要包含标题：`

    try {
      const result = await modelService.generate(prompt, 'local', {
        maxTokens: 1000,
        temperature: 0.7
      })
      
      if (result.success && result.data) {
        return result.data.trim()
      }
      
      return this.generateFallbackContent(topic, sectionTitle)
    } catch (error) {
      console.error('生成内容失败:', error)
      return this.generateFallbackContent(topic, sectionTitle)
    }
  }
  
  static async enrichImage(
    imageSrc: string,
    alt: string,
    context?: string
  ): Promise<ImageWithDescription> {
    const prompt = `请为以下图片生成一段描述性文字。

图片信息：
- 地址: ${imageSrc}
- 替代文本: ${alt}
${context ? `- 上下文: ${context}` : ''}

要求：
- 描述要具体、生动
- 字数：50-100字
- 与文档内容相关

请直接输出描述：`

    try {
      const result = await modelService.generate(prompt, 'local', {
        maxTokens: 200,
        temperature: 0.7
      })
      
      if (result.success && result.data) {
        return {
          src: imageSrc,
          alt,
          description: result.data.trim(),
          position: 'inline'
        }
      }
      
      return {
        src: imageSrc,
        alt,
        description: alt || '图片描述',
        position: 'inline'
      }
    } catch (error) {
      console.error('生成图片描述失败:', error)
      return {
        src: imageSrc,
        alt,
        description: alt || '图片描述',
        position: 'inline'
      }
    }
  }
  
  static async processHTMLContent(
    html: string,
    enrichImages: boolean = true
  ): Promise<{
    htmlContent: HTMLContent
    enrichedImages: ImageWithDescription[]
    wordDocument: string
  }> {
    const htmlContent = HTMLParser.parse(html)
    const enrichedImages: ImageWithDescription[] = []
    
    if (enrichImages && htmlContent.images.length > 0) {
      for (const image of htmlContent.images) {
        const enriched = await this.enrichImage(
          image.src,
          image.alt,
          htmlContent.text.substring(0, 500)
        )
        enrichedImages.push(enriched)
      }
    }
    
    const wordDocument = HTMLParser.convertToWordFormat(htmlContent)
    
    return {
      htmlContent,
      enrichedImages,
      wordDocument
    }
  }
  
  static generateWordDocument(content: GeneratedContent): string {
    let html = ''
    
    html += `<h1>${content.title}</h1>\n`
    
    for (const section of content.sections) {
      const tag = `h${section.level}`
      html += `<${tag}>${section.heading}</${tag}>\n`
      html += `<p>${section.content}</p>\n`
    }
    
    for (const image of content.images) {
      html += `<p><img src="${image.src}" alt="${image.alt}" /></p>\n`
      if (image.description) {
        html += `<p><em>${image.description}</em></p>\n`
      }
    }
    
    return html
  }
  
  static generatePPTContent(content: GeneratedContent): Array<{
    title: string
    content: string[]
    type: 'title' | 'content' | 'image'
  }> {
    const slides: Array<{
      title: string
      content: string[]
      type: 'title' | 'content' | 'image'
    }> = []
    
    slides.push({
      title: content.title,
      content: [content.metadata.topic],
      type: 'title'
    })
    
    for (const section of content.sections) {
      const bulletPoints = this.extractBulletPoints(section.content)
      slides.push({
        title: section.heading,
        content: bulletPoints.length > 0 ? bulletPoints : [section.content.substring(0, 200)],
        type: 'content'
      })
    }
    
    for (const image of content.images) {
      slides.push({
        title: image.alt,
        content: [image.description],
        type: 'image'
      })
    }
    
    return slides
  }
  
  private static generateTitle(topic: string, docType: string): string {
    const typeNames: Record<string, string> = {
      project: '项目书',
      report: '报告',
      plan: '计划书',
      document: '文档',
      presentation: '演示文稿'
    }
    
    const typeName = typeNames[docType] || '文档'
    return `${topic}${typeName}`
  }
  
  private static getHeadingLevel(sectionTitle: string, _allSections: string[]): number {
    const mainSections = ['项目概述', '摘要', '计划概述', '概述', '标题页']
    if (mainSections.includes(sectionTitle)) {
      return 1
    }
    
    const importantSections = ['项目目标', '主要内容', '实施计划', '目标设定']
    if (importantSections.includes(sectionTitle)) {
      return 2
    }
    
    return 3
  }
  
  private static async generateFallbackContent(topic: string, sectionTitle: string): Promise<string> {
    try {
      const doc = await intelligentDocGen.generate(topic, { type: '通用文档', maxLength: 3000 })

      const matchedSection = doc.sections.find(s =>
        s.title === sectionTitle ||
        s.heading.includes(sectionTitle) ||
        sectionTitle.includes(s.title)
      )

      if (matchedSection) {
        return matchedSection.content.join('\n\n')
      }

      return doc.sections[0]?.content.join('\n\n') || `本部分将详细介绍"${topic}"的${sectionTitle}相关内容。`
    } catch {
      const templates: Record<string, string> = {
        '项目概述': `本项目"${topic}"旨在通过系统化的方法实现预定目标。项目将采用先进的技术和管理手段，确保高效、高质量地完成各项任务。具体而言，项目的核心价值体现在三个方面：第一，解决当前领域面临的关键痛点；第二，提供可复制、可推广的解决方案；第三，为后续发展奠定坚实的技术和数据基础。`,
        '项目背景': `随着行业发展和市场需求的变化，"${topic}"成为当前亟需解决的重要课题。从宏观环境来看，政策支持、技术成熟度和市场需求三方面因素共同推动了这一领域的发展。本项目应运而生，旨在应对相关挑战，把握发展机遇。`,
        '项目目标': `本项目的主要目标包括三个层面：战略层面——完成核心功能开发并实现商业化落地；战术层面——达成关键性能指标和用户体验目标；执行层面——确保项目按时、按质、按预算交付。具体量化指标如下：...`,
        '实施计划': `项目将分阶段有序推进：第一阶段（需求分析与方案设计）— 明确范围、识别风险、制定详细计划；第二阶段（核心开发与迭代优化）— 采用敏捷方法，每两周一个迭代周期；第三阶段（测试验收与上线部署）— 全面测试、用户验收、平滑上线。`,
        '预期成果': `项目完成后，将产出完整的"${topic}"解决方案，包括：（1）可交付的产品/系统/文档；（2）完整的技术文档和操作手册；（3）测试报告和质量保证材料；（4）培训材料和知识转移文档。`,
        '摘要': `本文档围绕"${topic}"这一核心主题，系统阐述了背景动因、目标设定、实施方案、资源规划和预期成果等关键要素。全文逻辑清晰、论据充分，可为相关决策提供参考依据。`,
        '背景介绍': `"${topic}"是当前领域的重要研究方向，具有广泛的应用前景和实际价值。从理论层面看，它涉及多个学科的交叉融合；从实践层面看，它能够有效解决现实中的具体问题；从发展趋势看，它代表了未来技术演进的重要方向。`
      }

      return templates[sectionTitle] || `本部分将深入探讨"${topic}"在${sectionTitle}方面的具体内容，包括核心概念、关键要点和实践建议。`
    }
  }
  
  private static extractBulletPoints(content: string): string[] {
    const points: string[] = []
    
    const sentences = content.split(/[。！？\n]+/).filter(s => s.trim().length > 0)
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      if (trimmed.length > 10 && trimmed.length < 100) {
        points.push(trimmed)
      }
      if (points.length >= 5) break
    }
    
    return points
  }
}
