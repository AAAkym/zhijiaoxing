import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CodeEditor from '@/components/ui/CodeEditor'
import {
  Target,
  Loader2,
  RefreshCw,
  BookOpen,
  CheckCircle,
  XCircle,
  ChevronRight,
  Zap,
  Brain,
  ArrowLeft,
  Clock,
  Star,
  AlertCircle,
  Sparkles,
  TrendingUp,
  BarChart3,
  Send,
  ChevronLeft,
  Flag,
  FileText,
  Code,
  Play,
  ListChecks
} from 'lucide-react'
import { mistakeBook } from '@/services/api'
import PromptAggregation from './PromptAggregation'

const PHASE_CONFIG = {
  1: { label: '基础纠偏', color: 'bg-green-100 text-green-700 border-green-300', icon: '🌱', stars: 1 },
  2: { label: '能力巩固', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: '💪', stars: 2 },
  3: { label: '冲刺迁移', color: 'bg-red-100 text-red-700 border-red-300', icon: '🚀', stars: 3 },
}

const DIFFICULTY_CONFIG = {
  easy: { label: '简单', color: 'bg-green-100 text-green-700', stars: 1 },
  medium: { label: '中等', color: 'bg-yellow-100 text-yellow-700', stars: 2 },
  hard: { label: '困难', color: 'bg-red-100 text-red-700', stars: 3 },
}

