import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, ArrowLeft, BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Play, RefreshCw, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { personalizedLearning } from '@/services/api'
import PersonalizedNotificationCenter from './PersonalizedNotificationCenter'
import ResourceBasisPanel from './ResourceBasisPanel'

const STATUS_LABELS = {
  PUBLISHED: '待开始', IN_PROGRESS: '学习中', WAITING_ASSESSMENT: '等待检测',
  ASSESSING: '分析中', CYCLE_COMPLETED: '本轮完成', PAUSED: '教师已暂停',
  NEEDS_ATTENTION: '系统正在恢复',
}

const RESOURCE_LABELS = {
  document: '讲解文档', mindmap: '思维导图', layered_exercise: '分层练习',
  recommendation: '学习推荐', media: '视频脚本', project: '实践项目', ppt: 'PPT课件',
}

const DUE_LABELS = {
  none: '无截止时间', active: '进行中', due_soon: '24小时内截止',
  overdue: '已逾期', completed: '已完成',
}

function listParams({ query, status, dueStatus, page }) {
  return {
    page,
    page_size: 10,
    ...(query ? { q: query } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(dueStatus !== 'all' ? { due_status: dueStatus } : {}),
  }
}

function dueText(item) {
  if (!item.due_at) return '无截止时间'
  return `${DUE_LABELS[item.due_status] || '截止时间'} · ${new Date(item.due_at).toLocaleString('zh-CN')}`
}

function resourceSummary(resource) {
  const content = resource?.content
  if (typeof content === 'string') return content
  if (!content) return '资源内容已准备完成。'
  const summary = content.content || content.description || content.summary || content.title
  if (typeof summary === 'string') return summary
  return JSON.stringify(summary || content, null, 2)
}

function newRequestId(resourceKey) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `complete-${resourceKey}-${random}`
}

