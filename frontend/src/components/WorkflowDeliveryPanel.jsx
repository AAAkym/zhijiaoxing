import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertCircle, CalendarClock, Loader2, Pause, Play, RefreshCw, Send } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { courseGeneration, personalizedLearning } from '@/services/api'

const STATUS_LABELS = {
  PUBLISHED: '已发布', IN_PROGRESS: '学习中', WAITING_ASSESSMENT: '等待检测',
  ASSESSING: '分析中', CYCLE_COMPLETED: '本轮完成', PAUSED: '已暂停',
  NEEDS_ATTENTION: '正在恢复',
}

export default function WorkflowDeliveryPanel({ workflow, onWorkflowChange }) {
  const [delivery, setDelivery] = useState(null)
  const [title, setTitle] = useState(workflow?.topic || '')
  const [instructions, setInstructions] = useState('请按推荐顺序完成学习资源和学习检测。')
  const [dueAt, setDueAt] = useState('')
  const [loading, setLoading] = useState('load')
  const [notice, setNotice] = useState(null)

  const loadDelivery = useCallback(async () => {
    if (!workflow?.workflow_id) return
    setLoading('load')
    try {
      const response = await courseGeneration.getWorkflowDeliveries(workflow.workflow_id)
      setDelivery(response.deliveries?.[0] || null)
    } catch (error) {
      setNotice({ type: 'error', text: `任务状态读取失败：${error.message}` })
    } finally {
      setLoading('')
    }
  }, [workflow?.workflow_id])

  useEffect(() => { loadDelivery() }, [loadDelivery])

  const publish = async () => {
    setLoading('publish')
    setNotice(null)
    try {
      const response = await courseGeneration.publishWorkflow(workflow.workflow_id, {
        title: title.trim() || workflow.topic,
        instructions: instructions.trim(),
        due_at: dueAt || null,
      })
      setDelivery(response.delivery)
      onWorkflowChange?.({ ...workflow, state: 'PUBLISHED' })
      setNotice({ type: 'info', text: response.already_published ? '该任务已经发布，本次没有重复创建。' : '任务已发布给当前学生。' })
    } catch (error) {
      setNotice({ type: 'error', text: `发布失败：${error.message}` })
    } finally {
      setLoading('')
    }
  }

  const togglePause = async () => {
    if (!delivery) return
    const resume = delivery.status === 'PAUSED'
    setLoading(resume ? 'resume' : 'pause')
    try {
      const response = resume
        ? await personalizedLearning.resumeTeacherDelivery(delivery.delivery_id)
        : await personalizedLearning.pauseTeacherDelivery(delivery.delivery_id)
      setDelivery(response.delivery)
      setNotice({ type: 'info', text: response.message })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading('')
    }
  }

  const analyze = async () => {
    setLoading('analyze')
    try {
      const response = await personalizedLearning.analyzeTeacherDelivery(delivery.delivery_id)
      setDelivery((current) => ({ ...current, status: 'CYCLE_COMPLETED', cycles: [response.cycle] }))
      setNotice({ type: 'info', text: '学习效果已分析，并自动创建下一轮工作流草稿。' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading('')
    }
  }

  const cycle = delivery?.cycles?.[0]
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Send /> 发布与学习闭环</CardTitle>
            <CardDescription>把审核后的资源快照发布给当前学生，并跟踪下一轮策略。</CardDescription>
          </div>
          {delivery ? <Badge variant="outline">{STATUS_LABELS[delivery.status] || delivery.status}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice ? (
          <Alert variant={notice.type === 'error' ? 'destructive' : 'default'}>
            <AlertCircle /><AlertTitle>{notice.type === 'error' ? '暂时无法继续' : '状态更新'}</AlertTitle>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : null}
        {loading === 'load' ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> 正在读取发布状态</div> : null}
        {!delivery && loading !== 'load' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="delivery-title">任务名称</Label>
              <Input id="delivery-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="delivery-instructions">学生任务说明</Label>
              <Textarea id="delivery-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="delivery-due">截止时间（可选）</Label>
              <Input id="delivery-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
          </div>
        ) : null}
        {delivery ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="border p-3"><p className="text-xs text-muted-foreground">学生任务</p><p className="mt-1 text-sm font-medium">{delivery.title}</p></div>
              <div className="border p-3"><p className="text-xs text-muted-foreground">发布时间</p><p className="mt-1 text-sm">{delivery.published_at ? new Date(delivery.published_at).toLocaleString() : '未记录'}</p></div>
              <div className="border p-3"><p className="text-xs text-muted-foreground">任务编号</p><p className="mt-1 truncate text-sm">{delivery.delivery_id}</p></div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm"><span>学习进度</span><span>{delivery.progress_percentage || 0}%</span></div>
              <Progress value={delivery.progress_percentage || 0} />
            </div>
            {cycle ? (
              <div className="flex flex-col gap-3 border-l-2 pl-4">
                <div className="mb-2 flex flex-wrap items-center gap-2"><Activity className="h-4 w-4" /><span className="text-sm font-medium">本轮 Agent 结论</span><Badge>{cycle.confidence_score}%可信度</Badge></div>
                <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
                  <div><p className="font-medium">1. 发布前问题</p><p className="mt-1 text-muted-foreground">{(delivery.baseline?.selected_evidence || []).map((item) => item.label || item).join('；') || '以发布时画像快照为准'}</p></div>
                  <div><p className="font-medium">2. 本轮策略</p><p className="mt-1 text-muted-foreground">{delivery.strategy?.summary || delivery.strategy?.action || '按推荐顺序学习'}</p></div>
                  <div><p className="font-medium">3. 真实表现</p><p className="mt-1 text-muted-foreground">{(cycle.feedback?.evidence || []).join('；') || cycle.feedback?.summary}</p></div>
                  <div><p className="font-medium">4. 画像审核</p><p className="mt-1 text-muted-foreground">{cycle.review?.summary || 'EvidenceReviewAgent 已复核'}</p></div>
                  <div><p className="font-medium">5. 下一轮动作</p><p className="mt-1 text-muted-foreground">{cycle.next_strategy?.action}</p></div>
                </div>
                <p className="text-xs text-muted-foreground">评测来源 {cycle.evidence?.assessment_source_count ?? 0} 类 · 有效样本 {cycle.evidence?.assessment_sample_count ?? 0} 条 · 下一轮草稿 {cycle.next_workflow_id}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        {delivery ? <Button variant="outline" size="icon" title="刷新任务状态" onClick={loadDelivery}><RefreshCw /></Button> : null}
        {delivery && !['CYCLE_COMPLETED', 'ASSESSING'].includes(delivery.status) ? (
          <Button variant="outline" onClick={togglePause} disabled={loading === 'pause' || loading === 'resume'}>
            {delivery.status === 'PAUSED' ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
            {delivery.status === 'PAUSED' ? '恢复任务' : '暂停任务'}
          </Button>
        ) : null}
        {delivery?.status === 'WAITING_ASSESSMENT' ? <Button onClick={analyze} disabled={loading === 'analyze'}><Activity data-icon="inline-start" />分析本轮效果</Button> : null}
        {!delivery && loading !== 'load' ? <Button onClick={publish} disabled={loading === 'publish'}><CalendarClock data-icon="inline-start" />{loading === 'publish' ? '正在发布' : '发布给当前学生'}</Button> : null}
      </CardFooter>
    </Card>
  )
}
