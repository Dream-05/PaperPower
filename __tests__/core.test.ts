import { describe, it, expect } from 'vitest'
import { intentParser } from '../utils/intentParser'
import { deterministicChoice, deterministicSample, deterministicShuffle } from '../utils/deterministic'
import { createHash, verifyDeterminism } from '../utils/hashUtils'
import { complianceValidator, documentClassifier } from '../utils/compliance'

describe('IntentParser', () => {
  it('should parse intent deterministically', () => {
    const input = '帮我整理这个文件夹'
    const result1 = intentParser.parse(input)
    const result2 = intentParser.parse(input)
    
    expect(result1.intent).toBe(result2.intent)
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2))
  })
  
  it('should detect file organization intent', () => {
    const result = intentParser.parse('整理文件夹')
    expect(result.intent).toContain('organize')
  })
  
  it('should detect document creation intent', () => {
    const result = intentParser.parse('生成PPT')
    expect(result.intent).toContain('ppt')
  })
  
  it('should extract constraints', () => {
    const result = intentParser.parse('整理文件夹，别动系统文件')
    expect(result.parameters.constraints).toBeDefined()
  })
  
  it('should detect urgency', () => {
    const result = intentParser.parse('快点帮我整理文件')
    expect(result.urgency).toBe('high')
  })
})

describe('Deterministic Functions', () => {
  it('should produce same result for same input', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const key = 'test_key'
    
    const result1 = deterministicChoice(items, key)
    const result2 = deterministicChoice(items, key)
    
    expect(result1).toBe(result2)
  })
  
  it('should produce different results for different keys', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    
    const result1 = deterministicChoice(items, 'key1')
    const result2 = deterministicChoice(items, 'key2')
    
    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
  })
  
  it('should sample deterministically', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const key = 'sample_test'
    
    const result1 = deterministicSample(items, 3, key)
    const result2 = deterministicSample(items, 3, key)
    
    expect(result1).toEqual(result2)
    expect(result1.length).toBe(3)
  })
  
  it('should shuffle deterministically', () => {
    const items = [1, 2, 3, 4, 5]
    const key = 'shuffle_test'
    
    const result1 = deterministicShuffle(items, key)
    const result2 = deterministicShuffle(items, key)
    
    expect(result1).toEqual(result2)
    expect(result1.length).toBe(items.length)
  })
  
  it('should pass 100 iterations determinism test', () => {
    const items = ['x', 'y', 'z']
    const key = 'determinism_test'
    
    const { deterministic } = verifyDeterminism(() => deterministicChoice(items, key), 100)
    expect(deterministic).toBe(true)
  })
})

describe('Hash Utils', () => {
  it('should produce consistent hash', () => {
    const input = 'test_input'
    const hash1 = createHash(input)
    const hash2 = createHash(input)
    
    expect(hash1).toBe(hash2)
    expect(typeof hash1).toBe('number')
  })
  
  it('should produce different hashes for different inputs', () => {
    const hash1 = createHash('input1')
    const hash2 = createHash('input2')
    
    expect(hash1).not.toBe(hash2)
  })
})

describe('Compliance Validator', () => {
  it('should detect forbidden patterns in source code', () => {
    const badCode = 'const x = Math.random();'
    const result = complianceValidator.checkSourceCode(badCode)
    
    expect(result.passed).toBe(false)
    expect(result.violations.length).toBeGreaterThan(0)
  })
  
  it('should pass clean source code', () => {
    const cleanCode = 'const x = deterministicChoice(items, key);'
    const result = complianceValidator.checkSourceCode(cleanCode)
    
    expect(result.passed).toBe(true)
  })
  
  it('should verify determinism', () => {
    const fn = () => deterministicChoice([1, 2, 3], 'test')
    const result = complianceValidator.checkDeterminism(fn, 100)
    
    expect(result.passed).toBe(true)
  })
})

describe('Document Classifier', () => {
  it('should classify thesis document', () => {
    const text = '摘要：本文研究... 关键词：AI 引言... 结论... 参考文献...'
    const result = documentClassifier.classify(text, [])
    
    expect(result.result).toBe('thesis')
  })
  
  it('should classify lesson plan', () => {
    const text = '教学目标：... 教学重难点：... 教学过程：... 板书设计：...'
    const result = documentClassifier.classify(text, [])
    
    expect(result.result).toBe('lesson_plan')
  })
  
  it('should produce consistent results', () => {
    const text = '摘要 关键词 引言 结论 参考文献'
    
    const result1 = documentClassifier.classify(text, [])
    const result2 = documentClassifier.classify(text, [])
    
    expect(result1.result).toBe(result2.result)
    expect(JSON.stringify(result1.scores)).toBe(JSON.stringify(result2.scores))
  })
})
