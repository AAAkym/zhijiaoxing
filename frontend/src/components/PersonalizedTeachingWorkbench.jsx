import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, BookOpen, Check, ChevronRight, FileCheck2, Loader2,
  Pause, Play, Plus, Save, Sparkles, UserRoundSearch, Users,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { classManagement, courseGeneration, courses } from '@/services/api'
import { getEligibleClasses, getStudentsForClass } from '@/utils/personalizedGeneration'
import WorkflowResourcePreview from './WorkflowResourcePreview'
import WorkflowReviewPanel from './WorkflowReviewPanel'
import AgentCollaborationProgress from './AgentCollaborationProgress'
import WorkflowHistoryPanel from './WorkflowHistoryPanel'
import WorkflowDeliveryPanel from './WorkflowDeliveryPanel'
import PersonalizedTaskOperations from './PersonalizedTaskOperations'
import ClassPersonalizationBatchWorkbench from './ClassPersonalizationBatchWorkbench'

const RESOURCE_OPTIONS = [
  ['document', '讲解文档'], ['mindmap', '思维导图'], ['layered_exercise', '分层练习'],
  ['recommendation', '学习推荐'], ['media', '视频脚本'], ['project', '实践项目'], ['ppt', 'PPT课件'],
]

const STAGE_LABELS = ['选择对象', '知识点', '学习证据', '学习方案', '资源生成', '审核确认']
const STATE_LABELS = {
  DRAFT: '草稿', WAITING_APPROVAL: '等待确认', GENERATING: '正在生成',
  READY_TO_PUBLISH: '可以提交', NEEDS_ATTENTION: '需要继续处理', PAUSED: '已暂停',
  PUBLISHED: '已发布', LEARNING: '学习中', WAITING_ASSESSMENT: '等待检测',
  ASSESSING: '分析中', UPDATING_PROFILE: '更新周期画像', COMPLETED: '本轮完成',
}

function normalizeCourses(response) {
  return (response?.courses || []).filter((item) => item?.id != null)
}

