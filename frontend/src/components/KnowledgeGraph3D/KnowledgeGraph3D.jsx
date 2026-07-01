import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { knowledgeGraph } from '@/services/api'
import KnowledgeGraphScene from './KnowledgeGraphScene'
import {
  Loader2, AlertCircle, RefreshCw, Network,
  Layers, Link2, BookOpen, Target, Info, Route,
} from 'lucide-react'

/* ── 常量 ── */
const NODE_TYPE_META = {
  course: { label: '课程', color: '#d4a853', note: '图谱根节点，代表当前课程或文档主题。' },
  chapter: { label: '线路', color: '#5a9e6f', note: '按文档一级标题形成的知识线路。' },
  knowledge_point: { label: '知识点', color: '#4a90d9', note: '线路下的二级标题、概念、方法或实践内容。' },
  objective: { label: '目标', color: '#e07c4f', note: '文档或课程希望达成的理解目标。' },
  skill: { label: '技能', color: '#8b6fb0', note: '先修能力、应用能力或实践要求。' },
  case: { label: '案例', color: '#e05d6f', note: '支撑知识点理解的案例材料。' },
  exercise: { label: '练习', color: '#3db8a0', note: '用于检测或强化知识点的任务。' },
  resource: { label: '资源', color: '#7a8b99', note: '教材、参考资料或外部学习资源。' },
}

const EDGE_TYPE_META = {
  contains: { label: '包含', color: '#5a9e6f', note: '上层线路包含下层知识点。' },
  prerequisite: { label: '前置依赖', color: '#e07c4f', note: '理解目标节点前，建议先掌握来源节点。' },
  related: { label: '关联', color: '#4a90d9', note: '两个节点在主题、概念或上下文中存在关联。' },
  supports_objective: { label: '支撑目标', color: '#d4a853', note: '该节点对课程目标或学习目标形成支撑。' },
  applies_to: { label: '应用于', color: '#8b6fb0', note: '知识点可用于解释、解决或支撑目标场景。' },
  assesses: { label: '评估', color: '#3db8a0', note: '练习、评价或考核对知识点的覆盖关系。' },
  recommended_after: { label: '后续学习', color: '#e05d6f', note: '表示推荐学习顺序。' },
}

const RELATION_LABELS = {
  contains: '包含',
  prerequisite: '前置依赖',
  related: '关联',
  supports_objective: '支撑目标',
  applies_to: '应用于',
  assesses: '评估',
  recommended_after: '后续学习',
}

const VIEW_MODES = {
  layered: 'layered',
  focus: 'focus',
  full: 'full',
}

const getNodeTitle = (node) => node?.label || node?.name || node?.title || ''
const getEdgeSource = (edge) => edge?.source_node_id ?? edge?.source
const getEdgeTarget = (edge) => edge?.target_node_id ?? edge?.target
const getEdgeKey = (edge) => `${getEdgeSource(edge)}-${getEdgeTarget(edge)}`

/* ── 辅助函数 ── */
function summarizeChapter(chapter, chapterKps) {
  const title = getNodeTitle(chapter)
  const kpNames = chapterKps.map(getNodeTitle).filter(Boolean)
  if (kpNames.length === 0) return `${title}的学习路径`
  if (kpNames.length <= 3) return `${title}：涵盖${kpNames.join('、')}等知识点。`
  return `${title}：涵盖${kpNames.slice(0, 3).join('、')}等${kpNames.length}个知识点。`
}

