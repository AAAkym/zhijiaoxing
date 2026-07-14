﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { knowledgeGraph } from '@/services/api'
import KnowledgeGraphScene from './KnowledgeGraph3D/KnowledgeGraphScene'
import RagReliabilityPanel from './RagReliabilityPanel'
import {
  Upload, FileText, Trash2, AlertCircle, CheckCircle2, Loader2, Network, FileUp, Maximize2, Minimize2,
  Layers, Link2, BookOpen, Target, Info, Route,
} from 'lucide-react'

const ALLOWED_EXTENSIONS = ['.docx', '.pdf']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const CHUNK_UPLOAD_THRESHOLD = 2 * 1024 * 1024
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB，减少 HTTP 请求数
const CHUNK_CONCURRENCY = 4
const CHUNK_RETRY_LIMIT = 3
const RESUME_KEY_PREFIX = 'kg_upload_resume:'

const NODE_TYPE_META = {
  course: { label: '课程', color: '#d4a853', note: '图谱根节点，代表当前课程或文档主题。' },
  chapter: { label: '线路', color: '#5a9e6f', note: '按文档一级标题形成的知识线路。' },
  knowledge_point: { label: '知识点', color: '#4a90d9', note: '线路下的二级标题、概念、方法或实践内容。' },
  objective: { label: '目标', color: '#e07c4f', note: '文档或课程希望达成的理解目标。' },
  skill: { label: '技能', color: '#8b6fb0', note: '先修能力、应用能力或实践要求。' },
  case: { label: '案例', color: '#e05d6f', note: '支撑知识点理解的案例材料。' },
  exercise: { label: '练习', color: '#3db8a0', note: '用于检测或强化知识点的任务。' },
  resource: { label: '资源', color: '#7a8b99', note: '教材、参考资料或外部学习资源。' },
}

const EDGE_TYPE_META = {
  contains: { label: '包含', color: '#5a9e6f', note: '上层线路包含下层知识点。' },
  prerequisite: { label: '前置依赖', color: '#e07c4f', note: '理解目标节点前，建议先掌握来源节点。' },
  related: { label: '关联', color: '#4a90d9', note: '两个节点在主题、概念或上下文中存在关联。' },
  supports_objective: { label: '支撑目标', color: '#d4a853', note: '该节点对课程目标或学习目标形成支撑。' },
  applies_to: { label: '应用于', color: '#8b6fb0', note: '知识点可用于解释、解决或支撑目标场景。' },
  assesses: { label: '评估', color: '#3db8a0', note: '练习、评价或考核对知识点的覆盖关系。' },
  recommended_after: { label: '后续学习', color: '#e05d6f', note: '表示推荐学习顺序。' },
}

const VIEW_MODES = {
  layered: 'layered',
  focus: 'focus',
  full: 'full',
}

const RELATION_LABELS = {
  contains: '包含',
  prerequisite: '前置依赖',
  related: '关联',
  supports_objective: '支撑目标',
  applies_to: '应用于',
  assesses: '评估',
  recommended_after: '后续学习',
}

