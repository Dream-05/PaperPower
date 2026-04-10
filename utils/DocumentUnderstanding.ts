// intelligentEngine 可用于未来扩展

export interface DocumentAnalysis {
  type: 'word' | 'excel' | 'ppt'
  wordCount?: number
  paragraphCount?: number
  headingCount?: number
  imageCount?: number
  tableCount?: number
  chartCount?: number
  slideCount?: number
  complexity: 'simple' | 'medium' | 'complex'
  topics: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  keyPoints: string[]
  suggestions: string[]
}

export function analyzeDocument(content: string, type: DocumentAnalysis['type']): DocumentAnalysis {
  const analysis: DocumentAnalysis = {
    type,
    complexity: 'medium',
    topics: [],
    sentiment: 'neutral',
    keyPoints: [],
    suggestions: []
  }

  if (type === 'word') {
    analysis.wordCount = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => w.length > 0).length
    analysis.paragraphCount = (content.match(/<p/g) || []).length
    analysis.headingCount = (content.match(/<h[1-6]/g) || []).length
    analysis.imageCount = (content.match(/<img/g) || []).length
    analysis.tableCount = (content.match(/<table/g) || []).length
  } else if (type === 'ppt') {
    analysis.slideCount = (content.match(/<slide/g) || []).length
    analysis.imageCount = (content.match(/<img/g) || []).length
  }

  const complexityScore = (analysis.wordCount || 0) / 1000 + 
                         (analysis.paragraphCount || 0) / 10 + 
                         (analysis.headingCount || 0) / 5
  
  if (complexityScore < 5) {
    analysis.complexity = 'simple'
  } else if (complexityScore < 15) {
    analysis.complexity = 'medium'
  } else {
    analysis.complexity = 'complex'
  }

  analysis.topics = extractTopics(content)
  analysis.keyPoints = extractKeyPoints(content)
  analysis.suggestions = generateSuggestions(analysis)

  return analysis
}

function extractTopics(content: string): string[] {
  const topics: string[] = []
  const text = content.replace(/<[^>]*>/g, ' ').toLowerCase()
  
  const topicKeywords: Record<string, string[]> = {
    business: ['business', 'company', 'market', 'strategy', '商业', '公司', '市场'],
    technology: ['technology', 'software', 'ai', 'digital', '技术', '软件', '人工智能'],
    finance: ['finance', 'budget', 'revenue', 'profit', '财务', '预算', '收入'],
    education: ['education', 'learning', 'student', 'teaching', '教育', '学习', '学生'],
    health: ['health', 'medical', 'patient', 'treatment', '健康', '医疗', '治疗']
  }

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(k => text.includes(k))) {
      topics.push(topic)
    }
  }

  return topics.length > 0 ? topics : ['general']
}

function extractKeyPoints(content: string): string[] {
  const text = content.replace(/<[^>]*>/g, ' ')
  const sentences = text.split(/[.。.!?!?]/).filter(s => s.trim().length > 20)
  
  const keyIndicators = ['important', 'key', 'critical', 'essential', '必须', '关键', '重要', '首先', '其次']
  const keyPoints = sentences
    .filter(s => keyIndicators.some(k => s.toLowerCase().includes(k)))
    .slice(0, 5)
    .map(s => s.trim())

  return keyPoints.length > 0 ? keyPoints : sentences.slice(0, 3).map(s => s.trim())
}

function generateSuggestions(analysis: DocumentAnalysis): string[] {
  const suggestions: string[] = []

  if (analysis.complexity === 'complex' && !analysis.headingCount) {
    suggestions.push('建议添加标题以改善文档结构')
  }

  if ((analysis.wordCount || 0) > 2000 && !analysis.tableCount) {
    suggestions.push('考虑使用表格整理数据以提高可读性')
  }

  if (analysis.type === 'ppt' && (analysis.slideCount || 0) > 10) {
    suggestions.push('演示文稿较长，建议添加目录页')
  }

  if (analysis.topics.includes('finance') || analysis.topics.includes('business')) {
    suggestions.push('建议添加图表展示关键数据')
  }

  return suggestions
}

export function getDocumentSummary(analysis: DocumentAnalysis): string {
  const summary: string[] = []

  if (analysis.wordCount) {
    summary.push(`共${analysis.wordCount}字`)
  }

  if (analysis.paragraphCount) {
    summary.push(`${analysis.paragraphCount}段`)
  }

  if (analysis.headingCount) {
    summary.push(`${analysis.headingCount}个标题`)
  }

  summary.push(`复杂度：${analysis.complexity === 'simple' ? '简单' : analysis.complexity === 'medium' ? '中等' : '复杂'}`)

  if (analysis.topics.length > 0) {
    summary.push(`主题：${analysis.topics.join(', ')}`)
  }

  return summary.join(' · ')
}
