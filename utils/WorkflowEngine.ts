export interface WorkflowStep {
  id: string
  name: string
  type: 'action' | 'condition' | 'loop' | 'wait'
  action: string
  params: Record<string, any>
  nextStep?: string
  condition?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  trigger: 'manual' | 'auto' | 'scheduled'
  steps: WorkflowStep[]
  active: boolean
  lastRun?: Date
  successCount: number
  failureCount: number
}

export interface WorkflowContext {
  documentType: 'word' | 'excel' | 'ppt'
  content: string
  variables: Record<string, any>
  results: Array<{ stepId: string; result: any }>
}

export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map()
  private runningWorkflows: Set<string> = new Set()

  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow)
  }

  async executeWorkflow(workflowId: string, context: WorkflowContext): Promise<boolean> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow || !workflow.active) {
      return false
    }

    if (this.runningWorkflows.has(workflowId)) {
      console.warn(`Workflow ${workflowId} is already running`)
      return false
    }

    this.runningWorkflows.add(workflowId)

    try {
      let currentStepId = workflow.steps[0]?.id

      while (currentStepId) {
        const step = workflow.steps.find(s => s.id === currentStepId)
        if (!step) break

        const result = await this.executeStep(step, context)
        context.results.push({ stepId: step.id, result })

        if (step.condition && !this.evaluateCondition(step.condition, context)) {
          if (step.nextStep) currentStepId = step.nextStep; else break
          continue
        }

        if (step.nextStep) currentStepId = step.nextStep; else break
      }

      workflow.lastRun = new Date()
      workflow.successCount++
      return true
    } catch (error) {
      console.error(`Workflow ${workflowId} failed:`, error)
      workflow.failureCount++
      return false
    } finally {
      this.runningWorkflows.delete(workflowId)
    }
  }

  private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    switch (step.type) {
      case 'action':
        return this.executeAction(step.action, step.params, context)
      case 'condition':
        return this.evaluateCondition(step.condition || 'true', context)
      case 'wait':
        await this.wait(step.params.duration || 1000)
        return { waited: step.params.duration }
      default:
        return { skipped: true }
    }
  }

  private executeAction(action: string, params: Record<string, any>, context: WorkflowContext): any {
    const actions: Record<string, Function> = {
      'format_document': () => this.formatDocument(context),
      'insert_toc': () => this.insertTOC(context),
      'analyze_data': () => this.analyzeData(context),
      'create_chart': () => this.createChart(context, params),
      'save_document': () => this.saveDocument(context),
      'export_pdf': () => this.exportPDF(context, params)
    }

    const actionFn = actions[action]
    if (actionFn) {
      return actionFn()
    }

    return { action, params, executed: true }
  }

  private evaluateCondition(condition: string, context: WorkflowContext): boolean {
    // 简单的条件评估逻辑
    if (condition.startsWith('wordCount>')) {
      const threshold = parseInt(condition.split('>')[1])
      return (context.variables.wordCount || 0) > threshold
    }

    if (condition.startsWith('hasImages')) {
      return context.variables.imageCount > 0
    }

    return true
  }

  private wait(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration))
  }

  private formatDocument(_context: WorkflowContext): any {
    console.log('Formatting document...')
    return { formatted: true }
  }

  private insertTOC(_context: WorkflowContext): any {
    console.log('Inserting table of contents...')
    return { tocInserted: true }
  }

  private analyzeData(_context: WorkflowContext): any {
    console.log('Analyzing data...')
    return { analyzed: true }
  }

  private createChart(_context: WorkflowContext, params: Record<string, any>): any {
    console.log('Creating chart...', params)
    return { chartCreated: true, type: params.type }
  }

  private saveDocument(_context: WorkflowContext): any {
    console.log('Saving document...')
    return { saved: true }
  }

  private exportPDF(_context: WorkflowContext, params: Record<string, any>): any {
    console.log('Exporting to PDF...', params)
    return { exported: true, format: 'pdf' }
  }

  getWorkflowStats(workflowId: string): { success: number; failure: number; lastRun?: Date } | null {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) return null

    return {
      success: workflow.successCount,
      failure: workflow.failureCount,
      lastRun: workflow.lastRun
    }
  }

  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values())
  }
}

// 预定义的工作流模板
export const workflowTemplates: Record<string, Omit<Workflow, 'id' | 'lastRun' | 'successCount' | 'failureCount'>> = {
  word_format: {
    name: 'Word 文档格式化',
    description: '自动格式化 Word 文档，包括标题、段落和样式',
    trigger: 'manual',
    active: true,
    steps: [
      {
        id: 'step1',
        name: '分析文档结构',
        type: 'action',
        action: 'analyze_document',
        params: { deep: true }
      },
      {
        id: 'step2',
        name: '格式化标题',
        type: 'action',
        action: 'format_headings',
        params: { style: 'default' }
      },
      {
        id: 'step3',
        name: '插入目录',
        type: 'action',
        action: 'insert_toc',
        params: { maxLevel: 3 }
      },
      {
        id: 'step4',
        name: '保存文档',
        type: 'action',
        action: 'save_document',
        params: {}
      }
    ]
  },
  excel_analysis: {
    name: 'Excel 数据分析',
    description: '自动分析 Excel 数据并生成图表',
    trigger: 'manual',
    active: true,
    steps: [
      {
        id: 'step1',
        name: '读取数据',
        type: 'action',
        action: 'read_data',
        params: {}
      },
      {
        id: 'step2',
        name: '分析数据',
        type: 'action',
        action: 'analyze_data',
        params: { type: 'summary' }
      },
      {
        id: 'step3',
        name: '生成图表',
        type: 'action',
        action: 'create_chart',
        params: { type: 'bar' }
      },
      {
        id: 'step4',
        name: '保存工作簿',
        type: 'action',
        action: 'save_document',
        params: {}
      }
    ]
  },
  ppt_beautify: {
    name: 'PPT 美化',
    description: '自动美化 PPT 幻灯片，应用模板和动画',
    trigger: 'manual',
    active: true,
    steps: [
      {
        id: 'step1',
        name: '应用模板',
        type: 'action',
        action: 'apply_template',
        params: { template: 'professional' }
      },
      {
        id: 'step2',
        name: '统一字体',
        type: 'action',
        action: 'unify_fonts',
        params: {}
      },
      {
        id: 'step3',
        name: '添加动画',
        type: 'action',
        action: 'add_animations',
        params: { type: 'subtle' }
      },
      {
        id: 'step4',
        name: '保存演示文稿',
        type: 'action',
        action: 'save_document',
        params: {}
      }
    ]
  }
}

// 创建工作流实例
export function createWorkflowFromTemplate(templateKey: string): Workflow {
  const template = workflowTemplates[templateKey]
  if (!template) {
    throw new Error(`Template ${templateKey} not found`)
  }

  return {
    id: `workflow_${Date.now()}`,
    name: template.name,
    description: template.description,
    trigger: template.trigger,
    active: template.active,
    steps: template.steps,
    successCount: 0,
    failureCount: 0
  }
}

// 导出单例
export const workflowEngine = new WorkflowEngine()

// 注册预定义工作流
Object.entries(workflowTemplates).forEach(([key]) => {
  const workflow = createWorkflowFromTemplate(key)
  workflowEngine.registerWorkflow(workflow)
})
