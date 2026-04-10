import { skillRegistry, initializeSkillHandlers } from '../src/utils/openclaw/skills'
import { quickProcess, getOpenClawBridge } from '../src/utils/openclaw'

async function testOpenClawIntegration() {
  console.log('🧪 开始测试 OpenClaw 集成...\n')

  console.log('📋 1. 测试技能注册')
  console.log('='.repeat(50))
  
  const allSkills = skillRegistry.getAllSkills()
  console.log(`已注册技能数量: ${allSkills.length}`)
  
  const categories = skillRegistry.getSkillsByCategory()
  for (const [category, skills] of Object.entries(categories)) {
    console.log(`\n${category} (${skills.length}个):`)
    skills.forEach(s => console.log(`  - ${s.name}: ${s.description}`))
  }

  console.log('\n\n🔧 2. 测试技能处理器初始化')
  console.log('='.repeat(50))
  initializeSkillHandlers()

  console.log('\n\n🎯 3. 测试技能匹配')
  console.log('='.repeat(50))
  
  const testInputs = [
    '帮我生成一个关于AI的PPT',
    '写一篇关于环保的文章',
    '帮我生成一个Excel公式计算总和',
    '搜索关于人工智能的资料',
    '分析这份数据'
  ]

  for (const input of testInputs) {
    const matchedSkills = skillRegistry.findMatchingSkills(input)
    console.log(`\n输入: "${input}"`)
    if (matchedSkills.length > 0) {
      console.log(`匹配技能: ${matchedSkills.map(s => s.name).join(', ')}`)
    } else {
      console.log('未匹配到技能')
    }
  }

  console.log('\n\n⚡ 4. 测试技能执行')
  console.log('='.repeat(50))

  const testCases = [
    { skill: 'ppt_generator', args: { user_input: '人工智能发展趋势', style: 'tech', page_count: 10 } },
    { skill: 'formula_generator', args: { user_intent: '计算A列的总和' } },
    { skill: 'intent_parser', args: { user_input: '生成一个关于量子计算的科技风格PPT' } },
    { skill: 'data_analyzer', args: { data: [10, 20, 30, 40, 50] } },
    { skill: 'breakeven_analyzer', args: { fixed_costs: 10000, variable_cost_per_unit: 50, price_per_unit: 100 } }
  ]

  for (const { skill, args } of testCases) {
    console.log(`\n执行技能: ${skill}`)
    console.log(`参数: ${JSON.stringify(args)}`)
    
    try {
      const result = await skillRegistry.executeSkill(skill, args)
      console.log(`结果: ${JSON.stringify(result, null, 2)}`)
    } catch (error) {
      console.log(`错误: ${error}`)
    }
  }

  console.log('\n\n🌉 5. 测试桥接服务 (本地模式)')
  console.log('='.repeat(50))

  const bridge = getOpenClawBridge()
  
  const bridgeTestInputs = [
    { input: '帮我生成一个PPT', type: 'ppt' as const },
    { input: '分析这份数据', type: 'data' as const },
    { input: '写一篇文章', type: 'text' as const }
  ]

  for (const { input, type } of bridgeTestInputs) {
    console.log(`\n处理请求: "${input}" (类型: ${type})`)
    
    try {
      const response = await bridge.process({
        input,
        type,
        context: { language: 'zh' },
        options: { useOpenClaw: false }
      })
      
      console.log(`成功: ${response.success}`)
      console.log(`来源: ${response.source}`)
      console.log(`状态: ${response.state}`)
      if (response.thinking && response.thinking.length > 0) {
        console.log('思考过程:')
        response.thinking.forEach(t => {
          console.log(`  [${t.type}] ${t.description}: ${t.result}`)
        })
      }
    } catch (error) {
      console.log(`错误: ${error}`)
    }
  }

  console.log('\n\n✅ 测试完成!')
}

testOpenClawIntegration().catch(console.error)
