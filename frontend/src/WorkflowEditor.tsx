import { useCallback, useRef, useState, type DragEvent } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './WorkflowEditor.css'

type NodeKind = 'start' | 'agent' | 'end'
type WorkflowNodeData = { label: string; description: string; kind: NodeKind }
type WorkflowNode = Node<WorkflowNodeData>
const DRAG_NODE_TYPE = 'application/reactflow'

const starterNodes: WorkflowNode[] = [
  { id: 'start-1', type: 'workflowNode', position: { x: 90, y: 180 }, draggable: true, data: { label: 'Start', description: 'Workflow trigger', kind: 'start' } },
  { id: 'agent-1', type: 'workflowNode', position: { x: 370, y: 180 }, draggable: true, data: { label: 'AI Agent', description: 'Customer Support Assistant', kind: 'agent' } },
  { id: 'end-1', type: 'workflowNode', position: { x: 650, y: 180 }, draggable: true, data: { label: 'End', description: 'Workflow complete', kind: 'end' } },
]

const starterEdges: Edge[] = [
  { id: 'start-agent', source: 'start-1', target: 'agent-1', type: 'smoothstep' },
  { id: 'agent-end', source: 'agent-1', target: 'end-1', type: 'smoothstep' },
]

const palette: { kind: NodeKind; label: string; description: string }[] = [
  { kind: 'start', label: 'Start', description: 'Begin your workflow' },
  { kind: 'agent', label: 'AI Agent', description: 'Run an AI agent' },
  { kind: 'end', label: 'End', description: 'Finish your workflow' },
]

function WorkflowNodeView({ data }: NodeProps<WorkflowNode>) {
  return (
    <div className={`flow-node ${data.kind}`}>
      {data.kind !== 'start' && <Handle type="target" position={Position.Left} />}
      <span className="flow-node-icon" aria-hidden="true">{data.kind === 'start' ? '▶' : data.kind === 'agent' ? '✧' : '■'}</span>
      <span className="flow-node-copy"><strong>{data.label}</strong><small>{data.description}</small><em>DEMO NODE</em></span>
      {data.kind !== 'end' && <Handle type="source" position={Position.Right} />}
    </div>
  )
}

const nodeTypes = { workflowNode: WorkflowNodeView }

function EditorCanvas({ workflowName }: { workflowName: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(starterNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(starterEdges)
  const { screenToFlowPosition } = useReactFlow<WorkflowNode>()
  const [draggingKind, setDraggingKind] = useState<NodeKind | null>(null)
  const nextNodeId = useRef(0)

  const onConnect = useCallback((connection: Connection) => {
    setEdges((currentEdges) => addEdge({ ...connection, type: 'smoothstep' }, currentEdges))
  }, [setEdges])

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData(DRAG_NODE_TYPE) as NodeKind
    const nodeInfo = palette.find((item) => item.kind === kind)
    if (!nodeInfo) return

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const newNode: WorkflowNode = {
      id: `added-${kind}-${nextNodeId.current++}`,
      type: 'workflowNode',
      position,
      draggable: true,
      data: { label: nodeInfo.label, description: nodeInfo.description, kind },
    }
    setNodes((currentNodes) => [...currentNodes, newNode])
    setDraggingKind(null)
  }, [screenToFlowPosition, setNodes])

  const handlePaletteDrag = (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
    event.dataTransfer.setData(DRAG_NODE_TYPE, kind)
    event.dataTransfer.effectAllowed = 'move'
    setDraggingKind(kind)
  }

  return (
    <div className="workflow-editor-layout">
      <aside className="editor-palette">
        <div className="palette-heading"><span>NODE LIBRARY</span><span className="demo-badge">Demo</span></div>
        <p>Drag a node onto the canvas to add it.</p>
        <div className="palette-list">
          {palette.map((item) => (
            <button
              className={`palette-node ${item.kind}`}
              draggable
              key={item.kind}
              onDragStart={(event) => handlePaletteDrag(event, item.kind)}
              onDragEnd={() => setDraggingKind(null)}
              type="button"
            >
              <span className="palette-icon">{item.kind === 'start' ? '▶' : item.kind === 'agent' ? '✧' : '■'}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <span className="drag-grip" aria-hidden="true">⠿</span>
            </button>
          ))}
        </div>
        <div className="palette-tip"><strong>Connect nodes</strong><span>Drag from a node’s handle to another node to create a connection.</span></div>
      </aside>

      <div
        className={`workflow-canvas${draggingKind ? ' dragging-node' : ''}`}
        data-drop-label={draggingKind ? `Drop ${draggingKind === 'agent' ? 'AI Agent' : draggingKind} onto canvas` : undefined}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          nodesDraggable
          multiSelectionKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#34333d" />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap position="bottom-right" pannable zoomable nodeColor={(node) => {
            const nodeData = node.data as WorkflowNodeData
            return nodeData.kind === 'start' ? '#62c997' : nodeData.kind === 'end' ? '#e78b91' : '#a887f5'
          }} />
          <Panel position="top-left" className="canvas-demo-label">DEMO CANVAS · {workflowName}</Panel>
        </ReactFlow>
      </div>
    </div>
  )
}

export default function WorkflowEditor({ workflowName, onBack }: { workflowName: string; onBack: () => void }) {
  return (
    <div className="workflow-editor-page">
      <header className="editor-toolbar">
        <div className="editor-title-block">
          <button className="secondary-button" onClick={onBack} type="button">← Back to Workflows</button>
          <span className="toolbar-divider" />
          <span className="editor-workflow-name">{workflowName}</span>
          <span className="editor-demo-badge">DEMO</span>
        </div>
        <span className="editor-save-state"><i /> Demo workflow · Not saved</span>
      </header>
      <div className="editor-workspace"><ReactFlowProvider><EditorCanvas workflowName={workflowName} /></ReactFlowProvider></div>
    </div>
  )
}
