import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Filter, Loader2, Pause, Play, RefreshCw, Search, Send, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { personalizedLearning } from '@/services/api'

const STATUS_LABELS = {
  PUBLISHED: '已发布', IN_PROGRESS: '学习中', WAITING_ASSESSMENT: '等待检测',
  ASSESSING: '分析中', CYCLE_COMPLETED: '本轮完成', PAUSED: '已暂停',
  NEEDS_ATTENTION: '正在恢复',
}

const DUE_LABELS = {
  none: '无截止时间', active: '进行中', due_soon: '24小时内截止',
  overdue: '已逾期', completed: '已完成',
}

function cleanParams({ query, status, dueStatus, page }) {
  return {
    page,
    page_size: 10,
    ...(query ? { q: query } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(dueStatus !== 'all' ? { due_status: dueStatus } : {}),
  }
}

function dueText(item) {
  if (!item.due_at) return DUE_LABELS[item.due_status] || '无截止时间'
  return `${DUE_LABELS[item.due_status] || '截止时间'} · ${new Date(item.due_at).toLocaleString('zh-CN')}`
}

export default function PersonalizedTaskOperations() {
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [dueStatus, setDueStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [tasks, setTasks] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 })
  const [selected, setSelected] = useState(() => new Set())
  const [loading, setLoading] = useState('list')
  const [notice, setNotice] = useState(null)
  const [scheduler, setScheduler] = useState(null)

  const loadTasks = useCallback(async () => {
    setLoading('list')
    try {
      const [response, reminderStatus] = await Promise.all([
        personalizedLearning.listTeacherDeliveries(cleanParams({ query, status, dueStatus, page })),
        personalizedLearning.getReminderStatus().catch(() => null),
      ])
      setTasks(response.deliveries || [])
      setScheduler(reminderStatus)
      setPagination(response.pagination || { page, pages: 0, total: response.count || 0 })
      setSelected(new Set())
    } catch (error) {
      setNotice({ type: 'error', text: `任务列表读取失败：${error.message}` })
    } finally {
      setLoading('')
    }
  }, [dueStatus, page, query, status])

  useEffect(() => { loadTasks() }, [loadTasks])

  const allSelected = tasks.length > 0 && tasks.every((item) => selected.has(item.delivery_id))
  const selectionState = allSelected ? true : selected.size > 0 ? 'indeterminate' : false
  const selectedIds = useMemo(() => Array.from(selected), [selected])

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

  const toggleAll = (checked) => {
    setSelected(checked ? new Set(tasks.map((item) => item.delivery_id)) : new Set())
  }

  const toggleOne = (deliveryId, checked) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(deliveryId)
      else next.delete(deliveryId)
      return next
    })
  }

  const bulkChange = async (action) => {
    if (!selectedIds.length) return
    setLoading(action)
    setNotice(null)
    try {
      const response = await personalizedLearning.bulkChangeDeliveryState({
        action, delivery_ids: selectedIds,
      })
      setNotice({
        type: 'info',
        text: `已处理 ${response.requested_count} 个任务：变更 ${response.changed_count} 个，跳过 ${response.skipped_count} 个。`,
      })
      await loadTasks()
    } catch (error) {
      setNotice({ type: 'error', text: `批量操作未完成：${error.message}` })
    } finally {
      setLoading('')
    }
  }

  const bulkRemind = async () => {
    if (!selectedIds.length) return
    setLoading('remind')
    setNotice(null)
    try {
      const response = await personalizedLearning.bulkRemindDeliveries(selectedIds)
      setNotice({ type: 'info', text: `已创建 ${response.created_count} 条提醒，跳过 ${response.skipped_count} 条。` })
      setSelected(new Set())
    } catch (error) {
      setNotice({ type: 'error', text: `提醒未完成：${error.message}` })
    } finally {
      setLoading('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Filter /> 任务运营</CardTitle>
            <CardDescription>搜索和筛选已发布任务，批量暂停或恢复学生学习。</CardDescription>
          </div>
          <Badge variant="outline">共 {pagination.total || 0} 个任务</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice ? (
          <Alert variant={notice.type === 'error' ? 'destructive' : 'default'}>
            <AlertTitle>{notice.type === 'error' ? '暂时无法处理' : '批量处理结果'}</AlertTitle>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : null}
        {scheduler && !scheduler.enabled ? <Alert><AlertCircle /><AlertTitle>定时提醒未启用</AlertTitle><AlertDescription>{scheduler.message}，教师仍可使用手动批量提醒。</AlertDescription></Alert> : null}
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]" onSubmit={submitSearch}>
          <div className="flex gap-2">
            <Button variant="outline" onClick={bulkRemind} disabled={!selected.size || loading === 'remind'}>
              {loading === 'remind' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Send data-icon="inline-start" />}批量提醒
            </Button>
            <Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="任务、学生或任务编号" aria-label="搜索任务" />
            <Button type="submit" size="icon" title="搜索任务"><Search /></Button>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={selectionState} onCheckedChange={toggleAll} aria-label="选择本页全部任务" />
            已选 {selected.size} 个
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => bulkChange('pause')} disabled={!selected.size || loading === 'pause'}>
              {loading === 'pause' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Pause data-icon="inline-start" />}批量暂停
            </Button>
            <Button variant="outline" onClick={() => bulkChange('resume')} disabled={!selected.size || loading === 'resume'}>
              {loading === 'resume' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}批量恢复
            </Button>
            <Button variant="outline" size="icon" title="刷新任务" onClick={loadTasks} disabled={loading === 'list'}><RefreshCw className={loading === 'list' ? 'animate-spin' : ''} /></Button>
          </div>
        </div>

        {loading === 'list' ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" />正在读取任务</div> : null}
        {loading !== 'list' && !tasks.length ? <div className="py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有任务</div> : null}
        {loading !== 'list' ? tasks.map((item) => (
          <div key={item.delivery_id} className="grid gap-3 border p-3 md:grid-cols-[auto_minmax(0,1fr)_160px] md:items-center">
            <Checkbox checked={selected.has(item.delivery_id)} onCheckedChange={(checked) => toggleOne(item.delivery_id, checked)} aria-label={`选择任务 ${item.title}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium">{item.title}</p><Badge variant="outline">{STATUS_LABELS[item.status] || item.status}</Badge><Badge variant={item.due_status === 'overdue' ? 'destructive' : 'secondary'}>{DUE_LABELS[item.due_status] || item.due_status}</Badge></div>
              <p className="mt-1 text-xs text-muted-foreground">{item.student_name} · {item.class_name} · {item.course_title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{dueText(item)}</p>
            </div>
            <div className="flex flex-col gap-1"><div className="flex justify-between text-xs"><span>进度</span><span>{item.progress_percentage || 0}%</span></div><Progress value={item.progress_percentage || 0} /></div>
          </div>
        )) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3">
        <p className="text-xs text-muted-foreground">第 {pagination.page || 1} / {Math.max(pagination.pages || 0, 1)} 页</p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" title="上一页" disabled={!pagination.has_previous || loading === 'list'} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" title="下一页" disabled={!pagination.has_next || loading === 'list'} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button>
        </div>
      </CardFooter>
    </Card>
  )
}
