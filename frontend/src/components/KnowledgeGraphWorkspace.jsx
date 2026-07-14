import React, { useEffect, useMemo, useState } from 'react'
import { Activity, Brain, CheckCircle, FileText, Loader2, Network, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { courseGeneration, knowledgeGraph } from '../services/api'
import RagReliabilityPanel from './RagReliabilityPanel'

const NODE_TYPES = ['all', 'course', 'chapter', 'knowledge_point', 'objective', 'skill', 'case', 'exercise', 'resource']
const EDGE_TYPES = ['all', 'contains', 'prerequisite', 'related', 'supports_objective', 'applies_to', 'assesses', 'recommended_after']

function layoutNodes(nodes, width, height) {
  if (!nodes.length) return []
  const centerX = width / 2
  const centerY = height / 2
  const rings = { course: 0, chapter: 110, objective: 165, skill: 210, knowledge_point: 250 }
  const grouped = nodes.reduce((acc, node) => {
    const key = node.node_type || 'knowledge_point'
    acc[key] = acc[key] || []
    acc[key].push(node)
    return acc
  }, {})
  return nodes.map((node) => {
    const group = grouped[node.node_type || 'knowledge_point'] || nodes
    const idx = group.findIndex((n) => n.id === node.id)
    const radius = rings[node.node_type] ?? 225
    const angle = group.length <= 1 ? 0 : (Math.PI * 2 * idx) / group.length
    return {
      ...node,
      x: radius === 0 ? centerX : centerX + radius * Math.cos(angle),
      y: radius === 0 ? centerY : centerY + radius * Math.sin(angle),
    }
  })
}

export default function KnowledgeGraphWorkspace({ courses = [] }) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id ? String(courses[0].id) : '')
  const [inputType, setInputType] = useState('text')
  const [syllabusText, setSyllabusText] = useState('')
  const [graph, setGraph] = useState({ nodes: [], edges: [], metrics: {}, quality_report: {} })
  const [courseProfile, setCourseProfile] = useState(null)
  const [agents, setAgents] = useState([])
  const [messages, setMessages] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodeFilter, setNodeFilter] = useState('all')
  const [edgeFilter, setEdgeFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [ragRequired, setRagRequired] = useState(true)
  const [citationStyle, setCitationStyle] = useState('bracket')
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    if (!selectedCourse && courses[0]?.id) setSelectedCourse(String(courses[0].id))
  }, [courses, selectedCourse])

  const loadWorkspace = async () => {
    if (!selectedCourse) return
    setLoading(true)
    try {
      const params = {
        node_type: nodeFilter === 'all' ? undefined : nodeFilter,
        edge_type: edgeFilter === 'all' ? undefined : edgeFilter,
      }
      const [graphRes, profileRes, agentsRes, messagesRes] = await Promise.allSettled([
        knowledgeGraph.getGraph(selectedCourse, params),
        knowledgeGraph.getCourseProfile(selectedCourse),
        courseGeneration.getAgentsStatus(),
        fetchMessages(),
      ])
      if (graphRes.status === 'fulfilled') setGraph(graphRes.value)
      if (profileRes.status === 'fulfilled') setCourseProfile(profileRes.value?.course_profile || null)
      if (agentsRes.status === 'fulfilled') setAgents(Object.values(agentsRes.value?.agents || {}))
      if (messagesRes.status === 'fulfilled') setMessages(messagesRes.value?.messages || [])
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    const response = await fetch('/api/resource-generation/messages/log?limit=20', { credentials: 'include' })
    if (!response.ok) return { messages: [] }
    return response.json()
  }

  useEffect(() => {
    loadWorkspace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, nodeFilter, edgeFilter])

  const importSyllabus = async () => {
    if (!selectedCourse || !syllabusText.trim()) return
    setImporting(true)
    try {
      const result = await knowledgeGraph.importSyllabus(selectedCourse, {
        input_type: inputType,
        content: inputType === 'json' ? JSON.parse(syllabusText) : syllabusText,
        rag_required: ragRequired,
        citation_style: citationStyle,
      })
      setImportResult(result)
      await loadWorkspace()
    } catch (err) {
      alert(`导入失败：${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  const retrieveEvidence = async () => {
    if (!selectedCourse || !query.trim()) return
    const res = await knowledgeGraph.retrieve({ course_id: Number(selectedCourse), query, top_k: 6 })
    setEvidence(res.evidence || [])
  }

  const width = 820
  const height = 520
  const laidOutNodes = useMemo(() => layoutNodes(graph.nodes || [], width, height), [graph.nodes])
  const nodeMap = useMemo(() => Object.fromEntries(laidOutNodes.map((node) => [node.id, node])), [laidOutNodes])

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#2d2a26]">知识图谱与Agent协同工作台</h2>
          <p className="text-[#6b6560]">导入课程大纲，构建图谱，检索证据，并观察多智能体协同状态</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="选择课程" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={String(course.id)}>{course.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadWorkspace} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_340px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base"><FileText className="w-4 h-4 mr-2" />大纲导入</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={inputType} onValueChange={setInputType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">文本</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={syllabusText}
                onChange={(e) => setSyllabusText(e.target.value)}
                rows={8}
                placeholder="粘贴课程大纲：章节、课程目标、知识点、先修要求、参考资料..."
              />
              <label className="flex items-center justify-between gap-3 rounded border bg-white p-2 text-sm">
                <span>强制 RAG 引用校验</span>
                <input type="checkbox" checked={ragRequired} onChange={(event) => setRagRequired(event.target.checked)} />
              </label>
              <div className="space-y-1">
                <Label>引用风格</Label>
                <Select value={citationStyle} onValueChange={setCitationStyle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bracket">方括号 [S1]</SelectItem>
                    <SelectItem value="footnote">脚注</SelectItem>
                    <SelectItem value="inline">行内来源</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-[#d4a853] hover:bg-[#c49a48]" onClick={importSyllabus} disabled={importing || !selectedCourse}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Network className="w-4 h-4 mr-2" />}
                构建知识图谱
              </Button>
              <RagReliabilityPanel data={importResult} title="本次导入引用可靠性" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base"><Activity className="w-4 h-4 mr-2" />Agent状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.length === 0 && <p className="text-sm text-[#6b6560]">暂无状态</p>}
              {agents.map((agent) => (
                <div key={agent.name || agent.agent_name} className="flex items-center justify-between rounded border p-2">
                  <div>
                    <p className="text-sm font-medium">{agent.role || agent.agent_role || agent.name}</p>
                    <p className="text-xs text-[#6b6560]">{agent.current_task || agent.agent_name || '等待任务'}</p>
                  </div>
                  <Badge variant="outline">{agent.status || 'idle'}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <CardTitle className="flex items-center text-base"><Brain className="w-4 h-4 mr-2" />课程知识图谱</CardTitle>
              <div className="flex gap-2">
                <Select value={nodeFilter} onValueChange={setNodeFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{NODE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={edgeFilter} onValueChange={setEdgeFilter}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{EDGE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Metric label="节点" value={graph.metrics?.node_count || 0} />
              <Metric label="边" value={graph.metrics?.edge_count || 0} />
              <Metric label="引用覆盖" value={`${graph.quality_report?.source_coverage_rate || 0}%`} />
              <Metric label="孤立节点" value={graph.quality_report?.isolated_node_count || 0} />
            </div>
            <div className="border rounded-lg bg-[#fbfaf8] overflow-hidden">
              <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="h-[520px]">
                {(graph.edges || []).map((edge) => {
                  const source = nodeMap[edge.source]
                  const target = nodeMap[edge.target]
                  if (!source || !target) return null
                  return (
                    <line
                      key={edge.id}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="#7c8a99"
                      strokeWidth={Math.max(1, (edge.weight || 0.6) * 3)}
                      opacity={0.42}
                    />
                  )
                })}
                {laidOutNodes.map((node) => (
                  <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNode(node)}>
                    <circle cx={node.x} cy={node.y} r={Math.max(16, Math.min(36, node.size || 20))} fill={node.color || '#64748b'} opacity={selectedNode?.id === node.id ? 1 : 0.86} />
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">{String(node.label || '').slice(0, 5)}</text>
                  </g>
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base"><ShieldCheck className="w-4 h-4 mr-2" />画像与质量</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>课程难度：<Badge variant="outline">{courseProfile?.difficulty || '-'}</Badge></p>
              <p>知识密度：{courseProfile?.knowledge_density ?? '-'}</p>
              <p>实践比例：{courseProfile?.practice_ratio ?? '-'}</p>
              <p>平均边权重：{graph.quality_report?.average_edge_weight ?? '-'}</p>
              <p>缺失引用：{graph.quality_report?.missing_citation_count ?? 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">节点详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!selectedNode && <p className="text-[#6b6560]">点击图谱节点查看证据片段</p>}
              {selectedNode && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{selectedNode.label}</p>
                    <Badge>{selectedNode.node_type}</Badge>
                  </div>
                  <p className="text-[#6b6560]">{selectedNode.description || '暂无描述'}</p>
                  {(selectedNode.sources || []).slice(0, 3).map((source) => (
                    <div key={source.id} className="rounded border p-2">
                      <p className="font-medium">[{source.reference_code}] {source.title}</p>
                      <p className="text-xs text-[#6b6560]">{source.excerpt}</p>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base"><Search className="w-4 h-4 mr-2" />RAG证据检索</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>查询</Label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例如：递归函数、机器学习流程" />
              </div>
              <Button variant="outline" className="w-full" onClick={retrieveEvidence}>检索证据</Button>
              {evidence.map((item) => (
                <div key={`${item.source_id}-${item.title}`} className="rounded border p-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">[{item.source_id}] {item.title}</p>
                    <Badge variant="outline">{Math.round((item.confidence || 0) * 100)}%</Badge>
                  </div>
                  <p className="text-xs text-[#6b6560]">{item.excerpt}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base"><CheckCircle className="w-4 h-4 mr-2" />协同消息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {messages.slice(0, 6).map((msg) => (
                <div key={msg.id} className="rounded border p-2 text-xs">
                  <p className="font-medium">{msg.sender} → {msg.receiver}</p>
                  <p className="text-[#6b6560]">{msg.msg_type}</p>
                </div>
              ))}
              {messages.length === 0 && <p className="text-sm text-[#6b6560]">暂无消息</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded border bg-white p-2">
      <p className="text-xs text-[#6b6560]">{label}</p>
      <p className="text-lg font-semibold text-[#2d2a26]">{value}</p>
    </div>
  )
}
