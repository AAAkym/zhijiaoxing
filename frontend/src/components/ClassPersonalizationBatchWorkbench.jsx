import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Eye, Loader2, RefreshCw, Send, Users } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { classManagement, courseGeneration, courses } from '@/services/api'
import { getEligibleClasses } from '@/utils/personalizedGeneration'
import WorkflowResourcePreview from './WorkflowResourcePreview'

const RESOURCE_OPTIONS = [
  ['document', '讲义'], ['layered_exercise', '分层练习'], ['project', '实践项目'],
  ['mindmap', '思维导图'], ['media', '视频脚本'], ['ppt', 'PPT'], ['recommendation', '学习推荐'],
]
const RESOURCE_LABELS = Object.fromEntries(RESOURCE_OPTIONS)

const STATE_LABELS = {
  WAITING_PROFILE: '等待画像补齐', READY_TO_GENERATE: '可以生成', GENERATING: '正在逐人生成',
  READY_TO_PUBLISH: '全班可以发布', PUBLISHED: '已发布', PROFILE_REQUIRED: '需快速诊断',
  READY: '画像已就绪', READY_TO_PUBLISH_ITEM: '审核完成',
}

export default function ClassPersonalizationBatchWorkbench() {
  const [courseList, setCourseList] = useState([])
  const [classes, setClasses] = useState([])
  const [courseId, setCourseId] = useState('')
  const [classId, setClassId] = useState('')
  const [topic, setTopic] = useState('')
  const [points, setPoints] = useState('')
  const [requiredTypes, setRequiredTypes] = useState(['document', 'layered_exercise', 'project'])
  const [preflight, setPreflight] = useState(null)
  const [batch, setBatch] = useState(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)
  const [instructions, setInstructions] = useState('请按照推荐顺序完成学习资源和检测。')
  const [loading, setLoading] = useState('initial')
  const [notice, setNotice] = useState(null)

  const eligibleClasses = useMemo(() => getEligibleClasses(classes, courseId), [classes, courseId])
  const progress = batch?.student_count ? Math.round(((batch.generated_count || batch.ready_count || 0) / batch.student_count) * 100) : 0

  useEffect(() => {
    let cancelled = false
    Promise.all([courses.getAll(), classManagement.getClasses(), courseGeneration.getClassBatches().catch(() => ({ batches: [] }))])
      .then(async ([courseResponse, classResponse, batchResponse]) => {
        const details = await Promise.all((classResponse.classes || []).map((item) => classManagement.getClass(item.id)))
        const latestBatch = batchResponse.batches?.[0]
        const latestBatchDetail = latestBatch
          ? await courseGeneration.getClassBatch(latestBatch.batch_id).catch(() => ({ batch: latestBatch }))
          : null
        if (!cancelled) {
          setCourseList(courseResponse.courses || [])
          setClasses(details)
          if (latestBatchDetail?.batch) setBatch(latestBatchDetail.batch)
        }
      })
      .catch((error) => { if (!cancelled) setNotice({ type: 'error', text: `基础数据加载失败：${error.message}` }) })
      .finally(() => { if (!cancelled) setLoading('') })
    return () => { cancelled = true }
  }, [])

  const payload = () => ({
    course_id: Number(courseId), class_id: Number(classId), topic: topic.trim(),
    knowledge_points: points.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean),
    required_resource_types: requiredTypes,
  })

  const run = async (action, callback) => {
    setLoading(action)
    setNotice(null)
    try { await callback() } catch (error) { setNotice({ type: 'error', text: error.message }) } finally { setLoading('') }
  }

  const checkProfiles = () => run('preflight', async () => {
    const response = await courseGeneration.preflightClassBatch(payload())
    setPreflight(response.preflight)
    setNotice({ type: response.preflight.all_ready ? 'success' : 'info', text: response.preflight.all_ready ? '全班画像已满足生成条件。' : `还有 ${response.preflight.diagnostic_required_count} 名学生需要快速诊断或画像同步。` })
  })

  const createBatch = () => run('create', async () => {
    const response = await courseGeneration.createClassBatch(payload())
    setBatch(response.batch)
    setPreflight(response.preflight)
    setNotice({ type: 'info', text: response.batch.state === 'WAITING_PROFILE' ? '班级任务已创建，画像补齐后即可生成。' : '班级任务已创建，可以开始为全班独立生成。' })
  })

  const refreshProfiles = () => run('refresh', async () => {
    const response = await courseGeneration.refreshClassBatchProfiles(batch.batch_id)
    setBatch(response.batch); setPreflight(response.preflight)
  })

  const generate = () => run('generate', async () => {
    const response = await courseGeneration.generateClassBatch(batch.batch_id)
    setBatch(response.batch)
    setNotice({ type: 'success', text: response.message })
  })

  const publish = () => run('publish', async () => {
    const response = await courseGeneration.publishClassBatch(batch.batch_id, { title: topic || batch.topic, instructions })
    setBatch(response.batch)
    setNotice({ type: 'success', text: response.message })
  })

  const inspectStudent = (item) => run('detail', async () => {
    const response = await courseGeneration.getWorkflow(item.workflow_id)
    setSelectedWorkflow(response.workflow)
  })

  return (
    <div className="space-y-6">
      {notice ? <Alert variant={notice.type === 'error' ? 'destructive' : 'default'}><AlertTitle>{notice.type === 'error' ? '暂时无法继续' : '班级任务状态'}</AlertTitle><AlertDescription>{notice.text}</AlertDescription></Alert> : null}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users /> 全班独立个性化生成</CardTitle><CardDescription>教师配置一次，系统为班内每名学生建立独立工作流、资源包和审核结果。</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>课程</Label><Select value={courseId} onValueChange={(value) => { setCourseId(value); setClassId(''); setPreflight(null) }}><SelectTrigger><SelectValue placeholder="选择课程" /></SelectTrigger><SelectContent>{courseList.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>班级</Label><Select value={classId} onValueChange={(value) => { setClassId(value); setPreflight(null) }}><SelectTrigger><SelectValue placeholder="选择已分配班级" /></SelectTrigger><SelectContent>{eligibleClasses.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2 md:col-span-2"><Label>统一教学主题</Label><Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例如：Python循环与边界控制" /></div>
          <div className="space-y-2 md:col-span-2"><Label>全班必须覆盖的核心知识点</Label><Textarea value={points} onChange={(event) => setPoints(event.target.value)} placeholder="用逗号或换行分隔，例如：for循环，range边界，嵌套循环" rows={3} /></div>
          <div className="space-y-3 md:col-span-2"><Label>全班必备资源</Label><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{RESOURCE_OPTIONS.map(([value, label]) => <label key={value} className="flex min-h-10 items-center gap-2 border px-3 text-sm"><Checkbox checked={requiredTypes.includes(value)} onCheckedChange={(checked) => setRequiredTypes((current) => checked ? [...current, value] : current.filter((item) => item !== value))} /><span>{label}</span></label>)}</div><p className="text-xs text-muted-foreground">AI可以根据画像增加额外资源，但不会删除这里选择的资源。</p></div>
        </CardContent>
        <CardFooter className="flex-wrap justify-end gap-2"><Button variant="outline" onClick={checkProfiles} disabled={!courseId || !classId || loading === 'preflight'}>{loading === 'preflight' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}画像预检</Button><Button onClick={createBatch} disabled={!preflight || loading === 'create'}>{loading === 'create' ? <Loader2 className="animate-spin" /> : <Users />}创建全班任务</Button></CardFooter>
      </Card>

      {preflight ? <Card><CardHeader><CardTitle className="text-base">画像准备情况</CardTitle><CardDescription>{preflight.ready_count}/{preflight.student_count} 名学生已满足条件</CardDescription></CardHeader><CardContent className="divide-y border-y">{preflight.students.map((student) => <div key={student.student_user_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{student.student_name}</p><p className="text-muted-foreground">证据来源 {student.source_count} · 完整度 {student.completeness_score}% · 可信度 {student.confidence_score}%</p></div><Badge variant={student.profile_ready ? 'default' : 'outline'}>{student.profile_ready ? '画像就绪' : '需快速诊断'}</Badge></div>)}</CardContent></Card> : null}

          {batch ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">班级生成总览</CardTitle><CardDescription>{batch.topic} · {batch.generated_count || 0}/{batch.student_count} 已生成 · {batch.published_count || 0}/{batch.student_count} 已发布</CardDescription></div><Badge>{STATE_LABELS[batch.state] || batch.state}</Badge></div></CardHeader><CardContent className="space-y-4"><Progress value={batch.state === 'PUBLISHED' ? 100 : progress} /><div className="divide-y border-y">{(batch.items || []).map((item) => <div key={item.student_user_id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{item.student_name}</p><p className="text-sm text-muted-foreground">{item.generation_mode === 'spark_ai' ? 'AI生成' : item.generation_mode ? '保障模式' : '等待生成'} · {(item.resource_types || []).map((type) => RESOURCE_LABELS[type] || type).join('、')}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{item.review_passed ? '审核通过' : STATE_LABELS[item.state] || item.state}</Badge>{item.workflow_id ? <Button size="icon" variant="ghost" title="查看该学生资源" onClick={() => inspectStudent(item)}><Eye /></Button> : null}</div></div>)}</div></CardContent><CardFooter className="flex-wrap justify-end gap-2">{batch.state === 'WAITING_PROFILE' ? <Button variant="outline" onClick={refreshProfiles} disabled={loading === 'refresh'}><RefreshCw className={loading === 'refresh' ? 'animate-spin' : ''} />重新检查画像</Button> : null}{batch.state === 'READY_TO_GENERATE' ? <Button onClick={generate} disabled={loading === 'generate'}>{loading === 'generate' ? <Loader2 className="animate-spin" /> : <Users />}为全班独立生成</Button> : null}</CardFooter></Card> : null}

      {batch?.state === 'READY_TO_PUBLISH' ? <Card><CardHeader><CardTitle className="text-base">统一发布</CardTitle><CardDescription>所有学生均已生成并通过审核 Agent 检查，发布后每个人收到自己的资源包。</CardDescription></CardHeader><CardContent><Textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} /></CardContent><CardFooter className="justify-end"><Button onClick={publish} disabled={loading === 'publish'}>{loading === 'publish' ? <Loader2 className="animate-spin" /> : <Send />}一次发布给全班</Button></CardFooter></Card> : null}

      {selectedWorkflow?.generation ? <section className="space-y-3"><div><h3 className="font-semibold">{selectedWorkflow.payload?.profile_snapshot?.student?.name}的独立资源</h3><p className="text-sm text-muted-foreground">工作流 {selectedWorkflow.workflow_id}，不会影响其他学生。</p></div><WorkflowResourcePreview resources={selectedWorkflow.generation.resources} sourceLabel={selectedWorkflow.generation.generation_source_label} /></section> : null}
    </div>
  )
}
