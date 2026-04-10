import { OpenClawBridge, getOpenClawBridge, initializeBridge } from './bridge'
import { OpenClawClient, getOpenClawClient, initializeOpenClaw } from './client'
import { skillRegistry } from './skills'
import { initializeSkillHandlers } from './handlers'
import { DEFAULT_CONFIG, ZHIBAN_SKILLS } from './types'

// 导出所有类型和函数
export * from './types'
export * from './client'
export * from './skills'
export * from './handlers'
export * from './bridge'

// 重新导出命名导出以确保一致性
export {
  OpenClawBridge,
  getOpenClawBridge,
  initializeBridge,
  OpenClawClient,
  getOpenClawClient,
  initializeOpenClaw,
  skillRegistry,
  initializeSkillHandlers,
  DEFAULT_CONFIG,
  ZHIBAN_SKILLS
}

export async function quickProcess(input: string, options?: {
  type?: 'text' | 'document' | 'data' | 'command' | 'ppt' | 'excel' | 'word'
  language?: 'zh' | 'en'
  useOpenClaw?: boolean
}): Promise<{
  success: boolean
  content: string
  thinking?: Array<{ type: string; description: string; result: string }>
}> {
  const bridge = getOpenClawBridge()
  
  if (!bridge.isReady()) {
    await bridge.initialize()
  }
  
  const response = await bridge.process({
    input,
    type: options?.type || 'text',
    context: {
      language: options?.language || 'zh'
    },
    options: {
      useOpenClaw: options?.useOpenClaw
    }
  })
  
  return {
    success: response.success,
    content: response.content,
    thinking: response.thinking
  }
}
