import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  BookOpen,
  ListTodo,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Play,
  GraduationCap,
  Target,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Camera,
  Loader2
} from 'lucide-react'
import { mistakeBook } from '@/services/api'
import MistakeList from './MistakeList'
import MistakeDetail from './MistakeDetail'
import MistakeStats from './MistakeStats'
import MistakeReview from './MistakeReview'
import MistakeExport from './MistakeExport'
import TargetedTherapy from './TargetedTherapy'

export default function MistakeBook({ myCourses = [] }) {
  const [currentView, setCurrentView] = useState('list')
  const [mistakes, setMistakes] = useState([])
  const [selectedMistake, setSelectedMistake] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exportingAnki, setExportingAnki] = useState(false)
  const [error, setError] = useState(null)

  // 拍照 OCR 录入（丰富化 T6）：tesseract.js 懒加载，OCR 仅作预填，最终手动确认后保存
  const [showOcrDialog, setShowOcrDialog] = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrSaving, setOcrSaving] = useState(false)
  const [ocrImageName, setOcrImageName] = useState('')
  const [ocrForm, setOcrForm] = useState({ course_id: '', question: '', answer: '', tags: '' })
  const ocrFileInputRef = useRef(null)
  
  const [filters, setFilters] = useState({
    course_id: '',
    mastery_status: '',
    page: 1,
    per_page: 10
  })
  
  const [pagination, setPagination] = useState({
    total: 0,
    total_pages: 0
  })

  // 修复：使用 JSON.stringify 序列化 filters 作为依赖，避免对象引用变化导致无限循环
  // 原问题：filters 是对象，每次 setState 创建新引用，导致 useCallback 依赖变化 -> useEffect 无限循环
  const filtersKey = JSON.stringify({ course_id: filters.course_id, mastery_status: filters.mastery_status, page: filters.page, per_page: filters.per_page })

  const fetchMistakes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (filters.course_id) params.course_id = filters.course_id
      if (filters.mastery_status) params.mastery_status = filters.mastery_status
      params.page = filters.page
      params.per_page = filters.per_page
      
      const response = await mistakeBook.getMistakes(params)
      setMistakes(response.mistakes || [])
      setPagination({
        total: response.total || 0,
        total_pages: response.total_pages || 0
      })
    } catch (err) {
      console.error('获取错题列表失败:', err)
      setError('加载错题列表失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [filtersKey]) // 使用序列化后的字符串作为依赖，避免无限循环

  // 修复：fetchStats 也使用序列化依赖，避免不必要的重复请求
  const statsFilterKey = JSON.stringify({ course_id: filters.course_id })

  const fetchStats = useCallback(async () => {
    try {
      const params = {}
      if (filters.course_id) params.course_id = filters.course_id
      const response = await mistakeBook.getStats(params)
      setStats(response)
    } catch (err) {
      console.error('获取错题统计失败:', err)
      // 修复：统计加载失败时不阻断主流程，静默处理即可
    }
  }, [statsFilterKey, filters.course_id])

  useEffect(() => {
    fetchMistakes()
    fetchStats()
  }, [fetchMistakes, fetchStats])

  const [detailError, setDetailError] = useState(null)

  const handleSelectMistake = async (mistake) => {
    setDetailError(null)
    try {
      const response = await mistakeBook.getMistake(mistake.id)
      setSelectedMistake(response.mistake)
      setCurrentView('detail')
    } catch (err) {
      console.error('获取错题详情失败:', err)
      setDetailError('加载错题详情失败，请稍后重试')
      // 可选：使用 toast 或其他方式通知用户
      alert('加载错题详情失败，请检查网络连接后重试')
    }
  }

  const handleUpdateStatus = async (mistakeId, newStatus, noteId = null) => {
    try {
      await mistakeBook.updateStatus(mistakeId, newStatus, noteId)
      fetchMistakes()
      fetchStats()
      if (selectedMistake && selectedMistake.id === mistakeId) {
        try {
          const response = await mistakeBook.getMistake(mistakeId)
          setSelectedMistake(response.mistake)
        } catch (refreshErr) {
          console.error('刷新错题详情失败:', refreshErr)
          setSelectedMistake(prev => ({
            ...prev,
            mastery_status: newStatus
          }))
        }
      }
    } catch (err) {
      console.error('更新状态失败:', err)
      throw err
    }
  }

  const [activeStatusTab, setActiveStatusTab] = useState('all')

  const handleDeleteMistake = async (mistakeId) => {
    try {
      await mistakeBook.deleteMistake(mistakeId)
      fetchMistakes()
      fetchStats()
      if (selectedMistake && selectedMistake.id === mistakeId) {
        setSelectedMistake(null)
        setCurrentView('list')
      }
      setSelectedIds(prev => prev.filter(id => id !== mistakeId))
    } catch (err) {
      console.error('删除错题失败:', err)
      throw err
    }
  }

  const handleBatchDelete = async (ids) => {
    try {
      const response = await mistakeBook.batchDelete(ids)
      fetchMistakes()
      fetchStats()
      setSelectedIds([])
      return response
    } catch (err) {
      console.error('批量删除错题失败:', err)
      throw err
    }
  }

  const handleStatusTabChange = (status) => {
    setActiveStatusTab(status)
    setFilters(prev => ({
      ...prev,
      mastery_status: status === 'all' ? '' : status,
      page: 1
    }))
    setSelectedIds([])
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedMistake(null)
  }

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1
    }))
  }

  // Anki 卡组导出（丰富化 T3）：后端 genanki 生成 .apkg，浏览器侧只负责触发下载
  const handleExportAnki = async () => {
    setExportingAnki(true)
    try {
      const response = await fetch('/api/mistakes/export/anki', { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        alert(payload.error || '导出失败，请重试')
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'zhijiaoxing-mistakes.apkg'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Anki 导出失败:', err)
      alert('导出失败，请重试')
    } finally {
      setExportingAnki(false)
    }
  }

  // OCR 识别：tesseract.js 走动态 import 避免进入首屏包；语言包由库按 CDN 拉取，
  // 离线/加载失败时降级为手动填写（OCR 只是预填辅助，不阻塞录入）。
  const handleOcrFile = async (file) => {
    if (!file) return
    setOcrImageName(file.name)
    setOcrRunning(true)
    try {
      const Tesseract = (await import('tesseract.js')).default
      // worker/core/语言包全部走 public/tesseract 本地资源：blob worker 跨域
      // importScripts CDN 会被拒（实测 NetworkError），本地化后离线可用。
      const result = await Tesseract.recognize(file, 'chi_sim+eng', {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/',
        langPath: '/tesseract/langs',
        gzip: true,
      })
      const text = (result?.data?.text || '').trim()
      if (text) {
        setOcrForm(prev => ({ ...prev, question: text }))
      } else {
        alert('未识别到文字，可手动输入题目')
      }
    } catch (err) {
      console.error('OCR 识别失败:', err)
      alert('OCR 引擎加载失败（首次使用需联网下载语言包），可直接手动输入题目')
    } finally {
      setOcrRunning(false)
    }
  }

  const handleSaveOcrMistake = async () => {
    if (!ocrForm.question.trim()) {
      alert('请填写题目内容')
      return
    }
    if (!ocrForm.course_id) {
      alert('请选择所属课程')
      return
    }
    setOcrSaving(true)
    try {
      await mistakeBook.createMistake({
        course_id: Number(ocrForm.course_id),
        question_content: ocrForm.question.trim(),
        correct_answer: ocrForm.answer.trim(),
        knowledge_tags: ocrForm.tags.trim(),
      })
      setShowOcrDialog(false)
      setOcrForm({ course_id: '', question: '', answer: '', tags: '' })
      setOcrImageName('')
      fetchMistakes()
      fetchStats()
    } catch (err) {
      console.error('保存错题失败:', err)
      alert(err.message || '保存失败，请重试')
    } finally {
      setOcrSaving(false)
    }
  }

  const handleRefresh = () => {
    fetchMistakes()
    fetchStats()
  }

  if (currentView === 'review') {
    return (
      <MistakeReview
        myCourses={myCourses}
        onBack={() => setCurrentView('list')}
      />
    )
  }

  if (currentView === 'export') {
    return (
      <MistakeExport
        myCourses={myCourses}
        selectedIds={selectedIds}
        filters={filters}
        onBack={() => setCurrentView('list')}
      />
    )
  }

  if (currentView === 'detail' && selectedMistake) {
    return (
      <div className="space-y-4">
        {detailError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            {detailError}
          </div>
        )}
        <MistakeDetail
          mistake={selectedMistake}
          onBack={handleBackToList}
          onUpdateStatus={handleUpdateStatus}
          onMistakeChange={setSelectedMistake}
          onDelete={handleDeleteMistake}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">错题本</h2>
          <p className="text-gray-600">管理你的错题，针对性复习</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentView('export')}
          >
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button
            variant="outline"
            title="生成 .apkg 卡组，导入 Anki 即可用其间隔重复算法复习"
            onClick={handleExportAnki}
            disabled={exportingAnki}
          >
            <Download className={`w-4 h-4 mr-2 ${exportingAnki ? 'animate-pulse' : ''}`} />
            {exportingAnki ? '生成中...' : 'Anki 卡组'}
          </Button>
          <Button
            variant="outline"
            title="拍照/选图 OCR 识别题目并保存为错题"
            onClick={() => setShowOcrDialog(true)}
          >
            <Camera className="w-4 h-4 mr-2" />
            拍照录入
          </Button>
          <Button
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            onClick={() => setCurrentView('review')}
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            开始复习
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-red-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">总错题</p>
                  <p className="text-xl font-bold">{stats.stats?.total_mistakes || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">未掌握</p>
                  <p className="text-xl font-bold">{stats.stats?.by_status?.unmastered || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">复习中</p>
                  <p className="text-xl font-bold">{stats.stats?.by_status?.reviewing || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">已掌握</p>
                  <p className="text-xl font-bold">{stats.stats?.by_status?.mastered || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="list">错题列表</TabsTrigger>
          <TabsTrigger value="stats">统计分析</TabsTrigger>
          <TabsTrigger value="targeted">
            <Target className="w-4 h-4 mr-1" />
            靶向治疗
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="mt-4">
          {error && (
            <Card className="border-red-200 bg-red-50 mb-4">
              <CardContent className="p-4 flex items-center text-red-700">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 mb-4">
            <Button
              variant={activeStatusTab === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusTabChange('all')}
              className="gap-1"
            >
              <BookOpen className="w-4 h-4" />
              全部
              <Badge variant="secondary" className="ml-1 text-xs">
                {stats?.stats?.total_mistakes || 0}
              </Badge>
            </Button>
            <Button
              variant={activeStatusTab === 'unmastered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusTabChange('unmastered')}
              className={`gap-1 ${activeStatusTab === 'unmastered' ? 'bg-red-500 hover:bg-red-600' : 'text-red-600 border-red-200 hover:bg-red-50'}`}
            >
              <AlertTriangle className="w-4 h-4" />
              未掌握
              <Badge variant="secondary" className="ml-1 text-xs">
                {stats?.stats?.by_status?.unmastered || 0}
              </Badge>
            </Button>
            <Button
              variant={activeStatusTab === 'reviewing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusTabChange('reviewing')}
              className={`gap-1 ${activeStatusTab === 'reviewing' ? 'bg-blue-500 hover:bg-blue-600' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
            >
              <RefreshCw className="w-4 h-4" />
              复习中
              <Badge variant="secondary" className="ml-1 text-xs">
                {stats?.stats?.by_status?.reviewing || 0}
              </Badge>
            </Button>
            <Button
              variant={activeStatusTab === 'mastered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusTabChange('mastered')}
              className={`gap-1 ${activeStatusTab === 'mastered' ? 'bg-green-500 hover:bg-green-600' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
            >
              <CheckCircle className="w-4 h-4" />
              已掌握
              <Badge variant="secondary" className="ml-1 text-xs">
                {stats?.stats?.by_status?.mastered || 0}
              </Badge>
            </Button>
          </div>
          
          <MistakeList
            mistakes={mistakes}
            loading={loading}
            myCourses={myCourses}
            filters={filters}
            pagination={pagination}
            selectedIds={selectedIds}
            activeStatusTab={activeStatusTab}
            onSelectMistake={handleSelectMistake}
            onFilterChange={handleFilterChange}
            onUpdateStatus={handleUpdateStatus}
            onSelectedIdsChange={setSelectedIds}
            onDeleteMistake={handleDeleteMistake}
            onBatchDelete={handleBatchDelete}
          />
        </TabsContent>
        
        <TabsContent value="stats" className="mt-4">
          <MistakeStats stats={stats} />
        </TabsContent>

        <TabsContent value="targeted" className="mt-4">
          <TargetedTherapy myCourses={myCourses} />
        </TabsContent>
      </Tabs>

      {/* 拍照录入错题弹层（丰富化 T6）：选图 → OCR 预填 → 人工确认保存 */}
      <Dialog open={showOcrDialog} onOpenChange={setShowOcrDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />拍照录入错题
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <input
                ref={ocrFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleOcrFile(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={ocrRunning}
                onClick={() => ocrFileInputRef.current?.click()}
              >
                {ocrRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                {ocrRunning ? '识别中…' : (ocrImageName ? `重新选择（${ocrImageName}）` : '选择图片 / 拍照')}
              </Button>
              <p className="text-xs text-gray-400 mt-1">OCR 识别结果仅作预填，请人工核对后再保存</p>
            </div>

            <div>
              <Label>所属课程 *</Label>
              <Select
                value={ocrForm.course_id}
                onValueChange={(v) => setOcrForm(prev => ({ ...prev, course_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="选择课程" /></SelectTrigger>
                <SelectContent>
                  {myCourses.map(course => (
                    <SelectItem key={course.id} value={String(course.id)}>{course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>题目内容 *</Label>
              <Textarea
                rows={5}
                placeholder="OCR 识别结果或手动输入题目"
                value={ocrForm.question}
                onChange={(e) => setOcrForm(prev => ({ ...prev, question: e.target.value }))}
              />
            </div>

            <div>
              <Label>正确答案</Label>
              <Textarea
                rows={2}
                placeholder="选填，可稍后补充"
                value={ocrForm.answer}
                onChange={(e) => setOcrForm(prev => ({ ...prev, answer: e.target.value }))}
              />
            </div>

            <div>
              <Label>知识点标签（逗号分隔）</Label>
              <Input
                placeholder="如：循环结构, 数组"
                value={ocrForm.tags}
                onChange={(e) => setOcrForm(prev => ({ ...prev, tags: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowOcrDialog(false)}>取消</Button>
              <Button onClick={handleSaveOcrMistake} disabled={ocrSaving}>
                {ocrSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                保存为错题
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
