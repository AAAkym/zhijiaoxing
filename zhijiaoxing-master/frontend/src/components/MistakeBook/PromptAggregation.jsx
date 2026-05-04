import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Target,
  Loader2,
  Sparkles,
  FileText,
  Brain,
  CheckCircle,
  XCircle,
  Zap,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Send,
  ChevronLeft,
  TrendingUp
} from 'lucide-react'
import { mistakeBook } from '@/services/api'

const PHASE_CONFIG = {
  1: { label: '基础纠偏', color: 'bg-green-100 text-green-700 border-green-300', icon: '🌱' },
  2: { label: '能力巩固', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: '💪' },
  3: { label: '冲刺迁移', color: 'bg-red-100 text-red-700 border-red-300', icon: '🚀' },
}

const DIFFICULTY_CONFIG = {
  easy: { label: '简单', color: 'bg-green-100 text-green-700', stars: 1 },
  medium: { label: '中等', color: 'bg-yellow-100 text-yellow-700', stars: 2 },
  hard: { label: '困难', color: 'bg-red-100 text-red-700', stars: 3 },
}

function resolveAnswerDisplay(answer, options) {
  if (answer === null || answer === undefined || answer === '') {
    return { display: '未作答', label: null, isResolved: false }
  }
  const answerStr = String(answer).trim()
  if (options && Array.isArray(options) && options.length > 0) {
    const idx = parseInt(answerStr, 10)
    if (!isNaN(idx) && idx >= 0 && idx < options.length) {
      const label = String.fromCharCode(65 + idx)
      const optionText = typeof options[idx] === 'string' ? options[idx] : String(options[idx])
      return { display: `${label}. ${optionText}`, label, optionText, index: idx, isResolved: true }
    }
    const letterMatch = answerStr.match(/^([A-Za-z])/)
    if (letterMatch) {
      const letter = letterMatch[1].toUpperCase()
      const idxFromLetter = letter.charCodeAt(0) - 65
      if (idxFromLetter >= 0 && idxFromLetter < options.length) {
        const optionText = typeof options[idxFromLetter] === 'string' ? options[idxFromLetter] : String(options[idxFromLetter])
        return { display: `${letter}. ${optionText}`, label: letter, optionText, index: idxFromLetter, isResolved: true }
      }
    }
  }
  if (/^[A-Za-z]$/.test(answerStr)) {
    return { display: answerStr.toUpperCase(), label: answerStr.toUpperCase(), isResolved: true }
  }
  return { display: answerStr, label: null, isResolved: false }
}

