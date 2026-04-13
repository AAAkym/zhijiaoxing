import React, { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileQuestion,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react'
import { mistakeBook } from '@/services/api'

const STATUS_CONFIG = {
  unmastered: {
    label: '未掌握',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertTriangle
  },
  reviewing: {
    label: '复习中',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: RefreshCw
  },
  mastered: {
    label: '已掌握',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle
  }
}

export default function MistakeList({
  mistakes = [],
  loading = false,
  myCourses = [],
  filters = {},
  pagination = {},
  onSelectMistake,
  onFilterChange,
  onUpdateStatus
}) {
  const [selectedIds, setSelectedIds] = useState([])
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [batchAnalysis, setBatchAnalysis] = useState('')
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(null) // 修复：记录正在更新状态的错题ID
  const abortControllerRef = useRef(null)

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const truncateText = (text, maxLength = 100) => {
    if (!text) return ''
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
  }

  const handleCourseFilter = (value) => {
    onFilterChange({ course_id: value === 'all' ? '' : value })
  }

  const handleStatusFilter = (value) => {
    onFilterChange({ mastery_status: value === 'all' ? '' : value })
  }

  const handlePageChange = (newPage) => {
    onFilterChange({ page: newPage })
    setSelectedIds([])
  }

  // 修复：增加状态更新反馈，显示加载状态和错误提示
  const handleQuickStatusUpdate = async (e, mistakeId, newStatus) => {
    e.stopPropagation()
    setStatusUpdating(mistakeId)
    try {
      await onUpdateStatus(mistakeId, newStatus)
      // 成功后不需要额外提示，列表会自动刷新
    } catch (err) {
      console.error('快速更新状态失败:', err)
      alert('状态更新失败，请稍后重试') // 修复：增加用户可见的错误提示
    } finally {
      setStatusUpdating(null)
    }
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(mistakes.map(m => m.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectMistake = (mistakeId, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, mistakeId])
    } else {
      setSelectedIds(prev => prev.filter(id => id !== mistakeId))
    }
  }

  const handleBatchAnalyze = useCallback(async () => {
    if (selectedIds.length === 0) return

    setIsBatchAnalyzing(true)
    setBatchAnalysis('')
    setShowBatchDialog(true)

    abortControllerRef.current = new AbortController()

    try {
      const response = await mistakeBook.batchAnalyzeMistakesStream(selectedIds)
      
      // 修复：检查 response.body 是否存在，避免空响应导致崩溃
      if (!response || !response.body) {
        throw new Error('无效的响应：无法获取分析数据')
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                setBatchAnalysis(prev => prev + data.content)
              }
              if (data.error) {
                setBatchAnalysis(prev => prev + '\n错误: ' + data.error)
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }

      setIsBatchAnalyzing(false)
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Batch analysis error:', err)
        setBatchAnalysis('分析失败，请稍后重试')
      }
      setIsBatchAnalyzing(false)
    }
  }, [selectedIds])

  const closeBatchDialog = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setShowBatchDialog(false)
    setBatchAnalysis('')
  }

  const renderBatchAnalysisContent = (content) => {
    if (!content) return null

    const sections = content.split(/##\s*/)
    const elements = []

    sections.forEach((section, index) => {
      if (!section.trim()) return

      const lines = section.trim().split('\n')
      const title = lines[0].trim()
      const body = lines.slice(1).join('\n').trim()

      const getIcon = (titleText) => {
        if (titleText.includes('错误模式')) return <AlertTriangle className="w-5 h-5 text-red-500" />
        if (titleText.includes('知识点') || titleText.includes('薄弱')) return <BookOpen className="w-5 h-5 text-blue-500" />
        if (titleText.includes('学习建议')) return <RefreshCw className="w-5 h-5 text-amber-500" />
        if (titleText.includes('学习路径')) return <CheckCircle className="w-5 h-5 text-green-500" />
        return <Sparkles className="w-5 h-5 text-purple-500" />
      }

      const getBgColor = (titleText) => {
        if (titleText.includes('错误模式')) return 'bg-red-50 border-red-200'
        if (titleText.includes('知识点') || titleText.includes('薄弱')) return 'bg-blue-50 border-blue-200'
        if (titleText.includes('学习建议')) return 'bg-amber-50 border-amber-200'
        if (titleText.includes('学习路径')) return 'bg-green-50 border-green-200'
        return 'bg-gray-50 border-gray-200'
      }

      elements.push(
        <div key={index} className={`rounded-lg border p-4 mb-4 ${getBgColor(title)}`}>
          <div className="flex items-center gap-2 mb-2">
            {getIcon(title)}
            <h4 className="font-semibold text-gray-800">{title}</h4>
          </div>
          <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
            {body}
          </div>
        </div>
      )
    })

    return elements
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500">加载中...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">课程筛选:</span>
          <Select
            value={filters.course_id || 'all'}
            onValueChange={handleCourseFilter}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="全部课程" />
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

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">状态筛选:</span>
          <Select
            value={filters.mastery_status || 'all'}
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="unmastered">未掌握</SelectItem>
              <SelectItem value="reviewing">复习中</SelectItem>
              <SelectItem value="mastered">已掌握</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {selectedIds.length > 0 && (
            <Button
              onClick={handleBatchAnalyze}
              disabled={isBatchAnalyzing}
              className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {isBatchAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  批量分析 ({selectedIds.length})
                </>
              )}
            </Button>
          )}
          <span className="text-sm text-gray-500">
            共 {pagination.total || 0} 道错题
          </span>
        </div>
      </div>

      <Dialog open={showBatchDialog} onOpenChange={closeBatchDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              批量错因分析
              <Badge variant="secondary" className="ml-2">
                {selectedIds.length} 道错题
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {isBatchAnalyzing && !batchAnalysis && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                <p className="text-gray-500">AI 正在综合分析 {selectedIds.length} 道错题...</p>
                <div className="flex gap-1 mt-3">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            {batchAnalysis && (
              <div className="space-y-2">
                {renderBatchAnalysisContent(batchAnalysis)}
                {isBatchAnalyzing && (
                  <div className="flex items-center gap-2 text-purple-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在生成...
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {mistakes.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <FileQuestion className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-2">暂无错题记录</p>
            <p className="text-gray-400 text-sm">完成练习后，错题会自动添加到这里</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Checkbox
              id="select-all"
              checked={selectedIds.length === mistakes.length && mistakes.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm text-gray-600 cursor-pointer">
              全选当前页
            </label>
          </div>

          <div className="space-y-3">
            {mistakes.map((mistake) => {
              const statusConfig = STATUS_CONFIG[mistake.mastery_status] || STATUS_CONFIG.unmastered
              const StatusIcon = statusConfig.icon
              
              return (
                <Card
                  key={mistake.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    mistake.mastery_status === 'mastered'
                      ? 'border-l-4 border-l-green-500'
                      : 'border-l-4 border-l-red-500'
                  } ${selectedIds.includes(mistake.id) ? 'ring-2 ring-purple-300 bg-purple-50/30' : ''}`}
                  onClick={() => onSelectMistake(mistake)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(mistake.id)}
                          onCheckedChange={(checked) => handleSelectMistake(mistake.id, checked)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          {mistake.course_title && (
                            <Badge variant="outline" className="text-gray-600">
                              <BookOpen className="w-3 h-3 mr-1" />
                              {mistake.course_title}
                            </Badge>
                          )}
                          {mistake.mistake_count > 1 && (
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              错误 {mistake.mistake_count} 次
                            </Badge>
                          )}
                          {mistake.ai_analysis && (
                            <Badge variant="outline" className="text-purple-600 border-purple-200">
                              <Sparkles className="w-3 h-3 mr-1" />
                              已分析
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-gray-800 font-medium mb-2 line-clamp-2">
                          {truncateText(mistake.question_content, 150)}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            最近错误: {formatDate(mistake.last_mistake_at)}
                          </span>
                          {mistake.knowledge_tags && mistake.knowledge_tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {mistake.knowledge_tags.slice(0, 3).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 shrink-0">
                        {mistake.mastery_status === 'unmastered' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={(e) => handleQuickStatusUpdate(e, mistake.id, 'reviewing')}
                            disabled={statusUpdating === mistake.id} // 修复：禁用正在更新的按钮
                          >
                            {statusUpdating === mistake.id ? ( // 修复：显示加载状态
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '开始复习'
                            )}
                          </Button>
                        )}
                        {mistake.mastery_status === 'reviewing' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={(e) => handleQuickStatusUpdate(e, mistake.id, 'mastered')}
                            disabled={statusUpdating === mistake.id}
                          >
                            {statusUpdating === mistake.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '标记掌握'
                            )}
                          </Button>
                        )}
                        {mistake.mastery_status === 'mastered' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-orange-600 border-orange-200 hover:bg-orange-50"
                            onClick={(e) => handleQuickStatusUpdate(e, mistake.id, 'unmastered')}
                            disabled={statusUpdating === mistake.id}
                          >
                            {statusUpdating === mistake.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '重新学习'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => handlePageChange(filters.page - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一页
              </Button>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  第 {filters.page} / {pagination.total_pages} 页
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= pagination.total_pages}
                onClick={() => handlePageChange(filters.page + 1)}
              >
                下一页
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
