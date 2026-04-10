import { DocumentStructure, DocumentBlock, ContentExtractor } from './documentIntelligence'

export interface FormatRecommendation {
  type: 'font' | 'size' | 'spacing' | 'margin' | 'alignment' | 'indent' | 'style'
  currentValue: string | number
  recommendedValue: string | number
  reason: string
  confidence: number
  autoApplicable: boolean
}

export interface DocumentStyleProfile {
  name: string
  description: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  titleSize: number
  headingSizes: { h1: number; h2: number; h3: number }
  margins: { top: number; bottom: number; left: number; right: number }
  paragraphSpacing: number
  indent: number
  alignment: 'left' | 'center' | 'justify'
}

export const STYLE_PROFILES: Record<string, DocumentStyleProfile> = {
  official: {
    name: '公文格式',
    description: '符合党政机关公文格式标准',
    fontFamily: 'FangSong, serif',
    fontSize: 16,
    lineHeight: 1.5,
    titleSize: 22,
    headingSizes: { h1: 22, h2: 18, h3: 16 },
    margins: { top: 37, bottom: 35, left: 28, right: 26 },
    paragraphSpacing: 0,
    indent: 2,
    alignment: 'justify'
  },
  academic: {
    name: '学术论文',
    description: '符合学术论文写作规范',
    fontFamily: 'SimSun, serif',
    fontSize: 10.5,
    lineHeight: 1.5,
    titleSize: 18,
    headingSizes: { h1: 16, h2: 14, h3: 12 },
    margins: { top: 25, bottom: 25, left: 30, right: 30 },
    paragraphSpacing: 0,
    indent: 2,
    alignment: 'justify'
  },
  business: {
    name: '商务文档',
    description: '适用于商业报告和合同',
    fontFamily: '"Microsoft YaHei", sans-serif',
    fontSize: 12,
    lineHeight: 1.6,
    titleSize: 18,
    headingSizes: { h1: 16, h2: 14, h3: 12 },
    margins: { top: 25, bottom: 25, left: 25, right: 25 },
    paragraphSpacing: 6,
    indent: 0,
    alignment: 'left'
  },
  education: {
    name: '教育文档',
    description: '适用于教案和教学材料',
    fontFamily: 'SimSun, serif',
    fontSize: 12,
    lineHeight: 1.5,
    titleSize: 18,
    headingSizes: { h1: 16, h2: 14, h3: 12 },
    margins: { top: 25, bottom: 25, left: 25, right: 25 },
    paragraphSpacing: 6,
    indent: 2,
    alignment: 'left'
  },
  resume: {
    name: '个人简历',
    description: '专业简历格式',
    fontFamily: '"Microsoft YaHei", sans-serif',
    fontSize: 10.5,
    lineHeight: 1.4,
    titleSize: 16,
    headingSizes: { h1: 14, h2: 12, h3: 11 },
    margins: { top: 15, bottom: 15, left: 20, right: 20 },
    paragraphSpacing: 4,
    indent: 0,
    alignment: 'left'
  },
  contract: {
    name: '合同协议',
    description: '标准合同格式',
    fontFamily: 'SimSun, serif',
    fontSize: 12,
    lineHeight: 1.5,
    titleSize: 18,
    headingSizes: { h1: 14, h2: 12, h3: 12 },
    margins: { top: 25, bottom: 25, left: 25, right: 25 },
    paragraphSpacing: 0,
    indent: 0,
    alignment: 'justify'
  }
}

export class FormatRecommendationEngine {
  static analyzeAndRecommend(structure: DocumentStructure): FormatRecommendation[] {
    const recommendations: FormatRecommendation[] = []
    const profile = this.selectBestProfile(structure)
    
    recommendations.push(...this.recommendFont(structure, profile))
    recommendations.push(...this.recommendFontSize(structure, profile))
    recommendations.push(...this.recommendLineSpacing(structure, profile))
    recommendations.push(...this.recommendMargins(structure, profile))
    recommendations.push(...this.recommendAlignment(structure, profile))
    recommendations.push(...this.recommendIndent(structure, profile))
    
    return recommendations.filter(r => r.confidence > 0.5)
  }

