import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Network,
  Play,
  Sparkles,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { courseGeneration } from '@/services/api'

const STATUS_CONFIG = {
  success: { label: '完成', icon: CheckCircle, tone: 'success' },
  completed: { label: '完成', icon: CheckCircle, tone: 'success' },
  running: { label: '运行中', icon: Loader2, tone: 'running' },
  failed: { label: '失败', icon: AlertCircle, tone: 'failed' },
  pending: { label: '等待中', icon: Clock, tone: 'pending' },
  skipped: { label: '已跳过', icon: Clock, tone: 'pending' },
  idle: { label: '空闲', icon: Clock, tone: 'pending' },
  waiting: { label: '等待中', icon: Clock, tone: 'pending' },
}

const AGENT_LABELS = {
  coordinator: '协调者',
  exercise_agent: '习题设计专家',
  document_agent: '课程文档专家',
  media_agent: '多媒体教学专家',
  recommendation_agent: '资源推荐专家',
  project_agent: '实践项目设计专家',
}

const RESOURCE_LABELS = {
  exercise: '个性化练习',
  layered_exercise: '分层练习',
  document: '讲解文档',
  mindmap: '思维导图',
  media: '视频脚本',
  recommendation: '拓展资源',
  project: '实操案例',
}

function StatusIndicator({ status }) {
  const config = STATUS_CONFIG[status] || { label: status || '未知', icon: Clock, tone: 'pending' }
  const Icon = config.icon
  const spin = status === 'running'
  const variant =
    config.tone === 'failed' ? 'destructive' : config.tone === 'running' ? 'default' : 'secondary'
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={spin ? 'animate-spin h-3 w-3' : 'h-3 w-3'} />
      {config.label}
    </Badge>
  )
}

function AgentCard({ step, index }) {
  const resourceLabel = RESOURCE_LABELS[step.resource_type] || step.resource_type
  const agentLabel = AGENT_LABELS[step.agent_name] || step.agent_name
  return (
    <div className="rounded-lg border bg-background p-3 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{resourceLabel}</p>
            <p className="truncate text-xs text-muted-foreground">{agentLabel}</p>
          </div>
        </div>
        <StatusIndicator status={step.status} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Progress value={step.progress || 0} className="h-1.5" />
        <span className="w-10 text-right text-xs text-muted-foreground">{step.progress || 0}%</span>
      </div>
      {step.task_type && (
        <p className="mt-1.5 truncate text-[10px] text-muted-foreground/70">任务: {step.task_type}</p>
      )}
    </div>
  )
}

function TimelineItem({ step, index, isLast }) {
  const config = STATUS_CONFIG[step.status] || { icon: Clock, tone: 'pending' }
  const Icon = config.icon
  const dotColor =
    config.tone === 'success'
      ? 'bg-green-500'
      : config.tone === 'failed'
        ? 'bg-red-500'
        : config.tone === 'running'
          ? 'bg-blue-500'
          : 'bg-gray-300'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${dotColor} text-white`}>
          <Icon className={`h-3.5 w-3.5 ${step.status === 'running' ? 'animate-spin' : ''}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>
      <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {RESOURCE_LABELS[step.resource_type] || step.resource_type}
          </span>
          <span className="text-xs text-muted-foreground">#{index + 1}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {AGENT_LABELS[step.agent_name] || step.agent_name}
        </p>
        {step.status === 'running' && (
          <p className="mt-1 text-xs text-blue-600">正在执行 {step.task_type || '生成任务'}...</p>
        )}
        {step.status === 'completed' && (
          <p className="mt-1 text-xs text-green-600">已完成，进度 100%</p>
        )}
        {step.status === 'failed' && (
          <p className="mt-1 text-xs text-red-600">执行失败，请查看日志</p>
        )}
      </div>
    </div>
  )
}

/**
 * Agent 协作进度可视化组件
 *
 * 通过进度条、状态指示器和时间线实时展示多 Agent 协作过程中的任务分配、执行状态和完成进度。
 *
 * @param {Object} props
 * @param {Object} props.progress - 来自后端的 agent_progress 数据（含 overall_progress、steps 等）
 * @param {Object} props.agents - 来自后端的 agents 状态字典
 * @param {boolean} props.loading - 是否正在生成中
 * @param {boolean} props.autoPoll - 是否自动轮询 agent 状态（默认 true）
 * @param {string} props.title - 面板标题
 */
export default function AgentCollaborationProgress({
  progress,
  agents: agentsProp,
  loading = false,
  autoPoll = true,
  title = 'Agent 协作进度',
}) {
  const [polledAgents, setPolledAgents] = useState(agentsProp || {})
  const timerRef = useRef(null)

  const agents = agentsProp !== undefined ? agentsProp : polledAgents
  const currentProgress = progress || null

  useEffect(() => {
    if (!autoPoll) return
    let cancelled = false

    const poll = async () => {
      try {
        const response = await courseGeneration.getAgentsStatus()
        if (!cancelled) {
          setPolledAgents(response.agents || {})
        }
      } catch {
        // 生成请求本身会暴露重要错误，这里静默处理
      }
    }

    if (loading) {
      poll()
      timerRef.current = setInterval(poll, 1500)
    }

    return () => {
      cancelled = true
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [loading, autoPoll])

  const steps = currentProgress?.steps || []
  const agentRows = Object.values(agents || {})
  const overall =
    currentProgress?.overall_progress ??
    (agentRows.length
      ? Math.round(
          (agentRows.filter((a) => a.status === 'success').length / agentRows.length) * 100
        )
      : 0)

  const completedCount = steps.filter((s) => s.status === 'completed').length
  const failedCount = steps.filter((s) => s.status === 'failed').length
  const runningCount = steps.filter((s) => s.status === 'running').length
  const stage = currentProgress?.stage || (loading ? 'running' : 'idle')
  const stageLabel = { planning: '规划中', running: '执行中', completed: '已完成', idle: '待启动' }[
    stage
  ] || stage

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Network />
            {title}
          </span>
          <Badge variant={loading ? 'default' : 'secondary'} className="gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {stageLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* 总体进度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Play className="h-3.5 w-3.5" />
              总体进度
            </span>
            <span className="font-semibold">{overall}%</span>
          </div>
          <Progress value={overall} className="h-2.5" />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              已完成 {completedCount}
            </span>
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 text-blue-500" />
              运行中 {runningCount}
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              失败 {failedCount}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              协作 Agent {agentRows.length}
            </span>
          </div>
        </div>

        {/* 任务分配卡片网格 */}
        {steps.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">任务分配与执行状态</p>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {steps.map((step, index) => (
                <AgentCard key={`${step.resource_type}-${index}`} step={step} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Agent 状态概览（无 steps 时展示） */}
        {steps.length === 0 && agentRows.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {agentRows.map((agent) => (
              <div key={agent.name} className="rounded-lg border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {AGENT_LABELS[agent.name] || agent.name}
                  </span>
                  <StatusIndicator status={agent.status} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {agent.current_task || agent.output_summary || agent.role || '空闲'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 时间线视图 */}
        {steps.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-medium text-muted-foreground">执行时间线</p>
            <div className="rounded-lg border bg-muted/20 p-4">
              {steps.map((step, index) => (
                <TimelineItem
                  key={`timeline-${step.resource_type}-${index}`}
                  step={step}
                  index={index}
                  isLast={index === steps.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {steps.length === 0 && agentRows.length === 0 && (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {loading ? '正在初始化 Agent 协作...' : '点击生成后展示任务分配与执行状态'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
