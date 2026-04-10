import { describe, it, expect } from 'vitest';
import { createInstructionExecutor } from '../utils/documentAI/INSTRUCTION_EXECUTOR';

describe('DocumentAI', () => {
  it('should generate AI project introduction with images', () => {
    // 测试用户的命令
    const userCommand = '帮我写一个关于AI的项目介绍书，包含图片，图片可以去网上找';
    
    // 创建指令执行器
    const executor = createInstructionExecutor('');
    
    // 执行命令
    const result = executor.executeComplexInstruction(userCommand);
    
    // 验证执行结果
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].message).toContain('已为您生成包含图片的AI项目介绍书');
    
    // 验证生成的内容
    const generatedContent = executor.getDocumentContent();
    expect(generatedContent).toContain('# AI项目介绍书');
    expect(generatedContent).toContain('![AI技术架构图]');
    expect(generatedContent).toContain('![AI核心功能]');
  });
  
  it('should generate AI project introduction without images', () => {
    // 测试用户的命令
    const userCommand = '帮我写一个关于AI的项目介绍书';
    
    // 创建指令执行器
    const executor = createInstructionExecutor('');
    
    // 执行命令
    const result = executor.executeComplexInstruction(userCommand);
    
    // 验证执行结果
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].message).toContain('已为您生成AI项目介绍书');
    
    // 验证生成的内容
    const generatedContent = executor.getDocumentContent();
    expect(generatedContent).toContain('# AI项目介绍书');
    expect(generatedContent).not.toContain('![AI技术架构图]');
  });
});
