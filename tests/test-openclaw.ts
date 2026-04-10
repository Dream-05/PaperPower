import { skillRegistry } from '../src/utils/openclaw/skills'
import { initializeSkillHandlers } from '../src/utils/openclaw/handlers'
import { getOpenClawBridge } from '../src/utils/openclaw/bridge'

async function testIntegration() {
  console.log('🧪 智办AI OpenClaw 集成测试\n')
  console.log('='.repeat(60))

  console.log('\n📋 1. 技能注册测试')
  console.log('-'.repeat(60))
  
  const allSkills = skillRegistry.getAllSkills()
  console.log(`✅ 已注册技能数量: ${allSkills.length}`)
  
  const categories = skillRegistry.getSkillsByCategory()
  console.log('\n技能分类:')
  for (const [category, skills] of Object.entries(categories)) {
    console.log(`  ${category}: ${skills.length}个`)
  }

  console.log('\n\n🔧 2. 技能处理器初始化测试')
  console.log('-'.repeat(60))
  initializeSkillHandlers()
  console.log('✅ 技能处理器初始化完成')

  console.log('\n\n🎯 3. 技能匹配测试')
  console.log('-'.repeat(60))
  
  const testInputs = [
    '帮我生成一个关于AI的PPT',
    '写一篇关于环保的文章',
    '帮我写一个Excel公式计算总和',
    '搜索关于人工智能的资料',
    '分析这份数据'
  ]

  for (const input of testInputs) {
    const matchedSkills = skillRegistry.findMatchingSkills(input)
    console.log(`\n输入: "${input}"`)
    if (matchedSkills.length > 0) {
      console.log(`匹配: ${matchedSkills.map(s => s.name).join(', ')}`)
    } else {
      console.log('未匹配到技能')
    }
  }

  console.log('\n\n⚡ 4. 技能执行测试')
  console.log('-'.repeat(60))

  const testCases = [
    { skill: 'ppt_generator', args: { user_input: '人工智能发展趋势', style: 'tech', page_count: 10 } },
    { skill: 'formula_generator', args: { user_intent: '计算A列的总和' } },
    { skill: 'intent_parser', args: { user_input: '生成一个关于量子计算的科技风格PPT' } },
    { skill: 'data_analyzer', args: { data: [10, 20, 30, 40, 50] } },
    { skill: 'breakeven_analyzer', args: { fixed_costs: 10000, variable_cost_per_unit: 50, price_per_unit: 100 } }
  ]

  for (const { skill, args } of testCases) {
    console.log(`\n执行: ${skill}`)
    console.log(`参数: ${JSON.stringify(args)}`)
    
    try {
      const result = await skillRegistry.executeSkill(skill, args)
      if (result.success) {
        console.log(`✅ 成功`)
        console.log(`输出: ${JSON.stringify(result.output).substring(0, 100)}...`)
      } else {
        console.log(`❌ 失败: ${result.error}`)
      }
    } catch (error) {
      console.log(`❌ 错误: ${error}`)
    }
  }

  console.log('\n\n🌉 5. 桥接服务测试 (本地模式)')
  console.log('-'.repeat(60))

  const bridge = getOpenClawBridge()
  
  const bridgeTests = [
    { input: '帮我生成一个PPT', type: 'ppt' as const },
    { input: '分析这份数据', type: 'data' as const },
    { input: '写一篇文章', type: 'text' as const }
  ]

  for (const { input, type } of bridgeTests) {
    console.log(`\n处理: "${input}" (类型: ${type})`)
    
    try {
      const response = await bridge.process({
        input,
        type,
        context: { language: 'zh' },
        options: { useOpenClaw: false }
      })
      
      console.log(`✅ 成功: ${response.success}`)
      console.log(`来源: ${response.source}`)
      console.log(`状态: ${response.state}`)
      if (response.thinking && response.thinking.length > 0) {
        console.log('思考步骤:')
        response.thinking.slice(0, 3).forEach(t => {
          console.log(`  [${t.type}] ${t.description}`)
        })
      }
    } catch (error) {
      console.log(`❌ 错误: ${error}`)
    }
  }

  console.log('\n\n' + '='.repeat(60))
  console.log('✅ 所有测试完成!')
  console.log('='.repeat(60))
}

testIntegration().catch(console.error)
