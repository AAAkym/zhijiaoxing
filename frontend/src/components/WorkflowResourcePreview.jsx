import {
  AlertTriangle, BookOpen, CheckCircle2, ClipboardList, FileText, Quote,
  Sparkles, Target, Video,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import InteractiveMindMap from '@/components/ui/InteractiveMindMap'
import { convertDocument, convertMindmap, ensureObject } from '@/utils/contentConverter'

const TYPE_LABELS = {
  document: '讲义', mindmap: '思维导图', layered_exercise: '分层练习', exercise: '练习',
  recommendation: '推荐', media: '视频脚本', project: '实践项目', ppt: 'PPT',
}

const META_KEYS = new Set([
  'citations', 'citation_coverage_score', 'citation_style', 'verification_report', 'rag_required',
  'degraded', 'degradation_reason', 'knowledge_point_references', '知识点引用来源',
  'profile_adaptation_explanation', '画像适配说明', 'external_status',
])

const STRUCTURED_KEYS = new Set([
  'sections', 'chapters', 'exercises', 'items', 'questions', 'levels', 'layers', 'scenes', 'script',
  'slides', 'tasks', 'steps', 'recommendations', 'resources', 'root', 'nodes', 'children', 'project',
  'document', 'mindmap', 'media', 'presentation', 'ppt',
])

function parseValue(value) {
  if (typeof value !== 'string') return value
  const parsed = ensureObject(value)
  return parsed.raw_response === value.trim() ? value : parsed
}

function prepareResource(value) {
  const parsed = parseValue(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { body: parsed, meta: {} }
  }

  const meta = {}
  const body = {}
  Object.entries(parsed).forEach(([key, item]) => {
    if (META_KEYS.has(key)) meta[key] = item
    else body[key] = item
  })

  const hasStructuredBody = Object.keys(body).some((key) => STRUCTURED_KEYS.has(key))
  if ('content' in body && !hasStructuredBody) {
    const nested = parseValue(body.content)
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return { body: { ...nested, title: body.title || nested.title, difficulty: body.difficulty || nested.difficulty }, meta }
    }
  }
  return { body, meta }
}

function TextBlock({ children, className = '' }) {
  if (children === null || children === undefined || children === '') return null
  const text = typeof children === 'object' ? children.description || children.content || children.text || children.title : String(children)
  if (!text) return null
  return <p className={`whitespace-pre-wrap break-words text-sm leading-7 text-foreground ${className}`}>{text}</p>
}

