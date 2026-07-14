import { useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  GitCompare,
  Highlighter,
  Loader2,
  Play,
  Sparkles,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { courseGeneration } from '@/services/api'
import RagReliabilityPanel from './RagReliabilityPanel'

const PROFILE_PRESETS = [
  {
    id: 'exam_slow',
    name: '应试巩固型',
    description: '基础薄弱、节奏偏慢、目标是考试提分',
    profile: {
      cognitive_style: 'reading',
      goal_orientation: 'exam',
      learning_pace: 'slow',
      interaction_preference: 'guided',
      knowledge_base: { Python基础: 42, 算法思维: 38 },
      error_patterns: [{ knowledge_point: '循环与条件', error_type: 'concept', frequency: 'high' }],
    },
  },
  {
    id: 'career_fast',
    name: '工程实践型',
    description: '节奏较快、偏好动手、目标是就业项目能力',
    profile: {
      cognitive_style: 'kinesthetic',
      goal_orientation: 'career',
      learning_pace: 'fast',
      interaction_preference: 'challenging',
      knowledge_base: { Python基础: 76, 工程实践: 55 },
      interest_areas: [{ name: '后端开发', weight: 0.8 }],
    },
  },
  {
    id: 'visual_research',
    name: '研究探索型',
    description: '偏视觉化理解、关注原理与研究拓展',
    profile: {
      cognitive_style: 'visual',
      goal_orientation: 'research',
      learning_pace: 'adaptive',
      interaction_preference: 'exploratory',
      knowledge_base: { 机器学习: 68, 数学基础: 58 },
      interest_areas: [{ name: '模型解释性', weight: 0.9 }],
    },
  },
  {
    id: 'mixed_hobby',
    name: '兴趣探索型',
    description: '混合学习风格、希望从有趣案例进入主题',
    profile: {
      cognitive_style: 'mixed',
      goal_orientation: 'hobby',
      learning_pace: 'moderate',
      interaction_preference: 'exploratory',
      interest_areas: [{ name: '小游戏和可视化', weight: 0.85 }],
    },
  },
]

const RESOURCE_TYPES = ['document', 'exercise', 'project']

/**
 * 解包Agent输出中的冗余包装键（兼容后端规范化前后的格式）。
 * 后端已做 _normalize_resources_for_output，但此处做防御性处理：
 *   resources.document.document.sections → resources.document.sections
 *   resources.project.project.title → resources.project.title
 */
function unwrapResource(resource, wrapperKey) {
  if (!resource || typeof resource !== 'object') return resource
  // 如果顶层有包装键且内层是对象，则解包
  if (wrapperKey && resource[wrapperKey] && typeof resource[wrapperKey] === 'object' && !Array.isArray(resource[wrapperKey])) {
    const inner = resource[wrapperKey]
    const merged = { ...inner }
    // 保留顶层的 enrichment 字段
    for (const [key, value] of Object.entries(resource)) {
      if (key !== wrapperKey) merged[key] = value
    }
    return merged
  }
  return resource
}

function stringifyPreview(value, maxLength = 900) {
  if (!value) return '暂无内容'
  if (typeof value === 'string') return value.slice(0, maxLength)
  // 优先提取可读文本字段
  const preferred = value.content || value.markdown || value.summary || value.description || value.title
  if (preferred && typeof preferred === 'string') return preferred.slice(0, maxLength)
  // 尝试从 sections 中拼接摘要
  if (Array.isArray(value.sections) && value.sections.length > 0) {
    const parts = value.sections.slice(0, 3).map(sec => {
      const header = sec.title ? `## ${sec.title}` : ''
      const body = sec.content || sec.key_points?.join('、') || ''
      return header ? `${header}\n${body}` : body
    })
    return parts.join('\n\n').slice(0, maxLength)
  }
  // 尝试从 exercises 中拼接摘要
  if (Array.isArray(value.exercises) && value.exercises.length > 0) {
    const parts = value.exercises.slice(0, 3).map(ex =>
      ex.question || ex.title || ''
    ).filter(Boolean)
    if (parts.length > 0) return parts.join('\n\n').slice(0, maxLength)
  }
  return JSON.stringify(value, null, 2).slice(0, maxLength)
}

function getQualityData(result) {
  const dimensions = result?.content_quality_report?.dimensions || {}
  return [
    { dimension: '覆盖率', score: dimensions.coverage?.score || 0 },
    { dimension: '难度', score: dimensions.difficulty?.score || 0 },
    { dimension: '事实性', score: dimensions.factuality?.score || 0 },
    { dimension: '引用完整性', score: dimensions.citation_integrity?.score || 0 },
  ]
}

function getHighlightItems(result) {
  const resources = result?.resources || {}
  // 从所有资源中收集引用和适配说明，优先使用有内容的资源
  const allReferences = []
  let bestAdaptation = ''
  for (const resource of Object.values(resources)) {
    if (!resource || typeof resource !== 'object') continue
    const refs = resource.knowledge_point_references || resource['知识点引用来源'] || []
    if (refs.length > 0) allReferences.push(...refs)
    const adaptation = resource.profile_adaptation_explanation || resource['画像适配说明'] || ''
    if (adaptation && adaptation !== '暂无画像适配说明' && adaptation.length > (bestAdaptation?.length || 0)) {
      bestAdaptation = adaptation
    }
  }
  return {
    references: allReferences,
    adaptation: bestAdaptation || '暂无画像适配说明',
  }
}

function extractKeyFeatures(result) {
  const resources = result?.resources || {}
  const features = []
  const profile = result?.student_profile_summary || ''

  // 文档：解包 document 包装键后提取 sections 和 glossary
  const rawDoc = resources.document || resources.mindmap
  const doc = unwrapResource(rawDoc, rawDoc === resources.mindmap ? 'mindmap' : 'document')
  if (doc && typeof doc === 'object') {
    const sections = doc.sections || []
    sections.slice(0, 3).forEach((sec) => {
      if (sec.title) features.push({ type: 'section', label: sec.title, source: 'document' })
    })
    const glossary = doc.glossary || []
    glossary.slice(0, 3).forEach((g) => {
      if (g.term) features.push({ type: 'term', label: g.term, source: 'glossary' })
    })
  }

  // 习题：提取题型（兼容 items/exercises 两种键名和 type/question_type 两种字段）
  const exercise = resources.exercise || resources.layered_exercise
  if (exercise && typeof exercise === 'object') {
    const items = exercise.items || exercise.exercises || exercise.basic?.exercises || []
    const types = new Set()
    items.slice(0, 8).forEach((item) => {
      if (item.question_type) types.add(item.question_type)
      if (item.type) types.add(item.type)
    })
    types.forEach((t) => features.push({ type: 'exercise_type', label: t, source: 'exercise' }))
  }

  // 项目：解包 project 包装键后提取 title 和 language
  const rawProject = resources.project
  const project = unwrapResource(rawProject, 'project')
  if (project && typeof project === 'object') {
    const lang = project.language || project.programming_language
    if (lang) features.push({ type: 'language', label: lang, source: 'project' })
    const title = project.title || project.project_title
    if (title) features.push({ type: 'project', label: title, source: 'project' })
  }

  const media = resources.media
  if (media && typeof media === 'object') {
    if (media.video_type) features.push({ type: 'media_type', label: media.video_type, source: 'media' })
    if (media.duration_minutes) features.push({ type: 'duration', label: `${media.duration_minutes}分钟`, source: 'media' })
  }

  return { features, profileSummary: profile }
}

function buildDifferenceAnalysis(results, selectedProfiles) {
  if (!results || results.length === 0) return null

  // 过滤掉仍在生成中（null）的画像，仅分析已完成的结果
  const completedResults = results.filter(r => r !== null)
  if (completedResults.length === 0) return null

  const analyses = results.map((result, index) => {
    if (!result) return null
    const { features, profileSummary } = extractKeyFeatures(result)
    const quality = result?.content_quality_report || {}
    const dimensions = quality.dimensions || {}
    return {
      name: selectedProfiles[index]?.name || `画像 ${index + 1}`,
      description: selectedProfiles[index]?.description || '',
      profileSummary,
      features,
      overallScore: quality.overall_score || 0,
      coverage: dimensions.coverage?.score || 0,
      difficulty: dimensions.difficulty?.score || 0,
      factuality: dimensions.factuality?.score || 0,
      citation: dimensions.citation_integrity?.score || 0,
      adaptation: getHighlightItems(result).adaptation,
    }
  }).filter(a => a !== null)

  const featureLabels = new Map()
  analyses.forEach((a) => {
    a.features.forEach((f) => {
      const key = `${f.source}:${f.label}`
      if (!featureLabels.has(key)) {
        featureLabels.set(key, { label: f.label, source: f.source, type: f.type, presentIn: [] })
      }
      featureLabels.get(key).presentIn.push(a.name)
    })
  })

  const uniqueFeatures = []
  const sharedFeatures = []
  featureLabels.forEach((info) => {
    if (info.presentIn.length === analyses.length) {
      sharedFeatures.push(info)
    } else {
      uniqueFeatures.push(info)
    }
  })

  const maxScore = Math.max(...analyses.map((a) => a.overallScore), 1)
  const minScore = Math.min(...analyses.map((a) => a.overallScore))
  const scoreGap = maxScore - minScore

  return { analyses, uniqueFeatures, sharedFeatures, scoreGap }
}

function AgentProgressPanel({ agents, progress, loading }) {
  const progressSteps = progress?.steps || []
  const agentRows = Object.values(agents || {})
  const overall = progress?.overall_progress ?? (
    agentRows.length
      ? Math.round(agentRows.filter(agent => agent.status === 'success').length / agentRows.length * 100)
      : 0
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles />
          Agent 协作进度
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Progress value={overall} />
          <span className="w-14 text-right text-sm font-medium">{overall}%</span>
        </div>

        {progressSteps.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-3">
            {progressSteps.map(step => (
              <div key={step.resource_type} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{step.resource_type}</span>
                  <StatusBadge status={step.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.agent_name}</p>
                <Progress className="mt-3" value={step.progress} />
                {step.status === 'failed' && step.error_message && (
                  <p className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                    {step.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {agentRows.map(agent => (
              <div key={agent.name} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <StatusBadge status={agent.status} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {agent.current_task || agent.output_summary || agent.role}
                </p>
              </div>
            ))}
            {agentRows.length === 0 && (
              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                {loading ? '正在获取 Agent 状态...' : '点击生成后展示任务分配与执行状态'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }) {
  const map = {
    success: { label: '完成', icon: CheckCircle },
    completed: { label: '完成', icon: CheckCircle },
    running: { label: '运行中', icon: Loader2 },
    failed: { label: '失败', icon: AlertCircle },
    pending: { label: '等待', icon: Clock },
    skipped: { label: '跳过', icon: Clock },
    idle: { label: '空闲', icon: Clock },
  }
  const item = map[status] || { label: status || '未知', icon: Clock }
  const Icon = item.icon
  return (
    <Badge variant={status === 'failed' ? 'destructive' : status === 'running' ? 'default' : 'secondary'} className="gap-1">
      <Icon className={status === 'running' ? 'animate-spin' : ''} />
      {item.label}
    </Badge>
  )
}

function ResultColumn({ preset, result, highlightKeys }) {
  // result为null时表示该画像仍在生成中
  if (!result) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span>{preset.name}</span>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">{preset.description}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">正在生成中...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const resources = result?.resources || {}
  // 解包后再提取预览，确保能正确读取 document.sections 等字段
  const docResource = unwrapResource(resources.document, 'document')
  const mindmapResource = unwrapResource(resources.mindmap, 'mindmap')
  const exerciseResource = resources.exercise
  const documentPreview = stringifyPreview(docResource || mindmapResource || exerciseResource)
  const highlights = getHighlightItems(result)
  const qualityData = getQualityData(result)
  const { features } = extractKeyFeatures(result)
  const errors = result?.errors || {}
  const failedAgents = Object.keys(errors)
  const hasErrors = failedAgents.length > 0

  const featureTypeColors = {
    section: 'bg-blue-100 text-blue-700',
    term: 'bg-purple-100 text-purple-700',
    exercise_type: 'bg-green-100 text-green-700',
    language: 'bg-orange-100 text-orange-700',
    project: 'bg-indigo-100 text-indigo-700',
    media_type: 'bg-pink-100 text-pink-700',
    duration: 'bg-amber-100 text-amber-700',
  }

  const isHighlighted = (feature) => {
    if (!highlightKeys || highlightKeys.length === 0) return false
    return highlightKeys.includes(`${feature.source}:${feature.label}`)
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>{preset.name}</span>
          <Badge variant="outline">{result?.content_quality_report?.overall_score || 0} 分</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{preset.description}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasErrors && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {failedAgents.length} 个 Agent 生成失败
            </p>
            <div className="flex flex-col gap-1">
              {failedAgents.map(agentName => (
                <div key={agentName} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{agentName}</span>
                  <span className="ml-1.5">{errors[agentName]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <RagReliabilityPanel data={result} title="引用可靠性" />

        <div className="rounded-md border bg-muted/20 p-3">
          <p className="mb-2 text-sm font-medium">生成内容摘要</p>
          <p className="max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {documentPreview}
          </p>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Highlighter className="h-3.5 w-3.5" />
            关键特征高亮
          </p>
          <div className="flex flex-wrap gap-1.5">
            {features.length === 0 && (
              <span className="text-xs text-muted-foreground">暂无可提取的关键特征</span>
            )}
            {features.map((feature, index) => (
              <span
                key={`${feature.source}-${feature.label}-${index}`}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  featureTypeColors[feature.type] || 'bg-gray-100 text-gray-700'
                } ${isHighlighted(feature) ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}
                title={isHighlighted(feature) ? '该特征为当前画像独有或差异项' : ''}
              >
                {feature.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">画像适配说明</p>
          <p className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">
            {highlights.adaptation}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">知识点引用来源</p>
          <div className="flex max-h-40 flex-col gap-2 overflow-auto">
            {highlights.references.slice(0, 4).map((ref, index) => (
              <div key={`${ref.source_id || index}`} className="rounded-md border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{ref.title || ref.source_id}</span>
                  <Badge variant="secondary">{ref.source_type || 'source'}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{ref.location || ref.excerpt || '未标注位置'}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">质量评分</p>
          <ChartContainer
            className="h-52"
            config={{
              score: { label: '评分', color: 'hsl(var(--primary))' },
            }}
          >
            <RadarChart data={qualityData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="dimension" />
              <Radar dataKey="score" fill="var(--color-score)" fillOpacity={0.28} stroke="var(--color-score)" />
              <ChartTooltip content={<ChartTooltipContent />} />
            </RadarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PersonalizationComparisonDemo() {
  const [topic, setTopic] = useState('Python 循环结构与条件判断')
  const [knowledgeText, setKnowledgeText] = useState('条件分支, for 循环, while 循环, 循环嵌套, 常见边界错误')
  const [selectedIds, setSelectedIds] = useState(['exam_slow', 'career_fast', 'visual_research'])
  const [courseId, setCourseId] = useState('')
  const [results, setResults] = useState([])
  const [agents, setAgents] = useState({})
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedProfiles = useMemo(
    () => selectedIds.map(id => PROFILE_PRESETS.find(item => item.id === id)).filter(Boolean),
    [selectedIds]
  )

  const comparisonData = useMemo(() => {
    return selectedProfiles.map((preset, index) => ({
      name: preset.name,
      score: results[index]?.content_quality_report?.overall_score || 0,
    }))
  }, [results, selectedProfiles])

  const differenceAnalysis = useMemo(() => {
    if (results.length === 0) return null
    return buildDifferenceAnalysis(results, selectedProfiles)
  }, [results, selectedProfiles])

  const highlightKeys = useMemo(() => {
    if (!differenceAnalysis) return []
    return differenceAnalysis.uniqueFeatures.map((f) => `${f.source}:${f.label}`)
  }, [differenceAnalysis])

  const updateSelectedProfile = (index, value) => {
    setSelectedIds(prev => prev.map((item, itemIndex) => itemIndex === index ? value : item))
  }

  const pollAgents = async () => {
    try {
      const response = await courseGeneration.getAgentsStatus()
      setAgents(response.agents || {})
    } catch {
      // The generation request itself will surface the important error.
    }
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setResults([])
    setProgress({
      overall_progress: 8,
      steps: RESOURCE_TYPES.map(resourceType => ({
        resource_type: resourceType,
        agent_name: `${resourceType}_agent`,
        status: 'pending',
        progress: 0,
      })),
    })

    const timer = setInterval(pollAgents, 1000)
    try {
      await pollAgents()
      const knowledge_points = knowledgeText.split(/[,，\n]/).map(item => item.trim()).filter(Boolean)

      // 并行发送3个画像请求，每个间隔0.3s错峰避免QPS限流
      // 每个画像完成后立即更新UI，实现进度同步
      const partialResults = new Array(selectedProfiles.length).fill(null)

      const promises = selectedProfiles.map((preset, index) => {
        const staggerDelay = index > 0 ? new Promise(resolve => setTimeout(resolve, index * 300)) : Promise.resolve()
        return staggerDelay.then(() =>
          courseGeneration.generateResourcePackage({
            topic,
            knowledge_points,
            resource_types: RESOURCE_TYPES,
            student_profile: preset.profile,
            course_id: courseId ? Number(courseId) : undefined,
            rag_required: Boolean(courseId),
            citation_style: 'bracket',
          }).then(result => {
            partialResults[index] = result
            // 增量更新：每完成一个画像就刷新UI
            setResults([...partialResults])
          }).catch(err => {
            partialResults[index] = {
              error: err.message || '请求失败',
              resources: {},
              content_quality_report: { overall_score: 0, dimensions: {} },
              agent_progress: {
                overall_progress: 0,
                steps: RESOURCE_TYPES.map(resourceType => ({
                  resource_type: resourceType,
                  agent_name: `${resourceType}_agent`,
                  status: 'failed',
                  progress: 0,
                  error_message: err.message || '请求失败',
                })),
              },
              errors: { request: err.message || '请求失败' },
              student_profile_summary: preset.name || '',
            }
            setResults([...partialResults])
          })
        )
      })

      await Promise.all(promises)
      const generated = partialResults

      // 合并三个画像的进度步骤，展示整体协作状态
      const allSteps = {}
      generated.forEach(result => {
        const steps = result?.agent_progress?.steps || []
        steps.forEach(step => {
          const key = step.resource_type
          if (!allSteps[key]) {
            allSteps[key] = { ...step }
          } else {
            const statusPriority = { failed: 0, pending: 1, running: 2, skipped: 3, completed: 4 }
            const existing = statusPriority[allSteps[key].status] ?? 5
            const current = statusPriority[step.status] ?? 5
            if (current < existing) {
              allSteps[key] = { ...allSteps[key], ...step }
            }
          }
        })
      })
      const mergedProgress = {
        overall_progress: generated.length > 0
          ? Math.round(generated.filter(r => r && !r.error).length / generated.length * 100)
          : 0,
        steps: Object.values(allSteps),
      }
      setProgress(mergedProgress)
      await pollAgents()
    } catch (err) {
      setError(err.message || '生成失败，请检查后端服务和 Spark API 配置')
      setProgress(prev => ({
        ...(prev || {}),
        overall_progress: 0,
        steps: (prev?.steps || []).map(step => ({ ...step, status: 'failed' })),
      }))
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <GitCompare />
          <h1 className="text-2xl font-bold tracking-normal">个性化对比演示</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          选择同一主题下的三个不同用户画像，并列查看资源生成差异、画像适配说明、知识点引用来源和质量评分。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Play />
            生成设置
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_1.4fr_0.6fr]">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="topic">同一题目</label>
            <Input id="topic" value={topic} onChange={event => setTopic(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="knowledge-points">知识点</label>
            <Textarea
              id="knowledge-points"
              value={knowledgeText}
              onChange={event => setKnowledgeText(event.target.value)}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="course-id">课程 ID</label>
            <Input
              id="course-id"
              value={courseId}
              onChange={event => setCourseId(event.target.value.replace(/[^\d]/g, ''))}
              placeholder="可选"
            />
          </div>

          <div className="grid gap-3 lg:col-span-3 md:grid-cols-3">
            {[0, 1, 2].map(index => (
              <div key={index} className="flex flex-col gap-2">
                <label className="text-sm font-medium">画像 {index + 1}</label>
                <Select value={selectedIds[index]} onValueChange={value => updateSelectedProfile(index, value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFILE_PRESETS.map(preset => (
                      <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{selectedProfiles[index]?.description}</p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-3">
            <Button onClick={handleGenerate} disabled={loading || !topic.trim()} className="gap-2">
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              生成三画像对比
            </Button>
          </div>
        </CardContent>
      </Card>

      <AgentProgressPanel agents={agents} progress={progress} loading={loading} />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
            <AlertCircle />
            {error}
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 />
                质量总分对比
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                className="h-72"
                config={{ score: { label: '质量总分', color: 'hsl(var(--primary))' } }}
              >
                <BarChart data={comparisonData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="score" fill="var(--color-score)" radius={6} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            {selectedProfiles.map((preset, index) => (
              <ResultColumn
                key={preset.id}
                preset={preset}
                result={results[index]}
                highlightKeys={highlightKeys}
              />
            ))}
          </div>

          {differenceAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Highlighter />
                  差异分析
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 text-sm leading-6">
                {/* 画像适配差异 */}
                <div>
                  <p className="mb-2 font-medium text-foreground">画像适配差异</p>
                  <div className="flex flex-col gap-2">
                    {differenceAnalysis.analyses.map((analysis) => (
                      <div key={analysis.name} className="rounded-md border bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{analysis.name}</span>
                          <Badge variant="outline">{analysis.overallScore} 分</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{analysis.description}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">{analysis.adaptation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* 质量维度对比 */}
                <div>
                  <p className="mb-2 font-medium text-foreground">质量维度对比</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">画像</th>
                          <th className="px-3 font-medium">覆盖率</th>
                          <th className="px-3 font-medium">难度</th>
                          <th className="px-3 font-medium">事实性</th>
                          <th className="px-3 font-medium">引用完整性</th>
                          <th className="pl-3 font-medium">总分</th>
                        </tr>
                      </thead>
                      <tbody>
                        {differenceAnalysis.analyses.map((analysis) => (
                          <tr key={analysis.name} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-medium text-foreground">{analysis.name}</td>
                            <td className="px-3">{analysis.coverage}</td>
                            <td className="px-3">{analysis.difficulty}</td>
                            <td className="px-3">{analysis.factuality}</td>
                            <td className="px-3">{analysis.citation}</td>
                            <td className="pl-3 font-semibold">{analysis.overallScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {differenceAnalysis.scoreGap > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      质量总分最大差距：{differenceAnalysis.scoreGap} 分，说明不同画像对生成质量有显著影响。
                    </p>
                  )}
                </div>

                <Separator />

                {/* 差异特征高亮 */}
                {differenceAnalysis.uniqueFeatures.length > 0 && (
                  <div>
                    <p className="mb-2 font-medium text-foreground">差异特征（黄色高亮项）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {differenceAnalysis.uniqueFeatures.map((feature, index) => (
                        <span
                          key={`unique-${index}`}
                          className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 ring-1 ring-yellow-300"
                          title={`仅出现在：${feature.presentIn.join('、')}`}
                        >
                          {feature.label}
                          <span className="ml-1 text-yellow-600">({feature.presentIn.join('、')})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 共同特征 */}
                {differenceAnalysis.sharedFeatures.length > 0 && (
                  <div>
                    <p className="mb-2 font-medium text-foreground">三画像共同特征</p>
                    <div className="flex flex-wrap gap-1.5">
                      {differenceAnalysis.sharedFeatures.slice(0, 12).map((feature, index) => (
                        <span
                          key={`shared-${index}`}
                          className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                        >
                          {feature.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <p className="text-muted-foreground">
                  同一题目下，系统会根据认知风格调整表达形态，根据目标导向调整内容侧重点，根据学习节奏调整讲解密度。
                  对比结果中的引用来源用于支撑内容可信度，质量评分用于快速定位需要人工复核的维度。
                  黄色高亮标记的特征为各画像独有或差异项，绿色标记为三画像共同覆盖的内容。
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
