import React, { useState, useEffect } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Calendar
} from 'lucide-react'

const mockLogs = [
  {
    id: 1,
    timestamp: '2025-03-27 14:32:15',
    operator: '管理员A',
    operatorRole: 'admin',
    action: 'approve',
    targetType: 'content',
    targetId: '#1024',
    targetTitle: 'Python函数基础教程',
    details: '审核通过，评分：92分',
    ipAddress: '192.168.1.100',
    status: 'success'
  },
  {
    id: 2,
    timestamp: '2025-03-27 14:28:43',
    operator: '系统',
    operatorRole: 'system',
    action: 'auto_review',
    targetType: 'content',
    targetId: '#1025',
    targetTitle: '数据结构练习题解答',
    details: '自动审核完成，合规性：95分，教育性：88分，准确性：91分',
    ipAddress: '-',
    status: 'success'
  },
  {
    id: 3,
    timestamp: '2025-03-27 14:15:22',
    operator: '审核员B',
    operatorRole: 'reviewer',
    action: 'reject',
    targetType: 'content',
    targetId: '#1023',
    targetTitle: '机器学习概念解释',
    details: '内容存在不准确描述，建议修改后重新提交',
    ipAddress: '192.168.1.105',
    status: 'success'
  },
  {
    id: 4,
    timestamp: '2025-03-27 13:58:10',
    operator: '管理员A',
    operatorRole: 'admin',
    action: 'rollback',
    targetType: 'version',
    targetId: '#1022/v2',
    targetTitle: 'Web开发知识点总结',
    details: '回滚到版本 v2',
    ipAddress: '192.168.1.100',
    status: 'success'
  },
  {
    id: 5,
    timestamp: '2025-03-27 13:45:33',
    operator: '系统',
    operatorRole: 'system',
    action: 'spot_check',
    targetType: 'content',
    targetId: '#1020',
    targetTitle: '算法复杂度分析',
    details: '随机抽查审核通过',
    ipAddress: '-',
    status: 'success'
  },
  {
    id: 6,
    timestamp: '2025-03-27 13:30:18',
    operator: '审核员C',
    operatorRole: 'reviewer',
    action: 'modify',
    targetType: 'content',
    targetId: '#1019',
    targetTitle: '数据库基础教程',
    details: '修改内容后通过审核',
    ipAddress: '192.168.1.108',
    status: 'success'
  },
  {
    id: 7,
    timestamp: '2025-03-27 13:15:45',
    operator: '管理员A',
    operatorRole: 'admin',
    action: 'config_change',
    targetType: 'system',
    targetId: '-',
    targetTitle: '审核规则配置',
    details: '更新自动审核规则：合规性阈值从60调整为65',
    ipAddress: '192.168.1.100',
    status: 'success'
  },
  {
    id: 8,
    timestamp: '2025-03-27 12:58:22',
    operator: '系统',
    operatorRole: 'system',
    action: 'export',
    targetType: 'report',
    targetId: '-',
    targetTitle: '审核数据报告',
    details: '导出2025年3月审核数据报告',
    ipAddress: '-',
    status: 'success'
  },
  {
    id: 9,
    timestamp: '2025-03-27 12:45:10',
    operator: '审核员B',
    operatorRole: 'reviewer',
    action: 'approve',
    targetType: 'content',
    targetId: '#1018',
    targetTitle: '前端开发入门指南',
    details: '审核通过，评分：88分',
    ipAddress: '192.168.1.105',
    status: 'success'
  },
  {
    id: 10,
    timestamp: '2025-03-27 12:30:55',
    operator: '管理员A',
    operatorRole: 'admin',
    action: 'delete',
    targetType: 'content',
    targetId: '#1015',
    targetTitle: '测试内容-需删除',
    details: '删除违规内容',
    ipAddress: '192.168.1.100',
    status: 'success'
  }
]

