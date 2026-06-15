import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Loader2, AlertCircle, RefreshCw, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { knowledgeGraph } from '@/services/api'
import KnowledgeGraphScene from './KnowledgeGraphScene'
import NodeDetailPanel from './NodeDetailPanel'
import GraphToolbar from './GraphToolbar'

function LoadingFallback() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#f5f2ee]/50">
      <Loader2 className="w-10 h-10 animate-spin text-[#d4a853] mb-3" />
      <p className="text-sm text-[#6b6560]">正在构建3D知识图谱...</p>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#f5f2ee]/50">
      <AlertCircle className="w-10 h-10 text-[#e05d6f] mb-3" />
      <p className="text-sm text-[#6b6560] mb-3">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="rounded-xl">
        <RefreshCw className="w-4 h-4 mr-2" />重试
      </Button>
    </div>
  )
}

function EmptyState({ hasCourses, onNavigateToCourses }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#f5f2ee]/50">
      <Network className="w-12 h-12 text-[#9a9590] mb-3" />
      <p className="text-sm text-[#6b6560] mb-1">暂无知识图谱数据</p>
      <p className="text-xs text-[#9a9590] mb-3">请先选择课程以加载知识图谱</p>
      {hasCourses && (
        <Button variant="outline" size="sm" onClick={onNavigateToCourses} className="rounded-xl">前往我的课程</Button>
      )}
    </div>
  )
}

