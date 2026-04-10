import React, { useState, useEffect } from 'react'
import { deerFlowService, WorkflowDefinition, WorkflowTemplate } from '@/services/deerFlowService'

const WorkflowPanel: React.FC = () => {
  const [workflows, setWorkflows] = useState<any[]>([])
  const [templates, setTemplates] = useState<Record<string, WorkflowTemplate>>({})
  const [loading, setLoading] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [workflowsData, templatesData] = await Promise.all([
        deerFlowService.listWorkflows(),
        deerFlowService.getTemplates(),
      ])
      setWorkflows(workflowsData)
      setTemplates(templatesData)
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
    if (!confirm('确定要删除这个工作流吗？')) return
    try {
      await deerFlowService.deleteWorkflow(workflowId)
      await loadData()
    } catch (error) {
      console.error('删除工作流失败:', error)
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
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (showEditor && selectedWorkflow) {
    return (
      <div className="h-full">
        <div className="mb-4">
          <button
            onClick={() => setShowEditor(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            返回列表
          </button>
        </div>
        <div className="text-lg font-semibold mb-4">{selectedWorkflow.name}</div>
        <div className="text-gray-600 mb-4">{selectedWorkflow.description}</div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="text-sm text-gray-500">节点数: {selectedWorkflow.nodes.length}</div>
          <div className="text-sm text-gray-500">边数: {selectedWorkflow.edges.length}</div>
        </div>
      </div>
    )
  }

  return (
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
          <span className="font-medium">DeerFlow工作流引擎</span>
        </div>
        <p className="text-sm text-white/80 mb-3">
          基于多智能体协作的自动化工作流引擎，支持复杂任务的编排和执行
        </p>
        <button
          onClick={() => handleCreateWorkflow()}
          className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition-colors"
        >
          创建自定义工作流
        </button>
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-lg">
        <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
          <h2 className="font-medium text-gray-700">我的工作流</h2>
          <span className="text-sm text-gray-500">{workflows.length} 个工作流</span>
        </div>
        {workflows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>暂无工作流，请从模板创建或创建自定义工作流</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0f0]">
            {workflows.map((workflow) => (
              <div key={workflow.workflow_id} className="px-5 py-3 hover:bg-[#f9f9f9]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-800">{workflow.name}</div>
                    <div className="text-sm text-gray-500 mt-1">{workflow.description}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>节点: {workflow.node_count}</span>
                      <span>边: {workflow.edge_count}</span>
                      <span>版本: {workflow.version}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExecuteWorkflow(workflow.workflow_id)}
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                    >
                      执行
                    </button>
                    <button
                      onClick={() => handleEditWorkflow(workflow.workflow_id)}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflow(workflow.workflow_id)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
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
  )
}

export default WorkflowPanel
