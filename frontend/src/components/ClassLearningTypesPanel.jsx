import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, ChevronDownIcon, RefreshCw, Users } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { classManagement } from '@/services/api'

const GAP_LABELS = {
  no_students: '该班级还没有学生',
  no_profiles: '学生画像尚未同步，无法生成分组',
  missing_mistake_detail: '错题明细缺失',
  difficulty_alignment_is_placeholder: '难度对齐为占位值，不作为真实评分使用',
}

const ACTION_LABELS = {
  remediation_exercise: '补救练习',
  micro_lesson: '微课讲解',
  peer_review: '同伴互评',
  project_practice: '项目实操',
}

function masteryTone(score) {
  if (score == null) return 'secondary'
  if (score < 60) return 'destructive'
  if (score < 75) return 'outline'
  return 'secondary'
}

export default function ClassLearningTypesPanel({ classId, courses = [], initialCourseId = null }) {
  const [courseId, setCourseId] = useState(initialCourseId ? String(initialCourseId) : '')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())

  useEffect(() => {
    if (!courseId && initialCourseId) setCourseId(String(initialCourseId))
  }, [courseId, initialCourseId])

  const loadGroups = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    setError(null)
    try {
      const response = await classManagement.getClassLearningGroups(classId, courseId || undefined)
      setOverview(response)
    } catch (err) {
      // 分组失败只影响本卡片，绝不阻塞班级管理的其他功能。
      setError(err.message || '分组加载失败')
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [classId, courseId])

  useEffect(() => { loadGroups() }, [loadGroups])

  const groups = useMemo(() => overview?.groups || [], [overview])
  const ungrouped = useMemo(() => overview?.ungrouped_students || [], [overview])
  const gaps = useMemo(() => overview?.gaps || [], [overview])

  const toggle = (key) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!classId) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />班级学习类型分布
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {courses.length > 0 ? (
              <Select value={courseId || 'all'} onValueChange={(value) => setCourseId(value === 'all' ? '' : value)}>
                <SelectTrigger className="h-8 w-48" aria-label="选择课程">
                  <SelectValue placeholder="选择课程" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部课程</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>{course.title || course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button variant="outline" size="sm" className="gap-1" onClick={loadGroups} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />刷新分组
            </Button>
          </div>
        </div>
        {overview ? (
          <p className="text-xs text-muted-foreground">
            按「认知风格 · 主要薄弱知识点 · 学习目标」确定性分组，共 {overview.student_count} 名学生，
            已分组 {overview.grouped_count} 人，未分组 {overview.ungrouped_count} 人。
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>分组暂时不可用</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

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

        {!error && !loading && groups.length === 0 && gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前没有可用于分组的学生画像证据。</p>
        ) : null}

        {groups.map((group) => {
          const isOpen = expanded.has(group.learning_type)
          const panelId = `learning-group-${group.learning_type}`
          return (
            <div key={group.learning_type} className="border">
              <h4 className="m-0">
                <button
                  type="button"
                  id={`learning-group-${group.learning_type}-trigger`}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(group.learning_type)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && isOpen) {
                      event.preventDefault()
                      toggle(group.learning_type)
                      event.currentTarget.focus()
                    }
                  }}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-medium">{group.learning_type}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{group.student_count} 人</span>
                    {group.merge_reason === 'less_than_two_students' ? (
                      <Badge variant="outline" className="ml-2">人数不足两人，已并入混合型</Badge>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    常见薄弱点 {group.common_weak_points?.length || 0} 个
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </span>
                </button>
              </h4>
              <div id={panelId} role="region" aria-labelledby={`learning-group-${group.learning_type}-trigger`} hidden={!isOpen} className="border-t px-3 py-3">
                {isOpen ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">学生名单</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(group.students || []).map((student) => (
                          <Badge key={student.student_user_id} variant="secondary">
                            {student.student_name || `学生${student.student_user_id}`}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <BarChart3 className="w-3 h-3" />常见薄弱知识点
                      </p>
                      {group.common_weak_points?.length ? (
                        <ul className="mt-1 space-y-2">
                          {group.common_weak_points.map((point) => (
                            <li key={point.knowledge_point} className="border-l-2 border-rose-400 bg-muted/25 px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-medium">{point.knowledge_point}</span>
                                <Badge variant={masteryTone(point.average_mastery)}>
                                  {point.student_count} 人薄弱 · 平均掌握度 {point.average_mastery ?? '暂无'}
                                </Badge>
                              </div>
                              <Progress value={Math.max(0, Math.min(100, Number(point.average_mastery) || 0))} className="my-1.5 h-1.5" />
                              <p className="text-xs text-muted-foreground">
                                来源：{point.evidence || '画像与错题记录'} · 涉及错题 {point.mistake_count || 0} 条
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">该组暂时没有共同薄弱知识点。</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">建议补救措施</p>
                      {group.remediation_plan?.length ? (
                        <ul className="mt-1 space-y-1 text-sm">
                          {group.remediation_plan.map((item, index) => (
                            <li key={`${item.action}-${index}`} className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{ACTION_LABELS[item.action] || item.action}</Badge>
                              <span className="text-muted-foreground">
                                {item.knowledge_point ? `针对「${item.knowledge_point}」` : ''}
                                {item.resource_type ? ` · 建议${item.resource_type}` : ''}
                                {item.reason ? ` · ${item.reason}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">暂无补救援助建议。</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}

        {ungrouped.length > 0 ? (
          <div className="border border-dashed px-3 py-3">
            <p className="text-sm font-medium">暂未分组学生（画像证据不足）</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {ungrouped.map((student) => (
                <li key={student.student_user_id}>
                  {student.student_name || `学生${student.student_user_id}`} · 完整度 {student.completeness_score} · 可信度 {student.confidence_score}
                  {student.reason === 'evidence_insufficient' ? '（画像完整度或可信度不足，建议先补充画像）' : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