  static selectBestProfile(structure: DocumentStructure): DocumentStyleProfile {
    const docType = structure.documentType
    
    if (docType === 'official') return STYLE_PROFILES.official
    if (docType === 'academic') return STYLE_PROFILES.academic
    if (docType === 'business') return STYLE_PROFILES.business
    if (docType === 'education') return STYLE_PROFILES.education
    
    const titles = ContentExtractor.extractTitles(structure.blocks)
    const content = structure.blocks.map(b => b.content).join(' ')
    
    if (content.includes('简历') || content.includes('求职') || content.includes('个人简介')) {
      return STYLE_PROFILES.resume
    }
    
    if (content.includes('合同') || content.includes('协议') || content.includes('甲方')) {
      return STYLE_PROFILES.contract
    }
    
    if (titles.length > 5) {
      return STYLE_PROFILES.academic
    }
    
    return STYLE_PROFILES.business
  }

  private static recommendFont(structure: DocumentStructure, profile: DocumentStyleProfile): FormatRecommendation[] {
    const recommendations: FormatRecommendation[] = []
    
    const currentFonts = new Set<string>()
    structure.blocks.forEach(block => {
      if (block.metadata?.fontFamily) {
        currentFonts.add(block.metadata.fontFamily)
      }
    })
    
    if (currentFonts.size > 3) {
      recommendations.push({
        type: 'font',
        currentValue: Array.from(currentFonts).join(', '),
        recommendedValue: profile.fontFamily,
        reason: '文档使用了过多字体，建议统一使用标准字体',
        confidence: 0.8,
        autoApplicable: true
      })
    }
    
    const content = structure.blocks.map(b => b.content).join('')
    const chineseRatio = (content.match(/[\u4e00-\u9fa5]/g) || []).length / content.length
    
    if (chineseRatio > 0.5) {
      const hasChineseFont = Array.from(currentFonts).some(f => 
        f.includes('SimSun') || f.includes('宋体') || f.includes('FangSong') || 
        f.includes('仿宋') || f.includes('SimHei') || f.includes('黑体') ||
        f.includes('KaiTi') || f.includes('楷体') || f.includes('YaHei') || f.includes('雅黑')
      )
      
      if (!hasChineseFont) {
        recommendations.push({
          type: 'font',
          currentValue: Array.from(currentFonts)[0] || 'unknown',
          recommendedValue: profile.fontFamily,
          reason: '中文文档建议使用中文字体',
          confidence: 0.9,
          autoApplicable: true
        })
      }
    }
    
    return recommendations
  }

  private static recommendFontSize(structure: DocumentStructure, profile: DocumentStyleProfile): FormatRecommendation[] {
    const recommendations: FormatRecommendation[] = []
    
    const sizes: number[] = []
    structure.blocks.forEach(block => {
      if (block.metadata?.fontSize) {
        sizes.push(block.metadata.fontSize)
      }
    })
    
    if (sizes.length === 0) return recommendations
    
    const minSize = Math.min(...sizes)
    const maxSize = Math.max(...sizes)
    
    if (minSize < 9) {
      recommendations.push({
        type: 'size',
        currentValue: minSize,
        recommendedValue: profile.fontSize,
        reason: '存在过小的字号，可能影响阅读',
        confidence: 0.85,
        autoApplicable: true
      })
    }
    
    if (maxSize > 28 && structure.documentType !== 'official') {
      recommendations.push({
        type: 'size',
        currentValue: maxSize,
        recommendedValue: profile.titleSize,
        reason: '存在过大的字号，建议调整标题大小',
        confidence: 0.7,
        autoApplicable: false
      })
    }
    
    const sizeVariance = this.calculateVariance(sizes)
    if (sizeVariance > 50) {
      recommendations.push({
        type: 'size',
        currentValue: `变化范围: ${minSize}-${maxSize}pt`,
        recommendedValue: `标准: ${profile.fontSize}pt, 标题: ${profile.titleSize}pt`,
        reason: '字号变化过大，建议统一规范',
        confidence: 0.75,
        autoApplicable: false
      })
    }
    
    return recommendations
  }

