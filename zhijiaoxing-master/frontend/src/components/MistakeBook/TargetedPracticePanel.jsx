import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Target } from 'lucide-react'
import { mistakeBook } from '@/services/api'

export default function TargetedPracticePanel({ courseId }) {
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [completedCount, setCompletedCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [afterAccuracy, setAfterAccuracy] = useState(0)

  const fetchPlan = async () => {
    setLoading(true)
    try {
      const data = await mistakeBook.getTargetedPractice(courseId ? { course_id: courseId } : {})
      setPlan(data)
    } catch (err) {
      console.error('加载靶向练习失败', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const previewQuestions = useMemo(() => (plan?.recommended_questions || []).slice(0, 8), [plan])

  const submitFeedback = async () => {
    setFeedbackLoading(true)
    try {
      const data = await mistakeBook.submitTargetedFeedback({
        course_id: courseId || null,
        completed_count: Number(completedCount) || 0,
        wrong_count: Number(wrongCount) || 0,
        after_accuracy: Number(afterAccuracy) || 0,
      })
      setFeedback(data)
    } catch (err) {
      console.error('提交反馈失败', err)
      alert('提交反馈失败，请稍后重试')
    } finally {
      setFeedbackLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5" />“靶向治疗”练习推荐</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-10 flex items-center justify-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />生成推荐方案中</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric title="推荐题量" value={plan?.plan_metrics?.question_total || 0} />
              <Metric title="靶向知识点" value={plan?.plan_metrics?.target_tag_count || 0} />
              <Metric title="基线效果" value={`${Math.round(plan?.plan_metrics?.baseline_effectiveness || 0)}%`} />
              <Metric title="预期提升" value={`+${Math.round(plan?.plan_metrics?.expected_improvement || 0)}%`} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">阶段练习计划</p>
              {(plan?.stage_plan || []).map((stage) => (
                <div key={stage.phase} className="p-3 border rounded-lg bg-white">
                  <div className="flex justify-between items-center">
                    <p className="font-medium">阶段 {stage.phase} · {stage.name}</p>
                    <Badge variant="outline">{stage.question_count} 题 · {stage.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">目标：{stage.goal}</p>
                  <p className="text-sm text-gray-600 mt-1">重点知识点：{(stage.focus_tags || []).join('、') || '暂无'}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">推荐题目预览</p>
              <div className="space-y-2">
                {previewQuestions.map((q, idx) => (
                  <div key={`${q.assessment_id}-${q.question_index}-${idx}`} className="p-3 border rounded-lg bg-slate-50">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium">{idx + 1}. {q.question_content?.slice(0, 80) || '题目内容缺失'}</p>
                      <Badge variant="secondary">{q.phase_name} / {q.difficulty}</Badge>
                    </div>
                    <p className="text-xs text-gray-600">命中知识点：{(q.matched_tags || []).join('、') || '暂无'}</p>
                  </div>
                ))}
                {!previewQuestions.length && <p className="text-sm text-gray-500">暂无可推荐题目，建议先补充题库标签。</p>}
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-white">
              <p className="text-sm font-medium">练习效果跟踪</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input type="number" min="0" value={completedCount} onChange={(e) => setCompletedCount(e.target.value)} placeholder="完成题数" />
                <Input type="number" min="0" value={wrongCount} onChange={(e) => setWrongCount(e.target.value)} placeholder="错题数" />
                <Input type="number" min="0" max="100" value={afterAccuracy} onChange={(e) => setAfterAccuracy(e.target.value)} placeholder="本轮正确率(%)" />
              </div>
              <Button onClick={submitFeedback} disabled={feedbackLoading}>{feedbackLoading ? '提交中...' : '提交阶段反馈'}</Button>
              {feedback?.feedback && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-sm text-emerald-800">效果等级：{feedback.feedback.effect_level}</p>
                  <p className="text-sm text-emerald-700">准确率变化：{feedback.feedback.delta_accuracy}%</p>
                  <p className="text-sm text-emerald-700">建议：{feedback.feedback.advice}</p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ title, value }) {
  return (
    <div className="p-3 rounded-lg border bg-white">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