const actionMap = {
  approve: { label: '审核通过', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  reject: { label: '审核拒绝', icon: XCircle, color: 'bg-red-100 text-red-700' },
  auto_review: { label: '自动审核', icon: Settings, color: 'bg-purple-100 text-purple-700' },
  spot_check: { label: '抽查审核', icon: AlertTriangle, color: 'bg-cyan-100 text-cyan-700' },
  modify: { label: '修改内容', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  rollback: { label: '版本回滚', icon: RotateCcw, color: 'bg-amber-100 text-amber-700' },
  config_change: { label: '配置变更', icon: Settings, color: 'bg-slate-100 text-slate-700' },
  export: { label: '数据导出', icon: Download, color: 'bg-indigo-100 text-indigo-700' },
  delete: { label: '删除内容', icon: XCircle, color: 'bg-red-100 text-red-700' }
}

const roleMap = {
  admin: { label: '管理员', color: 'bg-amber-100 text-amber-700' },
  reviewer: { label: '审核员', color: 'bg-blue-100 text-blue-700' },
  system: { label: '系统', color: 'bg-gray-100 text-gray-700' }
}

export default function OperationLog() {
  const [logs, setLogs] = useState(mockLogs)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterOperator, setFilterOperator] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [detailDialog, setDetailDialog] = useState({ open: false, log: null })
  const pageSize = 10

  const filteredLogs = logs.filter(log => {
    const matchSearch = log.targetTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       log.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       log.targetId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchAction = filterAction === 'all' || log.action === filterAction
    const matchOperator = filterOperator === 'all' || log.operatorRole === filterOperator
    return matchSearch && matchAction && matchOperator
  })

  const totalPages = Math.ceil(filteredLogs.length / pageSize)
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleExport = () => {
    const csvContent = [
      ['时间', '操作人', '操作类型', '目标ID', '目标标题', '详情', 'IP地址'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.operator,
        actionMap[log.action].label,
        log.targetId,
        log.targetTitle,
        log.details,
        log.ipAddress
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
                placeholder="搜索操作人、目标ID或标题..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                <SelectItem value="approve">审核通过</SelectItem>
                <SelectItem value="reject">审核拒绝</SelectItem>
                <SelectItem value="auto_review">自动审核</SelectItem>
                <SelectItem value="spot_check">抽查审核</SelectItem>
                <SelectItem value="modify">修改内容</SelectItem>
                <SelectItem value="rollback">版本回滚</SelectItem>
                <SelectItem value="config_change">配置变更</SelectItem>
                <SelectItem value="export">数据导出</SelectItem>
                <SelectItem value="delete">删除内容</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterOperator} onValueChange={setFilterOperator}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="操作人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="reviewer">审核员</SelectItem>
                <SelectItem value="system">系统</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              更多筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 操作统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600">今日审核通过</p>
                <p className="text-2xl font-bold text-green-700">45</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600">今日审核拒绝</p>
                <p className="text-2xl font-bold text-red-700">8</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600">自动审核处理</p>
                <p className="text-2xl font-bold text-purple-700">67</p>
              </div>
              <Settings className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600">今日总操作</p>
                <p className="text-2xl font-bold text-blue-700">156</p>
              </div>
              <History className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

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
                <TableHead className="w-20">目标ID</TableHead>
                <TableHead>目标标题</TableHead>
                <TableHead className="w-20">状态</TableHead>
                <TableHead className="w-16">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.map((log) => {
                const actionInfo = actionMap[log.action] || { label: '未知', color: 'bg-gray-100 text-gray-700' }
                const roleInfo = roleMap[log.operatorRole] || { label: '未知', color: 'bg-gray-100 text-gray-700' }

                return (
                  <TableRow key={log.id} className="hover:bg-gray-50">
                    <TableCell className="text-sm text-gray-500">
                      {log.timestamp}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{log.operator}</p>
                          <Badge className={roleInfo.color} variant="outline" style={{ fontSize: '10px' }}>
                            {roleInfo.label}
                          </Badge>
                        </div>
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
                      {log.targetId}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{log.targetTitle}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        成功
                      </Badge>
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
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          共 {filteredLogs.length} 条记录，第 {currentPage}/{totalPages} 页
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
                  <p className="font-medium">{detailDialog.log.timestamp}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">操作人</label>
                  <p>{detailDialog.log.operator}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">操作类型</label>
                  <Badge className={actionMap[detailDialog.log.action]?.color || 'bg-gray-100 text-gray-700'}>
                    {actionMap[detailDialog.log.action]?.label || '未知'}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">目标ID</label>
                  <p className="font-mono">{detailDialog.log.targetId}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">目标标题</label>
                  <p>{detailDialog.log.targetTitle}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">操作详情</label>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{detailDialog.log.details}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">IP地址</label>
                  <p className="font-mono">{detailDialog.log.ipAddress}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">操作状态</label>
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    执行成功
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