  private static recommendLineSpacing(structure: DocumentStructure, profile: DocumentStyleProfile): FormatRecommendation[] {
    const recommendations: FormatRecommendation[] = []
    
    const paragraphs = ContentExtractor.extractParagraphs(structure.blocks)
    if (paragraphs.length < 3) return recommendations
    
    const avgLength = paragraphs.reduce((sum, p) => sum + p.content.length, 0) / paragraphs.length
    
    if (avgLength > 100 && profile.lineHeight < 1.5) {
      recommendations.push({
        type: 'spacing',
        currentValue: profile.lineHeight,
        recommendedValue: 1.5,
        reason: '长段落文档建议使用1.5倍行距',
        confidence: 0.8,
        autoApplicable: true
      })
    }
    
    if (avgLength < 50 && profile.lineHeight > 1.5) {
      recommendations.push({
        type: 'spacing',
        currentValue: profile.lineHeight,
        recommendedValue: 1.3,
        reason: '短段落文档可使用较小行距',
        confidence: 0.6,
        autoApplicable: true
      })
    }
    
    return recommendations
  }

  private static recommendMargins(structure: DocumentStructure, profile: DocumentStyleProfile): FormatRecommendation[] {
    const recommendations: FormatRecommendation[] = []
    const margins = structure.layout.margins
    
    const totalHorizontal = margins.left + margins.right
    
    if (totalHorizontal < 40) {
      recommendations.push({
        type: 'margin',
        currentValue: `左右边距: ${margins.left}/${margins.right}mm`,
        recommendedValue: `${profile.margins.left}/${profile.margins.right}mm`,
        reason: '页边距过小，可能影响打印效果',
        confidence: 0.85,
        autoApplicable: true
      })
    }
    
    if (totalHorizontal > 80) {
      recommendations.push({
        type: 'margin',
        currentValue: `左右边距: ${margins.left}/${margins.right}mm`,
        recommendedValue: `${profile.margins.left}/${profile.margins.right}mm`,
        reason: '页边距过大，可能浪费纸张空间',
        confidence: 0.7,
        autoApplicable: true
      })
    }
    
    return recommendations
  }

  private static recommendAlignment(structure: DocumentStructure, profile: DocumentStyleProfile): FormatRecommendation[] {
    const recommendations: FormatRecommendation[] = []
    
    const alignments: Record<string, number> = {}
    structure.blocks.forEach(block => {
      if (block.metadata?.alignment) {
        alignments[block.metadata.alignment] = (alignments[block.metadata.alignment] || 0) + 1
      }
    })
    
    const totalBlocks = Object.values(alignments).reduce((a, b) => a + b, 0)
    if (totalBlocks === 0) return recommendations
    
    const centerRatio = (alignments['center'] || 0) / totalBlocks
    
    if (centerRatio > 0.3 && profile.alignment !== 'center') {
      recommendations.push({
        type: 'alignment',
        currentValue: '居中对齐',
        recommendedValue: profile.alignment === 'justify' ? '两端对齐' : profile.alignment,
        reason: '正文内容建议使用左对齐或两端对齐',
        confidence: 0.75,
        autoApplicable: false
      })
    }
    
    return recommendations
  }

