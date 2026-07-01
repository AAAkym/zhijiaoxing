import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Network, Filter, Layers, Route, ChevronRight, ChevronLeft, X } from 'lucide-react'

const NODE_TYPES = [
  { value: 'all', label: '全部类型' },
  { value: 'course', label: '课程' },
  { value: 'chapter', label: '章节' },
  { value: 'knowledge_point', label: '知识点' },
  { value: 'objective', label: '目标' },
  { value: 'skill', label: '技能' },
  { value: 'case', label: '案例' },
  { value: 'exercise', label: '练习' },
  { value: 'resource', label: '资源' },
]

const EDGE_TYPES = [
  { value: 'all', label: '全部关系' },
  { value: 'contains', label: '包含' },
  { value: 'prerequisite', label: '前置' },
  { value: 'related', label: '关联' },
  { value: 'supports_objective', label: '支撑目标' },
  { value: 'applies_to', label: '应用于' },
  { value: 'assesses', label: '评估' },
  { value: 'recommended_after', label: '建议后续' },
]

const TYPE_COLORS = {
  course: '#d4a853', chapter: '#5a9e6f', knowledge_point: '#4a90d9',
  objective: '#e07c4f', skill: '#8b6fb0', case: '#e05d6f',
  exercise: '#3db8a0', resource: '#7a8b99',
}

export default function GraphToolbar({
  nodeFilter,
  edgeFilter,
  onNodeFilterChange,
  onEdgeFilterChange,
  stats,
  learningPaths = [],
  selectedPathId,
  onPathSelect,
  onResetView,
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="absolute top-4 right-4 z-10 flex items-start gap-2 pointer-events-none">
      {/* 收起/展开按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="pointer-events-auto flex items-center justify-center w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm shadow-md border border-white/20 hover:bg-white transition-all duration-200"
        title={expanded ? '收起侧栏' : '展开侧栏'}
      >
        {expanded ? <ChevronRight className="w-4 h-4 text-[#6b6560]" /> : <ChevronLeft className="w-4 h-4 text-[#6b6560]" />}
      </button>

      {/* 侧栏内容 */}
      <div className={`pointer-events-auto flex flex-col gap-2 transition-all duration-300 overflow-hidden ${expanded ? 'w-[200px] opacity-100' : 'w-0 opacity-0'}`}>
        {/* 过滤器 */}
        <Card className="shadow-lg rounded-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Filter className="w-3.5 h-3.5 text-[#d4a853]" />
              <span className="text-xs font-medium text-[#2d2a26]">筛选</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Select value={nodeFilter} onValueChange={onNodeFilterChange}>
                <SelectTrigger className="w-full h-7 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NODE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={edgeFilter} onValueChange={onEdgeFilterChange}>
                <SelectTrigger className="w-full h-7 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDGE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 学习路径 */}
        {learningPaths.length > 0 && (
          <Card className="shadow-lg rounded-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Route className="w-3.5 h-3.5 text-[#e07c4f]" />
                <span className="text-xs font-medium text-[#2d2a26]">学习路径</span>
              </div>
              <Select value={selectedPathId || ''} onValueChange={onPathSelect}>
                <SelectTrigger className="w-full h-7 text-xs rounded-lg">
                  <SelectValue placeholder="选择学习路径" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不显示路径</SelectItem>
                  {learningPaths.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* 统计信息 */}
        {stats && (
          <Card className="shadow-lg rounded-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-[#4a90d9]" />
                <span className="text-xs font-medium text-[#2d2a26]">图谱概览</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <span className="text-[#9a9590]">节点</span>
                <span className="text-[#2d2a26] font-medium">{stats.nodeCount}</span>
                <span className="text-[#9a9590]">连线</span>
                <span className="text-[#2d2a26] font-medium">{stats.edgeCount}</span>
                <span className="text-[#9a9590]">孤立节点</span>
                <span className="text-[#2d2a26] font-medium">{stats.isolatedCount}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 图例 */}
        <Card className="shadow-lg rounded-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Network className="w-3.5 h-3.5 text-[#8b6fb0]" />
              <span className="text-xs font-medium text-[#2d2a26]">图例</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <Badge key={type} variant="outline" className="text-[10px] py-0 px-1.5" style={{ borderColor: color, color }}>
                  <span className="w-1.5 h-1.5 rounded-full mr-0.5" style={{ backgroundColor: color }} />
                  {NODE_TYPES.find((t) => t.value === type)?.label || type}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 重置视角 */}
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl bg-white/90 backdrop-blur-sm text-xs h-7"
          onClick={onResetView}
        >
          重置视角
        </Button>
      </div>
    </div>
  )
}
