import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, BarChart3, CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { resourceGeneration } from '@/services/api'

/** 资源智能体名单，与后端 agent_execution_history_service.RESOURCE_AGENT_NAMES 同口径。 */
const RESOURCE_AGENT_NAMES = new Set([
  'exercise_agent',
  'document_agent',
  'media_agent',
  'recommendation_agent',
  'project_agent',
  'ppt_agent',
])

const WINDOW_OPTIONS = [
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
  { value: 90, label: '近 90 天' },
]

function formatDuration(value) {
  if (value == null) return '暂无耗时'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function formatTime(value) {
  if (!value) return '暂无记录'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('zh-CN')
}

function Metric({ label, value, suffix = '', tone = '' }) {
  return (
    <div className="border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}{suffix}</p>
    </div>
  )
}

/**
 * 智能体执行历史看板。
 *
 * 存在的理由：`/agents/status` 返回 AgentMonitor 的**内存态**，服务重启即归零；
 * 本组件消费的是 `agent_execution_logs` 的**持久化记录**，因此重启后依然能看到
 * "上一次生成究竟是哪些智能体参与的、耗时多少、失败在哪里"。
 */
export default function AgentExecutionHistoryPanel({ days: initialDays = 30 }) {
  const [days, setDays] = useState(initialDays)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await resourceGeneration.getAgentExecutionHistory(days))
    } catch (loadError) {
      // 历史不可用只降级本卡片，绝不影响实时状态面板。
      setError(loadError.message || '执行历史加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const totals = data?.totals || {}
  const agents = useMemo(() => data?.agents || [], [data])
  const stages = useMemo(() => data?.pipeline?.stages || [], [data])
  const pipeline = data?.pipeline || {}
  const recent = data?.recent || []

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity /> 智能体执行历史
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={days === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDays(option.value)}
              >
                {option.label}
              </Button>
            ))}
            <Button variant="outline" size="icon" title="刷新执行历史" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
        <CardDescription>
          来自持久化执行记录，服务重启后依然可见。与实时状态面板的区别是：这里回答的是
          「过去这段时间，哪些智能体真的干过活」。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>执行历史暂时不可用</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" />正在读取持久化执行记录
          </div>
        ) : null}

        {!loading && !error && data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="执行记录" value={totals.records || 0} />
              <Metric label="成功" value={totals.success || 0} />
              <Metric
                label="失败"
                value={totals.failed || 0}
                tone={totals.failed ? 'text-destructive' : ''}
              />
              <Metric label="平均耗时" value={formatDuration(totals.avg_duration_ms)} />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">六阶段流水线证据覆盖</p>
                <span className="text-xs text-muted-foreground">
                  有证据 {pipeline.stages_with_evidence?.length || 0} / 必需要有证据的
                  {' '}{(pipeline.stages_with_evidence?.length || 0) + (pipeline.stages_without_evidence?.length || 0)} 个阶段
                </span>
              </div>
              <Progress value={(pipeline.coverage_rate || 0) * 100} className="my-2 h-2" />
              {pipeline.stages_without_evidence?.length ? (
                <p className="flex items-start gap-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    以下阶段在所选窗口内**没有**对应的执行记录，不能视为已正常运行：
                    {pipeline.stages_without_evidence
                      .map((stage) => stages.find((item) => item.stage === stage)?.stage_label || stage)
                      .join('、')}
                  </span>
                </p>
              ) : null}
              <ul className="mt-2 space-y-1">
                {stages.map((stage) => (
                  <li key={stage.stage} className="flex flex-wrap items-center gap-2 border-l-2 border-border bg-muted/25 px-3 py-2">
                    {stage.has_evidence ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="text-sm font-medium">{stage.stage_label}</span>
                    <span className="text-xs text-muted-foreground">{stage.owner_label}</span>
                    {stage.evidence_required ? null : (
                      <Badge variant="outline">不单独产生执行记录</Badge>
                    )}
                    {stage.has_evidence ? (
                      <span className="text-xs text-muted-foreground">
                        记录方：{stage.matched_agents.join('、')}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium">各智能体执行情况</p>
              {agents.length ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">智能体</th>
                        <th className="py-2 pr-3 font-medium">角色</th>
                        <th className="py-2 pr-3 font-medium">执行</th>
                        <th className="py-2 pr-3 font-medium">成功</th>
                        <th className="py-2 pr-3 font-medium">失败</th>
                        <th className="py-2 pr-3 font-medium">平均耗时</th>
                        <th className="py-2 font-medium">最近一次</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent) => (
                        <tr key={agent.agent_name} className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            <span className="font-medium">{agent.agent_label}</span>
                            <span className="ml-1 text-xs text-muted-foreground">{agent.agent_name}</span>
                          </td>
                          <td className="py-2 pr-3">
                            {RESOURCE_AGENT_NAMES.has(agent.agent_name) ? (
                              <Badge variant="secondary">资源生成</Badge>
                            ) : (
                              <Badge variant="outline">协调</Badge>
                            )}
                          </td>
                          <td className="py-2 pr-3">{agent.total}</td>
                          <td className="py-2 pr-3">{agent.success}</td>
                          <td className="py-2 pr-3">
                            {agent.failed ? (
                              <Badge variant="destructive">{agent.failed}</Badge>
                            ) : (
                              0
                            )}
                          </td>
                          <td className="py-2 pr-3">{formatDuration(agent.avg_duration_ms)}</td>
                          <td className="py-2 text-xs text-muted-foreground">{formatTime(agent.last_executed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  所选窗口内没有任何智能体执行记录。这不代表系统故障，但**也不代表流水线正常**——
                  没有记录时无法判断协作是否发生。
                </p>
              )}
            </div>

            {recent.length ? (
              <details className="border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  最近 {recent.length} 条执行明细
                </summary>
                <ul className="space-y-1 border-t px-3 py-3">
                  {recent.map((record) => (
                    <li key={record.id} className="flex flex-wrap items-center gap-2 text-xs">
                      {record.status === 'success' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                      )}
                      <span className="font-medium">{record.agent_name}</span>
                      <span className="text-muted-foreground">{record.task_type || '未标注任务类型'}</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatDuration(record.duration_ms)}
                      </span>
                      <span className="text-muted-foreground">{formatTime(record.created_at)}</span>
                      {record.error_message ? (
                        <span className="text-destructive">{record.error_message}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              统计窗口：近 {data.window_days} 天 · 生成时间 {formatTime(data.generated_at)}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
