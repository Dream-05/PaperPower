import { initializeBridge } from './openclaw/bridge'
import { aiService } from './aiService'
import { modelService } from './localAI/ModelService'
import { initializeSkillHandlers } from './openclaw/handlers'

export async function initializeSystem(): Promise<void> {
  console.log('开始系统初始化...')
  
  try {
    // 1. 初始化技能处理器
    console.log('初始化技能处理器...')
    initializeSkillHandlers()
    console.log('技能处理器初始化完成')
    
    // 2. 初始化OpenClaw桥接器
    console.log('初始化OpenClaw桥接器...')
    await initializeBridge()
    console.log('OpenClaw桥接器初始化完成')
    
    // 3. 初始化AI服务
    console.log('初始化AI服务...')
    await aiService.initialize()
    console.log('AI服务初始化完成')
    
    // 4. 初始化模型服务
    console.log('初始化模型服务...')
    await modelService.initialize()
    console.log('模型服务初始化完成')
    
    console.log('系统初始化完成！')
  } catch (error) {
    console.error('系统初始化失败:', error)
  }
}

export async function checkSystemStatus(): Promise<{
  openClaw: boolean
  aiService: boolean
  modelService: boolean
}> {
  return {
    openClaw: aiService.isOpenClawReady(),
    aiService: true, // AI服务总是可用的，即使OpenClaw失败
    modelService: true // 模型服务总是可用的，即使本地模型失败
  }
}