function ItemList({ items, ordered = false }) {
  const values = Array.isArray(items) ? items : items ? [items] : []
  if (!values.length) return null
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-5 text-sm leading-6`}>
      {values.map((item, index) => (
        <li key={`${typeof item === 'object' ? item.id || item.title || item.name : item}-${index}`}>
          {typeof item === 'object' ? item.text || item.name || item.title || item.description || item.content : String(item)}
        </li>
      ))}
    </Tag>
  )
}

function DocumentContent({ body }) {
  const document = convertDocument(body, body?.title)
  return (
    <article className="mx-auto max-w-4xl space-y-7" data-resource-format="document">
      <header className="space-y-2 border-b pb-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline"><BookOpen className="mr-1 size-3" />课程讲义</Badge>
          {document.estimated_reading_time_minutes ? <span>约 {document.estimated_reading_time_minutes} 分钟</span> : null}
          {document.target_audience ? <span>适合：{document.target_audience}</span> : null}
        </div>
        <h3 className="text-xl font-semibold">{document.title}</h3>
        <TextBlock className="text-muted-foreground">{document.summary}</TextBlock>
      </header>
      {document.sections.length ? document.sections.map((section, index) => (
        <section key={section.section_id || index} className="space-y-3">
          <h4 className="text-base font-semibold">{index + 1}. {section.title}</h4>
          {section.key_points?.length ? <div className="border-l-2 border-primary pl-4"><p className="mb-2 text-sm font-medium">核心要点</p><ItemList items={section.key_points} /></div> : null}
          <TextBlock>{section.content}</TextBlock>
          {section.examples?.map((example, exampleIndex) => (
            <div key={`${example.title}-${exampleIndex}`} className="space-y-2 bg-muted/50 p-4">
              <p className="text-sm font-medium">{example.title || '示例'}</p>
              <TextBlock>{example.description}</TextBlock>
              {example.content ? <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-background p-3 text-sm leading-6"><code>{example.content}</code></pre> : null}
            </div>
          ))}
          {section.common_mistakes?.length ? <div className="space-y-2"><p className="text-sm font-medium text-amber-700">常见误区</p><ItemList items={section.common_mistakes} /></div> : null}
        </section>
      )) : <TextBlock>{body?.content || body?.raw_response || body}</TextBlock>}
      {document.review_questions?.length ? <section className="space-y-2 border-t pt-5"><h4 className="font-semibold">复习思考题</h4><ItemList items={document.review_questions} ordered /></section> : null}
    </article>
  )
}

function normalizeQuestions(source) {
  const direct = source.exercises || source.items || source.questions
  if (Array.isArray(direct)) return [{ key: 'all', label: '练习题', exercises: direct }]
  const levels = source.levels || source.layers || direct
  if (levels && typeof levels === 'object') {
    return Object.entries(levels).map(([key, value]) => ({
      key, label: value?.label || ({ basic: '基础巩固', beginner: '基础巩固', intermediate: '能力提升', advanced: '综合挑战' }[key] || key),
      description: value?.description, exercises: Array.isArray(value) ? value : value?.exercises || value?.items || [],
    }))
  }
  return []
}

function ExerciseContent({ body, layered }) {
  const source = body?.exercise || body || {}
  const groups = normalizeQuestions(source)
  return (
    <div className="space-y-7" data-resource-format={layered ? 'layered-exercise' : 'exercise'}>
      <header className="space-y-2 border-b pb-4">
        <Badge variant="outline"><ClipboardList className="mr-1 size-3" />{layered ? '分层练习单' : '练习单'}</Badge>
        <h3 className="text-xl font-semibold">{source.title || '个性化练习'}</h3>
        <TextBlock className="text-muted-foreground">{source.coverage_summary || source.description}</TextBlock>
      </header>
      {groups.length ? groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <div><h4 className="font-semibold">{group.label}</h4><TextBlock className="text-muted-foreground">{group.description}</TextBlock></div>
          <div className="divide-y border-y">
            {group.exercises.map((question, index) => (
              <article key={question?.id || index} className="space-y-3 py-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium leading-6">{index + 1}. {question?.question || question?.text || question?.title || String(question)}</p>
                  <div className="flex gap-2">{question?.type ? <Badge variant="secondary">{question.type}</Badge> : null}{question?.score ? <Badge variant="outline">{question.score} 分</Badge> : null}</div>
                </div>
                {question?.options ? <ItemList items={Array.isArray(question.options) ? question.options : Object.entries(question.options).map(([key, val]) => `${key}. ${val}`)} /> : null}
                {question?.hint ? <div className="flex gap-2 text-sm text-muted-foreground"><Sparkles className="mt-1 size-4 shrink-0" /><span>{question.hint}</span></div> : null}
                {(question?.answer || question?.explanation || question?.reference_answer) ? <details className="text-sm"><summary className="cursor-pointer font-medium">查看答案与解析</summary><div className="mt-2 space-y-2 border-l-2 pl-4"><TextBlock>{question.answer || question.reference_answer}</TextBlock><TextBlock className="text-muted-foreground">{question.explanation}</TextBlock></div></details> : null}
              </article>
            ))}
          </div>
        </section>
      )) : <TextBlock>{source.content || source.raw_response}</TextBlock>}
    </div>
  )
}

function MediaContent({ body }) {
  const source = body?.media || body?.script || body || {}
  const scenes = source.scenes || source.segments || []
  return (
    <div className="space-y-6" data-resource-format="media-script">
      <header className="space-y-2 border-b pb-4"><Badge variant="outline"><Video className="mr-1 size-3" />视频脚本</Badge><h3 className="text-xl font-semibold">{source.title || source.topic || '个性化教学视频'}</h3><TextBlock>{source.summary || source.description}</TextBlock></header>
      {scenes.length ? <div className="divide-y border-y">{scenes.map((scene, index) => (
        <section key={scene.scene_id || index} className="grid gap-3 py-5 md:grid-cols-[9rem_1fr]">
          <div><p className="font-semibold">镜头 {index + 1}</p><p className="text-sm text-muted-foreground">{scene.stage || scene.scene_type || ''}{scene.duration_seconds ? ` · ${scene.duration_seconds}秒` : ''}</p></div>
          <div className="space-y-3"><TextBlock>{scene.narration || scene.voiceover || scene.script || scene.content}</TextBlock>{scene.visual || scene.visual_description ? <div className="text-sm"><span className="font-medium">画面：</span>{scene.visual || scene.visual_description}</div> : null}{scene.on_screen_text ? <div className="text-sm"><span className="font-medium">字幕：</span>{scene.on_screen_text}</div> : null}</div>
        </section>
      ))}</div> : <TextBlock>{source.content || source.raw_response}</TextBlock>}
    </div>
  )
}

function MindmapContent({ body }) {
  return <div data-resource-format="mindmap"><InteractiveMindMap data={convertMindmap(body, body?.title)} height={520} /></div>
}

function PptContent({ body }) {
  const source = body?.presentation || body?.ppt || body || {}
  const slides = source.slides || source.pages || []
  return (
    <div className="space-y-5" data-resource-format="ppt-outline">
      <header className="space-y-2 border-b pb-4"><Badge variant="outline"><FileText className="mr-1 size-3" />PPT 页面稿</Badge><h3 className="text-xl font-semibold">{source.title || '个性化课件'}</h3><TextBlock>{source.description || source.summary}</TextBlock></header>
      {slides.length ? <div className="grid gap-4 lg:grid-cols-2">{slides.map((slide, index) => (
        <section key={slide.slide_id || index} className="min-h-48 border bg-muted/20 p-5">
          <p className="mb-2 text-xs text-muted-foreground">第 {index + 1} 页{slide.layout ? ` · ${slide.layout}` : ''}</p>
          <h4 className="mb-4 font-semibold">{slide.title || slide.heading || `页面 ${index + 1}`}</h4>
          <ItemList items={slide.bullets || slide.points || slide.content} />
          {typeof slide.content === 'string' ? <TextBlock>{slide.content}</TextBlock> : null}
          {slide.speaker_notes || slide.notes ? <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">讲解备注</summary><TextBlock className="mt-2 text-muted-foreground">{slide.speaker_notes || slide.notes}</TextBlock></details> : null}
        </section>
      ))}</div> : <TextBlock>{source.content || source.raw_response}</TextBlock>}
    </div>
  )
}

function ProjectContent({ body }) {
  const source = body?.project || body || {}
  const tasks = source.tasks || source.steps || []
  return (
    <div className="space-y-6" data-resource-format="project-brief">
      <header className="space-y-2 border-b pb-4"><Badge variant="outline"><Target className="mr-1 size-3" />实践项目书</Badge><h3 className="text-xl font-semibold">{source.title || source.project_title || '个性化实践项目'}</h3><TextBlock>{source.description || source.project_description}</TextBlock></header>
      {source.learning_objectives?.length ? <section className="space-y-2"><h4 className="font-semibold">学习目标</h4><ItemList items={source.learning_objectives} /></section> : null}
      {tasks.length ? <section className="space-y-3"><h4 className="font-semibold">实施任务</h4>{tasks.map((task, index) => <div key={task?.task_id || index} className="border-l-2 pl-4"><p className="font-medium">{index + 1}. {typeof task === 'object' ? task.title || task.instruction || task.step : task}</p><TextBlock className="text-muted-foreground">{task?.description}</TextBlock><ItemList items={task?.steps} ordered /></div>)}</section> : null}
      {(source.acceptance_criteria || source.scoring_criteria || source.rubric) ? <section className="space-y-2 border-t pt-4"><h4 className="font-semibold">验收与评分标准</h4><ItemList items={source.acceptance_criteria || source.scoring_criteria || source.rubric} /></section> : null}
    </div>
  )
}

function RecommendationContent({ body }) {
  const source = body?.recommendations || body || {}
  const resources = source.resources || source.items || source.recommendations || []
  return (
    <div className="space-y-5" data-resource-format="recommendations">
      <header className="space-y-2 border-b pb-4"><Badge variant="outline"><CheckCircle2 className="mr-1 size-3" />学习推荐单</Badge><h3 className="text-xl font-semibold">{source.title || source.topic || '个性化学习推荐'}</h3><TextBlock>{source.learning_path_suggestion || source.description}</TextBlock></header>
      <div className="divide-y border-y">{(Array.isArray(resources) ? resources : []).map((item, index) => <section key={item?.id || index} className="space-y-2 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium">{index + 1}. {item?.title || item?.name || String(item)}</h4><div className="flex gap-2">{item?.type ? <Badge variant="secondary">{item.type}</Badge> : null}{item?.difficulty ? <Badge variant="outline">{item.difficulty}</Badge> : null}</div></div><TextBlock>{item?.description || item?.reason || item?.recommendation_reason}</TextBlock>{item?.url ? <a className="break-all text-sm text-primary underline" href={item.url} target="_blank" rel="noreferrer">打开外部资源</a> : null}</section>)}</div>
    </div>
  )
}

function GenericContent({ body }) {
  if (typeof body === 'string') return <TextBlock>{body}</TextBlock>
  const entries = Object.entries(body || {}).filter(([, value]) => value !== null && value !== undefined && value !== '')
  return <div className="space-y-5" data-resource-format="generic">{entries.map(([key, value]) => <section key={key} className="space-y-2"><h4 className="font-semibold">{key.replaceAll('_', ' ')}</h4>{Array.isArray(value) ? <ItemList items={value} /> : <TextBlock>{value}</TextBlock>}</section>)}</div>
}

function ResourceMetadata({ meta }) {
  const citations = meta.knowledge_point_references || meta['知识点引用来源'] || meta.citations || []
  const adaptation = meta.profile_adaptation_explanation || meta['画像适配说明']
  if (!citations.length && !adaptation && !meta.external_status) return null
  return (
    <aside className="mt-8 space-y-4 border-t pt-5" aria-label="生成依据">
      {meta.external_status ? <Alert><AlertTriangle /><AlertTitle>外部内容状态</AlertTitle><AlertDescription>{meta.external_status}</AlertDescription></Alert> : null}
      {adaptation ? <div className="flex gap-3 text-sm"><Target className="mt-1 size-4 shrink-0 text-primary" /><div><p className="font-medium">为什么这样设计</p><TextBlock className="text-muted-foreground">{adaptation}</TextBlock></div></div> : null}
      {citations.length ? <details className="text-sm"><summary className="flex cursor-pointer items-center gap-2 font-medium"><Quote className="size-4" />查看生成依据（{citations.length} 条）{meta.citation_coverage_score !== undefined ? <Badge variant="outline">覆盖率 {meta.citation_coverage_score}%</Badge> : null}</summary><div className="mt-3 divide-y border-y">{citations.map((citation, index) => <div key={`${citation.source_id || 'source'}-${index}`} className="space-y-1 py-3"><p className="font-medium">[{citation.source_id || index + 1}] {citation.title || '课程知识来源'}</p><p className="text-xs text-muted-foreground">{citation.location || citation.source_type}</p>{citation.excerpt ? <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{citation.excerpt}</p> : null}</div>)}</div></details> : null}
    </aside>
  )
}

function ResourceBody({ type, value }) {
  const items = Array.isArray(value) ? value : [value]
  const renderers = {
    document: DocumentContent, mindmap: MindmapContent, layered_exercise: (props) => <ExerciseContent {...props} layered />,
    exercise: ExerciseContent, recommendation: RecommendationContent, media: MediaContent, project: ProjectContent, ppt: PptContent,
  }
  const Renderer = renderers[type] || GenericContent
  return <div className="space-y-10">{items.map((item, index) => { const { body, meta } = prepareResource(item); return <section key={`${body?.title || type}-${index}`}><Renderer body={body} /><ResourceMetadata meta={meta} /></section> })}</div>
}

export default function WorkflowResourcePreview({ resources, sourceLabel }) {
  const entries = Object.entries(resources || {}).filter(([, value]) => value)
  if (!entries.length) return null
  return (
    <Card>
      <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-col gap-1"><CardTitle className="flex items-center gap-2 text-base"><FileText /> 资源包预览</CardTitle><CardDescription>按实际教学资源格式预览，生成依据与正文分开显示。</CardDescription></div><Badge variant="secondary">{sourceLabel}</Badge></div></CardHeader>
      <CardContent>
        <Tabs defaultValue={entries[0][0]}><TabsList className="h-auto w-full justify-start overflow-x-auto">{entries.map(([type]) => <TabsTrigger key={type} value={type}>{TYPE_LABELS[type] || type}</TabsTrigger>)}</TabsList>{entries.map(([type, value]) => <TabsContent key={type} value={type} className="pt-6"><ResourceBody type={type} value={value} /></TabsContent>)}</Tabs>
      </CardContent>
    </Card>
  )
}