export default function TargetedTherapy({ myCourses = [], initialContext = null }) {
  const [currentView, setCurrentView] = useState('plan')
  const [showPromptAggregation, setShowPromptAggregation] = useState(false)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [courseFilter, setCourseFilter] = useState('')
  const [activePhase, setActivePhase] = useState('all')
  const [highlightedTags, setHighlightedTags] = useState([])

  const [practiceQuestions, setPracticeQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [startTime, setStartTime] = useState(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)

  const [feedback, setFeedback] = useState(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [afterAccuracy, setAfterAccuracy] = useState(0)

  const [practiceResults, setPracticeResults] = useState(null)

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000)
      const params = {}
      if (courseFilter) params.course_id = courseFilter
      params._signal = controller.signal
      const data = await mistakeBook.getTargetedPractice(params)
      clearTimeout(timeoutId)
      setPlan(data)
    } catch (err) {
      console.error('加载靶向练习方案失败', err)
      if (err.name === 'AbortError') {
        setError('AI生成练习方案超时，请稍后重试')
      } else {
        setError(`加载靶向练习方案失败：${err.message || '请稍后重试'}`)
      }
    } finally {
      setLoading(false)
    }
  }, [courseFilter])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  useEffect(() => {
    if (initialContext) {
      if (initialContext.courseId) {
        setCourseFilter(String(initialContext.courseId))
      }
      if (initialContext.knowledgeTags && initialContext.knowledgeTags.length > 0) {
        setHighlightedTags(initialContext.knowledgeTags)
      }
      setCurrentView('plan')
    }
  }, [initialContext])

  useEffect(() => {
    if (plan && highlightedTags.length > 0 && plan.target_tags) {
      console.log('[TargetedTherapy] 自动高亮匹配的知识点标签:', highlightedTags)
    }
  }, [plan, highlightedTags])

  useEffect(() => {
    if (!startTime) return
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  const groupedQuestions = useMemo(() => {
    if (!plan?.recommended_questions) return []
    const groups = {}
    plan.recommended_questions.forEach(q => {
      const phase = q.phase || (q.difficulty === 'easy' ? 1 : q.difficulty === 'hard' ? 3 : 2)
      if (!groups[phase]) {
        groups[phase] = {
          phase,
          phaseName: q.phase_name || (phase === 1 ? '基础纠偏' : phase === 3 ? '冲刺迁移' : '能力巩固'),
          difficulty: q.difficulty || 'medium',
          questions: []
        }
      }
      groups[phase].questions.push(q)
    })
    return Object.values(groups).sort((a, b) => a.phase - b.phase)
  }, [plan])

  const filteredQuestions = useMemo(() => {
    if (!plan?.recommended_questions) return []
    if (activePhase === 'all') return plan.recommended_questions
    return plan.recommended_questions.filter(q => {
      const phase = q.phase || (q.difficulty === 'easy' ? 1 : q.difficulty === 'hard' ? 3 : 2)
      return phase === Number(activePhase)
    })
  }, [plan, activePhase])

  const phaseStats = useMemo(() => {
    if (!plan?.recommended_questions) return {}
    const stats = {}
    plan.recommended_questions.forEach(q => {
      if (!stats[q.phase]) stats[q.phase] = { total: 0, answered: 0, correct: 0 }
      stats[q.phase].total += 1
    })
    return stats
  }, [plan])

  const handleStartPractice = useCallback(() => {
    const seenKnowledgePoints = new Set()
    const questions = filteredQuestions.map((q, idx) => {
      const qType = q.question_type || q.type || 'choice'
      const isProgramming = qType === 'programming'
      const knowledgeTags = q.knowledge_tags || q.matched_tags || []
      const primaryTag = knowledgeTags[0] || ''

      if (primaryTag && seenKnowledgePoints.has(primaryTag)) {
        return null
      }
      if (primaryTag) {
        seenKnowledgePoints.add(primaryTag)
      }

      return {
        id: idx + 1,
        question: q.question_content || q.content || '',
        type: isProgramming ? 'programming' : (qType === 'choice' ? 'choice' : 'essay'),
        options: q.options || [],
        score: q.score || (isProgramming ? 25 : 10),
        correctAnswer: q.correctAnswer ?? q.correct_answer ?? 0,
        explanation: q.explanation || '',
        phase: q.phase,
        phaseName: q.phase_name,
        difficulty: q.difficulty,
        matchedTags: q.matched_tags || q.knowledge_tags || [],
        matchScore: q.match_score,
        language: q.language || 'python',
        starter_code: q.starter_code || '',
        standard_answer: q.standard_answer || '',
        test_cases: q.test_cases || [],
      }
    }).filter(q => q !== null && q.question.trim() !== '')

    if (questions.length === 0) {
      setError('暂无可练习的题目，请先确保题库中有带知识点标签的题目')
      return
    }

    setPracticeQuestions(questions)
    setAnswers({})
    setCurrentIndex(0)
    setStartTime(Date.now())
    setTimeElapsed(0)
    setPracticeResults(null)
    setCurrentView('practice')
  }, [filteredQuestions])

  const handleAnswerChange = useCallback((questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }, [])

  const checkAnswer = useCallback((question, userAnswer) => {
    if (question.type === 'choice') {
      return typeof userAnswer === 'number' &&
        typeof question.correctAnswer === 'number' &&
        userAnswer === question.correctAnswer
    }
    return false
  }, [])

  const handleSubmit = useCallback(() => {
    const unanswered = practiceQuestions.filter(q => {
      const ans = answers[q.id]
      if (q.type === 'programming') {
        return !ans || !ans.code
      }
      return ans === undefined || ans === null || ans === ''
    })
    if (unanswered.length > 0 && !showConfirmSubmit) {
      setShowConfirmSubmit(true)
      return
    }

    const results = practiceQuestions.map(q => {
      const userAnswer = answers[q.id]
      const isCorrect = checkAnswer(q, userAnswer)
      return {
        questionId: q.id,
        question: q.question,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        score: q.score,
        explanation: q.explanation,
        options: q.options,
        phase: q.phase,
        phaseName: q.phaseName,
        difficulty: q.difficulty,
        matchedTags: q.matchedTags,
        type: q.type,
        standard_answer: q.standard_answer,
        language: q.language,
      }
    })

    const totalScore = results.reduce((sum, r) => sum + (r.isCorrect ? r.score : 0), 0)
    const maxScore = results.reduce((sum, q) => sum + q.score, 0)
    const correctCount = results.filter(r => r.isCorrect).length
    const wrongCount = results.filter(r => !r.isCorrect).length
    const accuracy = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

    setCompletedCount(correctCount + wrongCount)
    setWrongCount(wrongCount)
    setAfterAccuracy(accuracy)
    setPracticeResults({
      results,
      totalScore,
      maxScore,
      accuracy,
      correctCount,
      wrongCount,
      timeElapsed,
    })

    setCurrentView('result')
  }, [practiceQuestions, answers, showConfirmSubmit, checkAnswer, timeElapsed])

  const handleSubmitFeedback = async () => {
    setFeedbackLoading(true)
    try {
      const data = await mistakeBook.submitTargetedFeedback({
        course_id: courseFilter || null,
        completed_count: completedCount,
        wrong_count: wrongCount,
        after_accuracy: afterAccuracy,
      })
      setFeedback(data)
    } catch (err) {
      console.error('提交反馈失败', err)
    } finally {
      setFeedbackLoading(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (showPromptAggregation) {
    return (
      <PromptAggregation
        myCourses={myCourses}
        onBack={() => setShowPromptAggregation(false)}
      />
    )
  }

  if (currentView === 'practice') {
    return (
      <PracticeView
        questions={practiceQuestions}
        currentIndex={currentIndex}
        answers={answers}
        timeElapsed={timeElapsed}
        showConfirmSubmit={showConfirmSubmit}
        onAnswerChange={handleAnswerChange}
        onSetCurrentIndex={setCurrentIndex}
        onSubmit={handleSubmit}
        onBack={() => { setCurrentView('plan'); setPracticeQuestions([]) }}
        onCancelConfirm={() => setShowConfirmSubmit(false)}
      />
    )
  }

  if (currentView === 'result') {
    return (
      <ResultView
        results={practiceResults}
        feedback={feedback}
        feedbackLoading={feedbackLoading}
        completedCount={completedCount}
        wrongCount={wrongCount}
        afterAccuracy={afterAccuracy}
        onCompletedCountChange={setCompletedCount}
        onWrongCountChange={setWrongCount}
        onAfterAccuracyChange={setAfterAccuracy}
        onSubmitFeedback={handleSubmitFeedback}
        onBackToPlan={() => { setCurrentView('plan'); fetchPlan() }}
        onRetry={handleStartPractice}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-7 h-7 text-purple-600" />
            靶向治疗
          </h2>
          {initialContext ? (
            <p className="text-gray-600 mt-1">针对「{initialContext.questionPreview || '当前错题'}」的专项练习</p>
          ) : (
            <p className="text-gray-600 mt-1">基于学习画像与错题智能分析，AI精准生成个性化练习方案</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            onClick={() => setShowPromptAggregation(true)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            错题提示词汇总
          </Button>
          {myCourses.length > 0 && (
            <Select value={courseFilter || '__all__'} onValueChange={(v) => setCourseFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-44 bg-white">
                <SelectValue placeholder="全部课程" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部课程</SelectItem>
                {myCourses.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={fetchPlan} disabled={loading} className="gap-1">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新方案
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
          <p className="text-gray-500">正在分析学习画像与错题数据，AI生成个性化练习方案...</p>
        </div>
      ) : plan ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<FileText className="w-5 h-5 text-purple-600" />}
              title="推荐题量"
              value={plan.plan_metrics?.question_total || 0}
              bgColor="bg-purple-50"
            />
            <MetricCard
              icon={<Brain className="w-5 h-5 text-blue-600" />}
              title="靶向知识点"
              value={plan.plan_metrics?.target_tag_count || 0}
              bgColor="bg-blue-50"
            />
            <MetricCard
              icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
              title="基线效果"
              value={`${Math.round(plan.plan_metrics?.baseline_effectiveness || 0)}%`}
              bgColor="bg-amber-50"
            />
            <MetricCard
              icon={<Zap className="w-5 h-5 text-green-600" />}
              title="预期提升"
              value={`+${Math.round(plan.plan_metrics?.expected_improvement || 0)}%`}
              bgColor="bg-green-50"
            />
          </div>

          {plan.target_tags && plan.target_tags.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-500" />
                  薄弱知识点定位
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {plan.target_tags.map((tag, idx) => {
                    const isHighlighted = highlightedTags.length > 0 && highlightedTags.some(
                      ht => tag.toLowerCase().includes(ht.toLowerCase()) || ht.toLowerCase().includes(tag.toLowerCase())
                    )
                    return (
                      <Badge
                        key={idx}
                        className={`px-3 py-1 text-sm ${
                          isHighlighted
                            ? 'bg-purple-100 text-purple-700 border-2 border-purple-300 shadow-md'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isHighlighted && <Target className="w-3 h-3 mr-1 inline" />}
                        {tag}
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-500" />
                阶段练习计划
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(plan.stage_plan || []).map((stage) => {
                  const phaseConf = PHASE_CONFIG[stage.phase] || PHASE_CONFIG[1]
                  const stats = phaseStats[stage.phase] || { total: 0 }
                  return (
                    <div key={stage.phase} className={`p-4 border rounded-lg ${phaseConf.color} border-opacity-50`}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{phaseConf.icon}</span>
                          <p className="font-semibold">阶段 {stage.phase} · {stage.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-white">
                            {stage.question_count} 题 · {DIFFICULTY_CONFIG[stage.difficulty]?.label || stage.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm opacity-80">目标：{stage.goal}</p>
                      <p className="text-sm opacity-80 mt-1">重点知识点：{(stage.focus_tags || []).join('、') || '暂无'}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  推荐题组
                  {plan.ai_generated && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs ml-1">
                      <Sparkles className="w-3 h-3 mr-1" />AI生成
                    </Badge>
                  )}
                </CardTitle>
                <Badge variant="outline" className="text-sm">{groupedQuestions.length} 个阶段</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {groupedQuestions.length > 0 ? (
                <div className="space-y-4">
                  {groupedQuestions.map((group) => {
                    const phaseConf = PHASE_CONFIG[group.phase] || PHASE_CONFIG[1]
                    const diffConf = DIFFICULTY_CONFIG[group.difficulty] || DIFFICULTY_CONFIG.medium
                    return (
                      <div key={group.phase} className="border rounded-xl overflow-hidden">
                        <div className={`px-4 py-3 ${phaseConf.color} border-b`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{phaseConf.icon}</span>
                              <span className="font-semibold">阶段 {group.phase} · {group.phaseName}</span>
                              <Badge className={`${diffConf.color} text-xs`}>{diffConf.label}</Badge>
                            </div>
                            <span className="text-sm font-medium">{group.questions.length} 题</span>
                          </div>
                        </div>
                        <div className="bg-white divide-y">
                          {group.questions.map((q, idx) => {
                            const qType = q.question_type || q.type || 'choice'
                            const isProg = qType === 'programming'
                            return (
                              <div key={`${q.assessment_id || ''}-${q.question_index || ''}-${idx}`} className="p-3 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-medium text-gray-400 w-6 pt-0.5">{idx + 1}.</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <Badge variant="outline" className="text-xs py-0">
                                        {isProg ? <Code className="w-3 h-3 mr-0.5" /> : <ListChecks className="w-3 h-3 mr-0.5" />}
                                        {isProg ? '编程' : '选择'}
                                      </Badge>
                                    </div>
                                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{q.question_content || q.content || '题目内容缺失'}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">知识点：{(q.matched_tags || q.knowledge_tags || []).join('、') || '暂无'}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>暂无可推荐题目</p>
                  <p className="text-sm mt-1">请先完成练习并积累错题记录，AI将根据薄弱点生成个性化题目</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-8"
              onClick={handleStartPractice}
              disabled={!filteredQuestions.length}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              开始全部练习 ({filteredQuestions.length} 题)
            </Button>
            {groupedQuestions.length > 1 && (
              <Button
                size="lg"
                variant="outline"
                className="px-8"
                onClick={() => {
                  const firstGroup = groupedQuestions[0]
                  if (firstGroup) {
                    const seenKP = new Set()
                    const questions = firstGroup.questions.map((q, idx) => {
                      const qType = q.question_type || q.type || 'choice'
                      const isProgramming = qType === 'programming'
                      const knowledgeTags = q.knowledge_tags || q.matched_tags || []
                      const primaryTag = knowledgeTags[0] || ''
                      if (primaryTag && seenKP.has(primaryTag)) return null
                      if (primaryTag) seenKP.add(primaryTag)
                      return {
                        id: idx + 1,
                        question: q.question_content || q.content || '',
                        type: isProgramming ? 'programming' : (qType === 'choice' ? 'choice' : 'essay'),
                        options: q.options || [],
                        score: q.score || (isProgramming ? 25 : 10),
                        correctAnswer: q.correctAnswer ?? q.correct_answer ?? 0,
                        explanation: q.explanation || '',
                        phase: q.phase,
                        phaseName: q.phase_name,
                        difficulty: q.difficulty,
                        matchedTags: q.matched_tags || q.knowledge_tags || [],
                        matchScore: q.match_score,
                        language: q.language || 'python',
                        starter_code: q.starter_code || '',
                        standard_answer: q.standard_answer || '',
                        test_cases: q.test_cases || [],
                      }
                    }).filter(q => q !== null && q.question.trim() !== '')
                    setPracticeQuestions(questions)
                    setAnswers({})
                    setCurrentIndex(0)
                    setStartTime(Date.now())
                    setTimeElapsed(0)
                    setPracticeResults(null)
                    setCurrentView('practice')
                  }
                }}
              >
                从基础阶段开始 ({groupedQuestions[0]?.questions?.length || 0} 题)
              </Button>
            )}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">暂无靶向练习数据</p>
            <p className="text-sm text-gray-400 mt-2">请先完成练习并积累错题记录，系统将自动分析薄弱点并生成练习方案</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PracticeView({ questions, currentIndex, answers, timeElapsed, showConfirmSubmit, onAnswerChange, onSetCurrentIndex, onSubmit, onBack, onCancelConfirm }) {
  const safeQuestions = Array.isArray(questions) ? questions : []
  const safeIndex = typeof currentIndex === 'number' && !isNaN(currentIndex)
    ? Math.max(0, Math.min(currentIndex, safeQuestions.length - 1))
    : 0
  const currentQuestion = safeQuestions[safeIndex]
  const answeredCount = Object.keys(answers).length
  const progress = safeQuestions.length > 0 ? (answeredCount / safeQuestions.length) * 100 : 0

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">暂无题目数据</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>返回方案</Button>
        </CardContent>
      </Card>
    )
  }

  const questionType = currentQuestion.type || 'essay'
  const isProgramming = questionType === 'programming'
  const questionOptions = Array.isArray(currentQuestion.options) ? currentQuestion.options : []
  const currentAnswer = answers[currentQuestion.id]
  const phaseConf = PHASE_CONFIG[currentQuestion.phase] || PHASE_CONFIG[1]

  const typeLabel = isProgramming ? '编程题' : (questionType === 'choice' ? '选择题' : '简答题')
  const typeIcon = isProgramming ? <Code className="w-4 h-4" /> : (questionType === 'choice' ? <ListChecks className="w-4 h-4" /> : null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回方案
        </Button>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Badge className={phaseConf.color}>{phaseConf.icon} {phaseConf.label}</Badge>
          <Badge variant="outline">{DIFFICULTY_CONFIG[currentQuestion.difficulty]?.label || '中等'}</Badge>
          <Badge variant="outline" className="flex items-center gap-1">{typeIcon}{typeLabel}</Badge>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                {safeIndex + 1}
              </div>
              <div>
                <p className="text-purple-100 text-sm">第 {safeIndex + 1} 题 / 共 {safeQuestions.length} 题</p>
                <p className="font-medium">{typeLabel} · {currentQuestion.score} 分</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{Math.floor(timeElapsed / 60).toString().padStart(2, '0')}:{(timeElapsed % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-purple-500 mb-6">
            <p className="text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">
              {currentQuestion.question || '（题目内容缺失）'}
            </p>
            {isProgramming && currentQuestion.test_cases?.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-gray-600">示例：</p>
                {currentQuestion.test_cases.slice(0, 2).map((tc, idx) => (
                  <div key={idx} className="bg-white rounded p-2 text-sm font-mono">
                    <span className="text-gray-500">输入：</span>{tc.input}
                    <span className="text-gray-500 ml-3">输出：</span>{tc.expected_output}
                  </div>
                ))}
              </div>
            )}
          </div>

          {questionType === 'choice' && questionOptions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 mb-3">请选择正确答案：</p>
              {questionOptions.map((option, index) => {
                const isSelected = currentAnswer === index
                const optionLabel = String.fromCharCode(65 + index)
                return (
                  <button
                    key={`choice-${index}`}
                    onClick={() => onAnswerChange(currentQuestion.id, index)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                    }`}
                    type="button"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        isSelected ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {optionLabel}
                      </div>
                      <p className={`text-base leading-relaxed pt-1 ${isSelected ? 'text-purple-900 font-medium' : 'text-gray-700'}`}>
                        {option || '选项内容'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : isProgramming ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{(currentQuestion.language || 'python').toUpperCase()}</Badge>
              </div>
              <CodeEditor
                value={typeof currentAnswer === 'object' ? currentAnswer?.code || '' : (currentAnswer || '')}
                onChange={(code) => onAnswerChange(currentQuestion.id, { code, language: currentQuestion.language || 'python' })}
                language={currentQuestion.language || 'python'}
                height="300px"
                placeholder="在这里编写代码..."
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 mb-3">请作答：</p>
              <textarea
                value={currentAnswer || ''}
                onChange={(e) => onAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="在此输入你的答案..."
                rows={6}
                className="w-full rounded-lg border border-gray-300 p-3 text-base focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
              />
            </div>
          )}

          {currentQuestion.matchedTags && currentQuestion.matchedTags.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">涉及知识点：</span>
              {currentQuestion.matchedTags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => onSetCurrentIndex(safeIndex - 1)} disabled={safeIndex === 0} className="gap-1">
              <ChevronLeft className="w-4 h-4" />
              上一题
            </Button>
            <div className="flex gap-1 flex-wrap justify-center max-w-[300px]">
              {safeQuestions.slice(0, 15).map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== ''
                const isCurrent = idx === safeIndex
                return (
                  <button
                    key={`nav-${q.id}-${idx}`}
                    onClick={() => onSetCurrentIndex(idx)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-all ${
                      isCurrent
                        ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                        : isAnswered
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border'
                    }`}
                    type="button"
                  >
                    {idx + 1}
                  </button>
                )
              })}
              {safeQuestions.length > 15 && (
                <span className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">+{safeQuestions.length - 15}</span>
              )}
            </div>
            {safeIndex < safeQuestions.length - 1 ? (
              <Button onClick={() => onSetCurrentIndex(safeIndex + 1)} className="gap-1 bg-purple-600 hover:bg-purple-700">
                下一题
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={onSubmit} className="gap-1 bg-green-600 hover:bg-green-700">
                <Send className="w-4 h-4" />
                提交答案
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">答题进度</span>
          <span className="text-sm font-medium">{answeredCount} / {safeQuestions.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
                <h3 className="text-lg font-semibold">确认提交</h3>
                <p className="text-gray-500 mt-2">
                  还有 <span className="font-bold text-red-500">{safeQuestions.length - answeredCount}</span> 道题目未作答
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={onCancelConfirm}>继续答题</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onSubmit}>确认提交</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function ResultView({ results, feedback, feedbackLoading, completedCount, wrongCount, afterAccuracy, onCompletedCountChange, onWrongCountChange, onAfterAccuracyChange, onSubmitFeedback, onBackToPlan, onRetry }) {
  if (!results) return null

  const { totalScore, maxScore, accuracy, correctCount: correct, wrongCount: wrong, timeElapsed: elapsed } = results

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBackToPlan}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回方案
        </Button>
      </div>

      <Card className="border-2 border-purple-200">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-white mb-4 ${
              accuracy >= 80 ? 'bg-green-500' : accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}>
              {accuracy}%
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {accuracy >= 80 ? '🎉 表现优秀！' : accuracy >= 60 ? '💪 继续加油！' : '📚 需要加强'}
            </h3>
            <p className="text-gray-500 mt-1">得分 {totalScore} / {maxScore}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-700">{correct}</p>
              <p className="text-xs text-green-600">正确</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700">{wrong}</p>
              <p className="text-xs text-red-600">错误</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-700">{Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}</p>
              <p className="text-xs text-blue-600">用时</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <Target className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-purple-700">{results.results?.length || 0}</p>
              <p className="text-xs text-purple-600">总题数</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">答题详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(results.results || []).map((r, idx) => {
              const phaseConf = PHASE_CONFIG[r.phase] || PHASE_CONFIG[1]
              const isProg = r.type === 'programming'
              return (
                <div key={idx} className={`p-3 border-l-4 rounded-r-lg ${
                  r.isCorrect ? 'border-green-500 bg-green-50/50' : 'border-red-500 bg-red-50/50'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{idx + 1}.</span>
                        {r.isCorrect ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <Badge className={`${phaseConf.color} text-xs`}>{phaseConf.icon} {r.phaseName}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {isProg ? <Code className="w-3 h-3 mr-1" /> : <ListChecks className="w-3 h-3 mr-1" />}
                          {isProg ? '编程题' : '选择题'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{r.question}</p>
                      {!isProg && !r.isCorrect && r.correctAnswer !== null && r.correctAnswer !== undefined && r.options && r.options.length > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          正确答案：{String.fromCharCode(65 + r.correctAnswer)}. {r.options[r.correctAnswer]}
                        </p>
                      )}
                      {isProg && r.standard_answer && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-green-600 mb-1">参考解答：</p>
                          <pre className="bg-green-50 border border-green-200 rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                            {r.standard_answer}
                          </pre>
                        </div>
                      )}
                      {isProg && r.userAnswer?.code && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-red-600 mb-1">你的代码：</p>
                          <pre className="bg-red-50 border border-red-200 rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                            {r.userAnswer.code}
                          </pre>
                        </div>
                      )}
                      {r.explanation && (
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2">
                          <p className="text-xs font-medium text-amber-800 mb-0.5">解析</p>
                          <p className="text-xs text-amber-700 whitespace-pre-wrap">{r.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            练习效果跟踪
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">完成题数</label>
              <Input type="number" min="0" value={completedCount} onChange={(e) => onCompletedCountChange(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">错题数</label>
              <Input type="number" min="0" value={wrongCount} onChange={(e) => onWrongCountChange(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">本轮正确率(%)</label>
              <Input type="number" min="0" max="100" value={afterAccuracy} onChange={(e) => onAfterAccuracyChange(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Button onClick={onSubmitFeedback} disabled={feedbackLoading} className="bg-green-600 hover:bg-green-700">
            {feedbackLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
            提交阶段反馈
          </Button>
          {feedback?.feedback && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-sm text-emerald-800 font-medium">效果等级：{feedback.feedback.effect_level}</p>
              <p className="text-sm text-emerald-700">准确率变化：{feedback.feedback.delta_accuracy}%</p>
              <p className="text-sm text-emerald-700">建议：{feedback.feedback.advice}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={onBackToPlan}>返回方案</Button>
        <Button onClick={onRetry} className="bg-purple-600 hover:bg-purple-700">
          <RefreshCw className="w-4 h-4 mr-2" />
          再次练习
        </Button>
      </div>
    </div>
  )
}

function MetricCard({ icon, title, value, bgColor }) {
  return (
    <Card className={`${bgColor} border-0`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="text-xs text-gray-600">{title}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
