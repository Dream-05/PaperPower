import { describe, it, expect, beforeAll } from 'vitest'
import { skillRegistry } from './skills'
import { initializeSkillHandlers } from './handlers'
import { getOpenClawBridge } from './bridge'

describe('OpenClaw Integration', () => {
  beforeAll(() => {
    initializeSkillHandlers()
  })

  describe('Skill Registry', () => {
    it('should register all skills', () => {
      const allSkills = skillRegistry.getAllSkills()
      expect(allSkills.length).toBeGreaterThan(30)
    })

    it('should categorize skills correctly', () => {
      const categories = skillRegistry.getSkillsByCategory()
      expect(categories['PPT生成'].length).toBeGreaterThan(0)
      expect(categories['Excel处理'].length).toBeGreaterThan(0)
      expect(categories['AI辅助'].length).toBeGreaterThan(0)
    })

    it('should find skill by trigger', () => {
      const skill = skillRegistry.findSkillByTrigger('生成PPT')
      expect(skill).toBeDefined()
      expect(skill?.name).toBe('ppt_generate')
    })

    it('should get skill by name', () => {
      const skill = skillRegistry.getSkill('ppt_generate')
      expect(skill).toBeDefined()
      expect(skill?.name).toBe('ppt_generate')
    })
  })

  describe('Skill Execution', () => {
    it('should execute ppt_generator skill', async () => {
      const result = await skillRegistry.executeSkill('ppt_generator', {
        user_input: '人工智能发展趋势',
        style: 'tech',
        page_count: 10
      })
      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
    })

    it('should execute formula_generator skill', async () => {
      const result = await skillRegistry.executeSkill('formula_generator', {
        user_intent: '计算A列的总和'
      })
      expect(result.success).toBe(true)
      expect((result.output as any).formula).toBeDefined()
    })

    it('should execute data_analyzer skill', async () => {
      const result = await skillRegistry.executeSkill('data_analyzer', {
        data: [10, 20, 30, 40, 50]
      })
      expect(result.success).toBe(true)
      expect((result.output as any).statistics).toBeDefined()
    })

    it('should execute breakeven_analyzer skill', async () => {
      const result = await skillRegistry.executeSkill('breakeven_analyzer', {
        fixed_costs: 10000,
        variable_cost_per_unit: 50,
        price_per_unit: 100
      })
      expect(result.success).toBe(true)
      expect((result.output as any).break_even_units).toBeDefined()
    })

    it('should execute intent_parser skill', async () => {
      const result = await skillRegistry.executeSkill('intent_parser', {
        user_input: '生成一个关于量子计算的科技风格PPT'
      })
      expect(result.success).toBe(true)
      expect((result.output as any).keywords).toBeDefined()
      expect((result.output as any).style).toBeDefined()
    })
  })

  describe('Bridge Service', () => {
    it('should process request locally', async () => {
      const bridge = getOpenClawBridge()
      const response = await bridge.process({
        input: '帮我生成一个PPT',
        type: 'ppt',
        context: { language: 'zh' },
        options: { useOpenClaw: false }
      })
      
      expect(response.success).toBe(true)
      expect(response.source).toBe('local')
      expect(response.thinking).toBeDefined()
      expect(response.thinking!.length).toBeGreaterThan(0)
    })

    it('should include thinking steps', async () => {
      const bridge = getOpenClawBridge()
      const response = await bridge.process({
        input: '分析这份数据',
        type: 'data',
        context: { language: 'zh' },
        options: { useOpenClaw: false }
      })
      
      expect(response.thinking).toBeDefined()
      const thinkingTypes = response.thinking!.map(t => t.type)
      expect(thinkingTypes).toContain('analyze')
      expect(thinkingTypes).toContain('reason')
    })
  })
})
