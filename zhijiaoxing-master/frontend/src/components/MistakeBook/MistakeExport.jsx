import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Download,
  FileText,
  FileDown,
  Loader2,
  Filter,
  CheckCircle,
  EyeOff,
  BookOpen
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export default function MistakeExport({
  myCourses = [],
  selectedIds = [],
  filters = {},
  onBack
}) {
  const [exportFormat, setExportFormat] = useState('pdf')
  const [template, setTemplate] = useState('detailed')
  const [exportMode, setExportMode] = useState('full')
  const [excludeCareless, setExcludeCareless] = useState(false)
  const [courseId, setCourseId] = useState(filters.course_id || '')
  const [masteryStatus, setMasteryStatus] = useState(filters.mastery_status || '')
  const [errorType, setErrorType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    setExportSuccess(false)
    try {
      const payload = {
        format: exportFormat,
        template,
        export_mode: exportMode,
        exclude_careless: excludeCareless,
      }
      if (selectedIds.length > 0) {
        payload.mistake_ids = selectedIds
      } else {
        if (courseId && courseId !== 'all') payload.course_id = courseId
        if (masteryStatus && masteryStatus !== 'all') payload.mastery_status = masteryStatus
        if (errorType && errorType !== 'all') payload.error_type = errorType
        if (dateFrom) payload.date_from = dateFrom
        if (dateTo) payload.date_to = dateTo
      }

      const response = await fetch(`${API_BASE_URL}/mistakes/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Export failed' }))
        const msg = errData.error || 'Export failed'
        if (errData.suggestion) {
          throw new Error(`${msg}\n${errData.suggestion}`)
        }
        throw new Error(msg)
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `mistake_book_${new Date().toISOString().slice(0, 10)}.${exportFormat === 'word' ? 'docx' : 'pdf'}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(.+)/)
        if (match) filename = match[1]
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err) {
      console.error('Export error:', err)
      if (err.message?.includes('No mistake records found')) {
        alert('当前筛选条件下没有找到错题记录。\n\n建议：\n1. 尝试调整或清除筛选条件\n2. 在错题列表中勾选要导出的题目后再导出\n3. 先完成练习以生成错题记录')
      } else {
        alert(err.message || '导出失败，请稍后重试')
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          返回错题本
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">导出错题本</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              导出格式
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setExportFormat('pdf')}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  exportFormat === 'pdf'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className={`w-8 h-8 mx-auto mb-2 ${exportFormat === 'pdf' ? 'text-red-500' : 'text-gray-400'}`} />
                <p className="font-medium">PDF 文档</p>
                <p className="text-xs text-gray-500 mt-1">适合打印和分享</p>
              </button>
              <button
                onClick={() => setExportFormat('word')}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  exportFormat === 'word'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileDown className={`w-8 h-8 mx-auto mb-2 ${exportFormat === 'word' ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="font-medium">Word 文档</p>
                <p className="text-xs text-gray-500 mt-1">可编辑和批注</p>
              </button>
            </div>

            <div className="space-y-2">
              <Label>文档模板</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="detailed">详细模板 - 包含完整解析</SelectItem>
                  <SelectItem value="compact">精简模板 - 仅题目和答案</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>导出内容</Label>
              <Select value={exportMode} onValueChange={setExportMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">完整导出 - 包含答案和解析</SelectItem>
                  <SelectItem value="questions_only">仅题干 - 用于重新练习</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exportMode === 'questions_only' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <p className="text-sm text-amber-700 font-medium">仅题干模式</p>
                </div>
                <p className="text-xs text-amber-600 mt-1">
                  导出文件将只包含题目内容，不含答案、解析和错因分析，方便你重新练习
                </p>
              </div>
            )}

            {selectedIds.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-700">
                  已选择 <span className="font-bold">{selectedIds.length}</span> 道错题进行导出
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              筛选范围
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedIds.length > 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <p>已选择指定错题，筛选条件不生效</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>课程筛选</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label>掌握状态</Label>
                  <Select value={masteryStatus} onValueChange={setMasteryStatus}>
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label>错误类型</Label>
                  <Select value={errorType} onValueChange={setErrorType}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      <SelectItem value="concept_understanding">概念理解偏差</SelectItem>
                      <SelectItem value="calculation_error">计算失误</SelectItem>
                      <SelectItem value="question_misread">审题不清</SelectItem>
                      <SelectItem value="careless">粗心失误</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>开始日期</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>结束日期</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="border-t pt-4 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-gray-500" />
                  <div>
                    <Label className="cursor-pointer">排除粗心失误</Label>
                    <p className="text-xs text-gray-500">不导出因粗心导致的错题</p>
                  </div>
                </div>
                <Switch
                  checked={excludeCareless}
                  onCheckedChange={setExcludeCareless}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">准备导出</p>
              <p className="text-sm text-gray-500">
                {selectedIds.length > 0
                  ? `导出已选择的 ${selectedIds.length} 道错题`
                  : '根据筛选条件导出错题记录'}
                {excludeCareless && ' · 排除粗心失误'}
                {exportMode === 'questions_only' && ' · 仅题干模式'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {exportSuccess && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">导出成功</span>
                </div>
              )}
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    导出 {exportFormat === 'pdf' ? 'PDF' : 'Word'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
