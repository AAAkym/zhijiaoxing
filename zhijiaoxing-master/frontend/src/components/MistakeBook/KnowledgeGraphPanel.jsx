import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { mistakeBook } from '@/services/api'

function buildLayout(nodes, width, height) {
  if (!nodes.length) return []
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) * 0.34
  return nodes.map((node, idx) => {
    const angle = (Math.PI * 2 * idx) / nodes.length
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  })
}

export default function KnowledgeGraphPanel({ courseId }) {
  const [graph, setGraph] = useState(null)
  const [loading, setLoading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [selectedNode, setSelectedNode] = useState(null)

  const fetchGraph = async () => {
    setLoading(true)
    try {
      const data = await mistakeBook.getKnowledgeGraph(courseId ? { course_id: courseId } : {})
      setGraph(data)
      if (selectedNode) {
        const found = data?.nodes?.find((n) => n.id === selectedNode.id)
        setSelectedNode(found || null)
      }
    } catch (err) {
      console.error('加载知识图谱失败', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const width = 760
  const height = 420
  const laidOutNodes = useMemo(() => buildLayout(graph?.nodes || [], width, height), [graph?.nodes])
  const nodeMap = useMemo(() => Object.fromEntries(laidOutNodes.map((node) => [node.id, node])), [laidOutNodes])

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>知识图谱可视化</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
            <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
            <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => { setZoom(1); setSelectedNode(null) }}><RotateCcw className="w-4 h-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-[420px] border rounded-lg flex items-center justify-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />加载中</div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-slate-50">
            <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="h-[420px]">
              <g transform={`translate(${width * (1 - zoom) / 2} ${height * (1 - zoom) / 2}) scale(${zoom})`}>
                {(graph?.links || []).map((link, idx) => {
                  const source = nodeMap[link.source]
                  const target = nodeMap[link.target]
                  if (!source || !target) return null
                  return (
                    <line
                      key={`${link.source}-${link.target}-${idx}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="#64748b"
                      strokeWidth={Math.max(1, Number(link.weight) || 1)}
                      strokeDasharray={link.style === 'dashed' ? '6 4' : '0'}
                      opacity={link.opacity || 0.45}
                    />
                  )
                })}

                {laidOutNodes.map((node) => (
                  <g key={node.id} onClick={() => setSelectedNode(node)} className="cursor-pointer">
                    <circle cx={node.x} cy={node.y} r={Math.max(12, Math.min(46, Number(node.size) || 14))} fill={node.color || '#0ea5e9'} opacity={selectedNode?.id === node.id ? 1 : 0.86} />
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">{String(node.label || '').slice(0, 4)}</text>
                  </g>
                ))}
              </g>
            </svg>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric title="知识点" value={graph?.metrics?.knowledge_points || 0} />
          <Metric title="关联边" value={graph?.metrics?.connections || 0} />
          <Metric title="平均掌握度" value={`${Math.round(graph?.metrics?.average_mastery || 0)}%`} />
          <Metric title="薄弱点" value={graph?.metrics?.weak_points || 0} />
        </div>

        {selectedNode && (
          <div className="p-3 rounded-lg border bg-white">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">{selectedNode.label}</p>
              <Badge variant="outline">薄弱度 {selectedNode.weakness_score}</Badge>
            </div>
            <p className="text-sm text-gray-600">掌握度：{Math.round(selectedNode.mastery_score)}%</p>
            <p className="text-sm text-gray-600">状态分布：未掌握 {selectedNode.status_breakdown?.unmastered || 0}，复习中 {selectedNode.status_breakdown?.reviewing || 0}，已掌握 {selectedNode.status_breakdown?.mastered || 0}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ title, value }) {
  return (
    <div className="p-3 rounded-lg border bg-white">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
