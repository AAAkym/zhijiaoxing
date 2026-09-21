import { useMemo, useRef, useState } from 'react'
import { AlertCircle, BookOpen, ChevronDownIcon, FileText, Link2, Network, ShieldCheck, Target } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const RESOURCE_LABELS = {
  exercise: '个性化练习',
  layered_exercise: '分层练习',
  document: '讲解文档',
  mindmap: '思维导图',
  media: '视频脚本',
  recommendation: '拓展推荐',
  project: '实操项目',
  ppt: '课件PPT',
}

/** 与后端 generation_basis_service.CITATION_EXEMPT_RESOURCE_TYPES 保持同一口径。 */
const CITATION_EXEMPT_TYPES = new Set(['media', 'ppt'])

const LOW_CONFIDENCE_THRESHOLD = 60

const GAP_LABELS = {
  missing_mistake_detail: '错题明细缺失',
  difficulty_alignment_is_placeholder: '难度对齐为占位值',
  insufficient_dimension_evidence: '画像维度证据不足',
  missing_profile_evidence: '未使用个人画像证据',
  missing_knowledge_reference: '未关联知识点',
  missing_learning_cycle: '尚无下一轮策略',
  missing_quality_report: '缺少质量评估记录',
  citation_not_applicable: '该资源不适用引用核验',
}

function lowConfidence(confidence) {
  return Number(confidence || 0) < LOW_CONFIDENCE_THRESHOLD
}

function formatTime(value) {
  if (!value) return '暂无更新时间'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('zh-CN')
}