function SingleStudentTeachingWorkbench() {
  const [courseList, setCourseList] = useState([])
  const [classes, setClasses] = useState([])
  const [courseId, setCourseId] = useState('')
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [topic, setTopic] = useState('')
  const [knowledgePoints, setKnowledgePoints] = useState([])
  const [manualPoint, setManualPoint] = useState('')
  const [resourceTypes, setResourceTypes] = useState(['document', 'layered_exercise', 'project'])
  const [plan, setPlan] = useState(null)
  const [workflow, setWorkflow] = useState(null)
  const [generation, setGeneration] = useState(null)
  const [agentProgress, setAgentProgress] = useState(null)
  const [generationStages, setGenerationStages] = useState([])
  const [recentWorkflows, setRecentWorkflows] = useState([])
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState('initial')
  const pollingTimerRef = useRef(null)

  const eligibleClasses = useMemo(() => getEligibleClasses(classes, courseId), [classes, courseId])
  const students = useMemo(() => getStudentsForClass(classes, classId), [classes, classId])
  const currentStage = generation ? 5 : plan ? 3 : knowledgePoints.length ? 2 : courseId && classId && studentId ? 1 : 0

  useEffect(() => {
    let cancelled = false
    async function loadOptions() {
      try {
        const [courseResponse, classResponse, workflowResponse] = await Promise.all([
          courses.getAll(),
          classManagement.getClasses(),
          courseGeneration.getWorkflows({ limit: 10 }).catch(() => ({ workflows: [] })),
        ])
        const details = await Promise.all((classResponse?.classes || []).map((item) => classManagement.getClass(item.id)))
        if (!cancelled) {
          setCourseList(normalizeCourses(courseResponse))
          setClasses(details)
          setRecentWorkflows(workflowResponse?.workflows || [])
        }
      } catch (error) {
        if (!cancelled) setNotice({ type: 'error', text: `基础数据加载失败：${error.message}` })
      } finally {
        if (!cancelled) setLoading('')
      }
    }
    loadOptions()
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
  }, [])

  const resetFrom = (level) => {
    if (level <= 1) setClassId('')
    if (level <= 2) setStudentId('')
    setKnowledgePoints([])
    setPlan(null)
    setWorkflow(null)
    setGeneration(null)
    setAgentProgress(null)
    setGenerationStages([])
    setNotice(null)
  }

  const handleCourseChange = (value) => {
    setCourseId(value)
    resetFrom(1)
  }

  const handleClassChange = (value) => {
    setClassId(value)
    resetFrom(2)
  }

  const handleStudentChange = (value) => {
    setStudentId(value)
    setKnowledgePoints([])
    setPlan(null)
    setWorkflow(null)
    setGeneration(null)
    setAgentProgress(null)
    setGenerationStages([])
    setNotice(null)
  }

  const requestBase = () => ({
    course_id: Number(courseId), class_id: Number(classId), student_user_id: Number(studentId),
    topic: topic.trim(), knowledge_points: knowledgePoints.map((item) => item.name), resource_types: resourceTypes,
  })

  const rememberWorkflow = (nextWorkflow) => {
    if (!nextWorkflow?.workflow_id) return
    setRecentWorkflows((current) => [nextWorkflow, ...current.filter((item) => item.workflow_id !== nextWorkflow.workflow_id)].slice(0, 10))
  }

  const hydrateWorkflow = (saved) => {
    const payload = saved.payload || {}
    setCourseId(String(saved.course_id || payload.course_id || ''))
    setClassId(String(saved.class_id || payload.class_id || ''))
    setStudentId(String(saved.student_user_id || payload.student_user_id || ''))
    setTopic(saved.topic || payload.topic || '')
    setKnowledgePoints((payload.knowledge_points || []).map((name) => ({ name, selected: true, source: 'restored' })))
    setResourceTypes(payload.resource_types || ['document', 'layered_exercise', 'project'])
    setPlan(saved.plan || payload)
    setWorkflow(saved)
    setGeneration(saved.generation || null)
    setAgentProgress(saved.generation?.agent_progress || null)
    setGenerationStages(saved.generation?.stages || [])
    setNotice({ type: 'info', text: saved.state === 'NEEDS_ATTENTION' ? '上次生成被中断，已恢复方案，可以重新继续生成。' : '已恢复保存的工作流。' })
  }

  const restoreWorkflow = async (saved) => {
    setLoading('restore')
    setNotice(null)
    try {
      const response = await courseGeneration.getWorkflow(saved.workflow_id)
      const detailedWorkflow = response.workflow || saved
      hydrateWorkflow(detailedWorkflow)
      rememberWorkflow(detailedWorkflow)
    } catch (error) {
      setNotice({ type: 'error', text: `恢复工作流失败：${error.message}` })
    } finally {
      setLoading('')
    }
  }

  const suggestKnowledgePoints = async () => {
    if (!courseId || !classId || !studentId || !topic.trim()) {
      setNotice({ type: 'error', text: '请先选择课程、班级和学生，并填写教学主题。' })
      return
    }
    setLoading('knowledge')
    setNotice(null)
    try {
      const response = await courseGeneration.suggestWorkflowKnowledgePoints(requestBase())
      setKnowledgePoints(response.knowledge_points || [])
      setPlan(null)
      setWorkflow(null)
      setGeneration(null)
      setAgentProgress(null)
      setGenerationStages([])
      setNotice({ type: 'info', text: response.source === 'ai_course_context' ? 'AI已结合课程内容拆分知识点，请确认。' : '已生成候选知识点，请确认或修改。' })
    } catch (error) {
      setNotice({ type: 'error', text: `知识点拆分失败：${error.message}` })
    } finally {
      setLoading('')
    }
  }

  const addManualPoint = () => {
    const value = manualPoint.trim()
    if (!value || knowledgePoints.some((item) => item.name === value)) return
    setKnowledgePoints((current) => [...current, { name: value, selected: true, source: 'teacher' }])
    setManualPoint('')
    setPlan(null)
    setGeneration(null)
  }

  const createPlan = async (selectedEvidence) => {
    const selectedPoints = knowledgePoints.filter((item) => item.selected !== false)
    if (!selectedPoints.length || !resourceTypes.length) {
      setNotice({ type: 'error', text: '至少保留一个知识点和一种资源。' })
      return
    }
    setLoading('plan')
    setNotice(null)
    try {
      const response = await courseGeneration.previewWorkflowPlan({
        ...requestBase(),
        knowledge_points: selectedPoints.map((item) => item.name),
        selected_evidence: selectedEvidence,
        workflow_id: workflow?.workflow_id,
      })
      setPlan(response.plan)
      setWorkflow(response.workflow)
      rememberWorkflow(response.workflow)
      setGeneration(null)
      setAgentProgress(null)
      setGenerationStages([])
    } catch (error) {
      setNotice({ type: 'error', text: `方案生成失败：${error.message}` })
    } finally {
      setLoading('')
    }
  }

  const toggleEvidence = async (evidenceId, checked) => {
    if (!plan) return
    const nextEvidence = plan.selected_evidence.map((item) => item.id === evidenceId ? { ...item, selected: checked } : item)
    setPlan((current) => ({ ...current, selected_evidence: nextEvidence }))
    await createPlan(nextEvidence.filter((item) => item.selected).map((item) => item.id))
  }

  const generateResources = async () => {
    if (!workflow?.workflow_id) return
    const randomPart = globalThis.crypto?.randomUUID?.().replaceAll('-', '') || `${Date.now()}${Math.random().toString(16).slice(2)}`
    const trackingId = `trk_${randomPart}`
    setLoading('generation')
    setNotice(null)
    setAgentProgress({
      overall_progress: 5,
      stage: 'planning',
      steps: resourceTypes.map((resourceType) => ({
        resource_type: resourceType,
        agent_name: `${resourceType}_agent`,
        status: 'pending',
        progress: 0,
      })),
    })
    setGenerationStages([
      ['profile', '读取学生画像'], ['knowledge', '检索课程知识库'], ['strategy', '协调智能体制定策略'],
      ['agents', '各资源智能体并行生成'], ['quality', '一致性和质量检查'], ['package', '整合个性化资源包'],
    ].map(([key, name], index) => ({ key, name, order: index + 1, status: 'pending' })))
    let pollErrors = 0
    const pollStatus = async () => {
      try {
        const status = await courseGeneration.getGenerationStatus(trackingId)
        pollErrors = 0
        if (status.progress) setAgentProgress(status.progress)
        if (status.stages) setGenerationStages(status.stages)
      } catch (error) {
        if (error.status === 404 && pollErrors < 2) {
          pollErrors += 1
          return
        }
        pollErrors += 1
        if (pollErrors === 3) setNotice({ type: 'info', text: '进度连接暂时中断，服务器仍会继续生成并返回最终结果。' })
      }
    }
    pollingTimerRef.current = setInterval(pollStatus, 1000)
    pollStatus()
    try {
      const response = await courseGeneration.generateWorkflowResources(workflow.workflow_id, {
        strategy: plan.strategy,
        tracking_id: trackingId,
      })
      setGeneration(response)
      setWorkflow(response.workflow)
      rememberWorkflow(response.workflow)
      if (response.agent_progress) setAgentProgress(response.agent_progress)
      if (response.stages) setGenerationStages(response.stages)
    } catch (error) {
      setNotice({ type: 'error', text: `资源生成未完成：${error.message}` })
    } finally {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
      setLoading('')
    }
  }

  const explicitAction = async (action) => {
    if (!workflow?.workflow_id) return
    setLoading(action)
    setNotice(null)
    try {
      const response = action === 'draft'
        ? await courseGeneration.saveWorkflowDraft(workflow.workflow_id)
        : await courseGeneration.submitWorkflowReview(workflow.workflow_id)
      setWorkflow(response.workflow)
      rememberWorkflow(response.workflow)
      setNotice({ type: 'info', text: action === 'draft' ? '草稿已保存。' : '内容已提交AI审核流程。' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading('')
    }
  }

  const changeWorkflowPause = async () => {
    if (!workflow?.workflow_id) return
    const shouldResume = workflow.state === 'PAUSED'
    setLoading(shouldResume ? 'resume' : 'pause')
    setNotice(null)
    try {
      const response = shouldResume
        ? await courseGeneration.resumeWorkflow(workflow.workflow_id)
        : await courseGeneration.pauseWorkflow(workflow.workflow_id)
      setWorkflow(response.workflow)
      rememberWorkflow(response.workflow)
      setNotice({ type: 'info', text: response.message })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading('')
    }
  }

  if (loading === 'initial') {
    return <div className="flex min-h-80 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> 正在加载教学数据</div>
  }

  return (
    <div className="notranslate flex flex-col gap-6" translate="no">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">个性化教学</h2>
        <p className="text-sm text-muted-foreground">诊断学习证据，确认方案，生成并审核课程资源。</p>
      </div>

      <Alert>
        <AlertCircle />
        <AlertTitle>工作流已持久化保存</AlertTitle>
        <AlertDescription>方案、Agent结果和操作时间线会在服务重启后恢复；课程内容仍只在点击“保存为草稿”或“提交AI审核”后写入原有业务记录。</AlertDescription>
      </Alert>

      <PersonalizedTaskOperations />

      {recentWorkflows.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近工作流</CardTitle>
            <CardDescription>选择一条记录继续上次的方案或查看结果。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentWorkflows.slice(0, 5).map((item) => (
              <div key={item.workflow_id} className="flex flex-col justify-between gap-3 border p-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.topic || item.payload?.topic || '未命名工作流'}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.payload?.profile_snapshot?.student?.name || `学生 ${item.student_user_id}`} · {STATE_LABELS[item.state] || item.state}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled={loading === 'restore'} onClick={() => restoreWorkflow(item)}>
                  <span>{loading === 'restore' ? '恢复中...' : '继续'}</span>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <ol className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="工作流阶段">
        {STAGE_LABELS.map((label, index) => (
          <li key={label} className="flex min-h-12 items-center gap-2 border px-3 py-2 text-sm">
            <Badge variant={index <= currentStage ? 'default' : 'outline'}>{index + 1}</Badge>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {notice ? (
        <Alert variant={notice.type === 'error' ? 'destructive' : 'default'}>
          <AlertCircle />
          <AlertTitle><span>{notice.type === 'error' ? '暂时无法继续' : '状态更新'}</span></AlertTitle>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><UserRoundSearch /> 教学对象与主题</CardTitle>
          <CardDescription>班级和学生范围由后端再次校验。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label>课程</Label>
            <Select value={courseId} onValueChange={handleCourseChange}>
              <SelectTrigger aria-label="选择课程"><SelectValue placeholder="选择课程" /></SelectTrigger>
              <SelectContent><SelectGroup>{courseList.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>班级</Label>
            <Select value={classId} onValueChange={handleClassChange} disabled={!courseId}>
              <SelectTrigger aria-label="选择班级"><SelectValue placeholder="选择已分配班级" /></SelectTrigger>
              <SelectContent><SelectGroup>{eligibleClasses.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>学生</Label>
            <Select value={studentId} onValueChange={handleStudentChange} disabled={!classId}>
              <SelectTrigger aria-label="选择学生"><SelectValue placeholder="选择班级学生" /></SelectTrigger>
              <SelectContent><SelectGroup>{students.map((item) => <SelectItem key={item.user_id} value={String(item.user_id)}>{item.student_name || item.username}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workflow-topic">教学主题</Label>
            <Input id="workflow-topic" value={topic} onChange={(event) => { setTopic(event.target.value); setPlan(null); setGeneration(null) }} placeholder="例如：Python循环结构" />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={suggestKnowledgePoints} disabled={loading === 'knowledge'}>
            {loading === 'knowledge' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
            AI拆分知识点
          </Button>
        </CardFooter>
      </Card>

      {knowledgePoints.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen /> 知识点确认</CardTitle>
            <CardDescription>保留本次需要覆盖的知识点，教师补充不会写回知识图谱。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {knowledgePoints.map((item, index) => (
                <label key={`${item.name}-${index}`} className="flex min-h-12 cursor-pointer items-center gap-3 border px-3 py-2">
                  <Checkbox checked={item.selected !== false} onCheckedChange={(checked) => {
                    setKnowledgePoints((current) => current.map((point, pointIndex) => pointIndex === index ? { ...point, selected: checked === true } : point))
                    setPlan(null)
                    setGeneration(null)
                  }} />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <Badge variant="outline">{item.source === 'teacher' ? '教师补充' : 'AI建议'}</Badge>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={manualPoint} onChange={(event) => setManualPoint(event.target.value)} placeholder="补充知识点" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addManualPoint() } }} />
              <Button variant="outline" onClick={addManualPoint}><Plus data-icon="inline-start" />添加</Button>
            </div>
            <Separator />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {RESOURCE_OPTIONS.map(([value, label]) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 border px-3 py-2">
                  <Checkbox checked={resourceTypes.includes(value)} onCheckedChange={(checked) => {
                    setResourceTypes((current) => checked === true ? [...current, value] : current.filter((item) => item !== value))
                    setPlan(null)
                    setGeneration(null)
                  }} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => createPlan()} disabled={loading === 'plan'}>
              {loading === 'plan' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
              读取证据并制定方案
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {plan ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">学习证据</CardTitle>
                  <CardDescription>开关只影响本次方案，不修改学生永久画像。</CardDescription>
                </div>
                <Badge variant={plan.mode === 'personalized' ? 'default' : 'secondary'}>{plan.mode === 'personalized' ? '个性化方案' : '通用方案'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {plan.selected_evidence.map((item) => (
                <label key={item.id} className="flex min-h-20 items-start gap-3 border p-3">
                  <Checkbox disabled={!item.available || loading === 'plan'} checked={item.selected} onCheckedChange={(checked) => toggleEvidence(item.id, checked === true)} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.source} · 样本{item.sample_count} · <span>{item.confidence === 'high' ? '证据充分' : '证据较少'}</span></span>
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">本次学习方案</CardTitle>
              <CardDescription>{plan.strategy?.summary || '根据已确认的知识点和学习证据制定。'}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {plan.strategy?.learning_sequence ? <div><p className="mb-2 text-sm font-medium">学习顺序</p><div className="flex flex-wrap gap-2">{plan.strategy.learning_sequence.map((item, index) => <Badge key={`${item}-${index}`} variant="outline">{index + 1}. {item}</Badge>)}</div></div> : null}
              {plan.strategy?.mappings?.length ? <div className="flex flex-col gap-3">{plan.strategy.mappings.map((item, index) => <div key={`${item.feature}-${index}`} className="grid gap-2 border-l-2 pl-4 text-sm md:grid-cols-3"><span>{item.feature}</span><span>{item.action}</span><span className="text-muted-foreground">{(item.affected_resources || []).join('、')}</span></div>)}</div> : null}
              <Textarea value={plan.strategy?.teacher_note || ''} onChange={(event) => setPlan((current) => ({ ...current, strategy: { ...current.strategy, teacher_note: event.target.value } }))} placeholder="教师补充要求（将作为本次生成要求）" rows={3} />
            </CardContent>
            <CardFooter className="justify-end">
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={changeWorkflowPause} disabled={['generation', 'pause', 'resume'].includes(loading) || workflow?.state === 'GENERATING'}>
                  {workflow?.state === 'PAUSED' ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
                  <span>{workflow?.state === 'PAUSED' ? '恢复工作流' : '暂停'}</span>
                </Button>
                <Button onClick={generateResources} disabled={loading === 'generation' || Boolean(generation) || workflow?.state === 'PAUSED'}>
                {loading === 'generation' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                <span>{generation ? '资源已生成' : '确认方案并生成资源'}</span>
                </Button>
              </div>
            </CardFooter>
          </Card>
        </>
      ) : null}

      {generation ? (
        <>
          {agentProgress ? (
            <AgentCollaborationProgress
              progress={agentProgress}
              stages={generationStages}
              loading={loading === 'generation'}
              autoPoll={false}
              title="本次多 Agent 执行记录"
            />
          ) : null}
          <WorkflowReviewPanel review={generation.review} />
          <WorkflowResourcePreview resources={generation.resources} sourceLabel={generation.generation_source_label} />
          <WorkflowDeliveryPanel workflow={workflow} onWorkflowChange={(nextWorkflow) => {
            setWorkflow(nextWorkflow)
            rememberWorkflow(nextWorkflow)
          }} />
          <div className="flex flex-col justify-end gap-3 sm:flex-row">
            <Button variant="outline" onClick={() => explicitAction('draft')} disabled={loading === 'draft' || workflow?.draft_config_id}>
              {loading === 'draft' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              <span>{workflow?.draft_config_id ? '草稿已保存' : '保存为草稿'}</span>
            </Button>
            <Button onClick={() => explicitAction('submit')} disabled={!generation.review?.can_submit || loading === 'submit' || workflow?.review_submitted}>
              {loading === 'submit' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileCheck2 data-icon="inline-start" />}
              <span>{workflow?.review_submitted ? '已提交审核' : '提交AI审核'}</span>
            </Button>
          </div>
        </>
      ) : null}

      {workflow ? <WorkflowHistoryPanel workflow={workflow} /> : null}
    </div>
  )
}

export default function PersonalizedTeachingWorkbench() {
  const [mode, setMode] = useState('single')
  return (
    <div className="notranslate space-y-6" translate="no">
      <div className="grid grid-cols-2 gap-1 bg-muted p-1" role="group" aria-label="个性化生成范围">
        <Button variant={mode === 'class' ? 'default' : 'ghost'} onClick={() => setMode('class')}><Users />全班独立生成</Button>
        <Button variant={mode === 'single' ? 'default' : 'ghost'} onClick={() => setMode('single')}><UserRoundSearch />单学生生成</Button>
      </div>
      {mode === 'class' ? <ClassPersonalizationBatchWorkbench /> : <SingleStudentTeachingWorkbench />}
    </div>
  )
}
