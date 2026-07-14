import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Presentation,
  Loader2,
  RefreshCw,
  Download,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  FileText,
} from 'lucide-react'
import { pptApi } from '@/services/api'

/**
 * PPTViewer - PPT预览/编辑组件
 *
 * 集成讯飞智能PPT生成 + Office Online Viewer预览。
 * 功能：
 * 1. iframe嵌入Office Online预览.pptx（保留原生动画与排版）
 * 2. 下载.pptx源文件供本地PowerPoint编辑
 * 3. 编辑主题描述后重新生成PPT
 *
 * 响应式设计：通过 aspect-ratio 与 width:100% 适配各种屏幕尺寸。
 *
 * @param {Object} props
 * @param {number} props.courseId - 课程ID
 * @param {Object} [props.initialPpt] - 初始PPT数据（可选，从列表预加载）
 * @param {boolean} [props.allowEdit=true] - 是否允许编辑/生成（教师端true，学生端false）
 * @param {string} [props.defaultTitle] - 默认PPT标题（生成时使用）
 * @param {string} [props.defaultQuery] - 默认主题描述（生成时使用）
 */
export default function PPTViewer({
  courseId,
  initialPpt = null,
  allowEdit = true,
  defaultTitle = '',
  defaultQuery = '',
}) {
  const [ppts, setPpts] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [showGenPanel, setShowGenPanel] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [available, setAvailable] = useState(true)

  // 生成/编辑表单状态
  const [formData, setFormData] = useState({
    title: defaultTitle,
    query: defaultQuery,
  })

  const currentPpt = ppts[currentIndex] || null

  // 拉取PPT列表
  const fetchPpts = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    setError('')
    try {
      const result = await pptApi.list(courseId)
      setPpts(result.ppts || [])
      if ((result.ppts || []).length > 0) {
        setCurrentIndex(0)
      }
    } catch (err) {
      console.error('获取PPT列表失败:', err)
      setError(`获取PPT列表失败: ${err.message || '请稍后重试'}`)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  // 检查PPT功能可用性
  useEffect(() => {
    pptApi.getStatus().then(res => setAvailable(res.available !== false)).catch(() => setAvailable(false))
  }, [])

  useEffect(() => {
    fetchPpts()
  }, [fetchPpts])

  // 若外部传入初始PPT，加载其详情获取预览URL
  useEffect(() => {
    if (initialPpt && initialPpt.id) {
      pptApi.get(initialPpt.id).then(res => {
        if (res.ppt) {
          setPpts(prev => {
            const idx = prev.findIndex(p => p.id === res.ppt.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = res.ppt
              return next
            }
            return [res.ppt, ...prev]
          })
        }
      }).catch(err => console.warn('加载PPT详情失败:', err))
    }
  }, [initialPpt])

  // 生成PPT
  const handleGenerate = async () => {
    if (!formData.title.trim() || !formData.query.trim()) {
      setError('请填写PPT标题和主题描述')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const result = await pptApi.generate({
        course_id: courseId,
        title: formData.title.trim(),
        query: formData.query.trim(),
      })
      if (result.ppt) {
        setPpts(prev => [result.ppt, ...prev])
        setCurrentIndex(0)
        setShowGenPanel(false)
      }
    } catch (err) {
      console.error('生成PPT失败:', err)
      setError(`生成PPT失败: ${err.message || '请稍后重试'}`)
    } finally {
      setGenerating(false)
    }
  }

  // 重新生成（编辑后）
  const handleRegenerate = async () => {
    if (!currentPpt || !formData.query.trim()) {
      setError('请填写新的主题描述')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const result = await pptApi.regenerate(currentPpt.id, {
        query: formData.query.trim(),
        title: formData.title.trim() || currentPpt.title,
      })
      if (result.ppt) {
        setPpts(prev => prev.map(p => p.id === result.ppt.id ? result.ppt : p))
        setShowEditPanel(false)
      }
    } catch (err) {
      console.error('重新生成PPT失败:', err)
      setError(`重新生成失败: ${err.message || '请稍后重试'}`)
    } finally {
      setGenerating(false)
    }
  }

  // 删除PPT
  const handleDelete = async (pptId) => {
    if (!confirm('确认删除此PPT？删除后无法恢复。')) return
    try {
      await pptApi.delete(pptId)
      setPpts(prev => {
        const next = prev.filter(p => p.id !== pptId)
        if (currentIndex >= next.length) {
          setCurrentIndex(Math.max(0, next.length - 1))
        }
        return next
      })
    } catch (err) {
      console.error('删除PPT失败:', err)
      setError(`删除失败: ${err.message || '请稍后重试'}`)
    }
  }

  // 打开编辑面板时预填当前PPT信息
  const openEditPanel = () => {
    if (currentPpt) {
      setFormData({
        title: currentPpt.title || '',
        query: currentPpt.query || '',
      })
    }
    setShowEditPanel(true)
  }

  const openGenPanel = () => {
    setFormData({
      title: defaultTitle || '',
      query: defaultQuery || '',
    })
    setShowGenPanel(true)
  }

  // 下载PPT
  const handleDownload = () => {
    if (!currentPpt) return
    const url = pptApi.getDownloadUrl(currentPpt.id)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentPpt.title || 'presentation'}.pptx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // 切换上一张/下一张PPT（多个PPT间切换）
  const goPrev = () => setCurrentIndex(i => Math.max(0, i - 1))
  const goNext = () => setCurrentIndex(i => Math.min(ppts.length - 1, i + 1))

  // 凭证未配置提示
  if (!available) {
    return (
      <Card className="rounded-xl border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">PPT生成功能未配置</p>
            <p className="text-xs text-amber-700 mt-0.5">
              管理员需在服务器 .env 中配置 XFYUN_PPT_APP_ID 与 XFYUN_PPT_API_SECRET
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* 头部：标题 + 操作按钮 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Presentation className="h-5 w-5 text-purple-600" />
          <h3 className="text-base font-semibold text-gray-800">演示文稿 (PPT)</h3>
          {ppts.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {currentIndex + 1} / {ppts.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {allowEdit && (
            <Button size="sm" variant="outline" onClick={openGenPanel} disabled={generating}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              {generating ? '生成中...' : '生成PPT'}
            </Button>
          )}
          {currentPpt && (
            <>
              {allowEdit && (
                <Button size="sm" variant="outline" onClick={openEditPanel} disabled={generating}>
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  编辑重生成
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1" />
                下载
              </Button>
              {allowEdit && (
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(currentPpt.id)}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  删除
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button className="ml-auto text-red-500 hover:text-red-700" onClick={() => setError('')}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          加载PPT列表...
        </div>
      )}

      {/* 生成中遮罩 */}
      {generating && (
        <div className="flex items-center justify-center py-16 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-purple-700">正在调用讯飞智能PPT生成接口...</p>
            <p className="text-xs text-purple-500 mt-1">生成含模板与配图的完整PPT约需30秒-3分钟</p>
          </div>
        </div>
      )}

      {/* PPT预览区域：iframe Office Online Viewer */}
      {!loading && !generating && currentPpt && currentPpt.preview_url && (
        <div className="space-y-2">
          {/* 多PPT切换器 */}
          {ppts.length > 1 && (
            <div className="flex items-center justify-between">
              <Button size="sm" variant="ghost" onClick={goPrev} disabled={currentIndex === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-500 truncate max-w-xs">{currentPpt.title}</span>
              <Button size="sm" variant="ghost" onClick={goNext} disabled={currentIndex >= ppts.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 响应式 iframe 容器：16:9 比例，宽度100%自适应 */}
          <div
            className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
            style={{ paddingTop: '56.25%' }}
          >
            <iframe
              src={currentPpt.preview_url}
              className="absolute top-0 left-0 w-full h-full"
              frameBorder="0"
              title={currentPpt.title || 'PPT预览'}
              allow="fullscreen"
            />
          </div>

          {/* PPT元信息 */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {currentPpt.title}
            </span>
            {currentPpt.generated_at && (
              <span>生成于 {new Date(currentPpt.generated_at).toLocaleString('zh-CN')}</span>
            )}
            <a
              href={pptApi.getDownloadUrl(currentPpt.id)}
              className="text-blue-600 hover:underline flex items-center gap-1"
              download
            >
              <Download className="h-3 w-3" />
              下载.pptx
            </a>
          </div>

          {/* 开发环境提示：localhost URL无法被Office Online访问 */}
          {currentPpt.preview_url && currentPpt.preview_url.includes('localhost') && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">预览提示</p>
                <p>开发环境（localhost）的PPT文件无法被微软Office Online服务器访问，预览需部署到公网后生效。当前可点击"下载.pptx"在本地PowerPoint查看完整动画效果。</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 无PPT空状态 */}
      {!loading && !generating && !currentPpt && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-lg">
          <Presentation className="h-10 w-10 mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">暂无演示文稿</p>
          <p className="text-xs mt-1">
            {allowEdit ? '点击"生成PPT"创建课程演示文稿' : '教师尚未生成课程PPT'}
          </p>
        </div>
      )}

      {/* 生成PPT面板 */}
      {showGenPanel && (
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Presentation className="h-4 w-4 text-purple-600" />
                生成课程PPT
              </CardTitle>
              <button onClick={() => setShowGenPanel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">PPT标题</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="如：第1章 Python开发环境与基础语法"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                主题描述（200-500字，将提交给讯飞智能PPT接口）
              </label>
              <textarea
                value={formData.query}
                onChange={e => setFormData(prev => ({ ...prev, query: e.target.value }))}
                placeholder="详细描述PPT要覆盖的知识点、目标受众、章节结构等。描述越详细，生成的PPT质量越高。"
                rows={6}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
              />
              <p className="text-xs text-gray-400 mt-1">{formData.query.length} 字</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setShowGenPanel(false)}>取消</Button>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleGenerate}
                disabled={generating || !formData.title.trim() || !formData.query.trim()}
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                {generating ? '生成中...' : '开始生成'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 编辑重生成面板 */}
      {showEditPanel && currentPpt && (
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-600" />
                编辑主题并重新生成
              </CardTitle>
              <button onClick={() => setShowEditPanel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">PPT标题</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">主题描述（修改后将重新生成PPT）</label>
              <textarea
                value={formData.query}
                onChange={e => setFormData(prev => ({ ...prev, query: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <p className="text-xs text-gray-400 mt-1">{formData.query.length} 字</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setShowEditPanel(false)}>取消</Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleRegenerate}
                disabled={generating || !formData.query.trim()}
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                {generating ? '重新生成中...' : '重新生成'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
