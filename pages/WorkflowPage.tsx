import { useState, useEffect } from 'react'
import { deerFlowService, WorkflowTemplate, WorkflowDefinition } from '@/services/deerFlowService'
import WorkflowEditor from '@/components/WorkflowEditor'

export default function WorkflowPage() {
  const [templates, setTemplates] = useState<Record<string, WorkflowTemplate>>({})
  const [workflows, setWorkflows] = useState<any[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [templatesData, workflowsData] = await Promise.all([
        deerFlowService.getTemplates(),
        deerFlowService.listWorkflows(),
      ])
      setTemplates(templatesData)
      setWorkflows(workflowsData)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWorkflow = async (template?: string) => {
    try {
      const name = template ? `${templates[template].name} - 新实例` : '新工作流'
      const workflow = await deerFlowService.createWorkflow(name, '', template)
      setSelectedWorkflow(workflow)
      setShowEditor(true)
      await loadData()
    } catch (error) {
      console.error('创建工作流失败:', error)
    }
  }

  const handleEditWorkflow = async (workflowId: string) => {
    try {
      const workflow = await deerFlowService.getWorkflow(workflowId)
      if (workflow) {
        setSelectedWorkflow(workflow)
        setShowEditor(true)
      }
    } catch (error) {
      console.error('获取工作流失败:', error)
    }
  }

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (confirm('确定要删除这个工作流吗？')) {
      try {
        await deerFlowService.deleteWorkflow(workflowId)
        await loadData()
      } catch (error) {
        console.error('删除工作流失败:', error)
      }
    }
  }

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      const instanceId = await deerFlowService.executeWorkflow(workflowId, {
        user_input: '执行工作流',
      })
      alert(`工作流已启动，实例ID: ${instanceId}`)
    } catch (error) {
      console.error('执行工作流失败:', error)
      alert('执行工作流失败')
    }
  }

  if (showEditor && selectedWorkflow) {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-4 bg-white border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setShowEditor(false)
                setSelectedWorkflow(null)
              }}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
            >
              返回
            </button>
            <h2 className="text-lg font-semibold">{selectedWorkflow.name}</h2>
          </div>
        </div>
        <div className="flex-1">
          <WorkflowEditor />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-white border-b border-[#e0e0e0]">
        <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#6366f1] rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-800">工作流管理</span>
              <span className="text-xs text-gray-400 ml-2">DeerFlow集成</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCreateWorkflow()}
              className="px-4 py-2 bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e3] transition-colors text-sm font-medium"
            >
              创建工作流
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto px-8 py-6 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <div className="bg-white border border-[#e5e5e5] rounded-lg">
                <div className="px-5 py-3 border-b border-[#e5e5e5]">
                  <h2 className="font-medium text-gray-700">我的工作流</h2>
                </div>
                
                {workflows.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>暂无工作流</p>
                    <p className="text-sm mt-2">点击上方"创建工作流"按钮开始</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#f0f0f0]">
                    {workflows.map((workflow) => (
                      <div key={workflow.workflow_id} className="p-4 hover:bg-[#f9f9f9]">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-800">{workflow.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                              <span>节点: {workflow.node_count}</span>
                              <span>边: {workflow.edge_count}</span>
                              <span>版本: {workflow.version}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleExecuteWorkflow(workflow.workflow_id)}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                            >
                              执行
                            </button>
                            <button
                              onClick={() => handleEditWorkflow(workflow.workflow_id)}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteWorkflow(workflow.workflow_id)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-[#e5e5e5] rounded-lg">
                <div className="px-5 py-3 border-b border-[#e5e5e5]">
                  <h2 className="font-medium text-gray-700">工作流模板</h2>
                </div>
                <div className="p-4 space-y-3">
                  {Object.entries(templates).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => handleCreateWorkflow(key)}
                      className="w-full p-3 text-left rounded-lg border border-[#e5e5e5] hover:border-[#6366f1] hover:bg-[#f5f5ff] transition-colors"
                    >
                      <div className="font-medium text-gray-800">{template.name}</div>
                      <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>节点: {template.node_count}</span>
                        <span>边: {template.edge_count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#6366f1] to-[#4f46e5] rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-medium">DeerFlow引擎</span>
                </div>
                <p className="text-sm text-white/80 mb-3">
                  基于LangGraph的多智能体协作工作流引擎，支持复杂的任务编排和自动化执行。
                </p>
                <div className="text-xs text-white/60">
                  <p>• 多智能体协作</p>
                  <p>• DAG工作流编排</p>
                  <p>• 可视化编辑器</p>
                  <p>• 模板化工作流</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
