import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  MessageSquare,
  BookOpen,
  HelpCircle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RotateCcw,
  RefreshCw,
  Zap
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { contentReview } from '@/services/api'

const contentTypeMap = {
  knowledge_point: { label: '知识点', icon: BookOpen, color: 'bg-blue-100 text-blue-700' },
  teaching_case: { label: '教学案例', icon: FileText, color: 'bg-green-100 text-green-700' },
  exercise: { label: '练习', icon: FileText, color: 'bg-purple-100 text-purple-700' },
  teaching_content: { label: '教学内容', icon: MessageSquare, color: 'bg-orange-100 text-orange-700' },
}

const statusMap = {
  pending: { label: '待审核', color: 'bg-slate-100 text-slate-700' },
  auto_reviewing: { label: '自动审核中', color: 'bg-purple-100 text-purple-700' },
  manual_reviewing: { label: '人工审核中', color: 'bg-orange-100 text-orange-700' },
  spot_checking: { label: '抽查审核', color: 'bg-cyan-100 text-cyan-700' },
  passed: { label: '已通过', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' }
}

const sourceMap = {
  teacher: { label: '教师', color: 'bg-amber-100 text-amber-700' },
  student: { label: '学生', color: 'bg-blue-100 text-blue-700' },
  ai: { label: 'AI生成', color: 'bg-violet-100 text-violet-700' }
}

export default function ContentReviewList() {
  const [contents, setContents] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [detailDialog, setDetailDialog] = useState({ open: false, content: null })
  const [reviewDialog, setReviewDialog] = useState({ open: false, content: null, action: null })
  const [reviewComment, setReviewComment] = useState('')
  const [reviewScore, setReviewScore] = useState(3)
  const pageSize = 10

  const loadContents = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page: currentPage,
        per_page: pageSize,
      }
      if (filterStatus !== 'all') params.status = filterStatus
      if (filterType !== 'all') params.content_type = filterType
      if (filterSource !== 'all') params.source = filterSource
      if (searchTerm) params.search = searchTerm

      const response = await contentReview.getReviewList(params)
      if (response.success) {
        setContents(response.data.items || [])
        setTotal(response.data.total || 0)
        setTotalPages(response.data.pages || 0)
      }
    } catch (error) {
      console.error('加载审核列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, filterStatus, filterType, filterSource, searchTerm])

  useEffect(() => {
    loadContents()
  }, [loadContents])

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(contents.map(c => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelect = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id))
    }
  }

  const handleBatchAction = async (action) => {
    try {
      const response = await contentReview.batchReview({
        review_ids: selectedIds,
        action: action,
        comment: `批量${action === 'approve' ? '通过' : '拒绝'}`,
      })
      if (response.success) {
        setSelectedIds([])
        loadContents()
      }
    } catch (error) {
      console.error('批量操作失败:', error)
    }
  }

  const handleReview = (content, action) => {
    setReviewDialog({ open: true, content, action })
  }

  const submitReview = async () => {
    if (!reviewDialog.content) return
    try {
      const status = reviewDialog.action === 'approve' ? 'passed' : 'rejected'
      const response = await contentReview.manualReview(reviewDialog.content.id, {
        status,
        comment: reviewComment,
        score: reviewScore,
      })
      if (response.success) {
        setReviewDialog({ open: false, content: null, action: null })
        setReviewComment('')
        setReviewScore(3)
        loadContents()
      }
    } catch (error) {
      console.error('审核操作失败:', error)
    }
  }

  const handleAutoReview = async (id) => {
    try {
      const response = await contentReview.autoReview(id)
      if (response.success) {
        loadContents()
      }
    } catch (error) {
      console.error('触发自动审核失败:', error)
    }
  }

  const handleViewDetail = async (item) => {
    try {
      const response = await contentReview.getReviewDetail(item.id)
      if (response.success) {
        setDetailDialog({ open: true, content: response.data })
      }
    } catch (error) {
      console.error('获取详情失败:', error)
    }
  }

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-gray-400'
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-blue-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const formatAutoReviewResult = (resultStr) => {
    if (!resultStr) return null
    try {
      return JSON.parse(resultStr)
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      {/* 搜索和筛选区 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索标题..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            
            <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="内容类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="knowledge_point">知识点</SelectItem>
                <SelectItem value="teaching_case">教学案例</SelectItem>
                <SelectItem value="exercise">练习</SelectItem>
                <SelectItem value="teaching_content">教学内容</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="审核状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待审核</SelectItem>
                <SelectItem value="auto_reviewing">自动审核中</SelectItem>
                <SelectItem value="manual_reviewing">人工审核中</SelectItem>
                <SelectItem value="spot_checking">抽查审核</SelectItem>
                <SelectItem value="passed">已通过</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSource} onValueChange={(v) => { setFilterSource(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="内容来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                <SelectItem value="teacher">教师</SelectItem>
                <SelectItem value="student">学生</SelectItem>
                <SelectItem value="ai">AI生成</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={loadContents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox checked={true} />
                <span className="text-sm font-medium text-blue-700">
                  已选择 {selectedIds.length} 项
                </span>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleBatchAction('approve')}
                  className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  批量通过
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleBatchAction('reject')}
                  className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  批量拒绝
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSelectedIds([])}
                >
                  取消选择
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 内容列表表格 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedIds.length === contents.length && contents.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-12">ID</TableHead>
                <TableHead>标题</TableHead>
                <TableHead className="w-20">类型</TableHead>
                <TableHead className="w-20">来源</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-20">评分</TableHead>
                <TableHead className="w-32">创建时间</TableHead>
                <TableHead className="w-28">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </TableCell>
                </TableRow>
              ) : contents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    暂无审核数据
                  </TableCell>
                </TableRow>
              ) : (
                contents.map((item) => {
                  const typeInfo = contentTypeMap[item.content_type] || { label: item.content_type, icon: FileText, color: 'bg-gray-100 text-gray-700' }
                  const statusInfo = statusMap[item.status] || { label: item.status, color: 'bg-gray-100 text-gray-700' }
                  const sourceInfo = sourceMap[item.source] || { label: item.source, color: 'bg-gray-100 text-gray-700' }
                  const TypeIcon = typeInfo.icon

                  return (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={(checked) => handleSelect(item.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-500">
                        #{item.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.content_title}</span>
                          {item.version > 1 && (
                            <Badge variant="outline" className="text-xs">
                              v{item.version}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeInfo.color}>
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={sourceInfo.color}>
                          {sourceInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold ${getScoreColor(item.auto_score)}`}>
                          {item.auto_score !== null && item.auto_score !== undefined ? item.auto_score : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewDetail(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(item.status === 'pending' || item.status === 'auto_reviewing') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAutoReview(item.id)}
                              title="触发自动审核"
                            >
                              <Zap className="h-4 w-4 text-purple-600" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>审核操作</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleReview(item, 'approve')}>
                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                通过审核
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReview(item, 'reject')}>
                                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                拒绝内容
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          共 {total} 条记录，第 {currentPage}/{totalPages || 1} 页
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + 1
            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={currentPage === page ? "bg-slate-900" : ""}
              >
                {page}
              </Button>
            )
          })}
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 详情弹窗 */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, content: detailDialog.content })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>内容详情</DialogTitle>
            <DialogDescription>
              查看待审核内容的详细信息
            </DialogDescription>
          </DialogHeader>
          {detailDialog.content && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">标题</label>
                  <p className="font-medium">{detailDialog.content.content_title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">类型</label>
                  <p>{(contentTypeMap[detailDialog.content.content_type] || {}).label || detailDialog.content.content_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">来源</label>
                  <p>{(sourceMap[detailDialog.content.source] || {}).label || detailDialog.content.source}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">自动评分</label>
                  <p className={`font-bold ${getScoreColor(detailDialog.content.auto_score)}`}>
                    {detailDialog.content.auto_score !== null && detailDialog.content.auto_score !== undefined ? `${detailDialog.content.auto_score} 分` : '未评分'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">版本</label>
                  <p>{detailDialog.content.version} 个版本</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">状态</label>
                  <p>{(statusMap[detailDialog.content.status] || {}).label || detailDialog.content.status}</p>
                </div>
              </div>
              {detailDialog.content.content_body && (
                <div>
                  <label className="text-sm font-medium text-gray-500">内容预览</label>
                  <div className="mt-1 p-4 bg-gray-50 rounded-lg text-sm max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {detailDialog.content.content_body}
                  </div>
                </div>
              )}
              {detailDialog.content.auto_review_result && (() => {
                const result = formatAutoReviewResult(detailDialog.content.auto_review_result)
                if (!result) return null
                return (
                  <div>
                    <label className="text-sm font-medium text-gray-500">自动审核详情</label>
                    <div className="mt-1 p-4 bg-purple-50 rounded-lg text-sm">
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div>完整性: <span className="font-bold">{result.completeness}</span></div>
                        <div>结构: <span className="font-bold">{result.structure}</span></div>
                        <div>质量: <span className="font-bold">{result.quality}</span></div>
                        <div>相关性: <span className="font-bold">{result.relevance}</span></div>
                      </div>
                      {result.details && result.details.length > 0 && (
                        <div className="text-red-600">
                          问题: {result.details.join('; ')}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
              {detailDialog.content.review_comment && (
                <div>
                  <label className="text-sm font-medium text-gray-500">审核意见</label>
                  <div className="mt-1 p-4 bg-orange-50 rounded-lg text-sm">
                    {detailDialog.content.review_comment}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialog({ open: false, content: null })}>
              关闭
            </Button>
            <Button onClick={() => {
              const content = detailDialog.content
              setDetailDialog({ open: false, content: null })
              handleReview(content, 'approve')
            }}>
              开始审核
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审核弹窗 */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog({ open, content: reviewDialog.content, action: reviewDialog.action })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === 'approve' && '通过审核'}
              {reviewDialog.action === 'reject' && '拒绝内容'}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.content?.content_title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">审核评分 (1-5)</label>
              <div className="flex items-center gap-2 mt-1">
                {[1, 2, 3, 4, 5].map(score => (
                  <Button
                    key={score}
                    variant={reviewScore === score ? "default" : "outline"}
                    size="sm"
                    onClick={() => setReviewScore(score)}
                    className={reviewScore === score ? "bg-slate-900" : ""}
                  >
                    {score}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">审核意见</label>
              <Textarea
                placeholder="请输入审核意见..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog({ open: false, content: null, action: null })}>
              取消
            </Button>
            <Button 
              onClick={submitReview}
              className={
                reviewDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                'bg-red-600 hover:bg-red-700'
              }
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
