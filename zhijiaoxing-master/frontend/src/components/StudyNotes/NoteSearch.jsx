import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Search,
  X,
  Filter,
  Calendar,
  Clock,
  Loader2
} from 'lucide-react'

const DATE_RANGES = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '最近一周' },
  { value: 'month', label: '最近一月' },
  { value: 'quarter', label: '最近三月' },
  { value: 'year', label: '最近一年' },
]

export const TAG_COLORS = [
  { name: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { name: 'green', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  { name: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  { name: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  { name: 'purple', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { name: 'pink', bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  { name: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { name: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
]

export function getTagColor(tagName) {
  const hash = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return TAG_COLORS[hash % TAG_COLORS.length]
}

export function highlightText(text, keyword) {
  if (!keyword || !text) return text
  
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export default function NoteSearch({
  myCourses = [],
  allTags = [],
  onSearch,
  onTagFilter,
  loading = false,
  initialKeyword = '',
  initialCourse = 'all',
  initialDateRange = 'all',
  initialTags = [],
}) {
  const [keyword, setKeyword] = useState(initialKeyword)
  const [selectedCourse, setSelectedCourse] = useState(initialCourse)
  const [dateRange, setDateRange] = useState(initialDateRange)
  const [selectedTags, setSelectedTags] = useState(initialTags)
  const [showFilters, setShowFilters] = useState(false)
  
  const debounceTimer = useRef(null)
  const inputRef = useRef(null)

  const debouncedSearch = useCallback((searchParams) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    debounceTimer.current = setTimeout(() => {
      onSearch?.(searchParams)
    }, 300)
  }, [onSearch])

  const handleKeywordChange = (value) => {
    setKeyword(value)
    debouncedSearch({
      keyword: value,
      course_id: selectedCourse !== 'all' ? selectedCourse : undefined,
      date_range: dateRange !== 'all' ? dateRange : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    })
  }

  const handleCourseChange = (value) => {
    setSelectedCourse(value)
    onSearch?.({
      keyword: keyword || undefined,
      course_id: value !== 'all' ? value : undefined,
      date_range: dateRange !== 'all' ? dateRange : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    })
  }

  const handleDateRangeChange = (value) => {
    setDateRange(value)
    onSearch?.({
      keyword: keyword || undefined,
      course_id: selectedCourse !== 'all' ? selectedCourse : undefined,
      date_range: value !== 'all' ? value : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    })
  }

  const handleTagClick = (tag) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]
    
    setSelectedTags(newTags)
    onTagFilter?.(newTags)
  }

  const clearAllFilters = () => {
    setKeyword('')
    setSelectedCourse('all')
    setDateRange('all')
    setSelectedTags([])
    onSearch?.({})
    onTagFilter?.([])
  }

  const hasActiveFilters = keyword || selectedCourse !== 'all' || dateRange !== 'all' || selectedTags.length > 0

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={inputRef}
            placeholder="搜索笔记标题或内容..."
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
          )}
          {keyword && !loading && (
            <button
              onClick={() => handleKeywordChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="w-4 h-4 mr-2" />
              筛选
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                  {(keyword ? 1 : 0) + (selectedCourse !== 'all' ? 1 : 0) + (dateRange !== 'all' ? 1 : 0) + selectedTags.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  按课程筛选
                </label>
                <Select value={selectedCourse} onValueChange={handleCourseChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择课程" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部课程</SelectItem>
                    {myCourses.map(course => (
                      <SelectItem key={course.id} value={String(course.id)}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  按时间筛选
                </label>
                <Select value={dateRange} onValueChange={handleDateRangeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择时间范围" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {allTags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    按标签筛选
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {allTags.map(tag => {
                      const color = getTagColor(tag)
                      const isSelected = selectedTags.includes(tag)
                      return (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={`cursor-pointer transition-all ${
                            isSelected 
                              ? `${color.bg} ${color.text} ${color.border}` 
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => handleTagClick(tag)}
                        >
                          {tag}
                          {isSelected && (
                            <X className="w-3 h-3 ml-1" />
                          )}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="w-full text-gray-500"
                >
                  清除所有筛选
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">当前筛选:</span>
          {keyword && (
            <Badge variant="secondary" className="gap-1">
              关键词: {keyword}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => handleKeywordChange('')}
              />
            </Badge>
          )}
          {selectedCourse !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              课程: {myCourses.find(c => String(c.id) === selectedCourse)?.title || selectedCourse}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => handleCourseChange('all')}
              />
            </Badge>
          )}
          {dateRange !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              时间: {DATE_RANGES.find(r => r.value === dateRange)?.label}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => handleDateRangeChange('all')}
              />
            </Badge>
          )}
          {selectedTags.map(tag => (
            <Badge 
              key={tag} 
              variant="secondary" 
              className="gap-1"
            >
              标签: {tag}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => handleTagClick(tag)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
