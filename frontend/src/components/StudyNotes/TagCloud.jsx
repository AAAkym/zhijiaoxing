import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tag,
  X,
  Plus,
  Palette,
  Check,
  Hash,
  TrendingUp
} from 'lucide-react'
import { getTagColor, TAG_COLORS } from './NoteSearch'

const TAG_SIZE_LEVELS = [
  { min: 1, max: 2, className: 'text-xs px-2 py-0.5' },
  { min: 3, max: 5, className: 'text-sm px-2.5 py-1' },
  { min: 6, max: 10, className: 'text-base px-3 py-1 font-medium' },
  { min: 11, max: Infinity, className: 'text-lg px-3 py-1.5 font-semibold' },
]

function getTagSize(count) {
  return TAG_SIZE_LEVELS.find(level => count >= level.min && count <= level.max)?.className || TAG_SIZE_LEVELS[0].className
}

export default function TagCloud({
  tagsWithCount = {},
  selectedTags = [],
  onTagSelect,
  onTagCreate,
  onTagColorChange,
  tagColors = {},
  showCreate = false,
  compact = false,
}) {
  const [newTag, setNewTag] = useState('')
  const [suggestedTags] = useState([
    '重要', '待复习', '已掌握', '难点', '考点',
    '公式', '概念', '例题', '总结', '疑问'
  ])

  const sortedTags = useMemo(() => {
    return Object.entries(tagsWithCount)
      .sort(([, a], [, b]) => b - a)
  }, [tagsWithCount])

  const handleCreateTag = () => {
    if (newTag.trim()) {
      onTagCreate?.(newTag.trim())
      setNewTag('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCreateTag()
    }
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {sortedTags.slice(0, 10).map(([tag, count]) => {
          const color = tagColors[tag] ? TAG_COLORS.find(c => c.name === tagColors[tag]) : getTagColor(tag)
          const isSelected = selectedTags.includes(tag)
          
          return (
            <Badge
              key={tag}
              variant="outline"
              className={`cursor-pointer transition-all ${
                isSelected 
                  ? `${color.bg} ${color.text} ${color.border} ring-2 ring-offset-1` 
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => onTagSelect?.(tag)}
            >
              <Hash className="w-3 h-3 mr-0.5" />
              {tag}
              <span className="ml-1 text-xs opacity-70">({count})</span>
            </Badge>
          )
        })}
        {sortedTags.length > 10 && (
          <Badge variant="outline" className="text-gray-500">
            +{sortedTags.length - 10} 更多
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Tag className="w-5 h-5 text-blue-600" />
          标签云
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedTags.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Tag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">暂无标签</p>
            <p className="text-xs text-gray-400">创建笔记时添加标签</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center">
            {sortedTags.map(([tag, count]) => {
              const color = tagColors[tag] ? TAG_COLORS.find(c => c.name === tagColors[tag]) : getTagColor(tag)
              const isSelected = selectedTags.includes(tag)
              const sizeClass = getTagSize(count)
              
              return (
                <Popover key={tag}>
                  <PopoverTrigger asChild>
                    <Badge
                      variant="outline"
                      className={`cursor-pointer transition-all ${sizeClass} ${
                        isSelected 
                          ? `${color.bg} ${color.text} ${color.border} ring-2 ring-offset-1` 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => onTagSelect?.(tag)}
                    >
                      <Hash className="w-3 h-3 mr-0.5" />
                      {tag}
                      <span className="ml-1 opacity-60">({count})</span>
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-48">
                    <div className="space-y-3">
                      <div className="text-sm font-medium">标签颜色</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {TAG_COLORS.map(c => (
                          <button
                            key={c.name}
                            onClick={() => onTagColorChange?.(tag, c.name)}
                            className={`w-6 h-6 rounded-full ${c.bg} border-2 transition-all hover:scale-110 ${
                              (tagColors[tag] || getTagColor(tag).name) === c.name 
                                ? 'ring-2 ring-offset-1 ring-gray-400' 
                                : ''
                            }`}
                          >
                            {(tagColors[tag] || getTagColor(tag).name) === c.name && (
                              <Check className={`w-3 h-3 ${c.text} mx-auto`} />
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        使用 {count} 次
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )
            })}
          </div>
        )}

        {showCreate && (
          <div className="pt-3 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="添加新标签..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button size="sm" onClick={handleCreateTag} disabled={!newTag.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {newTag === '' && suggestedTags.filter(t => !tagsWithCount[t]).length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1.5">推荐标签:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestedTags
                    .filter(t => !tagsWithCount[t])
                    .slice(0, 5)
                    .map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="cursor-pointer text-xs hover:bg-gray-100"
                        onClick={() => {
                          onTagCreate?.(tag)
                        }}
                      >
                        <Plus className="w-3 h-3 mr-0.5" />
                        {tag}
                      </Badge>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTags.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">已选标签:</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs"
                onClick={() => onTagSelect?.(null)}
              >
                清除选择
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map(tag => {
                const color = tagColors[tag] ? TAG_COLORS.find(c => c.name === tagColors[tag]) : getTagColor(tag)
                return (
                  <Badge
                    key={tag}
                    className={`${color.bg} ${color.text} ${color.border}`}
                  >
                    {tag}
                    <X 
                      className="w-3 h-3 ml-1 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation()
                        onTagSelect?.(tag)
                      }}
                    />
                  </Badge>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
