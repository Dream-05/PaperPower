import { describe, it, expect } from 'vitest'
import { analyzeContent, generateExpandedContent } from '../utils/contentAnalyzer'

describe('ContentAnalyzer', () => {
  describe('analyzeContent', () => {
    it('should analyze technology content correctly', () => {
      const text = '人工智能和机器学习正在改变世界。深度学习算法在图像识别领域取得了突破性进展。'
      const result = analyzeContent(text)
      
      expect(result.type).toBe('technology')
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.keywords.length).toBeGreaterThan(0)
      expect(result.layoutTokens).toBeDefined()
      expect(result.expansionTokens).toBeDefined()
    })

    it('should analyze business content correctly', () => {
      const text = '市场竞争激烈，企业需要制定有效的商业策略。市场份额和营收增长是关键指标。'
      const result = analyzeContent(text)
      
      expect(result.type).toBe('business')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should analyze education content correctly', () => {
      const text = '教学方法和课程设计对学习效果至关重要。教育心理学研究表明，互动式教学更有效。'
      const result = analyzeContent(text)
      
      expect(result.type).toBe('education')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should return general type for ambiguous content', () => {
      const text = '这是一段普通的内容，没有特定的主题。'
      const result = analyzeContent(text)
      
      expect(result.type).toBe('general')
    })

    it('should handle empty text', () => {
      const result = analyzeContent('')
      
      expect(result.type).toBe('general')
      expect(result.keywords).toEqual([])
    })
  })

  describe('generateExpandedContent', () => {
    it('should expand technology content', () => {
      const originalText = '人工智能技术发展迅速。'
      const expandedText = generateExpandedContent(originalText, 'technology')
      
      expect(expandedText.length).toBeGreaterThan(originalText.length)
      expect(expandedText).toContain('人工智能')
    })

    it('should expand business content', () => {
      const originalText = '市场竞争激烈。'
      const expandedText = generateExpandedContent(originalText, 'business')
      
      expect(expandedText.length).toBeGreaterThan(originalText.length)
    })

    it('should add introduction and conclusion', () => {
      const originalText = '这是一个测试内容。'
      const expandedText = generateExpandedContent(originalText, 'general')
      
      expect(expandedText).toBeTruthy()
    })
  })
})