/* ── 安全轨道控制器 ── */
function SafeOrbitControls() {
  const { gl } = useThree()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (gl?.domElement) {
      const raf = requestAnimationFrame(() => setReady(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [gl])

  if (!ready) return null

  return (
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
  )
}

/* ── 主组件 ── */
export default function KnowledgeGraph3D({ myCourses = [] }) {
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [focusTarget, setFocusTarget] = useState(null)
  const [viewMode, setViewMode] = useState(VIEW_MODES.layered)

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
      const data = await knowledgeGraph.getGraph(selectedCourse)
      setGraphData(data)
      setSelectedNode(null)
      setSelectedEdge(null)
      setFocusTarget(null)
    } catch (err) {
      console.error('加载知识图谱失败:', err)
      setError(err.message || '加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [selectedCourse])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  const nodes = useMemo(() => graphData?.nodes || [], [graphData])
  const edges = useMemo(() => graphData?.edges || [], [graphData])
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])

  const stats = useMemo(() => {
    const counts = nodes.reduce((acc, n) => {
      acc[n.node_type] = (acc[n.node_type] || 0) + 1
      return acc
    }, {})
    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      chapters: counts.chapter || 0,
      knowledgePoints: counts.knowledge_point || 0,
      objectives: counts.objective || 0,
      skills: counts.skill || 0,
    }
  }, [nodes, edges])

  const sourceCoverage = graphData?.quality_report?.source_coverage_rate ?? 0

  /* ── 主要内容注释 ── */
  const annotations = useMemo(() => {
    const chapters = nodes
      .filter((node) => node.node_type === 'chapter')
      .sort((a, b) => ((a.properties?.order_index ?? 999) - (b.properties?.order_index ?? 999)))
    const courseIds = nodes.filter((node) => node.node_type === 'course').map((node) => node.id)
    const kpsByChapter = new Map()
    nodes
      .filter((node) => node.node_type === 'knowledge_point')
      .forEach((node) => {
        const chapterTitle = node.properties?.chapter || ''
        if (!kpsByChapter.has(chapterTitle)) kpsByChapter.set(chapterTitle, [])
        kpsByChapter.get(chapterTitle).push(node)
      })

    const isMeaningfulTitle = (name) => {
      if (!name || name.length < 2) return false
      if (/^\d+\.?\d*[fFdDlL]?$/.test(name)) return false
      if (/^[a-zA-Z0-9_.]+$/.test(name) && name.length < 4) return false
      if (/^String\s*\(/i.test(name)) return false
      return true
    }

    return chapters
      .map((chapter, index) => {
        const rawTitle = getNodeTitle(chapter) || ''
        const title = isMeaningfulTitle(rawTitle) ? rawTitle : `第${index + 1}章`
        const chapterKps = (kpsByChapter.get(rawTitle) || kpsByChapter.get(title) || [])
          .filter((kp) => isMeaningfulTitle(getNodeTitle(kp)))
          .sort((a, b) => ((a.properties?.order_index ?? 999) - (b.properties?.order_index ?? 999)))
        const ids = new Set([chapter.id, ...courseIds])
        chapterKps.forEach((kp) => ids.add(kp.id))

        const lineEdges = edges.filter((edge) => ids.has(getEdgeSource(edge)) && ids.has(getEdgeTarget(edge)))
        const concepts = chapterKps.map(getNodeTitle).filter(isMeaningfulTitle)

        const rawMainContent = chapter.properties?.main_content || ''
        const isValidMainContent = rawMainContent && rawMainContent.length >= 2 && isMeaningfulTitle(rawMainContent.split(/[：:]/)[0])
        const annotationTitle = isValidMainContent ? rawMainContent : title

        const rawAnnotation = chapter.properties?.annotation || ''
        const isValidAnnotation = rawAnnotation && rawAnnotation.length >= 4 && !/^String\s*\(/i.test(rawAnnotation) && isMeaningfulTitle(rawAnnotation.split(/[：:，,。]/)[0])

        return {
          id: `chapter-annotation-${chapter.id}`,
          title: annotationTitle,
          chapterTitle: title,
          rawTitle,
          summary: isValidAnnotation ? rawAnnotation : summarizeChapter(chapter, chapterKps),
          concepts,
          nodeIds: Array.from(ids),
          edgeKeys: lineEdges.map(getEdgeKey),
        }
      })
      .filter((annotation) => annotation.concepts.length > 0 || (!annotation.summary.startsWith('本线路根据文档章节') && !annotation.summary.startsWith('该章节已建立知识点')))
  }, [nodes, edges])

  /* ── 事件处理 ── */
  const handleReset = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
    setFocusTarget(null)
    setViewMode(VIEW_MODES.layered)
  }, [])

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
    setFocusTarget(node.id)
    if (viewMode !== VIEW_MODES.layered) {
      setViewMode(VIEW_MODES.focus)
    }
  }, [viewMode])

  const handleNodeDoubleClick = useCallback((node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
    setFocusTarget(node.id)
    setViewMode(VIEW_MODES.focus)
  }, [])

  const handleEdgeClick = useCallback((edge) => {
    setSelectedEdge(edge)
    const s = nodeMap[edge.source_node_id ?? edge.source]
    const t = nodeMap[edge.target_node_id ?? edge.target]
    setSelectedNode(s || t || null)
    setFocusTarget((s || t || {}).id || null)
    if (viewMode !== VIEW_MODES.layered) {
      setViewMode(VIEW_MODES.focus)
    }
  }, [nodeMap, viewMode])

  const handleAnnotationClick = useCallback((annotation) => {
    setSelectedEdge(null)
    const firstNode = annotation.nodeIds
      .map((id) => nodeMap[id])
      .find((node) => node?.node_type === 'chapter')
      || annotation.nodeIds.map((id) => nodeMap[id]).find(Boolean)
    setSelectedNode(firstNode || null)
    setFocusTarget(firstNode?.id || null)
    if (viewMode !== VIEW_MODES.layered) {
      setViewMode(VIEW_MODES.focus)
    }
  }, [nodeMap, viewMode])

  const handleCourseChange = useCallback((courseId) => {
    setSelectedCourse(courseId)
  }, [])

  const detailNode = selectedNode ? nodeMap[selectedNode.id] || selectedNode : null
  const detailEdge = selectedEdge ? {
    ...selectedEdge,
    sourceNode: nodeMap[selectedEdge.source_node_id ?? selectedEdge.source],
    targetNode: nodeMap[selectedEdge.target_node_id ?? selectedEdge.target],
  } : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
      {/* 顶部标题栏 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            3D 知识图谱
          </h2>
          <p className="text-sm text-[#6b6560]">交互式三维知识网络可视化，探索知识点间的关联与学习路径</p>
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
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />刷新
          </Button>
        </div>
      </div>

      {/* 主内容区：左侧 + 侧边栏 */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3 min-w-0">
          {/* 统计 Badge 条 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="rounded-full border-[#d4a853]/40 text-[#8a6422] bg-[#d4a853]/10 text-[11px]"><Layers className="w-3 h-3 mr-1" />分层视图</Badge>
            <Badge variant="outline" className="rounded-full border-[#5a9e6f]/30 text-[#3f7d52] bg-[#5a9e6f]/10 text-[11px]"><Route className="w-3 h-3 mr-1" />学习链路</Badge>
            <Badge variant="outline" className="rounded-full border-[#4a90d9]/30 text-[#2d6fb8] bg-[#4a90d9]/10 text-[11px]"><Network className="w-3 h-3 mr-1" />{stats.totalNodes} 节点</Badge>
            <Badge variant="outline" className="rounded-full border-[#e07c4f]/30 text-[#b95a2d] bg-[#e07c4f]/10 text-[11px]"><Link2 className="w-3 h-3 mr-1" />{stats.totalEdges} 关系</Badge>
            <Badge variant="outline" className="rounded-full border-[#7a8b99]/30 text-[#66717c] bg-[#7a8b99]/10 text-[11px]">覆盖率 {sourceCoverage}%</Badge>
          </div>

          {/* 统计卡片 */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
            <div className="rounded-lg border border-[#e5e0db] bg-white p-2.5">
              <div className="text-[11px] text-[#9a9590]">线路</div>
              <div className="text-lg font-semibold text-[#2d2a26]">{stats.chapters}</div>
            </div>
            <div className="rounded-lg border border-[#e5e0db] bg-white p-2.5">
              <div className="text-[11px] text-[#9a9590]">知识点</div>
              <div className="text-lg font-semibold text-[#2d2a26]">{stats.knowledgePoints}</div>
            </div>
            <div className="rounded-lg border border-[#e5e0db] bg-white p-2.5">
              <div className="text-[11px] text-[#9a9590]">目标</div>
              <div className="text-lg font-semibold text-[#2d2a26]">{stats.objectives}</div>
            </div>
            <div className="rounded-lg border border-[#e5e0db] bg-white p-2.5">
              <div className="text-[11px] text-[#9a9590]">技能</div>
              <div className="text-lg font-semibold text-[#2d2a26]">{stats.skills}</div>
            </div>
          </div>

          {/* 视图模式切换 */}
          <div className="flex flex-wrap items-center gap-1.5">
            {Object.entries(VIEW_MODES).map(([, mode]) => (
              <Button key={mode} size="sm" variant={viewMode === mode ? 'default' : 'outline'} className={viewMode === mode ? 'rounded-lg bg-[#2d2a26] text-white h-8 text-xs' : 'rounded-lg h-8 text-xs'} onClick={() => setViewMode(mode)}>
                {mode === VIEW_MODES.layered ? '分层总览' : mode === VIEW_MODES.focus ? '聚焦关系' : '完整图谱'}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="rounded-lg h-8 text-xs" onClick={handleReset}>重置视图</Button>
            <span className="text-[11px] text-[#9a9590] hidden sm:inline-flex items-center gap-1"><Info className="w-3 h-3" />单击看详情，双击聚焦</span>
          </div>

          {/* 3D 画布 */}
          <div className="h-[400px] sm:h-[500px] lg:h-[560px] rounded-xl overflow-hidden border border-[#e5e0db] bg-[#1a1a2e]">
            {!selectedCourse ? (
              <div className="h-full flex flex-col items-center justify-center bg-[#f5f2ee]">
                <Network className="w-12 h-12 text-[#9a9590] mb-3" />
                <p className="text-sm text-[#6b6560]">请选择课程查看知识图谱</p>
              </div>
            ) : loading ? (
              <div className="h-full flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#d4a853] mb-3" />
                <p className="text-sm text-white/60">正在加载知识图谱...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center">
                <AlertCircle className="w-10 h-10 text-[#e05d6f] mb-3" />
                <p className="text-sm text-white/60 mb-3">{error}</p>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={fetchGraph}>重试</Button>
              </div>
            ) : nodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-[#f5f2ee]">
                <Network className="w-12 h-12 text-[#9a9590] mb-3" />
                <p className="text-sm text-[#6b6560]">暂无知识图谱数据</p>
                <p className="text-xs text-[#9a9590] mt-1">请等待教师上传文档生成知识图谱</p>
              </div>
            ) : (
              <Canvas
                camera={{ position: [0, 18, 32], fov: 52, near: 0.1, far: 500 }}
                gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
                dpr={[1, 2]}
                style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
              >
                <fog attach="fog" args={['#1a1a2e', 40, 85]} />
                <Suspense fallback={null}>
                  <KnowledgeGraphScene
                    nodes={nodes}
                    edges={edges}
                    selectedNodeId={selectedNode?.id}
                    highlightedNodes={[]}
                    pathNodeIds={[]}
                    pathEdgeKeys={[]}
                    focusTarget={focusTarget}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onEdgeClick={handleEdgeClick}
                    selectedEdgeKey={selectedEdge ? `${getEdgeSource(selectedEdge)}-${getEdgeTarget(selectedEdge)}` : null}
                    layoutMode={viewMode === VIEW_MODES.layered ? 'lanes' : 'force'}
                  />
                </Suspense>
                <SafeOrbitControls />
              </Canvas>
            )}
          </div>

          {/* 主要内容注释 */}
          <Card className="rounded-xl border-[#e5e0db]">
            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-[#e07c4f]" />主要内容注释</CardTitle></CardHeader>
            <CardContent className="text-sm px-4 pb-3">
              {annotations.length ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {annotations.map((annotation, index) => {
                    const cleanTitle = (annotation.chapterTitle || annotation.title || '').replace(/^\d+[\.\、\s]+/, '').trim()
                    const cleanSubTitle = (annotation.title || '').replace(/^\d+[\.\、\s]+/, '').trim()
                    const cleanSummary = (annotation.summary || '').replace(/^\d+[\.\、\s]+/gm, '').trim()
                    return (
                      <button
                        key={annotation.id}
                        type="button"
                        className={`text-left rounded-lg border p-2.5 transition-colors ${selectedNode && annotation.nodeIds.includes(selectedNode.id) ? 'border-[#e07c4f] bg-[#e07c4f]/10' : 'border-[#e5e0db] bg-[#faf8f5] hover:bg-[#f5f2ee]'}`}
                        onClick={() => handleAnnotationClick(annotation)}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#e07c4f]/15 text-[10px] font-medium text-[#b95a2d]">{index + 1}</span>
                          <span className="font-medium text-[#2d2a26] text-xs line-clamp-1">{cleanTitle}</span>
                        </div>
                        {annotation.chapterTitle && cleanSubTitle && cleanSubTitle !== cleanTitle && (
                          <div className="text-[10px] text-[#9a9590] line-clamp-1 mb-0.5">{cleanSubTitle}</div>
                        )}
                        <div className="text-[11px] leading-relaxed text-[#6b6560] line-clamp-2">{cleanSummary}</div>
                        {annotation.concepts?.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {annotation.concepts.slice(0, 3).map((concept) => (
                              <span key={concept} className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-[#6b6560] border border-[#ebe6df]">{concept}</span>
                            ))}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-[#f0ece7] bg-[#faf8f5] p-3 text-xs text-[#6b6560]">
                  暂未识别到稳定章节结构，请等待教师上传包含清晰标题层级的文档。
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧侧边栏 */}
        <aside className="space-y-3">
          {/* 关系详情 */}
          <Card className="rounded-xl border-[#e5e0db]">
            <CardHeader className="pb-1.5 pt-3 px-4"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#4a90d9]" />关系详情</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2 px-4 pb-3">
              {detailEdge ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-[#f5f2ee] p-2.5">
                    <div className="text-[10px] text-[#9a9590] mb-0.5">关系类型</div>
                    <div className="font-medium text-[#2d2a26] text-xs">{EDGE_TYPE_META[detailEdge.edge_type]?.label || detailEdge.edge_type}</div>
                    <div className="text-[11px] text-[#6b6560] mt-0.5">{EDGE_TYPE_META[detailEdge.edge_type]?.note}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg border border-[#e5e0db] bg-white p-2">
                      <div className="text-[10px] text-[#9a9590] mb-0.5">起点</div>
                      <div className="text-[#2d2a26] text-[11px] font-medium line-clamp-2">{detailEdge.sourceNode?.label || detailEdge.sourceNode?.name || '-'}</div>
                    </div>
                    <div className="rounded-lg border border-[#e5e0db] bg-white p-2">
                      <div className="text-[10px] text-[#9a9590] mb-0.5">终点</div>
                      <div className="text-[#2d2a26] text-[11px] font-medium line-clamp-2">{detailEdge.targetNode?.label || detailEdge.targetNode?.name || '-'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-[#f5f2ee] p-2 text-center">
                      <div className="text-[10px] text-[#9a9590]">权重</div>
                      <div className="text-xs font-semibold text-[#2d2a26]">{detailEdge.weight ?? '-'}</div>
                    </div>
                    <div className="rounded-lg bg-[#f5f2ee] p-2 text-center">
                      <div className="text-[10px] text-[#9a9590]">置信度</div>
                      <div className="text-xs font-semibold text-[#2d2a26]">{detailEdge.confidence ?? '-'}</div>
                    </div>
                  </div>
                </div>
              ) : detailNode ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-[#f5f2ee] p-2.5">
                    <div className="text-[10px] text-[#9a9590] mb-0.5">节点类型</div>
                    <div className="font-medium text-[#2d2a26] text-xs">{NODE_TYPE_META[detailNode.node_type]?.label || detailNode.node_type}</div>
                    <div className="text-[11px] text-[#6b6560] mt-0.5">{NODE_TYPE_META[detailNode.node_type]?.note}</div>
                  </div>
                  {detailNode.description && (
                    <div className="rounded-lg border border-[#e5e0db] bg-white p-2.5">
                      <div className="text-[10px] text-[#9a9590] mb-0.5">核心内容</div>
                      <div className="text-[#2d2a26] leading-relaxed text-[11px]">{detailNode.description}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-[#f5f2ee] p-2 text-center">
                      <div className="text-[10px] text-[#9a9590]">类别</div>
                      <div className="text-[11px] font-medium text-[#2d2a26]">{detailNode.category || '-'}</div>
                    </div>
                    <div className="rounded-lg bg-[#f5f2ee] p-2 text-center">
                      <div className="text-[10px] text-[#9a9590]">来源片段</div>
                      <div className="text-[11px] font-medium text-[#2d2a26]">{(detailNode.source_chunk_ids || []).length}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[#e5e0db] bg-[#faf8f5] p-3 text-center">
                  <Info className="w-4 h-4 text-[#9a9590] mx-auto mb-1.5" />
                  <p className="text-[11px] text-[#9a9590]">点击任意节点或关系查看详情</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 关联信息 */}
          <Card className="rounded-xl border-[#e5e0db]">
            <CardHeader className="pb-1.5 pt-3 px-4"><CardTitle className="text-sm flex items-center gap-2"><Network className="w-4 h-4 text-[#5a9e6f]" />关联信息</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1.5 px-4 pb-3">
              {detailNode ? (() => {
                const nodeId = detailNode.id
                const relatedEdges = edges.filter(
                  (e) => getEdgeSource(e) === nodeId || getEdgeTarget(e) === nodeId
                )
                const upstream = relatedEdges
                  .filter((e) => getEdgeTarget(e) === nodeId)
                  .map((e) => ({ edge: e, node: nodeMap[getEdgeSource(e)] }))
                  .filter((r) => r.node)
                const downstream = relatedEdges
                  .filter((e) => getEdgeSource(e) === nodeId)
                  .map((e) => ({ edge: e, node: nodeMap[getEdgeTarget(e)] }))
                  .filter((r) => r.node)

                if (!upstream.length && !downstream.length) {
                  return <p className="text-[11px] text-[#9a9590]">该节点暂无关联关系</p>
                }

                return (
                  <div className="space-y-1.5">
                    {upstream.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#9a9590] mb-1">上游节点</div>
                        {upstream.slice(0, 5).map(({ edge, node }) => (
                          <div key={node.id} onClick={() => handleNodeClick(node)} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[#f5f2ee] mb-0.5 cursor-pointer hover:bg-[#ede8e2] transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_TYPE_META[node.node_type]?.color || '#64748b' }} />
                            <span className="text-[11px] text-[#2d2a26] truncate">{getNodeTitle(node)}</span>
                            <span className="text-[10px] text-[#9a9590] ml-auto flex-shrink-0">{EDGE_TYPE_META[edge.edge_type]?.label || edge.edge_type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {downstream.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#9a9590] mb-1">下游节点</div>
                        {downstream.slice(0, 5).map(({ edge, node }) => (
                          <div key={node.id} onClick={() => handleNodeClick(node)} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[#f5f2ee] mb-0.5 cursor-pointer hover:bg-[#ede8e2] transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_TYPE_META[node.node_type]?.color || '#64748b' }} />
                            <span className="text-[11px] text-[#2d2a26] truncate">{getNodeTitle(node)}</span>
                            <span className="text-[10px] text-[#9a9590] ml-auto flex-shrink-0">{EDGE_TYPE_META[edge.edge_type]?.label || edge.edge_type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })() : detailEdge ? (() => {
                const sNode = detailEdge.sourceNode
                const tNode = detailEdge.targetNode
                const sRelated = sNode ? edges
                  .filter((e) => getEdgeSource(e) === sNode.id && getEdgeTarget(e) !== tNode?.id)
                  .map((e) => nodeMap[getEdgeTarget(e)])
                  .filter(Boolean)
                  .slice(0, 3) : []
                const tRelated = tNode ? edges
                  .filter((e) => getEdgeTarget(e) === tNode.id && getEdgeSource(e) !== sNode?.id)
                  .map((e) => nodeMap[getEdgeSource(e)])
                  .filter(Boolean)
                  .slice(0, 3) : []

                if (!sRelated.length && !tRelated.length) {
                  return <p className="text-[11px] text-[#9a9590]">该关系两端暂无其他关联</p>
                }

                return (
                  <div className="space-y-1.5">
                    {sRelated.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#9a9590] mb-1">起点其他关联</div>
                        {sRelated.map((node) => (
                          <div key={node.id} onClick={() => handleNodeClick(node)} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[#f5f2ee] mb-0.5 cursor-pointer hover:bg-[#ede8e2] transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_TYPE_META[node.node_type]?.color || '#64748b' }} />
                            <span className="text-[11px] text-[#2d2a26] truncate">{getNodeTitle(node)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {tRelated.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#9a9590] mb-1">终点其他关联</div>
                        {tRelated.map((node) => (
                          <div key={node.id} onClick={() => handleNodeClick(node)} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[#f5f2ee] mb-0.5 cursor-pointer hover:bg-[#ede8e2] transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_TYPE_META[node.node_type]?.color || '#64748b' }} />
                            <span className="text-[11px] text-[#2d2a26] truncate">{getNodeTitle(node)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })() : (
                <div className="rounded-lg border border-dashed border-[#e5e0db] bg-[#faf8f5] p-3 text-center">
                  <Network className="w-4 h-4 text-[#9a9590] mx-auto mb-1.5" />
                  <p className="text-[11px] text-[#9a9590]">点击节点或关系后显示关联信息</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