export default function PersonalizedLearningTasks({ onOpenAssessment, onOpenKnowledgeGraph }) {
  const [deliveries, setDeliveries] = useState([])
  const [delivery, setDelivery] = useState(null)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [dueStatus, setDueStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 })
  const [loading, setLoading] = useState('list')
  const [notice, setNotice] = useState(null)
  const [basisByResource, setBasisByResource] = useState({})
  const [basisLoading, setBasisLoading] = useState('')
  const [basisErrors, setBasisErrors] = useState({})

  const loadList = useCallback(async () => {
    setLoading('list')
    setNotice(null)
    try {
      const response = await personalizedLearning.getStudentDeliveries(
        listParams({ query, status, dueStatus, page })
      )
      setDeliveries(response.deliveries || [])
      setPagination(response.pagination || { page, pages: 0, total: response.count || 0 })
    } catch (error) {
      setNotice({ type: 'error', text: `学习任务加载失败：${error.message}` })
    } finally {
      setLoading('')
    }
  }, [dueStatus, page, query, status])

  useEffect(() => { loadList() }, [loadList])

  const submitSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setQuery(queryInput.trim())
  }

  const resetFilters = () => {
    setQueryInput('')
    setQuery('')
    setStatus('all')
    setDueStatus('all')
    setPage(1)
  }

  const openDelivery = async (deliveryId) => {
    setLoading('detail')
    setNotice(null)
    try {
      const response = await personalizedLearning.getStudentDelivery(deliveryId)
      setDelivery(response.delivery)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading('')
    }
  }

  const start = async () => {
    setLoading('start')
    try {
      const response = await personalizedLearning.startStudentDelivery(delivery.delivery_id)
      setDelivery(response.delivery)
      setNotice({ type: 'info', text: response.already_started ? '任务已经开始，可以继续学习。' : '本轮个性化学习已开始。' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading('')
    }
  }

  const completedKeys = useMemo(() => new Set(
    (delivery?.events || []).filter((event) => event.event_type === 'resource_completed').map((event) => event.resource_key)
  ), [delivery?.events])

  const completeResource = async (resourceKey) => {
    setLoading(`resource:${resourceKey}`)
    try {
      const response = await personalizedLearning.completeStudentResource(delivery.delivery_id, {
        resource_key: resourceKey,
        idempotency_key: newRequestId(resourceKey),
      })
      setDelivery(response.delivery)
      setNotice({ type: 'info', text: '这项资源已记录完成。' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading('')
    }
  }

  const loadBasis = useCallback(async (resourceKey) => {
    if (!delivery?.delivery_id) return
    setBasisLoading(resourceKey)
    setBasisErrors((current) => ({ ...current, [resourceKey]: false }))
    try {
      const response = await personalizedLearning.getStudentResourceBasis(delivery.delivery_id, resourceKey)
      setBasisByResource((current) => ({ ...current, [resourceKey]: response.basis }))
    } catch (error) {
      // 依据链失败只降级为一行提示，绝不影响资源正文的学习流程。
      setBasisErrors((current) => ({ ...current, [resourceKey]: true }))
    } finally {
      setBasisLoading('')
    }
  }, [delivery?.delivery_id])

  const analyze = async () => {
    setLoading('analyze')
    setNotice(null)
    try {
      const response = await personalizedLearning.submitStudentAssessment(delivery.delivery_id)
      setDelivery((current) => ({ ...current, status: 'CYCLE_COMPLETED', progress_percentage: 100, cycles: [response.cycle] }))
      setNotice({ type: 'info', text: 'FeedbackAgent 已完成本轮分析，下一轮学习草稿已经生成。' })
    } catch (error) {
      setNotice({ type: 'error', text: `暂时无法分析：${error.message}` })
    } finally {
      setLoading('')
    }
  }

  if (!delivery) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-2xl font-bold">个性化任务</h2><p className="text-sm text-muted-foreground">完成教师为你生成的资源，并查看下一轮学习建议。</p></div>
          <Button variant="outline" size="icon" title="刷新任务" onClick={loadList} disabled={loading === 'list'}><RefreshCw className={loading === 'list' ? 'animate-spin' : ''} /></Button>
        </div>
        <PersonalizedNotificationCenter onOpenTask={openDelivery} />
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]" onSubmit={submitSearch}>
          <div className="flex gap-2">
            <Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="搜索任务名称或说明" aria-label="搜索学习任务" />
            <Button type="submit" size="icon" title="搜索学习任务"><Search /></Button>
          </div>
          <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}>
            <SelectTrigger aria-label="任务状态"><SelectValue placeholder="任务状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dueStatus} onValueChange={(value) => { setDueStatus(value); setPage(1) }}>
            <SelectTrigger aria-label="截止状态"><SelectValue placeholder="截止状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部截止状态</SelectItem>
              {Object.entries(DUE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" title="清空筛选" onClick={resetFilters}><X /></Button>
        </form>
        {notice ? <Alert variant={notice.type === 'error' ? 'destructive' : 'default'}><AlertCircle /><AlertTitle>{notice.type === 'error' ? '加载失败' : '状态更新'}</AlertTitle><AlertDescription>{notice.text}</AlertDescription></Alert> : null}
        {loading === 'list' ? <div className="flex min-h-52 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> 正在读取任务</div> : null}
        {loading !== 'list' && !deliveries.length ? <div className="border py-16 text-center text-sm text-muted-foreground"><BookOpenCheck className="mx-auto mb-3 h-9 w-9" />目前没有待学习的个性化任务</div> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {deliveries.map((item) => (
            <Card key={item.delivery_id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{item.title}</CardTitle><Badge variant="outline">{STATUS_LABELS[item.status] || item.status}</Badge></div>
                <CardDescription>{item.instructions || '按推荐顺序完成本轮学习。'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-2"><Badge variant={item.due_status === 'overdue' ? 'destructive' : 'secondary'}>{DUE_LABELS[item.due_status] || item.due_status}</Badge><span className="text-xs text-muted-foreground">{dueText(item)}</span></div>
                <div className="mb-2 flex justify-between text-sm"><span>本轮进度</span><span>{item.progress_percentage || 0}%</span></div><Progress value={item.progress_percentage || 0} />
              </CardContent>
              <CardFooter className="justify-end"><Button onClick={() => openDelivery(item.delivery_id)}>查看任务</Button></CardFooter>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">共 {pagination.total || 0} 个任务 · 第 {pagination.page || 1} / {Math.max(pagination.pages || 0, 1)} 页</p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" title="上一页" disabled={!pagination.has_previous || loading === 'list'} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></Button>
            <Button variant="outline" size="icon" title="下一页" disabled={!pagination.has_next || loading === 'list'} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button>
          </div>
        </div>
      </div>
    )
  }

  const cycle = delivery.cycles?.[0]
  const resources = Object.entries(delivery.resources || {})
  const assessmentId = delivery.completion_rules?.assessment_id
  const assessmentTitle = delivery.completion_rules?.assessment_title
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Button variant="outline" size="icon" title="返回任务列表" onClick={() => { setDelivery(null); loadList() }}><ArrowLeft /></Button><div><h2 className="text-2xl font-bold">{delivery.title}</h2><p className="text-sm text-muted-foreground">{delivery.instructions}</p></div></div>
        <Badge>{STATUS_LABELS[delivery.status] || delivery.status}</Badge>
      </div>
      {notice ? <Alert variant={notice.type === 'error' ? 'destructive' : 'default'}><AlertCircle /><AlertTitle>{notice.type === 'error' ? '暂时无法继续' : '状态更新'}</AlertTitle><AlertDescription>{notice.text}</AlertDescription></Alert> : null}
      <div className="flex flex-col gap-2"><div className="flex justify-between text-sm"><span>任务进度</span><span>{delivery.progress_percentage || 0}%</span></div><Progress value={delivery.progress_percentage || 0} /></div>
      {delivery.status === 'PUBLISHED' ? <div className="border p-5"><p className="mb-3 text-sm text-muted-foreground">开始后，系统会按资源记录本轮学习过程。</p><Button onClick={start} disabled={loading === 'start'}><Play data-icon="inline-start" />开始本轮学习</Button></div> : null}
      <div className="flex flex-col gap-3">
        {resources.map(([key, resource], index) => {
          const completed = completedKeys.has(key)
          return (
            <section key={key} className="border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs text-muted-foreground">第 {index + 1} 项 · {RESOURCE_LABELS[resource.resource_type] || resource.resource_type}</p><h3 className="mt-1 text-base font-semibold">{resource.content?.title || RESOURCE_LABELS[key] || key}</h3></div>
                <Badge variant={completed ? 'default' : 'outline'}>{completed ? '已完成' : '待学习'}</Badge>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{resourceSummary(resource)}</p>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadBasis(key)}
                  disabled={basisLoading === key}
                  aria-expanded={Boolean(basisByResource[key])}
                  aria-controls={`resource-basis-${key}`}
                >
                  <ShieldCheck data-icon="inline-start" />
                  {basisByResource[key] ? '刷新生成依据' : '我为什么是给你的'}
                </Button>
              </div>
              <div id={`resource-basis-${key}`}>
                {basisLoading === key || basisByResource[key] || basisErrors[key] ? (
                  <ResourceBasisPanel
                    basis={basisByResource[key] || null}
                    resourceType={resource.resource_type || key}
                    loading={basisLoading === key}
                    error={basisErrors[key] ? new Error('basis_unavailable') : null}
                    onOpenKnowledgeGraph={onOpenKnowledgeGraph}
                  />
                ) : null}
              </div>
              {delivery.status === 'IN_PROGRESS' && !completed ? <div className="mt-4 flex justify-end"><Button onClick={() => completeResource(key)} disabled={loading === `resource:${key}`}><CheckCircle2 data-icon="inline-start" />完成这项资源</Button></div> : null}
            </section>
          )
        })}
      </div>
      {delivery.status === 'WAITING_ASSESSMENT' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Activity /> 学习效果分析</CardTitle>
            <CardDescription>
              {assessmentId
                ? `请先完成“${assessmentTitle || '本轮检测'}”（编号 #${assessmentId}）。系统只用这份检测产生的真实记录分析本轮效果。`
                : '系统只读取本轮之后产生的真实练习、错题和编程记录；没有足够证据时会明确显示“证据不足”。'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap justify-end gap-2">
            {onOpenAssessment ? <Button variant="outline" onClick={() => onOpenAssessment(assessmentId)}><BookOpenCheck data-icon="inline-start" />{assessmentId ? '打开本轮检测' : '前往练习或编程检测'}</Button> : null}
            <Button onClick={analyze} disabled={loading === 'analyze'}>{loading === 'analyze' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}分析本轮学习效果</Button>
          </CardFooter>
        </Card>
      ) : null}
      {cycle ? (
        <Card>
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">本轮反馈与下一步</CardTitle><CardDescription>由 FeedbackAgent 分析，EvidenceReviewAgent 自动复核。</CardDescription></div><Badge variant="outline">证据可信度 {cycle.confidence_score}%</Badge></div></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">评测来源 {cycle.evidence?.assessment_source_count ?? 0} 类 · 有效样本 {cycle.evidence?.assessment_sample_count ?? 0} 条</p>
            <div><p className="text-sm font-medium">本轮结论</p><p className="mt-1 text-sm text-muted-foreground">{cycle.feedback?.summary}</p></div>
            <div><p className="text-sm font-medium">判断依据</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{(cycle.feedback?.evidence || []).map((item) => <li key={item}>• {item}</li>)}</ul></div>
            <div className="border-l-2 pl-4"><p className="text-sm font-medium">下一轮策略</p><p className="mt-1 text-sm text-muted-foreground">{cycle.next_strategy?.action}</p><div className="mt-2 flex flex-wrap gap-2">{(cycle.next_strategy?.learning_sequence || []).map((item, index) => <Badge key={`${item}-${index}`} variant="outline">{index + 1}. {item}</Badge>)}</div></div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
