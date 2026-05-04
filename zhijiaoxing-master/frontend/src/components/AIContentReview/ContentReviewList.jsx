import React, { useState, useEffect } from 'react'
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
  RotateCcw
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const mockContentData = [
  {
    id: 1,
    title: 'Python函数基础教程',
    type: 'tutorial',
    source: 'teacher',
    author: '张老师',
    status: 'pending',
    autoScore: 85,
    createdAt: '2025-03-27 10:30',
    content: '这是一篇关于Python函数基础的教程内容...',
    versions: 3
  },
  {
    id: 2,
    title: '数据结构练习题解答',
    type: 'exercise',
    source: 'ai',
    author: 'AI助手',
    status: 'auto_reviewing',
    autoScore: 92,
    createdAt: '2025-03-27 09:15',
    content: '以下是数据结构练习题的详细解答...',
    versions: 1
  },
  {
    id: 3,
    title: '机器学习概念解释',
    type: 'explanation',
    source: 'student',
    author: '李同学',
    status: 'manual_reviewing',
    autoScore: 78,
    createdAt: '2025-03-27 08:45',
    content: '机器学习是人工智能的一个分支...',
    versions: 2
  },
  {
    id: 4,
    title: 'Web开发知识点总结',
    type: 'summary',
    source: 'ai',
    author: 'AI助手',
    status: 'spot_checking',
    autoScore: 88,
    createdAt: '2025-03-26 16:20',
    content: 'Web开发涉及前端和后端技术...',
    versions: 4
  },
  {
    id: 5,
    title: '算法复杂度分析',
    type: 'tutorial',
    source: 'teacher',
    author: '王老师',
    status: 'pending',
    autoScore: 95,
    createdAt: '2025-03-26 14:10',
    content: '算法复杂度是衡量算法效率的重要指标...',
    versions: 2
  }
]

const contentTypeMap = {
  tutorial: { label: '教程', icon: BookOpen, color: 'bg-blue-100 text-blue-700' },
  exercise: { label: '练习', icon: FileText, color: 'bg-green-100 text-green-700' },
  explanation: { label: '解释', icon: MessageSquare, color: 'bg-purple-100 text-purple-700' },
  summary: { label: '总结', icon: FileText, color: 'bg-orange-100 text-orange-700' },
  qa: { label: '问答', icon: HelpCircle, color: 'bg-cyan-100 text-cyan-700' }
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
  const [contents, setContents] = useState(mockContentData)
  const [selectedIds, setSelectedIds] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [detailDialog, setDetailDialog] = useState({ open: false, content: null })
  const [reviewDialog, setReviewDialog] = useState({ open: false, content: null, action: null })
  const [reviewComment, setReviewComment] = useState('')
  const pageSize = 10

  const filteredContents = contents.filter(content => {
    const matchSearch = content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       content.author.toLowerCase().includes(searchTerm.toLowerCase())
    const matchType = filterType === 'all' || content.type === filterType
    const matchStatus = filterStatus === 'all' || content.status === filterStatus
    const matchSource = filterSource === 'all' || content.source === filterSource
    return matchSearch && matchType && matchStatus && matchSource
  })

  const totalPages = Math.ceil(filteredContents.length / pageSize)
  const paginatedContents = filteredContents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(paginatedContents.map(c => c.id))
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

  const handleBatchAction = (action) => {
    console.log(`批量${action}:`, selectedIds)
    setSelectedIds([])
  }

  const handleReview = (content, action) => {
    setReviewDialog({ open: true, content, action })
  }

  const submitReview = () => {
    console.log(`审核${reviewDialog.action}:`, reviewDialog.content?.id, reviewComment)
    setReviewDialog({ open: false, content: null, action: null })
    setReviewComment('')
  }

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-blue-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
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
                placeholder="搜索标题或作者..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="内容类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="tutorial">教程</SelectItem>
                <SelectItem value="exercise">练习</SelectItem>
                <SelectItem value="explanation">解释</SelectItem>
                <SelectItem value="summary">总结</SelectItem>
                <SelectItem value="qa">问答</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
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

            <Select value={filterSource} onValueChange={setFilterSource}>
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

            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              更多筛选
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
                    checked={selectedIds.length === paginatedContents.length && paginatedContents.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-12">ID</TableHead>
                <TableHead>标题</TableHead>
                <TableHead className="w-20">类型</TableHead>
                <TableHead className="w-20">来源</TableHead>
                <TableHead className="w-20">作者</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-20">评分</TableHead>
                <TableHead className="w-32">创建时间</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContents.map((content) => {
                const typeInfo = contentTypeMap[content.type]
                const statusInfo = statusMap[content.status]
                const sourceInfo = sourceMap[content.source]
                const TypeIcon = typeInfo.icon

                return (
                  <TableRow key={content.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(content.id)}
                        onCheckedChange={(checked) => handleSelect(content.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-500">
                      #{content.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{content.title}</span>
                        {content.versions > 1 && (
                          <Badge variant="outline" className="text-xs">
                            v{content.versions}
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
                    <TableCell className="text-sm">{content.author}</TableCell>
                    <TableCell>
                      <Badge className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${getScoreColor(content.autoScore)}`}>
                        {content.autoScore}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {content.createdAt}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setDetailDialog({ open: true, content })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>审核操作</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleReview(content, 'approve')}>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              通过审核
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReview(content, 'reject')}>
                              <XCircle className="h-4 w-4 mr-2 text-red-600" />
                              拒绝内容
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReview(content, 'return')}>
                              <RotateCcw className="h-4 w-4 mr-2 text-amber-600" />
                              退回修改
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除内容
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          共 {filteredContents.length} 条记录，第 {currentPage}/{totalPages} 页
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
            disabled={currentPage === totalPages}
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
                  <p className="font-medium">{detailDialog.content.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">作者</label>
                  <p>{detailDialog.content.author}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">类型</label>
                  <p>{contentTypeMap[detailDialog.content.type].label}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">来源</label>
                  <p>{sourceMap[detailDialog.content.source].label}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">自动评分</label>
                  <p className={`font-bold ${getScoreColor(detailDialog.content.autoScore)}`}>
                    {detailDialog.content.autoScore} 分
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">版本数</label>
                  <p>{detailDialog.content.versions} 个版本</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">内容预览</label>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg text-sm">
                  {detailDialog.content.content}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialog({ open: false, content: null })}>
              关闭
            </Button>
            <Button onClick={() => {
              setDetailDialog({ open: false, content: null })
              handleReview(detailDialog.content, 'approve')
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
              {reviewDialog.action === 'return' && '退回修改'}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.content?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                reviewDialog.action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                'bg-amber-600 hover:bg-amber-700'
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
