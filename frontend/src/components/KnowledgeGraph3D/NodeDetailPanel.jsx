import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { X, BookOpen, Target, Link2, BarChart3, Lightbulb, ChevronRight } from 'lucide-react'

const TYPE_CONFIG = {
  course:           { color: '#d4a853', label: '课程' },
  chapter:          { color: '#5a9e6f', label: '章节' },
  knowledge_point:  { color: '#4a90d9', label: '知识点' },
  objective:        { color: '#e07c4f', label: '目标' },
  skill:            { color: '#8b6fb0', label: '技能' },
  case:             { color: '#e05d6f', label: '案例' },
  exercise:         { color: '#3db8a0', label: '练习' },
  resource:         { color: '#7a8b99', label: '资源' },
}

const EDGE_TYPE_LABELS = {
  contains: '包含',
  prerequisite: '前置依赖',
  related: '语义关联',
  supports_objective: '支撑目标',
  applies_to: '应用于',
  assesses: '评估',
  recommended_after: '建议后续学习',
}

const EDGE_TYPE_DESC = {
  contains: '层级包含关系',
  prerequisite: '学习前置依赖',
  related: '语义上的关联',
  supports_objective: '支撑课程目标',
  applies_to: '知识应用场景',
  assesses: '评估方式',
  recommended_after: '建议的学习顺序',
}

const DIFFICULTY_LABELS = {
  beginner: { label: '入门', color: '#4ade80' },
  intermediate: { label: '进阶', color: '#facc15' },
  advanced: { label: '高级', color: '#f87171' },
}

export default function NodeDetailPanel({ node, edges = [], nodes = [], onClose, onNavigateToNode }) {
  if (!node) return null

  const typeConf = TYPE_CONFIG[node.node_type] || TYPE_CONFIG.knowledge_point

  // 找到与该节点相关的边
  const relatedEdges = useMemo(() => {
    const nid = node.id
    return edges.filter((e) => {
      const s = e.source_node_id ?? e.source
      const t = e.target_node_id ?? e.target
      return s === nid || t === nid
    })
  }, [node.id, edges])

  // 邻居节点
  const neighbors = useMemo(() => {
    const nid = node.id
    const ids = new Set()
    relatedEdges.forEach((e) => {
      const s = e.source_node_id ?? e.source
      const t = e.target_node_id ?? e.target
      if (s === nid) ids.add(t)
      if (t === nid) ids.add(s)
    })
    return nodes.filter((n) => ids.has(n.id))
  }, [node.id, relatedEdges, nodes])

  const properties = node.properties || {}

  return (
    <div className="h-full flex flex-col bg-white/95 backdrop-blur-sm">
      {/* 头部 */}
      <div className="p-4 border-b flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: typeConf.color }} />
            <Badge variant="outline" className="text-xs" style={{ borderColor: typeConf.color, color: typeConf.color }}>
              {typeConf.label}
            </Badge>
            {properties.difficulty && DIFFICULTY_LABELS[properties.difficulty] && (
              <Badge variant="outline" className="text-xs" style={{ borderColor: DIFFICULTY_LABELS[properties.difficulty].color, color: DIFFICULTY_LABELS[properties.difficulty].color }}>
                {DIFFICULTY_LABELS[properties.difficulty].label}
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold text-[#2d2a26] truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {node.label || node.name}
          </h3>
        </div>
        <Button variant="ghost" size="icon" className="flex-shrink-0 -mt-1 -mr-2" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* 描述 */}
          {node.description && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-[#2d2a26]">
                <BookOpen className="w-3.5 h-3.5" />
                描述
              </div>
              <p className="text-sm text-[#6b6560] leading-relaxed">{node.description}</p>
            </div>
          )}

          {/* 属性 */}
          {Object.keys(properties).length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-[#2d2a26]">
                <BarChart3 className="w-3.5 h-3.5" />
                属性
              </div>
              <div className="space-y-1.5">
                {Object.entries(properties).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-[#9a9590]">{key}</span>
                    <span className="text-[#2d2a26] font-medium">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 类别 */}
          {node.category && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-[#2d2a26]">
                <Target className="w-3.5 h-3.5" />
                类别
              </div>
              <Badge className="bg-[#f5f2ee] text-[#6b6560]">{node.category}</Badge>
            </div>
          )}

          <Separator />

          {/* 关联关系 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-[#2d2a26]">
              <Link2 className="w-3.5 h-3.5" />
              关联关系 ({relatedEdges.length})
            </div>
            {relatedEdges.length === 0 ? (
              <p className="text-sm text-[#9a9590]">暂无关联</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {relatedEdges.map((e, i) => {
                  const s = e.source_node_id ?? e.source
                  const t = e.target_node_id ?? e.target
                  const isSource = s === node.id
                  const otherId = isSource ? t : s
                  const other = nodes.find((n) => n.id === otherId)
                  const direction = isSource ? '→' : '←'
                  const edgeLabel = EDGE_TYPE_LABELS[e.edge_type] || e.edge_type
                  const edgeDesc = EDGE_TYPE_DESC[e.edge_type] || ''
                  return (
                    <div
                      key={i}
                      className="py-1.5 px-2 rounded-md hover:bg-[#f5f2ee] cursor-pointer transition-colors"
                      onClick={() => onNavigateToNode?.(otherId)}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[#9a9590]">{direction}</span>
                        <Badge variant="outline" className="text-[10px] py-0">{edgeLabel}</Badge>
                        <span className="text-[#2d2a26] truncate">{other?.label || other?.name || otherId}</span>
                        <ChevronRight className="w-3 h-3 text-[#9a9590] ml-auto flex-shrink-0" />
                      </div>
                      {edgeDesc && <p className="text-[10px] text-[#9a9590] ml-5 mt-0.5">{edgeDesc}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* 邻居节点 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-[#2d2a26]">
              <Lightbulb className="w-3.5 h-3.5" />
              相关节点 ({neighbors.length})
            </div>
            {neighbors.length === 0 ? (
              <p className="text-sm text-[#9a9590]">暂无相关节点</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {neighbors.map((n) => {
                  const tc = TYPE_CONFIG[n.node_type] || TYPE_CONFIG.knowledge_point
                  return (
                    <Badge
                      key={n.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-[#f5f2ee] transition-colors"
                      style={{ borderColor: tc.color, color: tc.color }}
                      onClick={() => onNavigateToNode?.(n.id)}
                    >
                      {n.label || n.name}
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
