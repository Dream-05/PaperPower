import React, { useCallback, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  MarkerType,
  Position,
  Handle,
  NodeProps,
  NodeChange,
  EdgeChange,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'

interface WorkflowNodeData {
  label: string
  type: 'start' | 'end' | 'task' | 'condition' | 'parallel'
  description?: string
  config?: Record<string, any>
}

const nodeTypes: NodeTypes = {
  start: ({ data }: NodeProps<WorkflowNodeData>) => (
    <div className="px-4 py-2 rounded-full bg-green-500 text-white font-medium shadow-lg">
      <Handle type="source" position={Position.Bottom} />
      {data.label}
    </div>
  ),
  end: ({ data }: NodeProps<WorkflowNodeData>) => (
    <div className="px-4 py-2 rounded-full bg-red-500 text-white font-medium shadow-lg">
      <Handle type="target" position={Position.Top} />
      {data.label}
    </div>
  ),
  task: ({ data }: NodeProps<WorkflowNodeData>) => (
    <div className="px-4 py-3 rounded-lg bg-blue-500 text-white shadow-lg min-w-[120px]">
      <Handle type="target" position={Position.Top} />
      <div className="font-medium">{data.label}</div>
      {data.description && (
        <div className="text-xs text-blue-100 mt-1">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  ),
  condition: ({ data }: NodeProps<WorkflowNodeData>) => (
    <div className="px-4 py-3 rounded-lg bg-yellow-500 text-white shadow-lg transform rotate-45 w-24 h-24 flex items-center justify-center">
      <div className="transform -rotate-45">
        <Handle type="target" position={Position.Top} className="!transform !-rotate-45" />
        <div className="font-medium text-center">{data.label}</div>
        <Handle type="source" position={Position.Bottom} className="!transform !-rotate-45" />
      </div>
    </div>
  ),
  parallel: ({ data }: NodeProps<WorkflowNodeData>) => (
    <div className="px-4 py-3 rounded-lg bg-purple-500 text-white shadow-lg border-2 border-purple-300">
      <Handle type="target" position={Position.Top} />
      <div className="font-medium">{data.label}</div>
      {data.description && (
        <div className="text-xs text-purple-100 mt-1">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} id="a" />
      <Handle type="source" position={Position.Bottom} id="b" style={{ left: '70%' }} />
    </div>
  ),
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  const nodeWidth = 172
  const nodeHeight = 36

  dagreGraph.setGraph({ rankdir: direction })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

const WorkflowEditor: React.FC = () => {
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>([
    {
      id: 'start',
      type: 'start',
      position: { x: 250, y: 0 },
      data: { label: '开始', type: 'start' },
    },
    {
      id: 'task1',
      type: 'task',
      position: { x: 250, y: 100 },
      data: { label: '分析需求', type: 'task', description: '分析用户需求' },
    },
    {
      id: 'task2',
      type: 'task',
      position: { x: 250, y: 200 },
      data: { label: '执行任务', type: 'task', description: '执行具体任务' },
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 250, y: 300 },
      data: { label: '结束', type: 'end' },
    },
  ])

  const [edges, setEdges] = useState<Edge[]>([
    { id: 'e1', source: 'start', target: 'task1', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e2', source: 'task1', target: 'task2', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e3', source: 'task2', target: 'end', markerEnd: { type: MarkerType.ArrowClosed } },
  ])

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      ),
    []
  )

  const onAddNode = useCallback((type: string) => {
    const newNode: Node<WorkflowNodeData> = {
      id: `node_${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: type === 'task' ? '新任务' : type === 'condition' ? '条件' : type === 'parallel' ? '并行' : '节点',
        type: type as any,
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const onAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges)
    setNodes([...layoutedNodes])
    setEdges([...layoutedEdges])
  }, [nodes, edges])

  const onSave = useCallback(() => {
    const workflow = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    }
    console.log('保存工作流:', workflow)
    alert('工作流已保存到控制台')
  }, [nodes, edges])

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-white border-b flex items-center gap-4">
        <h2 className="text-lg font-semibold">工作流编辑器</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onAddNode('task')}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            添加任务
          </button>
          <button
            onClick={() => onAddNode('condition')}
            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
          >
            添加条件
          </button>
          <button
            onClick={() => onAddNode('parallel')}
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
          >
            添加并行
          </button>
          <button
            onClick={onAutoLayout}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
          >
            自动布局
          </button>
          <button
            onClick={onSave}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            保存
          </button>
        </div>
      </div>
      
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes: NodeChange[]) => {
            changes.forEach((change) => {
              if (change.type === 'position' && 'position' in change && change.position) {
                setNodes((nds) =>
                  nds.map((node) => {
                    if (node.id === change.id) {
                      return { ...node, position: change.position! }
                    }
                    return node
                  })
                )
              }
            })
          }}
          onEdgesChange={(changes: EdgeChange[]) => {
            changes.forEach((change) => {
              if (change.type === 'remove') {
                setEdges((eds) => eds.filter((e) => e.id !== change.id))
              }
            })
          }}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  )
}

export default WorkflowEditor
