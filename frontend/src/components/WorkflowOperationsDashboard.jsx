import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { workflowMetrics } from '@/services/api'

function Metric({ label, value, suffix = '' }) {
  return <div className="border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}{suffix}</p></div>
}

export default function WorkflowOperationsDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setData(await workflowMetrics.getDashboard(30)) }
    catch (loadError) { setError(loadError.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  const workflow = data?.workflow || {}
  const runtime = data?.runtime || {}

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">工作流运行监控</h2><p className="text-sm text-muted-foreground">只展示状态、数量和耗时，不展示学生答案或画像原文。</p></div><Button variant="outline" size="icon" title="刷新监控" onClick={load}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
      {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>监控数据不可用</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {loading ? <div className="flex min-h-52 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" />正在聚合真实运行数据</div> : null}
      {!loading && data ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="生成总量" value={workflow.generation_total || 0} /><Metric label="发布成功率" value={workflow.publish_success_rate || 0} suffix="%" /><Metric label="周期完成率" value={workflow.cycle_completion_rate || 0} suffix="%" /><Metric label="P95生成耗时" value={Math.round(workflow.p95_duration_ms || 0)} suffix="ms" /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="自动修复" value={workflow.auto_repair_count || 0} /><Metric label="降级生成" value={workflow.degraded_count || 0} /><Metric label="恢复次数" value={workflow.recovery_count || 0} /><Metric label="权限拒绝" value={runtime.permission_denied_count || 0} /></div>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity /> 运行环境</CardTitle><CardDescription>外部调度不可用不会阻断任务查看和手动提醒。</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Badge variant={data.scheduler?.enabled ? 'default' : 'outline'}>{data.scheduler?.message}</Badge><Badge variant="outline"><Clock /> P95接口 {Math.round(runtime.p95_response_ms || 0)}ms</Badge><Badge variant={runtime.error_count ? 'destructive' : 'outline'}>{runtime.error_count ? <AlertCircle /> : <CheckCircle2 />} 服务错误 {runtime.error_count || 0}</Badge></CardContent></Card>
      </> : null}
    </div>
  )
}
