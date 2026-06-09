import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  History, 
  Search, 
  Filter, 
  Download,
  Eye,
  User,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Settings,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { contentReview } from '@/services/api'

const actionMap = {
  approve: { label: '审核通过', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  passed: { label: '审核通过', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  reject: { label: '审核拒绝', icon: XCircle, color: 'bg-red-100 text-red-700' },
  rejected: { label: '审核拒绝', icon: XCircle, color: 'bg-red-100 text-red-700' },
  auto_review: { label: '自动审核', icon: Settings, color: 'bg-purple-100 text-purple-700' },
  spot_check: { label: '抽查审核', icon: AlertTriangle, color: 'bg-cyan-100 text-cyan-700' },
  submit: { label: '提交审核', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  assign: { label: '分配审核', icon: User, color: 'bg-amber-100 text-amber-700' },
}

export default function OperationLog() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [detailDialog, setDetailDialog] = useState({ open: false, log: null })
  const pageSize = 10

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page: currentPage,
        per_page: pageSize,
      }
      if (filterAction !== 'all') params.action = filterAction
      const response = await contentReview.getOperationLogs(params)
      if (response.success) {
        setLogs(response.data.items || [])
        setTotal(response.data.total || 0)
        setTotalPages(response.data.pages || 0)
      }
    } catch (error) {
      console.error('加载操作日志失败:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, filterAction])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const handleExport = () => {
    const csvContent = [
      ['时间', '操作人', '操作类型', '审核ID', '详情'].join(','),
      ...logs.map(log => [
        log.created_at || '',
        log.operator_name || '系统',
        actionMap[log.action]?.label || log.action,
        log.review_id || '',
        log.detail || '',
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `操作日志_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const getActionIcon = (action) => {
    const Icon = actionMap[action]?.icon || FileText
    return <Icon className="h-4 w-4" />
  }

  return (
    <div className="space-y-6">
      {/* 搜索和筛选区 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索操作人或详情..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                <SelectItem value="submit">提交审核</SelectItem>
                <SelectItem value="auto_review">自动审核</SelectItem>
                <SelectItem value="approve">审核通过</SelectItem>
                <SelectItem value="reject">审核拒绝</SelectItem>
                <SelectItem value="assign">分配审核</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <History className="h-5 w-5 mr-2 text-slate-600" />
              操作日志记录
            </CardTitle>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出日志
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-44">时间</TableHead>
                <TableHead className="w-28">操作人</TableHead>
                <TableHead className="w-28">操作类型</TableHead>
                <TableHead className="w-20">审核ID</TableHead>
                <TableHead>详情</TableHead>
                <TableHead className="w-16">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    暂无操作日志
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const actionInfo = actionMap[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' }

                  return (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm text-gray-500">
                        {log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">{log.operator_name || '系统'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={actionInfo.color}>
                          <span className="flex items-center gap-1">
                            {getActionIcon(log.action)}
                            {actionInfo.label}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-500">
                        #{log.review_id || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm line-clamp-2">{log.detail || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailDialog({ open: true, log })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, log: detailDialog.log })}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <History className="h-5 w-5 mr-2 text-slate-600" />
              操作详情
            </DialogTitle>
            <DialogDescription>
              查看操作的详细信息
            </DialogDescription>
          </DialogHeader>
          {detailDialog.log && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">操作时间</label>
                  <p className="font-medium">{detailDialog.log.created_at ? new Date(detailDialog.log.created_at).toLocaleString('zh-CN') : '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">操作人</label>
                  <p>{detailDialog.log.operator_name || '系统'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">操作类型</label>
                  <Badge className={actionMap[detailDialog.log.action]?.color || 'bg-gray-100 text-gray-700'}>
                    {actionMap[detailDialog.log.action]?.label || detailDialog.log.action}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">审核ID</label>
                  <p className="font-mono">#{detailDialog.log.review_id || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">操作详情</label>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{detailDialog.log.detail || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