export default function PromptAggregation({ myCourses = [], onBack }) {
  const [currentView, setCurrentView] = useState('config')
  const [courseFilter, setCourseFilter] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [promptData, setPromptData] = useState(null)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [rawOutput, setRawOutput] = useState('')

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [startTime, setStartTime] = useState(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)

  const [practiceResults, setPracticeResults] = useState(null)
  const [completedCount, setCompletedCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [afterAccuracy, setAfterAccuracy] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  const abortControllerRef = useRef(null)

  const handleGenerate = useCallback(async () => {
    if (loading) {
      console.log('[PromptAggregation] 正在生成中，忽略重复请求')
      return
    }

    setLoading(true)
    setError(null)
    setCurrentView('generating')
    setRawOutput('')
    abortControllerRef.current = new AbortController()

    try {
      const response = await mistakeBook.generateTargetedPracticeStream(
        {
          course_id: courseFilter || null,
          question_count: questionCount,
        },
        abortControllerRef.current.signal
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `生成请求失败 (${response.status})`)
      }

      if (!response.body) {
        throw new Error('无法获取响应流')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                fullText += data.content
                setRawOutput(prev => prev + data.content)
              }
              if (data.done) {
                const questions = data.questions || []
                const parsed = questions.map((q, idx) => ({
                  id: idx + 1,
                  question: q.content || '',
                  type: 'choice',
                  options: q.options || [],
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation || '',
                  difficulty: q.difficulty || 'medium',
                  knowledgeTags: q.knowledge_tags || [],
                  phase: q.difficulty === 'easy' ? 1 : q.difficulty === 'medium' ? 2 : 3,
                  phaseName: q.difficulty === 'easy' ? '基础纠偏' : q.difficulty === 'medium' ? '能力巩固' : '冲刺迁移',
                  score: 10,
                }))

                setGeneratedQuestions(parsed)
                setPromptData({
                  knowledgeTags: [],
                  sourceCount: parsed.length,
                })
                setCurrentView('practice')
              }
              if (data.error) {
                throw new Error(data.error)
              }
            } catch (e) {
              if (e.name === 'AbortError') return
              if (e.message) throw e
              console.error('[PromptAggregation] JSON解析错误:', e)
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        console.log('[PromptAggregation] 请求被用户主动取消')
        return
      }
      console.error('生成靶向练习失败:', err)
      setError(err.message || '生成失败，请重试')
      setCurrentView('config')
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }, [courseFilter, questionCount, loading])

  useEffect(() => {
    if (!startTime) return
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        console.log('[PromptAggregation] 组件卸载，中止生成请求')
      }
    }
  }, [])

  const checkAnswer = useCallback((question, userAnswer) => {
    if (question.type === 'choice') {
      return typeof userAnswer === 'number' &&
        typeof question.correctAnswer === 'number' &&
        userAnswer === question.correctAnswer
    }
    return false
  }, [])

  const handleStartPractice = useCallback(() => {
    if (generatedQuestions.length === 0) {
      setError('暂无生成的题目')
      return
    }
    setAnswers({})
    setCurrentIndex(0)
    setStartTime(Date.now())
    setTimeElapsed(0)
    setPracticeResults(null)
    setCurrentView('practice')
  }, [generatedQuestions])

  const handleAnswerChange = useCallback((questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }, [])

  const handleSubmit = useCallback(() => {
    const unanswered = generatedQuestions.filter(q => answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === '')
    if (unanswered.length > 0 && !showConfirmSubmit) {
      setShowConfirmSubmit(true)
      return
    }

    const results = generatedQuestions.map(q => {
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
        knowledgeTags: q.knowledgeTags,
      }
    })

    const totalScore = results.reduce((sum, r) => sum + (r.isCorrect ? r.score : 0), 0)
    const maxScore = results.reduce((sum, q) => sum + q.score, 0)
    const correctCount = results.filter(r => r.isCorrect).length
    const wrongCountVal = results.filter(r => !r.isCorrect).length
    const accuracy = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

    setCompletedCount(correctCount + wrongCountVal)
    setWrongCount(wrongCountVal)
    setAfterAccuracy(accuracy)
    setPracticeResults({
      results,
      totalScore,
      maxScore,
      accuracy,
      correctCount,
      wrongCount: wrongCountVal,
      timeElapsed,
    })
    setCurrentView('result')
  }, [generatedQuestions, answers, showConfirmSubmit, checkAnswer, timeElapsed])

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

  if (currentView === 'generating') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回靶向治疗
          </Button>
        </div>

        <Card>
          <CardContent className="py-16 text-center">
            <Brain className="w-16 h-16 mx-auto text-purple-400 animate-pulse mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">正在基于错题生成靶向练习</h3>
            <p className="text-gray-500 mb-6">AI 正在分析错题模式，生成针对性题目...</p>
            <div className="max-w-md mx-auto bg-gray-100 rounded-lg p-4 text-left">
              <p className="text-xs text-gray-500 mb-2">生成进度：</p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
            {rawOutput && (
              <div className="mt-4 max-w-lg mx-auto bg-gray-50 rounded p-3 text-left max-h-40 overflow-y-auto">
                <p className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                  {rawOutput.slice(-500)}
                </p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-4">
              提示：生成过程可能需要几分钟，请耐心等待
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentView === 'practice') {
    return (
      <PracticeView
        questions={generatedQuestions}
        currentIndex={currentIndex}
        answers={answers}
        timeElapsed={timeElapsed}
        showConfirmSubmit={showConfirmSubmit}
        onAnswerChange={handleAnswerChange}
        onSetCurrentIndex={setCurrentIndex}
        onSubmit={handleSubmit}
        onBack={() => { setCurrentView('config'); setGeneratedQuestions([]) }}
        onCancelConfirm={() => setShowConfirmSubmit(false)}
      />
    )
  }

  if (currentView === 'result' && practiceResults) {
    return (
      <ResultView
        results={practiceResults}
        feedback={feedback}
        feedbackLoading={feedbackLoading}
        completedCount={completedCount}
        wrongCount={wrongCount}
        afterAccuracy={afterAccuracy}
        onSubmitFeedback={handleSubmitFeedback}
        onBackToPlan={() => { setCurrentView('config') }}
        onRetry={handleStartPractice}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回靶向治疗
        </Button>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-purple-600" />
          错题提示词汇总
        </h2>
      </div>

      <p className="text-gray-600">基于课程错题中的关键提示信息，提取错因模式并提交AI分析，生成针对性练习题</p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-500" />
            生成设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">选择课程</label>
              <Select value={courseFilter || '__all__'} onValueChange={(v) => setCourseFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="全部课程" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部课程</SelectItem>
                  {myCourses.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">生成题量</label>
              <Input
                type="number"
                min={5}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.min(20, Math.max(5, Number(e.target.value) || 10)))}
              />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-800 mb-2">生成说明</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>• 系统将提取错题中的关键提示信息（错误类型、错因分析、知识点标签）</li>
              <li>• AI 将根据错因模式生成针对性练习题</li>
              <li>• 题目分为三个难度层次：基础纠偏、能力巩固、冲刺迁移</li>
              <li>• 生成完成后可立即开始练习</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  提取提示词并生成练习
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            流程说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">1</div>
              <p className="text-sm font-medium">提取错题提示词</p>
              <p className="text-xs text-gray-500 mt-1">从错题中提取错因、知识点</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">2</div>
              <p className="text-sm font-medium">提交AI分析</p>
              <p className="text-xs text-gray-500 mt-1">AI分析错误模式与薄弱点</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">3</div>
              <p className="text-sm font-medium">生成新练习</p>
              <p className="text-xs text-gray-500 mt-1">针对性生成选择题</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">4</div>
              <p className="text-sm font-medium">开始练习</p>
              <p className="text-xs text-gray-500 mt-1">完成靶向巩固训练</p>
            </div>
          </div>
        </CardContent>
      </Card>
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
          <Button variant="outline" className="mt-4" onClick={onBack}>返回设置</Button>
        </CardContent>
      </Card>
    )
  }

  const questionType = currentQuestion.type || 'choice'
  const questionOptions = Array.isArray(currentQuestion.options) ? currentQuestion.options : []
  const currentAnswer = answers[currentQuestion.id]
  const phaseConf = PHASE_CONFIG[currentQuestion.phase] || PHASE_CONFIG[1]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回设置
        </Button>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Badge className={phaseConf.color}>{phaseConf.icon} {phaseConf.label}</Badge>
          <Badge variant="outline">{DIFFICULTY_CONFIG[currentQuestion.difficulty]?.label || '中等'}</Badge>
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
                <p className="font-medium">
                  选择题 · {currentQuestion.score} 分
                </p>
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
          </div>

          {questionOptions.length > 0 ? (
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
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>该题目缺少选项，请联系管理员</p>
            </div>
          )}

          {currentQuestion.knowledgeTags && currentQuestion.knowledgeTags.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">涉及知识点：</span>
              {currentQuestion.knowledgeTags.map((tag, idx) => (
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
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
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

function ResultView({ results, feedback, feedbackLoading, completedCount, wrongCount, afterAccuracy, onSubmitFeedback, onBackToPlan, onRetry }) {
  if (!results) return null

  const { totalScore, maxScore, accuracy, correctCount: correct, wrongCount: wrong, timeElapsed: elapsed } = results

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBackToPlan}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回设置
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
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{r.question}</p>
                      {!r.isCorrect && r.correctAnswer !== null && r.correctAnswer !== undefined && r.options && r.options.length > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          正确答案：{String.fromCharCode(65 + r.correctAnswer)}. {r.options[r.correctAnswer]}
                        </p>
                      )}
                      {r.explanation && (
                        <p className="text-xs text-gray-500 mt-1">解析：{r.explanation}</p>
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
              <input
                type="number"
                min="0"
                value={completedCount}
                onChange={(e) => setCompletedCount(Number(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">错题数</label>
              <input
                type="number"
                min="0"
                value={wrongCount}
                onChange={(e) => setWrongCount(Number(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">本轮正确率(%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={afterAccuracy}
                onChange={(e) => setAfterAccuracy(Number(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
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
        <Button variant="outline" onClick={onBackToPlan}>返回设置</Button>
        <Button onClick={onRetry} className="bg-purple-600 hover:bg-purple-700">
          再次练习
        </Button>
      </div>
    </div>
  )
}