const getNodeTitle = (node) => node?.label || node?.name || node?.title || ''
const getEdgeSource = (edge) => edge?.source_node_id ?? edge?.source
const getEdgeTarget = (edge) => edge?.target_node_id ?? edge?.target
const getEdgeKey = (edge) => `${getEdgeSource(edge)}-${getEdgeTarget(edge)}`
const cleanText = (text = '') => String(text).replace(/\s+/g, ' ').trim()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function sha256File(file) {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function resumeKey(courseId, file, contentHash) {
  return `${RESUME_KEY_PREFIX}${courseId}:${file.name}:${file.size}:${contentHash}`
}

async function uploadFileOnce(courseId, file, inputType, { onProgress, ragRequired, citationStyle }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('filename', file.name)
  formData.append('input_type', inputType)
  formData.append('rag_required', String(Boolean(ragRequired)))
  formData.append('citation_style', citationStyle || 'bracket')
  onProgress?.(15, '正在上传文件')
  const result = await knowledgeGraph.importSyllabus(courseId, formData)
  onProgress?.(100, '解析完成')
  return result
}

async function uploadChunkWithRetry(courseId, uploadId, chunkIndex, blob, signal) {
  let lastError
  for (let attempt = 1; attempt <= CHUNK_RETRY_LIMIT; attempt += 1) {
    try {
      const formData = new FormData()
      formData.append('chunk_index', String(chunkIndex))
      formData.append('chunk', blob, `${chunkIndex}.part`)
      return await knowledgeGraph.uploadImportChunk(courseId, uploadId, formData, signal)
    } catch (err) {
      lastError = err
      if (attempt < CHUNK_RETRY_LIMIT) {
        await sleep(250 * attempt)
      }
    }
  }
  throw lastError
}

async function uploadFileInChunks(courseId, file, { onProgress, ragRequired, citationStyle }) {
  onProgress?.(3, '计算文件校验码')
  const contentHash = await sha256File(file)
  const key = resumeKey(courseId, file, contentHash)
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  let session = null
  const savedSession = JSON.parse(localStorage.getItem(key) || 'null')

  if (savedSession?.upload_id) {
    try {
      const status = await knowledgeGraph.getChunkedImportStatus(courseId, savedSession.upload_id)
      if (status.content_hash === contentHash && Number(status.file_size) === file.size) {
        session = {
          upload_id: savedSession.upload_id,
          received_chunks: status.received_chunks || [],
          chunk_size: status.chunk_size || CHUNK_SIZE,
          total_chunks: status.total_chunks || totalChunks,
        }
      }
    } catch {
      localStorage.removeItem(key)
    }
  }

  if (!session) {
    session = await knowledgeGraph.startChunkedImport(courseId, {
      filename: file.name,
      file_size: file.size,
      chunk_size: CHUNK_SIZE,
      total_chunks: totalChunks,
      content_hash: contentHash,
      rag_required: Boolean(ragRequired),
      citation_style: citationStyle || 'bracket',
    })
    localStorage.setItem(key, JSON.stringify({ upload_id: session.upload_id, created_at: Date.now() }))
  }

  const received = new Set(session.received_chunks || [])
  const pending = Array.from({ length: totalChunks }, (_, index) => index).filter((index) => !received.has(index))
  let completed = received.size
  onProgress?.(Math.min(10 + Math.round((completed / totalChunks) * 70), 80), pending.length ? '上传分片中' : '分片已上传，准备合并')

  let cursor = 0
  async function worker() {
    while (cursor < pending.length) {
      const chunkIndex = pending[cursor]
      cursor += 1
      const start = chunkIndex * CHUNK_SIZE
      const blob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size))
      await uploadChunkWithRetry(courseId, session.upload_id, chunkIndex, blob)
      completed += 1
      onProgress?.(10 + Math.round((completed / totalChunks) * 70), `上传分片 ${completed}/${totalChunks}`)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, pending.length || 1) }, () => worker()))
  onProgress?.(84, '服务器合并文件')
  const completeResp = await knowledgeGraph.completeChunkedImport(courseId, session.upload_id)
  localStorage.removeItem(key)

  // 异步模式：合并完成立即返回 task_id，轮询任务状态直到完成
  const taskId = completeResp?.task_id
  if (!taskId) {
    // 兼容旧版同步返回（直接包含 result）
    onProgress?.(100, '解析完成')
    return completeResp
  }

  const POLL_INTERVAL = 2000
  const POLL_TIMEOUT = 300000 // 5 分钟轮询上限
  const MAX_NOT_FOUND_RETRIES = 3 // 后端重启等瞬时 404 容忍次数
  const pollStarted = Date.now()
  let lastProgress = completeResp.progress || 10
  let notFoundCount = 0
  while (true) {
    if (Date.now() - pollStarted > POLL_TIMEOUT) {
      throw new Error('解析超时，请稍后在知识图谱中查看结果')
    }
    await sleep(POLL_INTERVAL)
    let status
    try {
      status = await knowledgeGraph.getImportTaskStatus(taskId)
      notFoundCount = 0
    } catch (err) {
      // 404 可能由后端短暂重启引起，重试几次后再放弃
      if (err.status === 404 && notFoundCount < MAX_NOT_FOUND_RETRIES) {
        notFoundCount += 1
        continue
      }
      throw err
    }
    if (typeof status.progress === 'number' && status.progress > lastProgress) {
      lastProgress = status.progress
    }
    // 进度区间 84-99 映射到轮询进度
    const display = Math.min(84 + Math.round((lastProgress / 100) * 15), 99)
    onProgress?.(display, status.message || '解析中...')
    if (status.status === 'completed') {
      onProgress?.(100, '解析完成')
      return status.result || status
    }
    if (status.status === 'failed') {
      throw new Error(status.error || '解析失败')
    }
  }
}

const summarizeChapter = (chapter, kps) => {
  const description = cleanText(chapter?.description)
  if (description) return description.length > 110 ? `${description.slice(0, 110)}...` : description
  const names = kps.slice(0, 4).map(getNodeTitle).filter(Boolean)
  if (names.length) return `围绕 ${names.join('、')} 展开，适合按章节主线逐步学习。`
  return '该线路已建立知识点与上下游关系，可点击查看对应知识线路。'
}

/* ── 安全的轨道控制器，防止 addEventListener null 错误 ── */
function SafeOrbitControls({ minDistance = 5, maxDistance = 90 }) {
  const { gl } = useThree()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (gl?.domElement) {
      const raf = requestAnimationFrame(() => setReady(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [gl])

  if (!ready) return null

  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.8}
      zoomSpeed={1.2}
      minDistance={minDistance}
      maxDistance={maxDistance}
      enablePan
      panSpeed={0.8}
    />
  )
}