  private static recommendIndent(structure: DocumentStructure, profile: DocumentStyleProfile): FormatRecommendation[] {
    const recommendations: FormatRecommendation[] = []
    
    const paragraphs = ContentExtractor.extractParagraphs(structure.blocks)
    const indentedCount = paragraphs.filter(p => 
      p.metadata?.indent && p.metadata.indent > 0
    ).length
    
    if (profile.indent > 0 && indentedCount < paragraphs.length * 0.5) {
      recommendations.push({
        type: 'indent',
        currentValue: '无缩进',
        recommendedValue: `${profile.indent}字符`,
        reason: '中文文档建议使用首行缩进',
        confidence: 0.8,
        autoApplicable: true
      })
    }
    
    return recommendations
  }

  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  }

  static generateFormatReport(structure: DocumentStructure): string {
    const recommendations = this.analyzeAndRecommend(structure)
    const profile = this.selectBestProfile(structure)
    
    let report = `# 文档格式分析报告\n\n`
    report += `## 基本信息\n`
    report += `- 文档类型: ${this.getDocumentTypeName(structure.documentType)}\n`
    report += `- 语言: ${structure.language === 'zh' ? '中文' : '英文'}\n`
    report += `- 字数: ${structure.wordCount}\n`
    report += `- 字符数: ${structure.charCount}\n\n`
    
    report += `## 推荐格式配置\n`
    report += `- 字体: ${profile.fontFamily.split(',')[0]}\n`
    report += `- 正文字号: ${profile.fontSize}pt\n`
    report += `- 标题字号: ${profile.titleSize}pt\n`
    report += `- 行距: ${profile.lineHeight}倍\n`
    report += `- 页边距: ${profile.margins.top}/${profile.margins.right}/${profile.margins.bottom}/${profile.margins.left} mm\n\n`
    
    if (recommendations.length > 0) {
      report += `## 格式建议\n`
      recommendations.forEach((rec, index) => {
        report += `${index + 1}. **${this.getRecommendationTypeName(rec.type)}**\n`
        report += `   - 当前: ${rec.currentValue}\n`
        report += `   - 建议: ${rec.recommendedValue}\n`
        report += `   - 原因: ${rec.reason}\n`
        report += `   - 置信度: ${(rec.confidence * 100).toFixed(0)}%\n\n`
      })
    } else {
      report += `## 格式建议\n`
      report += `文档格式良好，无需调整。\n`
    }
    
    return report
  }

  private static getDocumentTypeName(type: string): string {
    const names: Record<string, string> = {
      official: '公文',
      academic: '学术论文',
      business: '商务文档',
      personal: '个人文档',
      education: '教育文档',
      unknown: '未知'
    }
    return names[type] || type
  }

  private static getRecommendationTypeName(type: string): string {
    const names: Record<string, string> = {
      font: '字体',
      size: '字号',
      spacing: '行距',
      margin: '页边距',
      alignment: '对齐方式',
      indent: '缩进',
      style: '样式'
    }
    return names[type] || type
  }
}

export class AutoFormatter {
  static applyProfile(structure: DocumentStructure, profile: DocumentStyleProfile): string {
    const blocks = structure.blocks.map(block => {
      return this.formatBlock(block, profile)
    })
    
    return blocks.join('\n')
  }

  private static formatBlock(block: DocumentBlock, profile: DocumentStyleProfile): string {
    let style = ''
    let tag = 'p'
    
    switch (block.type) {
      case 'title':
        tag = 'h1'
        style = `font-family: ${profile.fontFamily}; font-size: ${profile.titleSize}pt; text-align: center; font-weight: bold;`
        break
      case 'heading1':
        tag = 'h1'
        style = `font-family: ${profile.fontFamily}; font-size: ${profile.headingSizes.h1}pt; font-weight: bold;`
        break
      case 'heading2':
        tag = 'h2'
        style = `font-family: ${profile.fontFamily}; font-size: ${profile.headingSizes.h2}pt; font-weight: bold;`
        break
      case 'heading3':
        tag = 'h3'
        style = `font-family: ${profile.fontFamily}; font-size: ${profile.headingSizes.h3}pt; font-weight: bold;`
        break
      case 'paragraph':
        tag = 'p'
        style = `font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}pt; line-height: ${profile.lineHeight}; text-align: ${profile.alignment};`
        if (profile.indent > 0) {
          style += ` text-indent: ${profile.indent}em;`
        }
        break
      case 'list':
        tag = 'li'
        style = `font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}pt; line-height: ${profile.lineHeight};`
        break
      default:
        tag = 'p'
        style = `font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}pt;`
    }
    
    return `<${tag} style="${style}">${block.content}</${tag}>`
  }

  static generateCSS(profile: DocumentStyleProfile): string {
    return `
body {
  font-family: ${profile.fontFamily};
  font-size: ${profile.fontSize}pt;
  line-height: ${profile.lineHeight};
  margin: ${profile.margins.top}mm ${profile.margins.right}mm ${profile.margins.bottom}mm ${profile.margins.left}mm;
}

h1 {
  font-size: ${profile.titleSize}pt;
  font-weight: bold;
  text-align: center;
  margin-bottom: 1em;
}

h2 {
  font-size: ${profile.headingSizes.h1}pt;
  font-weight: bold;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

h3 {
  font-size: ${profile.headingSizes.h2}pt;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

p {
  text-align: ${profile.alignment};
  ${profile.indent > 0 ? `text-indent: ${profile.indent}em;` : ''}
  margin-bottom: ${profile.paragraphSpacing}pt;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

td, th {
  border: 1px solid #000;
  padding: 5px;
  font-size: ${profile.fontSize}pt;
}

th {
  font-weight: bold;
  background-color: #f0f0f0;
}
    `.trim()
  }
}
