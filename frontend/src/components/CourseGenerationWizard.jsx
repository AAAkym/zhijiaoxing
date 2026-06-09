import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Settings,
  Play,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileText,
  BookOpen,
  PenTool,
  Presentation,
  History,
  RotateCcw,
  Eye,
  Send,
  Users,
  Star,
  MessageSquare,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { courseGeneration } from '@/services/api'

const STEPS = [
  { step: 1, name: 'syllabus', label: '教学大纲', icon: FileText },
  { step: 2, name: 'core_content', label: '核心内容', icon: BookOpen },
  { step: 3, name: 'exercises', label: '配套习题', icon: PenTool },
  { step: 4, name: 'materials', label: '课件材料', icon: Presentation },
]

const PHASE_CONFIG = { label: '事前 · 参数配置', color: 'text-blue-600' }
const PHASE_GENERATE = { label: '事中 · 内容生成', color: 'text-purple-600' }
const PHASE_REVIEW = { label: '事后 · 审核优化', color: 'text-green-600' }

export default function CourseGenerationWizard({ myCourses = [], onBack }) {
  const [phase, setPhase] = useState('config')
  const [configId, setConfigId] = useState(null)
  const [config, setConfig] = useState({
    course_id: '',
    difficulty: 3,
    duration: 45,
    interaction_level: 'medium',
    video_ratio: 40,
    experiment_ratio: 30,
    discussion_ratio: 30,
    teaching_goal: 'normal',
    custom_requirements: '',
  })
  const [currentStep, setCurrentStep] = useState(0)
  const [stepContents, setStepContents] = useState({})
  const [editingContent, setEditingContent] = useState('')
  const [versions, setVersions] = useState({})
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reviews, setReviews] = useState([])
  const [peerReviewTarget, setPeerReviewTarget] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewScore, setReviewScore] = useState(0)

  const totalRatio = config.video_ratio + config.experiment_ratio + config.discussion_ratio

  const handleRatioChange = (field, value) => {
    const val = Number(value[0] ?? value)
    const others = ['video_ratio', 'experiment_ratio', 'discussion_ratio'].filter(f => f !== field)
    const otherSum = others.reduce((sum, f) => sum + config[f], 0)

    if (val + otherSum > 100) {
      const overflow = val + otherSum - 100
      const other1Val = config[others[0]]
      const other2Val = config[others[1]]
      const total = other1Val + other2Val
      const reduce1 = total > 0 ? Math.round(overflow * other1Val / total) : Math.round(overflow / 2)
      const reduce2 = overflow - reduce1

      setConfig(prev => ({
        ...prev,
        [field]: val,
        [others[0]]: Math.max(0, other1Val - reduce1),
        [others[1]]: Math.max(0, other2Val - reduce2),
      }))
    } else {
      setConfig(prev => ({ ...prev, [field]: val }))
    }
  }

  const handleStartGeneration = async () => {
    setSaving(true)
    try {
      const payload = { ...config }
      if (!payload.course_id || payload.course_id === 'none') delete payload.course_id
      const result = await courseGeneration.createConfig(payload)
      setConfigId(result.id)
      setConfig(result)
      setPhase('generate')
    } catch (err) {
      console.error('Failed to create config:', err)
      alert('创建配置失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateStep = async (step) => {
    if (!configId) return
    setGenerating(true)
    try {
      const result = await courseGeneration.generateStep(configId, step)
      if (result.version) {
        setStepContents(prev => ({ ...prev, [step]: result.version.content }))
        setEditingContent(result.version.content)
        setCurrentStep(step)
        if (result.versions) {
          setVersions(prev => ({ ...prev, [step]: result.versions || [result.version] }))
        }
      }
    } catch (err) {
      console.error('Generate step error:', err)
      alert('生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleConfirmStep = async (step, isModified = false) => {
    if (!configId) return
    setSaving(true)
    try {
      const payload = {}
      if (isModified) {
        payload.modified_content = editingContent
        payload.change_summary = '教师手动修改'
      }
      const result = await courseGeneration.confirmStep(configId, step, payload)
      if (result.config) {
        setConfig(result.config)
      }
      if (step >= 4) {
        setPhase('review')
      } else {
        const nextStep = step + 1
        setCurrentStep(nextStep)
        if (stepContents[nextStep]) {
          setEditingContent(stepContents[nextStep])
        } else {
          setEditingContent('')
          handleGenerateStep(nextStep)
        }
      }
    } catch (err) {
      console.error('Confirm step error:', err)
      alert('确认失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleRollback = async (step, versionNumber) => {
    if (!configId) return
    try {
      const result = await courseGeneration.rollback(configId, step, versionNumber)
      if (result.version) {
        setStepContents(prev => ({ ...prev, [step]: result.version.content }))
        setEditingContent(result.version.content)
      }
    } catch (err) {
      console.error('Rollback error:', err)
    }
  }

  const handleSubmitReview = async () => {
    if (!configId) return
    try {
      await courseGeneration.submitReview(configId)
      const detail = await courseGeneration.getConfig(configId)
      setReviews(detail.reviews || [])
      alert('已提交审核')
    } catch (err) {
      console.error('Submit review error:', err)
    }
  }

  const handleApproveReview = async (reviewId, status) => {
    if (!configId) return
    try {
      await courseGeneration.approveReview(configId, reviewId, {
        status,
        comment: reviewComment,
        score: reviewScore || undefined,
      })
      const detail = await courseGeneration.getConfig(configId)
      setReviews(detail.reviews || [])
      setReviewComment('')
      setReviewScore(0)
    } catch (err) {
      console.error('Approve review error:', err)
    }
  }

  const handleSharePeerReview = async () => {
    if (!configId || !peerReviewTarget) return
    try {
      await courseGeneration.sharePeerReview(configId, { teacher_ids: [Number(peerReviewTarget)] })
      alert('已分享给同行评议')
      setPeerReviewTarget('')
      const detail = await courseGeneration.getConfig(configId)
      setReviews(detail.reviews || [])
    } catch (err) {
      console.error('Share peer review error:', err)
    }
  }

  const handleFinalize = async () => {
    if (!configId) return
    if (!config.course_id || config.course_id === 'none') {
      alert('请先关联课程后再定稿')
      return
    }
    try {
      const result = await courseGeneration.finalize(configId)
      alert('课程内容已定稿并保存！\n' + (result.created_items || []).join('\n'))
      if (onBack) onBack()
    } catch (err) {
      console.error('Finalize error:', err)
      const msg = err?.response?.data?.error || err?.message || ''
      if (msg.includes('approved') || msg.includes('审核')) {
        alert('定稿失败：请先完成审核通过后再定稿')
      } else if (msg.includes('course_id') || msg.includes('关联课程')) {
        alert('定稿失败：请先关联课程后再定稿')
      } else {
        alert('定稿失败，请重试')
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>返回</Button>
        <h2 className="text-2xl font-bold text-gray-900">AI课程内容生成</h2>
        <Badge variant="outline" className={
          phase === 'config' ? PHASE_CONFIG.color :
          phase === 'generate' ? PHASE_GENERATE.color :
          PHASE_REVIEW.color
        }>
          {phase === 'config' ? PHASE_CONFIG.label :
           phase === 'generate' ? PHASE_GENERATE.label :
           PHASE_REVIEW.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[
          { key: 'config', label: '参数配置', icon: Settings },
          { key: 'generate', label: '内容生成', icon: Play },
          { key: 'review', label: '审核优化', icon: CheckCircle },
        ].map((p, i) => (
          <React.Fragment key={p.key}>
            {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              phase === p.key
                ? 'bg-blue-100 text-blue-700'
                : (phase === 'generate' && p.key === 'config') || (phase === 'review' && (p.key === 'config' || p.key === 'generate'))
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
            }`}>
              <p.icon className="w-4 h-4" />
              {p.label}
            </div>
          </React.Fragment>
        ))}
      </div>

      {phase === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                课程参数配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>关联课程</Label>
                <Select value={config.course_id} onValueChange={v => setConfig(prev => ({ ...prev, course_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择课程（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联课程</SelectItem>
                    {myCourses.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>课程难度系数：{config.difficulty} / 5</Label>
                <Slider
                  value={[config.difficulty]}
                  onValueChange={v => setConfig(prev => ({ ...prev, difficulty: v[0] }))}
                  min={1} max={5} step={1}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>1 入门</span><span>2 初级</span><span>3 中级</span><span>4 高级</span><span>5 专家</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>课时长度：{config.duration} 分钟</Label>
                <Slider
                  value={[config.duration]}
                  onValueChange={v => setConfig(prev => ({ ...prev, duration: v[0] }))}
                  min={30} max={90} step={5}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>30分钟</span><span>90分钟</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>互动频次</Label>
                <Select value={config.interaction_level} onValueChange={v => setConfig(prev => ({ ...prev, interaction_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低频互动（以讲授为主）</SelectItem>
                    <SelectItem value="medium">中频互动（讲授与互动结合）</SelectItem>
                    <SelectItem value="high">高频互动（以互动讨论为主）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                教学资源偏好
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>视频内容占比</Label>
                  <span className="text-sm font-medium">{config.video_ratio}%</span>
                </div>
                <Slider value={[config.video_ratio]} onValueChange={v => handleRatioChange('video_ratio', v)} min={0} max={100} step={5} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>实验活动占比</Label>
                  <span className="text-sm font-medium">{config.experiment_ratio}%</span>
                </div>
                <Slider value={[config.experiment_ratio]} onValueChange={v => handleRatioChange('experiment_ratio', v)} min={0} max={100} step={5} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>讨论环节占比</Label>
                  <span className="text-sm font-medium">{config.discussion_ratio}%</span>
                </div>
                <Slider value={[config.discussion_ratio]} onValueChange={v => handleRatioChange('discussion_ratio', v)} min={0} max={100} step={5} />
              </div>

              <div className={`p-3 rounded-lg border ${totalRatio === 100 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-sm font-medium ${totalRatio === 100 ? 'text-green-700' : 'text-red-700'}`}>
                  总占比：{totalRatio}% {totalRatio === 100 ? '✓' : '（需调整为100%）'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>教学目标类型</Label>
                <Select value={config.teaching_goal} onValueChange={v => setConfig(prev => ({ ...prev, teaching_goal: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">普通教学</SelectItem>
                    <SelectItem value="remedial">学困生专项辅导</SelectItem>
                    <SelectItem value="advanced">竞赛培优</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>具体教学要求（200字以内）</Label>
                <Textarea
                  value={config.custom_requirements}
                  onChange={e => setConfig(prev => ({ ...prev, custom_requirements: e.target.value.slice(0, 200) }))}
                  placeholder="请输入具体教学要求..."
                  rows={3}
                />
                <p className="text-xs text-gray-400">{config.custom_requirements.length}/200</p>
              </div>

              <Button
                onClick={handleStartGeneration}
                disabled={saving || totalRatio !== 100}
                className="w-full gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                开始生成
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {phase === 'generate' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            {STEPS.map((s, i) => {
              const isActive = currentStep === s.step
              const isDone = stepContents[s.step] && currentStep > s.step
              const hasContent = !!stepContents[s.step]
              return (
                <React.Fragment key={s.step}>
                  {i > 0 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                  <button
                    onClick={async () => {
                      setCurrentStep(s.step)
                      if (!hasContent) {
                        await handleGenerateStep(s.step)
                      } else {
                        setEditingContent(stepContents[s.step])
                      }
                    }}
                    disabled={generating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      isActive ? 'bg-purple-100 text-purple-700 border-2 border-purple-300 shadow-sm' :
                      isDone ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                    } ${!hasContent ? 'ring-2 ring-dashed ring-purple-300 hover:ring-solid hover:ring-purple-400' : ''}`}
                  >
                    {!hasContent ? <Sparkles className="w-4 h-4" /> :
                     isDone ? <CheckCircle className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                    {s.label}
                    {!hasContent && !generating && <span className="text-xs ml-1">(点击生成)</span>}
                    {generating && isActive && <Loader2 className="w-3 h-3 animate-spin" />}
                  </button>
                </React.Fragment>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {currentStep ? STEPS[currentStep - 1]?.label || '内容编辑' : '选择步骤开始生成'}
                    </CardTitle>
                    <div className="flex gap-2">
                      {currentStep > 0 && stepContents[currentStep] && (
                        <>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1">
                                <History className="w-3 h-3" />
                                版本历史
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>版本历史 - {STEPS[currentStep - 1]?.label}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3 max-h-96 overflow-y-auto">
                                {(versions[currentStep] || []).map(v => (
                                  <div key={v.id} className="p-3 border rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">v{v.version_number}</Badge>
                                        <span className="text-sm text-gray-500">{v.change_summary}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">
                                          {v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : ''}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRollback(currentStep, v.version_number)}
                                        >
                                          <RotateCcw className="w-3 h-3 mr-1" />
                                          回滚
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-3">{v.content?.slice(0, 200)}...</p>
                                  </div>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {currentStep === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                        <Play className="w-10 h-10 text-purple-500" />
                      </div>
                      <p className="text-gray-500 mb-6">选择上方步骤或点击下方按钮开始AI生成</p>
                      <Button
                        onClick={() => handleGenerateStep(1)}
                        disabled={generating}
                        size="lg"
                        className="gap-2 px-8 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 shadow-lg"
                      >
                        {generating ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> AI正在生成教学大纲...</>
                        ) : (
                          <><Sparkles className="w-5 h-5" /> 开始生成：第1步 - 教学大纲</>
                        )}
                      </Button>
                      <p className="text-xs text-gray-400 mt-4">建议按顺序依次生成：教学大纲 → 核心内容 → 配套习题 → 课件材料</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {!stepContents[currentStep] ? (
                        <div className="text-center py-8">
                          <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <p className="text-sm text-purple-700 font-medium">
                              正在准备生成：{STEPS[currentStep - 1]?.label}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleGenerateStep(currentStep)}
                            disabled={generating}
                            size="lg"
                            className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500"
                          >
                            {generating ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> AI生成中...</>
                            ) : (
                              <><Sparkles className="w-4 h-4" /> 生成{STEPS[currentStep - 1]?.label}</>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Textarea
                            value={editingContent}
                            onChange={e => setEditingContent(e.target.value)}
                            rows={20}
                            className="font-mono text-sm"
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => handleGenerateStep(currentStep)}
                                disabled={generating}
                                className="gap-1"
                              >
                                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                重新生成
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleConfirmStep(currentStep, editingContent !== stepContents[currentStep])}
                                disabled={saving}
                                className="gap-1 bg-green-600 hover:bg-green-700"
                              >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                确认并继续
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-sm">AI 生成建议</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-blue-700 mb-1">当前配置</p>
                  <div className="text-xs text-blue-600 space-y-1">
                    <p>难度：{'⭐'.repeat(config.difficulty)}</p>
                    <p>课时：{config.duration}分钟</p>
                    <p>互动：{config.interaction_level === 'low' ? '低频' : config.interaction_level === 'high' ? '高频' : '中频'}</p>
                    <p>目标：{config.teaching_goal === 'normal' ? '普通教学' : config.teaching_goal === 'remedial' ? '学困生辅导' : '竞赛培优'}</p>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs font-medium text-amber-700 mb-1">优化建议</p>
                  <div className="text-xs text-amber-600 space-y-1">
                    {config.difficulty >= 4 && <p>• 高难度课程建议增加实验环节占比</p>}
                    {config.interaction_level === 'high' && <p>• 高互动模式建议缩短单次讲授时长</p>}
                    {config.teaching_goal === 'remedial' && <p>• 辅导模式建议增加基础练习题比例</p>}
                    {config.teaching_goal === 'advanced' && <p>• 培优模式建议增加拓展内容深度</p>}
                    {config.duration >= 60 && <p>• 长课时建议设置课间休息环节</p>}
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs font-medium text-green-700 mb-1">生成进度</p>
                  <div className="space-y-2">
                    {STEPS.map(s => (
                      <div key={s.step} className="flex items-center gap-2 text-xs">
                        {stepContents[s.step] ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-gray-300" />
                        )}
                        <span className={stepContents[s.step] ? 'text-green-700' : 'text-gray-400'}>
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                强制人工审核
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-700">审核要求</p>
                </div>
                <p className="text-xs text-amber-600">
                  首次使用系统生成的课程内容必须经过教师手动确认并签署审核意见后方可定稿。
                </p>
              </div>

              <div className="space-y-2">
                <Label>审核意见</Label>
                <Textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="请输入审核意见..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>评分：{reviewScore > 0 ? `${reviewScore} 分` : '未评分'}</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      onClick={() => setReviewScore(s)}
                      className={`p-1 rounded transition-all ${reviewScore >= s ? 'text-yellow-500' : 'text-gray-300'}`}
                    >
                      <Star className="w-5 h-5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSubmitReview}
                  className="gap-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                  提交审核并确认
                </Button>
                <Button
                  onClick={handleFinalize}
                  className="gap-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  定稿保存
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                同行评议
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>分享给同行教师（输入教师ID）</Label>
                <div className="flex gap-2">
                  <Input
                    value={peerReviewTarget}
                    onChange={e => setPeerReviewTarget(e.target.value)}
                    placeholder="教师ID"
                    type="number"
                  />
                  <Button onClick={handleSharePeerReview} className="gap-1">
                    <Send className="w-3 h-3" />
                    分享
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>评议记录</Label>
                {reviews.filter(r => r.review_type === 'peer_review').length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">暂无同行评议</p>
                  </div>
                ) : (
                  reviews.filter(r => r.review_type === 'peer_review').map(r => (
                    <div key={r.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{r.reviewer_name}</span>
                        <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {r.status === 'approved' ? '通过' : r.status === 'rejected' ? '需修改' : '待审核'}
                        </Badge>
                      </div>
                      {r.comment && <p className="text-sm text-gray-600 mb-1">{r.comment}</p>}
                      {r.score && (
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < r.score ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t pt-4">
                <Button
                  onClick={handleFinalize}
                  className="w-full gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <CheckCircle className="w-4 h-4" />
                  定稿并保存课程内容
                </Button>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  定稿后将自动创建教学内容和考核到关联课程中
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