export default function KnowledgeGraphManager({ courses = [], onRefresh }) {
  const [selectedCourse, setSelectedCourse] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('')
  const [uploadResult, setUploadResult] = useState(null)
  const [error, setError] = useState(null)
  const [showPreview, setShowPreview] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [ragRequired, setRagRequired] = useState(true)
  const [citationStyle, setCitationStyle] = useState('bracket')
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const fileInputRef = useRef(null)

  const selectedCourseObj = courses.find((c) => String(c.id) === selectedCourse)

  const validateFile = useCallback((file) => {
    if (!file) return '请选择文件'
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `不支持的文件格式 ${ext}，仅支持 ${ALLOWED_EXTENSIONS.join("、")}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`
    }
    return null
  }, [])

  const handleUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) { setError('请选择文件'); return }
    const validationError = validateFile(file)
    if (validationError) { setError(validationError); return }
    if (!selectedCourse) { setError('请先选择课程'); return }

    setUploading(true)
    setError(null)
    setUploadResult(null)
    setUploadProgress(2)
    setUploadStage('准备上传')

    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const inputType = ext === 'pdf' ? 'pdf' : 'docx'
      const useChunkedUpload = file.size >= CHUNK_UPLOAD_THRESHOLD
      const result = useChunkedUpload
        ? await uploadFileInChunks(selectedCourse, file, {
            ragRequired,
            citationStyle,
            onProgress: (progress, stage) => {
              setUploadProgress(progress)
              setUploadStage(stage)
            },
          })
        : await uploadFileOnce(selectedCourse, file, inputType, {
            ragRequired,
            citationStyle,
            onProgress: (progress, stage) => {
              setUploadProgress(progress)
              setUploadStage(stage)
            },
          })
      setUploadProgress(100)
      setUploadStage('解析完成')
      setUploadResult(result)
      setShowPreview(true)
      setPreviewRefreshKey((key) => key + 1)
      onRefresh?.()
    } catch (err) {
      console.error('上传知识点文件失败', err)
      setError(err.message || '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }, [selectedCourse, validateFile, onRefresh, ragRequired, citationStyle])

  const handleDelete = useCallback(async () => {
    if (!selectedCourse) return
    setDeleting(true)
    setError(null)
    try {
      const result = await knowledgeGraph.deleteGraph(selectedCourse)
      setUploadResult(null)
      setDeleteDialogOpen(false)
      setPreviewRefreshKey((key) => key + 1)
      onRefresh?.()
      setUploadResult({ ...result, isDelete: true })
    } catch (err) {
      console.error('删除知识图谱失败:', err)
      setError(err.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }, [selectedCourse, onRefresh])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    setSelectedFileName(file ? file.name : '')
    setError(null)
    setUploadResult(null)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          知识图谱管理
        </h2>
        <p className="text-[#6b6560]">上传课程大纲文件，自动解析知识点并生成3D知识图谱</p>
      </div>

      <Card className="rounded-xl border-[#e5e0db]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">选择课程</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedCourse}
            onChange={(e) => { setSelectedCourse(e.target.value); setUploadResult(null); setError(null); setShowPreview(true) }}
            className="w-full h-10 rounded-lg border border-[#e5e0db] bg-white px-3 text-sm text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#d4a853]/30"
          >
            <option value="">-- 请选择课程 --</option>
            {courses.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.title}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedCourse && (
        <div className="space-y-6">
          {/* 上传操作区 */}
          <Card className="rounded-xl border-[#e5e0db]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileUp className="w-4 h-4 text-[#d4a853]" />
                上传知识点文件
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-start">
                <div
                  className="flex-1 border-2 border-dashed border-[#e5e0db] rounded-xl p-6 text-center hover:border-[#d4a853] hover:bg-[#d4a853]/5 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-[#9a9590] mx-auto mb-2" />
                  <p className="text-sm text-[#2d2a26] font-medium mb-1">点击选择文件或拖拽到此处</p>
                  <p className="text-xs text-[#9a9590]">支持 Word (.docx) 和 PDF (.pdf) 格式，最大 20MB</p>
                  <input ref={fileInputRef} type="file" accept=".docx,.pdf" className="hidden" onChange={handleFileChange} />
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    className="bg-[#d4a853] hover:bg-[#c49a48] rounded-xl min-w-[140px]"
                    onClick={handleUpload}
                    disabled={uploading || !selectedCourse || !selectedFileName}
                  >
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />解析中...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />上传并解析</>
                    )}
                  </Button>

                  <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="rounded-xl border-[#e05d6f] text-[#e05d6f] hover:bg-[#e05d6f]/10 min-w-[140px]" disabled={!selectedCourse || deleting}>
                        <Trash2 className="w-4 h-4 mr-2" />清除图谱
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>确认删除知识图谱</DialogTitle></DialogHeader>
                      <p className="text-sm text-[#6b6560]">
                        确定要删除课程「{selectedCourseObj?.title}」的全部知识图谱数据吗？此操作不可撤销。
                      </p>
                      <DialogFooter>
                        <DialogClose asChild><Button variant="outline" className="rounded-xl">取消</Button></DialogClose>
                        <Button className="bg-[#e05d6f] hover:bg-[#c94d5e] rounded-xl" onClick={handleDelete} disabled={deleting}>
                          {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}确认删除
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-[#e5e0db] bg-[#faf8f5] p-3 md:grid-cols-[1fr_180px]">
                <label className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                  <span>
                    <span className="block font-medium text-[#2d2a26]">强制 RAG 引用校验</span>
                    <span className="text-xs text-[#6b6560]">导入后检查未引用句子，并在证据不足时标记自动降级。</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={ragRequired}
                    onChange={(event) => setRagRequired(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-[#6b6560]">引用风格</span>
                  <select
                    value={citationStyle}
                    onChange={(event) => setCitationStyle(event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#e5e0db] bg-white px-3 text-sm text-[#2d2a26]"
                  >
                    <option value="bracket">方括号 [S1]</option>
                    <option value="footnote">脚注</option>
                    <option value="inline">行内来源</option>
                  </select>
                </label>
              </div>

              {selectedFileName && (
                <div className="flex items-center gap-2 p-3 bg-[#f5f2ee] rounded-lg">
                  <FileText className="w-4 h-4 text-[#d4a853]" />
                  <span className="text-sm text-[#2d2a26] flex-1 truncate">{selectedFileName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {fileInputRef.current?.files?.[0]?.size >= CHUNK_UPLOAD_THRESHOLD ? '分片上传' : '待上传'}
                  </Badge>
                </div>
              )}

              {uploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-[#6b6560] text-center">
                    {uploadStage || (uploadProgress < 30 ? '正在读取文件...' : uploadProgress < 100 ? '正在解析知识点...' : '解析完成')}
                  </p>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {uploadResult && !error && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-[#5a9e6f]/30 bg-[#5a9e6f]/5">
                  <CheckCircle2 className="w-5 h-5 text-[#5a9e6f] flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#2d2a26]">{uploadResult.isDelete ? '删除成功' : '解析完成'}</p>
                    {uploadResult.isDelete ? (
                      <p className="text-xs text-[#6b6560]">已删除 {uploadResult.deleted_nodes} 个节点、{uploadResult.deleted_edges} 条边、{uploadResult.deleted_source_chunks} 个来源片段</p>
                    ) : (
                      <div className="text-xs text-[#6b6560] space-y-0.5">
                        <p>创建 {uploadResult.nodes_created} 个知识节点</p>
                        <p>创建 {uploadResult.edges_created} 条关联边</p>
                        {uploadResult.quality_report && <p>来源覆盖率 {uploadResult.quality_report.source_coverage_rate}%</p>}
                        {uploadResult.performance && (
                          <p>
                            上传模式 {uploadResult.performance.upload_mode === 'chunked' ? '分片并发' : '单请求'}
                            {uploadResult.performance.request_total_ms ? `，总耗时 ${Math.round(uploadResult.performance.request_total_ms)}ms` : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {uploadResult && !uploadResult.isDelete && (
                <RagReliabilityPanel data={uploadResult} title="图谱导入引用可靠性" />
              )}
            </CardContent>
          </Card>

          {/* 3D 预览区 - 全宽布局，600px 高度 */}
          {showPreview ? (
            <Card className="rounded-xl border-[#e5e0db]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Network className="w-4 h-4 text-[#4a90d9]" />
                    3D 知识图谱预览
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setShowPreview(false)}>
                    <Minimize2 className="w-4 h-4 mr-1" />收起
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <GraphPreviewCanvasV2 courseId={selectedCourse} refreshKey={previewRefreshKey} />
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center p-6 rounded-xl border border-dashed border-[#e5e0db] bg-[#f5f2ee]">
              <Button variant="ghost" className="rounded-xl" onClick={() => setShowPreview(true)}>
                <Maximize2 className="w-4 h-4 mr-2" />展开3D知识图谱预览
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 独立的3D图谱预览画布组件 ── */
function GraphPreviewCanvas({ courseId, refreshKey = 0 }) {
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    knowledgeGraph.getGraph(courseId)
      .then((data) => setGraphData(data))
      .catch((err) => setError(err.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [courseId, refreshKey])

  if (loading) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl">
        <Loader2 className="w-10 h-10 animate-spin text-[#d4a853] mb-3" />
        <p className="text-sm text-white/60">正在加载知识图谱...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl">
        <AlertCircle className="w-10 h-10 text-[#e05d6f] mb-3" />
        <p className="text-sm text-white/60 mb-3">{error}</p>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.location.reload()}>重试</Button>
      </div>
    )
  }

  const nodes = graphData?.nodes || []
  const edges = graphData?.edges || []

  if (nodes.length === 0) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center bg-[#f5f2ee] rounded-xl">
        <Network className="w-12 h-12 text-[#9a9590] mb-3" />
        <p className="text-sm text-[#6b6560]">暂无知识图谱数据</p>
        <p className="text-xs text-[#9a9590] mt-1">上传大纲文件后将自动生成3D知识图谱</p>
      </div>
    )
  }

  return (
    <div className="h-[600px] rounded-xl overflow-hidden">
      <Canvas
        camera={{ position: [0, 20, 35], fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
      >
        <fog attach="fog" args={['#1a1a2e', 50, 100]} />
        <Suspense fallback={null}>
          <KnowledgeGraphScene
            nodes={nodes}
            edges={edges}
            onNodeClick={() => {}}
          />
        </Suspense>
        <SafeOrbitControls maxDistance={100} />
      </Canvas>
    </div>
  )
}

function GraphPreviewCanvasV2({ courseId, refreshKey = 0 }) {
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState(VIEW_MODES.layered)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [focusTarget, setFocusTarget] = useState(null)

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    setError(null)
    knowledgeGraph.getGraph(courseId)
      .then((data) => setGraphData(data))
      .catch((err) => setError(err.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [courseId, refreshKey])

  const nodes = graphData?.nodes || []
  const edges = graphData?.edges || []
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])

  const stats = useMemo(() => {
    const counts = nodes.reduce((acc, n) => {
      acc[n.node_type] = (acc[n.node_type] || 0) + 1
      return acc
    }, {})
    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      chapters: counts.chapter || 0,
      knowledgePoints: counts.knowledge_point || 0,
      objectives: counts.objective || 0,
      skills: counts.skill || 0,
    }
  }, [nodes, edges])

  const filteredGraph = useMemo(() => {
    if (!nodes.length) return { nodes: [], edges: [] }
    // 聚焦模式不再改变图谱结构，仅通过高亮和相机聚焦来突出显示
    // 所有模式下都返回完整图谱，保持整体结构不变
    return { nodes, edges }
  }, [nodes, edges])

  const annotations = useMemo(() => {
    const chapters = nodes
      .filter((node) => node.node_type === 'chapter')
      .sort((a, b) => ((a.properties?.order_index ?? 999) - (b.properties?.order_index ?? 999)))
    const courseIds = nodes.filter((node) => node.node_type === 'course').map((node) => node.id)
    const kpsByChapter = new Map()
    nodes
      .filter((node) => node.node_type === 'knowledge_point')
      .forEach((node) => {
        const chapterTitle = node.properties?.chapter || ''
        if (!kpsByChapter.has(chapterTitle)) kpsByChapter.set(chapterTitle, [])
        kpsByChapter.get(chapterTitle).push(node)
      })

    return chapters
      .map((chapter, index) => {
        const rawTitle = getNodeTitle(chapter) || ''
        const isMeaningfulTitle = (name) => {
          if (!name || name.length < 2) return false
          if (/^\d+\.?\d*[fFdDlL]?$/.test(name)) return false
          if (/^[a-zA-Z0-9_.]+$/.test(name) && name.length < 4) return false
          if (/^String\s*\(/i.test(name)) return false
          return true
        }
        const title = isMeaningfulTitle(rawTitle) ? rawTitle : `第${index + 1}章`
        const chapterKps = (kpsByChapter.get(rawTitle) || kpsByChapter.get(title) || [])
          .filter((kp) => isMeaningfulTitle(getNodeTitle(kp)))
          .sort((a, b) => ((a.properties?.order_index ?? 999) - (b.properties?.order_index ?? 999)))
        const ids = new Set([chapter.id, ...courseIds])
        chapterKps.forEach((kp) => ids.add(kp.id))

        const lineEdges = edges.filter((edge) => ids.has(getEdgeSource(edge)) && ids.has(getEdgeTarget(edge)))
        const concepts = chapterKps.map(getNodeTitle).filter(isMeaningfulTitle)
        const relationSteps = lineEdges
          .filter((edge) => edge.edge_type === 'contains' || edge.edge_type === 'recommended_after' || edge.edge_type === 'prerequisite' || edge.edge_type === 'related')
          .slice(0, 8)
          .map((edge) => {
            const source = nodeMap[getEdgeSource(edge)]
            const target = nodeMap[getEdgeTarget(edge)]
            const sourceTitle = getNodeTitle(source)
            const targetTitle = getNodeTitle(target)
            if (!isMeaningfulTitle(sourceTitle) || !isMeaningfulTitle(targetTitle)) return null
            const relation = RELATION_LABELS[edge.edge_type] || EDGE_TYPE_META[edge.edge_type]?.label || edge.edge_type
            return `${sourceTitle} - ${relation} -> ${targetTitle}`
          })
          .filter(Boolean)

        const rawMainContent = chapter.properties?.main_content || ''
        const isValidMainContent = rawMainContent && rawMainContent.length >= 2 && isMeaningfulTitle(rawMainContent.split(/[：:]/)[0])
        const annotationTitle = isValidMainContent ? rawMainContent : title

        const rawAnnotation = chapter.properties?.annotation || ''
        const isValidAnnotation = rawAnnotation && rawAnnotation.length >= 4 && !/^String\s*\(/i.test(rawAnnotation) && isMeaningfulTitle(rawAnnotation.split(/[：:，,。]/)[0])

        return {
          id: `chapter-annotation-${chapter.id}`,
          title: annotationTitle,
          chapterTitle: title,
          rawTitle,
          summary: isValidAnnotation ? rawAnnotation : summarizeChapter(chapter, chapterKps),
          concepts,
          nodeIds: Array.from(ids),
          edgeKeys: lineEdges.map(getEdgeKey),
          steps: relationSteps.length ? relationSteps : concepts.length ? concepts.map((name) => `${title} - 包含 -> ${name}`) : [`${title}的学习路径`],
        }
      })
      .filter((annotation) => annotation.concepts.length > 0 || (!annotation.summary.startsWith('本线路根据文档章节') && !annotation.summary.startsWith('该章节已建立知识点')))
  }, [nodes, edges, nodeMap])

  const sourceCoverage = graphData?.quality_report?.source_coverage_rate ?? 0

  const handleReset = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
    setFocusTarget(null)
    setViewMode(VIEW_MODES.layered)
  }, [])

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
    setFocusTarget(node.id)
    // 分层总览模式下保持视图不变，其他模式切换到聚焦
    if (viewMode !== VIEW_MODES.layered) {
      setViewMode(VIEW_MODES.focus)
    }
  }, [viewMode])

  const handleNodeDoubleClick = useCallback((node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
    setFocusTarget(node.id)
    setViewMode(VIEW_MODES.focus)
  }, [])

  const handleEdgeClick = useCallback((edge) => {
    setSelectedEdge(edge)
    const s = nodeMap[edge.source_node_id ?? edge.source]
    const t = nodeMap[edge.target_node_id ?? edge.target]
    setSelectedNode(s || t || null)
    setFocusTarget((s || t || {}).id || null)
    // 分层总览模式下保持视图不变
    if (viewMode !== VIEW_MODES.layered) {
      setViewMode(VIEW_MODES.focus)
    }
  }, [nodeMap, viewMode])

  const handleAnnotationClick = useCallback((annotation) => {
    setSelectedEdge(null)
    const firstNode = annotation.nodeIds
      .map((id) => nodeMap[id])
      .find((node) => node?.node_type === 'chapter')
      || annotation.nodeIds.map((id) => nodeMap[id]).find(Boolean)
    setSelectedNode(firstNode || null)
    setFocusTarget(firstNode?.id || null)
    // 分层总览模式下保持视图不变
    if (viewMode !== VIEW_MODES.layered) {
      setViewMode(VIEW_MODES.focus)
    }
  }, [nodeMap, viewMode])

  if (loading) {
    return (
      <div className="h-[760px] flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl">
        <Loader2 className="w-10 h-10 animate-spin text-[#d4a853] mb-3" />
        <p className="text-sm text-white/60">正在加载知识图谱...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[760px] flex flex-col items-center justify-center bg-[#1a1a2e] rounded-xl">
        <AlertCircle className="w-10 h-10 text-[#e05d6f] mb-3" />
        <p className="text-sm text-white/60 mb-3">{error}</p>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.location.reload()}>重试</Button>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="h-[480px] flex flex-col items-center justify-center bg-[#f5f2ee] rounded-xl border border-[#e5e0db]">
        <Network className="w-12 h-12 text-[#9a9590] mb-3" />
        <p className="text-sm text-[#6b6560]">暂无知识图谱数据</p>
        <p className="text-xs text-[#9a9590] mt-1">上传文档后将自动生成 3D 知识图谱</p>
      </div>
    )
  }

  const detailNode = selectedNode ? nodeMap[selectedNode.id] || selectedNode : null
  const detailEdge = selectedEdge ? {
    ...selectedEdge,
    sourceNode: nodeMap[selectedEdge.source_node_id ?? selectedEdge.source],
    targetNode: nodeMap[selectedEdge.target_node_id ?? selectedEdge.target],
  } : null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full border-[#d4a853]/40 text-[#8a6422] bg-[#d4a853]/10"><Layers className="w-3 h-3 mr-1" />分层视图</Badge>
          <Badge variant="outline" className="rounded-full border-[#5a9e6f]/30 text-[#3f7d52] bg-[#5a9e6f]/10"><Route className="w-3 h-3 mr-1" />学习链路</Badge>
          <Badge variant="outline" className="rounded-full border-[#4a90d9]/30 text-[#2d6fb8] bg-[#4a90d9]/10"><Network className="w-3 h-3 mr-1" />{stats.totalNodes} 节点</Badge>
          <Badge variant="outline" className="rounded-full border-[#e07c4f]/30 text-[#b95a2d] bg-[#e07c4f]/10"><Link2 className="w-3 h-3 mr-1" />{stats.totalEdges} 关系</Badge>
          <Badge variant="outline" className="rounded-full border-[#7a8b99]/30 text-[#66717c] bg-[#7a8b99]/10">覆盖率 {sourceCoverage}%</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[#e5e0db] bg-white p-3">
            <div className="text-xs text-[#9a9590]">线路</div>
            <div className="text-xl font-semibold text-[#2d2a26]">{stats.chapters}</div>
          </div>
          <div className="rounded-xl border border-[#e5e0db] bg-white p-3">
            <div className="text-xs text-[#9a9590]">知识点</div>
            <div className="text-xl font-semibold text-[#2d2a26]">{stats.knowledgePoints}</div>
          </div>
          <div className="rounded-xl border border-[#e5e0db] bg-white p-3">
            <div className="text-xs text-[#9a9590]">目标</div>
            <div className="text-xl font-semibold text-[#2d2a26]">{stats.objectives}</div>
          </div>
          <div className="rounded-xl border border-[#e5e0db] bg-white p-3">
            <div className="text-xs text-[#9a9590]">技能</div>
            <div className="text-xl font-semibold text-[#2d2a26]">{stats.skills}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(VIEW_MODES).map(([, mode]) => (
            <Button key={mode} size="sm" variant={viewMode === mode ? 'default' : 'outline'} className={viewMode === mode ? 'rounded-xl bg-[#2d2a26] text-white' : 'rounded-xl'} onClick={() => setViewMode(mode)}>
              {mode === VIEW_MODES.layered ? '分层总览' : mode === VIEW_MODES.focus ? '聚焦关系' : '完整图谱'}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={handleReset}>重置视图</Button>
          <div className="text-xs text-[#9a9590] flex items-center gap-1"><Info className="w-3.5 h-3.5" />单击看详情，双击聚焦，点击关系看连线说明</div>
        </div>

        <div className="h-[620px] rounded-xl overflow-hidden border border-[#e5e0db] bg-[#1a1a2e]">
          <Canvas
            camera={{ position: [0, 18, 32], fov: 52, near: 0.1, far: 500 }}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
            style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
          >
            <fog attach="fog" args={['#1a1a2e', 40, 85]} />
            <Suspense fallback={null}>
              <KnowledgeGraphScene
                nodes={filteredGraph.nodes}
                edges={filteredGraph.edges}
                selectedNodeId={selectedNode?.id}
                highlightedNodes={[]}
                pathNodeIds={[]}
                pathEdgeKeys={[]}
                focusTarget={focusTarget}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onEdgeClick={handleEdgeClick}
                selectedEdgeKey={selectedEdge ? `${selectedEdge.source_node_id ?? selectedEdge.source}-${selectedEdge.target_node_id ?? selectedEdge.target}` : null}
                layoutMode={viewMode === VIEW_MODES.layered ? 'lanes' : 'force'}
              />
            </Suspense>
            <SafeOrbitControls />
          </Canvas>
        </div>

        {/* 主要内容注释 - 位于3D视图下方 */}
        <Card className="rounded-xl border-[#e5e0db]">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-[#e07c4f]" />主要内容注释</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {annotations.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {annotations.map((annotation, index) => {
                  // 去除标题和summary中与序号重复的数字前缀
                  const cleanTitle = (annotation.chapterTitle || annotation.title || '').replace(/^\d+[\.\、\s]+/, '').trim()
                  const cleanSubTitle = (annotation.title || '').replace(/^\d+[\.\、\s]+/, '').trim()
                  const cleanSummary = (annotation.summary || '').replace(/^\d+[\.\、\s]+/gm, '').trim()
                  return (
                    <button
                      key={annotation.id}
                      type="button"
                      className={`text-left rounded-xl border p-3 transition-colors ${selectedNode && annotation.nodeIds.includes(selectedNode.id) ? 'border-[#e07c4f] bg-[#e07c4f]/10' : 'border-[#e5e0db] bg-[#faf8f5] hover:bg-[#f5f2ee]'}`}
                      onClick={() => handleAnnotationClick(annotation)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e07c4f]/15 text-[11px] font-medium text-[#b95a2d]">{index + 1}</span>
                        <span className="font-medium text-[#2d2a26] line-clamp-1">{cleanTitle}</span>
                      </div>
                      {annotation.chapterTitle && cleanSubTitle && cleanSubTitle !== cleanTitle && (
                        <div className="text-[11px] text-[#9a9590] line-clamp-1 mb-1">{cleanSubTitle}</div>
                      )}
                      <div className="text-xs leading-relaxed text-[#6b6560] line-clamp-3">{cleanSummary}</div>
                      {annotation.concepts?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {annotation.concepts.slice(0, 4).map((concept) => (
                            <span key={concept} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#6b6560] border border-[#ebe6df]">{concept}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-[#f0ece7] bg-[#faf8f5] p-3 text-xs text-[#6b6560]">
                暂未识别到稳定章节结构。建议上传包含清晰标题层级的 Word 或 PDF，系统会按章节生成可定位注释。
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-3">
        {/* 关系详情 - 优化布局 */}
        <Card className="rounded-xl border-[#e5e0db]">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#4a90d9]" />关系详情</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-3">
            {detailEdge ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-[#f5f2ee] p-3">
                  <div className="text-[11px] text-[#9a9590] mb-1">关系类型</div>
                  <div className="font-medium text-[#2d2a26]">{EDGE_TYPE_META[detailEdge.edge_type]?.label || detailEdge.edge_type}</div>
                  <div className="text-xs text-[#6b6560] mt-0.5">{EDGE_TYPE_META[detailEdge.edge_type]?.note}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#e5e0db] bg-white p-2.5">
                    <div className="text-[11px] text-[#9a9590] mb-0.5">起点</div>
                    <div className="text-[#2d2a26] text-xs font-medium line-clamp-2">{detailEdge.sourceNode?.label || detailEdge.sourceNode?.name || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-[#e5e0db] bg-white p-2.5">
                    <div className="text-[11px] text-[#9a9590] mb-0.5">终点</div>
                    <div className="text-[#2d2a26] text-xs font-medium line-clamp-2">{detailEdge.targetNode?.label || detailEdge.targetNode?.name || '-'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#f5f2ee] p-2.5 text-center">
                    <div className="text-[11px] text-[#9a9590]">权重</div>
                    <div className="text-sm font-semibold text-[#2d2a26]">{detailEdge.weight ?? '-'}</div>
                  </div>
                  <div className="rounded-lg bg-[#f5f2ee] p-2.5 text-center">
                    <div className="text-[11px] text-[#9a9590]">置信度</div>
                    <div className="text-sm font-semibold text-[#2d2a26]">{detailEdge.confidence ?? '-'}</div>
                  </div>
                </div>
              </div>
            ) : detailNode ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-[#f5f2ee] p-3">
                  <div className="text-[11px] text-[#9a9590] mb-1">节点类型</div>
                  <div className="font-medium text-[#2d2a26]">{NODE_TYPE_META[detailNode.node_type]?.label || detailNode.node_type}</div>
                  <div className="text-xs text-[#6b6560] mt-0.5">{NODE_TYPE_META[detailNode.node_type]?.note}</div>
                </div>
                {detailNode.description && (
                  <div className="rounded-lg border border-[#e5e0db] bg-white p-3">
                    <div className="text-[11px] text-[#9a9590] mb-1">核心内容</div>
                    <div className="text-[#2d2a26] leading-relaxed text-xs">{detailNode.description}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#f5f2ee] p-2.5 text-center">
                    <div className="text-[11px] text-[#9a9590]">类别</div>
                    <div className="text-xs font-medium text-[#2d2a26]">{detailNode.category || '-'}</div>
                  </div>
                  <div className="rounded-lg bg-[#f5f2ee] p-2.5 text-center">
                    <div className="text-[11px] text-[#9a9590]">来源片段</div>
                    <div className="text-xs font-medium text-[#2d2a26]">{(detailNode.source_chunk_ids || []).length}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#e5e0db] bg-[#faf8f5] p-4 text-center">
                <Info className="w-5 h-5 text-[#9a9590] mx-auto mb-2" />
                <p className="text-xs text-[#9a9590]">点击任意节点或关系查看详情</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 动态详情 - 点击节点/关系时显示关联信息 */}
        <Card className="rounded-xl border-[#e5e0db]">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Network className="w-4 h-4 text-[#5a9e6f]" />关联信息</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {detailNode ? (() => {
              // 查找与当前节点关联的边和节点
              const nodeId = detailNode.id
              const relatedEdges = edges.filter(
                (e) => getEdgeSource(e) === nodeId || getEdgeTarget(e) === nodeId
              )
              const upstream = relatedEdges
                .filter((e) => getEdgeTarget(e) === nodeId)
                .map((e) => ({ edge: e, node: nodeMap[getEdgeSource(e)] }))
                .filter((r) => r.node)
              const downstream = relatedEdges
                .filter((e) => getEdgeSource(e) === nodeId)
                .map((e) => ({ edge: e, node: nodeMap[getEdgeTarget(e)] }))
                .filter((r) => r.node)

              if (!upstream.length && !downstream.length) {
                return <p className="text-xs text-[#9a9590]">该节点暂无关联关系</p>
              }

              return (
                <div className="space-y-2">
                  {upstream.length > 0 && (
                    <div>
                      <div className="text-[11px] text-[#9a9590] mb-1">上游节点</div>
                      {upstream.slice(0, 5).map(({ edge, node }) => (
                        <div key={node.id} onClick={() => handleNodeClick(node)} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[#f5f2ee] mb-1 cursor-pointer hover:bg-[#ede8e2] transition-colors">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_TYPE_META[node.node_type]?.color || '#64748b' }} />
                          <span className="text-xs text-[#2d2a26] truncate">{getNodeTitle(node)}</span>
                          <span className="text-[10px] text-[#9a9590] ml-auto flex-shrink-0">{EDGE_TYPE_META[edge.edge_type]?.label || edge.edge_type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {downstream.length > 0 && (
                    <div>
                      <div className="text-[11px] text-[#9a9590] mb-1">下游节点</div>
                      {downstream.slice(0, 5).map(({ edge, node }) => (
                        <div key={node.id} onClick={() => handleNodeClick(node)} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[#f5f2ee] mb-1 cursor-pointer hover:bg-[#ede8e2] transition-colors">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_TYPE_META[node.node_type]?.color || '#64748b' }} />
                          <span className="text-xs text-[#2d2a26] truncate">{getNodeTitle(node)}</span>
                          <span className="text-[10px] text-[#9a9590] ml-auto flex-shrink-0">{EDGE_TYPE_META[edge.edge_type]?.label || edge.edge_type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })() : detailEdge ? (() => {
              const sNode = detailEdge.sourceNode
              const tNode = detailEdge.targetNode
              const sRelated = sNode ? edges
                .filter((e) => getEdgeSource(e) === sNode.id && getEdgeTarget(e) !== tNode?.id)
                .map((e) => nodeMap[getEdgeTarget(e)])
                .filter(Boolean)
                .slice(0, 3) : []
              const tRelated = tNode ? edges
                .filter((e) => getEdgeTarget(e) === tNode.id && getEdgeSource(e) !== sNode?.id)
                .map((e) => nodeMap[getEdgeSource(e)])
                .filter(Boolean)
                .slice(0, 3) : []

              if (!sRelated.length && !tRelated.length) {
                return <p className="text-xs text-[#9a9590]">该关系两端暂无其他关联</p>
              }

              return (
                <div className="space-y-2">
                  {sRelated.length > 0 && (
                    <div>
                      <div className="text-[11px] text-[#9a9590] mb-1">起点其他关联</div>
                      {sRelated.map((node) => (
                        <div key={node.id} onClick={() => handleNodeClick(node)} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[#f5f2ee] mb-1 cursor-pointer hover:bg-[#ede8e2] transition-colors">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_TYPE_META[node.node_type]?.color || '#64748b' }} />
                          <span className="text-xs text-[#2d2a26] truncate">{getNodeTitle(node)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {tRelated.length > 0 && (
                    <div>
                      <div className="text-[11px] text-[#9a9590] mb-1">终点其他关联</div>
                      {tRelated.map((node) => (
                        <div key={node.id} onClick={() => handleNodeClick(node)} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-[#f5f2ee] mb-1 cursor-pointer hover:bg-[#ede8e2] transition-colors">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: NODE_TYPE_META[node.node_type]?.color || '#64748b' }} />
                          <span className="text-xs text-[#2d2a26] truncate">{getNodeTitle(node)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })() : (
              <div className="rounded-lg border border-dashed border-[#e5e0db] bg-[#faf8f5] p-4 text-center">
                <Network className="w-5 h-5 text-[#9a9590] mx-auto mb-2" />
                <p className="text-xs text-[#9a9590]">点击节点或关系后显示关联信息</p>
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