export default function ResourceBasisPanel({
  basis,
  resourceType = '',
  loading = false,
  error = null,
  onOpenKnowledgeGraph = null,
}) {
  const [openSections, setOpenSections] = useState(() => new Set(['profile']))
  const toggleRefs = useRef({})

  const resourceLabel = RESOURCE_LABELS[resourceType] || resourceType || '学习资源'
  const citationExempt = CITATION_EXEMPT_TYPES.has(resourceType)
  const gaps = useMemo(() => basis?.gaps || [], [basis])

  const toggle = (key) => {
    setOpenSections((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            生成依据
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">正在读取这份资源的生成依据...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>依据信息暂时不可用</AlertTitle>
        <AlertDescription>资源正文仍可正常阅读，依据信息稍后可重试。</AlertDescription>
      </Alert>
    )
  }

  if (!basis) return null

  return (
    <section aria-label="生成依据链" className="mt-3 flex flex-col gap-2">
      {gaps.map((gap, index) => (
        <p
          key={`${gap.kind}-${index}`}
          className="flex items-start gap-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">{GAP_LABELS[gap.kind] || gap.kind}</span>
            {gap.message ? `：${gap.message}` : ''}
          </span>
        </p>
      ))}

      <BasisSection
        id="profile"
        icon={Target}
        title="画像依据"
        summary={`${(basis.profile_evidence || []).length} 个维度`}
        open={openSections.has('profile')}
        onToggle={toggle}
        toggleRefs={toggleRefs}
      >
        {basis.profile_evidence?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {basis.profile_evidence.map((item) => (
              <div key={item.dimension_key} className="border-l-2 border-border bg-muted/25 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{item.dimension_label}</p>
                    <p className="text-xs text-muted-foreground">{item.judgement || '待积累数据'}</p>
                  </div>
                  {lowConfidence(item.confidence) ? (
                    <Badge variant="outline" className="gap-1">
                      <AlertCircle className="h-3 w-3" aria-hidden="true" />
                      低可信 {item.confidence}%
                    </Badge>
                  ) : (
                    <Badge variant="secondary">可信度 {item.confidence}%</Badge>
                  )}
                </div>
                <Progress value={item.confidence || 0} className="my-1.5 h-1.5" />
                <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                  {(item.evidence || []).map((line, lineIndex) => (
                    <li key={`${item.dimension_key}-line-${lineIndex}`} className="flex gap-1.5">
                      <span aria-hidden="true">-</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  样本 {item.sample_count || 0} · {(item.data_sources || []).join('、') || '暂无来源'} · {formatTime(item.updated_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            该资源按通用方案生成，未使用个人画像证据。补齐画像后可获得针对你的讲解顺序与练习难度。
          </p>
        )}
      </BasisSection>

      <BasisSection
        id="mistake"
        icon={FileText}
        title="错题来源"
        summary={`${(basis.mistake_evidence || []).length} 道错题`}
        open={openSections.has('mistake')}
        onToggle={toggle}
        toggleRefs={toggleRefs}
      >
        {basis.mistake_evidence?.length ? (
          <ul className="flex flex-col gap-2">
            {basis.mistake_evidence.map((item) => (
              <li key={item.mistake_id} className="border-l-2 border-rose-400 bg-muted/25 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.knowledge_point || '未标注知识点'}</Badge>
                  {item.error_type ? <Badge variant="secondary">{item.error_type}</Badge> : null}
                  <span className="text-xs text-muted-foreground">错误 {item.mistake_count} 次</span>
                </div>
                {item.question_excerpt ? (
                  <p className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5">{item.question_excerpt}</p>
                ) : null}
                <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>我的答案：{item.user_answer || '未作答'}</p>
                  <p>正确答案：{item.correct_answer || '暂无'}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">本轮未关联到具体错题记录。</p>
        )}
      </BasisSection>

      <BasisSection
        id="knowledge"
        icon={Network}
        title="知识图谱位置"
        summary={`${(basis.knowledge_evidence || []).length} 个知识点`}
        open={openSections.has('knowledge')}
        onToggle={toggle}
        toggleRefs={toggleRefs}
      >
        {basis.knowledge_evidence?.length ? (
          <ul className="flex flex-col gap-2">
            {basis.knowledge_evidence.map((item, index) => (
              <li
                key={`${item.node_id ?? item.label}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-sky-400 bg-muted/25 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.chapter_title || '未标注章节'}
                    {item.mastery != null ? ` · 掌握度 ${Math.round(Number(item.mastery) * 100)}%` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.is_weak ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" aria-hidden="true" />
                      薄弱知识点
                    </Badge>
                  ) : null}
                  {(item.citation_ids || []).map((citationId) => (
                    <Badge key={citationId} variant="outline">{citationId}</Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">该资源未关联到具体知识点。</p>
        )}
        {onOpenKnowledgeGraph ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit"
            onClick={() => onOpenKnowledgeGraph(basis.knowledge_evidence?.[0] || null)}
          >
            <Network data-icon="inline-start" />
            在知识图谱中查看
          </Button>
        ) : null}
      </BasisSection>

      <BasisSection
        id="next"
        icon={Target}
        title="接下来学什么"
        summary={basis.next_step?.action ? '已生成下一轮策略' : '暂无下一轮策略'}
        open={openSections.has('next')}
        onToggle={toggle}
        toggleRefs={toggleRefs}
      >
        {basis.next_step?.action ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">策略来源：</span>
              {basis.next_step.source === 'learning_cycle' ? '学习闭环结论' : basis.next_step.source}
            </p>
            <p className="text-sm leading-6">{basis.next_step.action}</p>
            {basis.next_step.learning_sequence?.length ? (
              <div className="flex flex-wrap gap-2">
                {basis.next_step.learning_sequence.map((step, index) => (
                  <Badge key={`${step}-${index}`} variant="outline">{index + 1}. {step}</Badge>
                ))}
              </div>
            ) : null}
            {basis.next_step.remaining_problems?.length ? (
              <div>
                <p className="text-sm font-medium">待解决问题</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {basis.next_step.remaining_problems.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            ) : null}
            {basis.next_step.prerequisite_chain?.length ? (
              <div>
                <p className="text-sm font-medium">先修链</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {basis.next_step.prerequisite_chain.map((item, index) => (
                    <Badge key={`${item}-${index}`} variant="secondary">{item}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">完成本轮检测后，系统会基于真实学习记录给出下一轮策略。</p>
        )}
      </BasisSection>

      <BasisSection
        id="quality"
        icon={BookOpen}
        title="质量评分"
        summary={basis.quality?.overall_score != null ? `综合 ${basis.quality.overall_score}/100` : '暂无质量评估'}
        open={openSections.has('quality')}
        onToggle={toggle}
        toggleRefs={toggleRefs}
      >
        {basis.quality?.dimensions && Object.keys(basis.quality.dimensions).length ? (
          <div className="flex flex-col gap-2">
            {Object.entries(basis.quality.dimensions).map(([dimensionKey, dimension]) => (
              <div key={dimensionKey} className="border-l-2 border-border bg-muted/25 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{dimension.label || dimensionKey}</span>
                  <span className="text-sm">{dimension.score ?? 0}/100</span>
                </div>
                <Progress value={dimension.score || 0} className="my-1.5 h-1.5" />
                {dimension.basis ? (
                  <p className="text-xs leading-5 text-muted-foreground">依据：{dimension.basis}</p>
                ) : null}
                {dimension.suggestion ? (
                  <p className="text-xs leading-5 text-muted-foreground">建议：{dimension.suggestion}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">该资源没有质量评估记录。</p>
        )}
        {citationExempt ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {resourceLabel}不附加知识库引用，因此不展示引用覆盖率。
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            引用覆盖率 {basis.quality?.citation_coverage_score ?? '暂无'} · 核验状态 {basis.quality?.verification_status || '未核验'}
          </p>
        )}
      </BasisSection>
    </section>
  )
}

function BasisSection({ id, icon: Icon, title, summary, open, onToggle, toggleRefs, children }) {
  const panelId = `basis-panel-${id}`
  const buttonId = `basis-trigger-${id}`
  return (
    <div className="border">
      <h4 className="m-0">
        <button
          type="button"
          id={buttonId}
          ref={(node) => { toggleRefs.current[id] = node }}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(id)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.preventDefault()
              onToggle(id)
              toggleRefs.current[id]?.focus()
            }
          }}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {title}
          </span>
          <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            {summary}
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </span>
        </button>
      </h4>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="border-t px-3 py-3"
      >
        {open ? children : null}
      </div>
    </div>
  )
}