export default function KnowledgeGraph3D({ myCourses = [] }) {
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState([])
  const [focusTarget, setFocusTarget] = useState(null)
  const [nodeFilter, setNodeFilter] = useState('all')
  const [edgeFilter, setEdgeFilter] = useState('all')
  const [selectedPathId, setSelectedPathId] = useState('')
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (!selectedCourse && myCourses.length > 0) {
      setSelectedCourse(String(myCourses[0].id))
    }
  }, [myCourses, selectedCourse])

  const fetchGraph = useCallback(async () => {
    if (!selectedCourse) return
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (nodeFilter !== 'all') params.node_type = nodeFilter
      if (edgeFilter !== 'all') params.edge_type = edgeFilter
      const data = await knowledgeGraph.getGraph(selectedCourse, params)
      setGraphData(data)
      setSelectedNode(null)
      setShowDetail(false)
      setExpandedNodeIds([])
      setFocusTarget(null)
    } catch (err) {
      console.error('加载知识图谱失败:', err)
      setError(err.message || '加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [selectedCourse, nodeFilter, edgeFilter])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  const filteredNodes = useMemo(() => graphData?.nodes || [], [graphData])
  const filteredEdges = useMemo(() => graphData?.edges || [], [graphData])

  // 学习路径提取
  const learningPaths = useMemo(() => {
    if (!filteredEdges.length) return []
    const prereqEdges = filteredEdges.filter((e) => e.edge_type === 'prerequisite' || e.edge_type === 'recommended_after')
    if (prereqEdges.length === 0) return []
    const nodeMap = Object.fromEntries(filteredNodes.map((n) => [n.id, n]))
    const visited = new Set()
    const pathNodes = []
    const pathEdges = []

    const targets = new Set(prereqEdges.map((e) => e.target_node_id ?? e.target))
    const chainStarts = prereqEdges.map((e) => e.source_node_id ?? e.source).filter((id) => !targets.has(id))
    const startId = chainStarts[0] || (prereqEdges[0]?.source_node_id ?? prereqEdges[0]?.source)
    let current = startId
    let safety = 0
    while (current && !visited.has(current) && safety < 200) {
      visited.add(current)
      if (nodeMap[current]) pathNodes.push(current)
      const nextEdge = prereqEdges.find((e) => (e.source_node_id ?? e.source) === current)
      if (nextEdge) {
        const t = nextEdge.target_node_id ?? nextEdge.target
        pathEdges.push(`${current}-${t}`)
        current = t
      } else { break }
      safety++
    }
    if (pathNodes.length < 2) return []
    return [{ id: 'prerequisite_path', name: '知识学习路径', nodeIds: pathNodes, edgeKeys: pathEdges }]
  }, [filteredNodes, filteredEdges])

  const activePath = useMemo(() => {
    if (!selectedPathId || selectedPathId === 'none') return null
    return learningPaths.find((p) => p.id === selectedPathId) || null
  }, [selectedPathId, learningPaths])

  // 高亮与选中节点关联的节点
  const highlightedNodes = useMemo(() => {
    if (!selectedNode) return []
    const nid = selectedNode.id
    const ids = []
    filteredEdges.forEach((e) => {
      const s = e.source_node_id ?? e.source
      const t = e.target_node_id ?? e.target
      if (s === nid) ids.push(t)
      if (t === nid) ids.push(s)
    })
    return ids
  }, [selectedNode, filteredEdges])

  const stats = useMemo(() => {
    if (!graphData) return null
    const nodes = graphData.nodes || []
    const edges = graphData.edges || []
    const connected = new Set()
    edges.forEach((e) => {
      connected.add(e.source_node_id ?? e.source)
      connected.add(e.target_node_id ?? e.target)
    })
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      isolatedCount: nodes.filter((n) => !connected.has(n.id)).length,
    }
  }, [graphData])

  // 单击：选中节点 + 显示详情
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
    setShowDetail(true)
  }, [])

  // 双击：展开/折叠节点 + 聚焦
  const handleNodeDoubleClick = useCallback((node) => {
    setExpandedNodeIds((prev) => {
      if (prev.includes(node.id)) {
        return prev.filter((id) => id !== node.id)
      }
      return [...prev, node.id]
    })
    setFocusTarget(node.id)
    setSelectedNode(node)
    setShowDetail(true)
  }, [])

  // 导航到邻居节点
  const handleNavigateToNode = useCallback((nodeId) => {
    const node = filteredNodes.find((n) => n.id === nodeId)
    if (node) {
      setSelectedNode(node)
      setFocusTarget(nodeId)
    }
  }, [filteredNodes])

  // 重置视角
  const handleResetView = useCallback(() => {
    setSelectedNode(null)
    setShowDetail(false)
    setExpandedNodeIds([])
    setFocusTarget(null)
  }, [])

  const handleCourseChange = useCallback((courseId) => {
    setSelectedCourse(courseId)
    setSelectedPathId('')
  }, [])

  if (!selectedCourse && myCourses.length === 0) {
    return <div className="h-[calc(100vh-120px)]"><EmptyState hasCourses={false} /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            3D 知识图谱
          </h2>
          <p className="text-[#6b6560]">交互式三维知识网络可视化，探索知识点间的关联与学习路径</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCourse}
            onChange={(e) => handleCourseChange(e.target.value)}
            className="h-9 rounded-lg border border-[#e5e0db] bg-white px-3 text-sm text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#d4a853]/30"
          >
            {myCourses.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.title}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchGraph} disabled={loading} className="rounded-xl">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />刷新
          </Button>
        </div>
      </div>

      <div className="relative h-[calc(100vh-220px)] min-h-[500px] rounded-2xl overflow-hidden border border-[#e5e0db] bg-[#1a1a2e]">
        {loading ? (
          <LoadingFallback />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchGraph} />
        ) : filteredNodes.length === 0 ? (
          <EmptyState hasCourses={myCourses.length > 0} onNavigateToCourses={() => {}} />
        ) : (
          <>
            <Canvas
              camera={{ position: [0, 15, 30], fov: 55, near: 0.1, far: 500 }}
              gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
              dpr={[1, 2]}
              style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
            >
              <fog attach="fog" args={['#1a1a2e', 40, 80]} />
              <Suspense fallback={null}>
                <KnowledgeGraphScene
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  selectedNodeId={selectedNode?.id}
                  highlightedNodes={highlightedNodes}
                  pathNodeIds={activePath?.nodeIds || []}
                  pathEdgeKeys={activePath?.edgeKeys || []}
                  expandedNodeIds={expandedNodeIds}
                  focusTarget={focusTarget}
                  onNodeClick={handleNodeClick}
                  onNodeDoubleClick={handleNodeDoubleClick}
                />
              </Suspense>
              <OrbitControls
                enableDamping
                dampingFactor={0.12}
                rotateSpeed={0.8}
                zoomSpeed={1.2}
                minDistance={5}
                maxDistance={80}
                enablePan
                panSpeed={0.8}
              />
            </Canvas>

            <GraphToolbar
              nodeFilter={nodeFilter}
              edgeFilter={edgeFilter}
              onNodeFilterChange={setNodeFilter}
              onEdgeFilterChange={setEdgeFilter}
              stats={stats}
              learningPaths={learningPaths}
              selectedPathId={selectedPathId}
              onPathSelect={setSelectedPathId}
              onResetView={handleResetView}
            />

            {showDetail && selectedNode && (
              <div className="absolute top-0 right-0 h-full w-80 z-20 shadow-xl border-l border-[#e5e0db]">
                <NodeDetailPanel
                  node={selectedNode}
                  edges={filteredEdges}
                  nodes={filteredNodes}
                  onClose={() => { setShowDetail(false); setSelectedNode(null) }}
                  onNavigateToNode={handleNavigateToNode}
                />
              </div>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <Card className="shadow-lg rounded-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="px-4 py-2">
                  <p className="text-xs text-[#9a9590]">
                    单击查看详情 · 双击展开聚焦 · 拖拽旋转 · 滚轮缩放 · 右键平移
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
