import React, { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Network, Filter, Layers, Route } from 'lucide-react'

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
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 pointer-events-none">
      {/* 过滤器 */}
      <Card className="pointer-events-auto shadow-lg rounded-xl border-0 bg-white/90 backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4 text-[#d4a853]" />
            <span className="text-sm font-medium text-[#2d2a26]">筛选</span>
          </div>
          <div className="flex gap-2">
            <Select value={nodeFilter} onValueChange={onNodeFilterChange}>
              <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NODE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={edgeFilter} onValueChange={onEdgeFilterChange}>
              <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
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
        <Card className="pointer-events-auto shadow-lg rounded-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Route className="w-4 h-4 text-[#e07c4f]" />
              <span className="text-sm font-medium text-[#2d2a26]">学习路径</span>
            </div>
            <Select value={selectedPathId || ''} onValueChange={onPathSelect}>
              <SelectTrigger className="w-full h-8 text-xs rounded-lg">
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
        <Card className="pointer-events-auto shadow-lg rounded-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-[#4a90d9]" />
              <span className="text-sm font-medium text-[#2d2a26]">图谱概览</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
      <Card className="pointer-events-auto shadow-lg rounded-xl border-0 bg-white/90 backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Network className="w-4 h-4 text-[#8b6fb0]" />
            <span className="text-sm font-medium text-[#2d2a26]">图例</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <Badge key={type} variant="outline" className="text-[10px] py-0" style={{ borderColor: color, color }}>
                <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />
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
        className="pointer-events-auto rounded-xl bg-white/90 backdrop-blur-sm"
        onClick={onResetView}
      >
        重置视角
      </Button>
    </div>
  )
}
