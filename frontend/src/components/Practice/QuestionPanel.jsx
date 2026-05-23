import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import CodeEditor from '@/components/ui/CodeEditor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  Clock, 
  Target,
  AlertCircle,
  CheckCircle,
  BookMarked,
  Send
} from 'lucide-react'
import { usePractice } from './PracticeContext'

const isEdge = typeof window !== 'undefined' && /Edg/.test(window.navigator.userAgent)

export default function QuestionPanel({ onSubmit }) {
  const {
    selectedPractice,
    questions,
    currentIndex,
    answers,
    markedQuestions,
    startTime,
    setAnswer,
    setCurrentIndex,
    toggleMark,
    isSubmitting
  } = usePractice()

  const [timeElapsed, setTimeElapsed] = useState(0)
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)
  const panelRef = useRef(null)
  const isSubmittingRef = useRef(null)

  // ========== 边界安全检查：防止 currentIndex 越界导致黑屏 ==========
  // 修复根因：当 questions 数组因上游 filter 操作长度减少时（如第4题被过滤掉），
  // currentIndex=3 会越界导致 currentQuestion 为 undefined，引发黑屏
  const safeQuestions = Array.isArray(questions) ? questions : []
  const safeIndex = typeof currentIndex === 'number' && !isNaN(currentIndex)
    ? Math.max(0, Math.min(currentIndex, safeQuestions.length - 1))
    : 0

  // 如果检测到索引越界，自动修正并输出警告日志
  if (safeQuestions.length > 0 && currentIndex !== safeIndex) {
    console.warn(
      `[QuestionPanel] 索引越界已自动修正: currentIndex=${currentIndex}, ` +
      `questions.length=${safeQuestions.length}, 修正为 safeIndex=${safeIndex}`
    )
  }

  const currentQuestion = safeQuestions[safeIndex]

  // 调试日志：帮助定位第四题黑屏问题
  if (process.env.NODE_ENV === 'development') {
    console.log(`[QuestionPanel] 渲染状态:`, {
      currentIndex,
      safeIndex,
      questionsLength: safeQuestions.length,
      hasCurrentQuestion: !!currentQuestion,
      questionId: currentQuestion?.id,
      questionType: currentQuestion?.type,
      hasOptions: Array.isArray(currentQuestion?.options) && currentQuestion.options.length > 0
    })
  }
  const answeredCount = Object.keys(answers).length
  // 使用 safeQuestions 防止 questions 为非数组时崩溃
  const progress = safeQuestions.length > 0 ? (answeredCount / safeQuestions.length) * 100 : 0

  useEffect(() => {
    const timer = setInterval(() => {
      if (startTime) {
        setTimeElapsed(Math.floor((Date.now() - startTime) / 1000))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime])
  
  useEffect(() => {
    if (isEdge && panelRef.current) {
      panelRef.current.focus()
    }
  }, [currentIndex])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswerChange = useCallback((answer) => {
    if (currentQuestion) {
      setAnswer(currentQuestion.id, answer)
    }
  }, [currentQuestion, setAnswer])

  const handlePrevious = useCallback(() => {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1)
    }
  }, [safeIndex, setCurrentIndex])

  const handleNext = useCallback(() => {
    // 使用 safeQuestions.length 防止越界
    if (safeIndex < safeQuestions.length - 1) {
      setCurrentIndex(safeIndex + 1)
    }
  }, [safeIndex, safeQuestions.length, setCurrentIndex])

  const handleJumpTo = useCallback((index) => {
    // 增强边界检查：确保跳转目标在有效范围内
    if (typeof index === 'number' && index >= 0 && index < safeQuestions.length) {
      setCurrentIndex(index)
    } else {
      console.warn(`[QuestionPanel] handleJumpTo 无效索引: ${index}, 有效范围: 0-${safeQuestions.length - 1}`)
    }
  }, [safeQuestions.length, setCurrentIndex])

  const checkAnswer = useCallback((question, userAnswer) => {
    if (!question) return false
    if (question.type === 'choice') {
      return typeof userAnswer === 'number' && 
             typeof question.correctAnswer === 'number' && 
             userAnswer === question.correctAnswer
    }
    if (question.type === 'programming') {
      return false
    }
    return false
  }, [])

  const handleSubmit = useCallback(() => {
    if (isSubmittingRef.current) {
      return
    }

    // 安全检查：确保有有效题目数据
    if (!Array.isArray(safeQuestions) || safeQuestions.length === 0) {
      console.error('[QuestionPanel] handleSubmit: 无有效题目数据')
      return
    }

    // 使用 safeQuestions 进行过滤，防止 undefined 崩溃
    const unanswered = safeQuestions.filter(q => {
      if (!q || q.id === undefined || q.id === null) return false
      const answer = answers[q.id]
      return answer === undefined || answer === null || answer === ''
    })
    
    if (unanswered.length > 0 && !showConfirmSubmit) {
      setShowConfirmSubmit(true)
      return
    }
    
    isSubmittingRef.current = true
    
    try {
      const perQuestionScore = safeQuestions.length > 0 ? 100 / safeQuestions.length : 0
      const results = safeQuestions.map(q => {
        // 对每道题做空值保护，防止字段缺失导致崩溃
        if (!q || q.id === undefined) {
          console.warn('[QuestionPanel] handleSubmit: 发现无效题目数据，已跳过', q)
          return null
        }
        const userAnswer = answers[q.id]
        const isCorrect = checkAnswer(q, userAnswer)

        return {
          questionId: q.id,
          question: q.question || '',
          userAnswer: userAnswer !== undefined ? userAnswer : null,
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : null,
          isCorrect: isCorrect,
          score: perQuestionScore,
          explanation: q.explanation || '',
          options: Array.isArray(q.options) ? q.options : [],
          type: q.type || 'essay',
          code: q.type === 'programming' ? (typeof userAnswer === 'object' ? userAnswer.code : userAnswer) || '' : undefined,
          language: q.type === 'programming' ? (typeof userAnswer === 'object' ? userAnswer.language : q.language) || 'python' : undefined
        }
      }).filter(Boolean)

      const totalScore = results.reduce((sum, r) => sum + (r.isCorrect ? r.score : 0), 0)
      const maxScore = 100
      
      console.log('QuestionPanel handleSubmit - results:', results)
      console.log('QuestionPanel handleSubmit - totalScore:', totalScore, 'maxScore:', maxScore)
      
      onSubmit({
        results,
        totalScore,
        maxScore,
        timeElapsed,
        answeredCount,
        totalQuestions: safeQuestions.length
      })
    } catch (error) {
      console.error('Submit error:', error)
      isSubmittingRef.current = false
    }
  }, [safeQuestions, answers, showConfirmSubmit, onSubmit, timeElapsed, answeredCount, checkAnswer])

  // ========== 空状态保护：处理所有可能的异常情况 ==========
  if (!currentQuestion) {
    // 区分不同的空状态原因，提供更有用的提示信息
    if (!Array.isArray(safeQuestions) || safeQuestions.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 font-medium">暂无题目数据</p>
            <p className="text-sm text-gray-400 mt-2">请选择一套练习开始答题</p>
          </CardContent>
        </Card>
      )
    }

    // 题目数组非空但当前索引指向无效题目（理论上被 safeIndex 修正后不应到达此处）
    console.error(
      `[QuestionPanel] 异常状态: questions.length=${safeQuestions.length}, ` +
      `currentIndex=${currentIndex}, safeIndex=${safeIndex}, currentQuestion 为空`
    )
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
          <p className="text-gray-500 font-medium">题目加载异常</p>
          <p className="text-sm text-gray-400 mt-2">
            第 {currentIndex + 1} 题数据无效（共 {safeQuestions.length} 题）
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setCurrentIndex(0)}
          >
            返回第一题
          </Button>
        </CardContent>
      </Card>
    )
  }

  const currentAnswer = answers[currentQuestion?.id]

  // 对 currentQuestion 各字段做防御性取值，防止 undefined 崩溃
  const questionId = currentQuestion?.id ?? 'unknown'
  const questionType = currentQuestion?.type || 'essay'
  const questionText = currentQuestion?.question || currentQuestion?.title || '（题目内容缺失）'
  const questionScore = typeof currentQuestion?.score === 'number' ? currentQuestion.score : 10
  const questionOptions = Array.isArray(currentQuestion?.options) ? currentQuestion.options : []

  return (
    <div 
      ref={panelRef}
      className="space-y-4"
      tabIndex={-1}
      style={isEdge ? { outline: 'none' } : {}}
    >
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                  {safeIndex + 1}
                </div>
                <div>
                  <p className="text-blue-100 text-sm">第 {safeIndex + 1} 题 / 共 {safeQuestions.length} 题</p>
                  <p className="font-medium">
                    {questionType === 'choice' ? '选择题' :
                     questionType === 'fill' ? '填空题' :
                     questionType === 'programming' ? '编程题' : '简答题'}
                    &middot; {questionScore} 分
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(timeElapsed)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={`text-white hover:bg-white/20 ${markedQuestions.has(questionId) ? 'bg-white/20' : ''}`}
                onClick={() => toggleMark(questionId)}
              >
                <Flag className={`w-4 h-4 mr-1 ${markedQuestions.has(questionId) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                {markedQuestions.has(questionId) ? '已标记' : '标记'}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-blue-500 mb-6">
            <p className="text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">
              {questionText}
            </p>
            {questionType === 'programming' && (
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                {currentQuestion.description && <p className="whitespace-pre-wrap">{currentQuestion.description}</p>}
                {currentQuestion.input_format && <p><span className="font-semibold">输入：</span>{currentQuestion.input_format}</p>}
                {currentQuestion.output_format && <p><span className="font-semibold">输出：</span>{currentQuestion.output_format}</p>}
                {currentQuestion.constraints && <p><span className="font-semibold">约束：</span>{currentQuestion.constraints}</p>}
                {Array.isArray(currentQuestion.samples) && currentQuestion.samples.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <pre className="bg-white border rounded-md p-3 overflow-auto"><span className="font-semibold">样例输入</span>{'\n'}{currentQuestion.samples[0].input}</pre>
                    <pre className="bg-white border rounded-md p-3 overflow-auto"><span className="font-semibold">样例输出</span>{'\n'}{currentQuestion.samples[0].output}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {questionType === 'choice' && questionOptions.length > 0 ? (
            <ChoiceOptions
              options={questionOptions}
              selected={currentAnswer}
              onChange={handleAnswerChange}
              questionId={questionId}
            />
          ) : questionType === 'fill' ? (
            <FillAnswer
              value={currentAnswer || ''}
              onChange={handleAnswerChange}
            />
          ) : questionType === 'programming' ? (
            <CodeAnswer
              value={currentAnswer || { code: '', language: currentQuestion.language || 'python' }}
              onChange={handleAnswerChange}
            />
          ) : (
            <EssayAnswer
              value={currentAnswer || ''}
              onChange={handleAnswerChange}
            />
          )}
        </div>

        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={safeIndex === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              上一题
            </Button>

            <div className="flex gap-1 flex-wrap justify-center max-w-[300px]">
              {safeQuestions.slice(0, 15).map((q, idx) => {
                // 安全检查：确保导航按钮的题目数据有效
                if (!q || q.id === undefined || q.id === null) {
                  console.warn(`[QuestionPanel] 导航栏第 ${idx + 1} 题数据无效`, q)
                  return null
                }
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== ''
                const isMarked = markedQuestions.has(q.id)
                const isCurrent = idx === safeIndex
                
                return (
                  <button
                    key={`nav-q-${q.id}-${idx}`}
                    onClick={() => handleJumpTo(idx)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-all relative ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                        : isMarked
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : isAnswered
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border'
                    }`}
                    type="button"
                  >
                    {idx + 1}
                    {isMarked && !isCurrent && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full"></span>
                    )}
                  </button>
                )})}
              {safeQuestions.length > 15 && (
                <span key="nav-more-indicator" className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">
                    +{safeQuestions.length - 15}
                </span>
              )}
            </div>

            {safeIndex < safeQuestions.length - 1 ? (
              <Button
                onClick={handleNext}
                className="gap-1 bg-blue-600 hover:bg-blue-700"
              >
                下一题
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4" />
                提交答案
              </Button>
            )}
          </div>
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
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowConfirmSubmit(false)}
                >
                  继续答题
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleSubmit}
                >
                  确认提交
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">答题进度</span>
          <span className="text-sm font-medium">{answeredCount} / {safeQuestions.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  )
}

function ChoiceOptions({ options, selected, onChange, questionId }) {
  return (
    <div className="space-y-3" key={`choices-container-${questionId}`}>
      <p className="text-sm font-medium text-gray-700 mb-3">请选择正确答案：</p>
      {options.map((option, index) => {
        const isSelected = selected === index
        const optionLabel = String.fromCharCode(65 + index)
        
        return (
          <button
            key={`choice-${questionId}-${index}`}
            onClick={() => onChange(index)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              isSelected
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
            type="button"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                isSelected
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {optionLabel}
              </div>
              <p className={`text-base leading-relaxed pt-1 ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                {option || '选项内容'}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function FillAnswer({ value, onChange }) {
  return (
    <div className="space-y-3" key="fill-answer-container">
      <p className="text-sm font-medium text-gray-700 mb-3">请填写答案：</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="在此输入答案..."
        className="text-lg"
        autoComplete="off"
      />
      <p className="text-xs text-gray-400">提示：请仔细核对答案，确保准确无误</p>
    </div>
  )
}

function CodeAnswer({ value, onChange }) {
  const current = typeof value === 'object' && value !== null ? value : { code: value || '', language: 'python' }
  const update = (patch) => onChange({ ...current, ...patch })

  return (
    <div className="space-y-3" key="code-answer-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-700">代码作答</p>
        <Select value={current.language || 'python'} onValueChange={(language) => update({ language })}>
          <SelectTrigger className="w-full sm:w-44 bg-white">
            <SelectValue placeholder="选择语言" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="python">Python</SelectItem>
            <SelectItem value="javascript">JavaScript</SelectItem>
            <SelectItem value="java">Java</SelectItem>
            <SelectItem value="cpp">C++</SelectItem>
            <SelectItem value="c">C</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CodeEditor
        value={current.code || ''}
        onChange={(code) => update({ code })}
        language={current.language || 'python'}
        height="320px"
        placeholder="在这里输入代码..."
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>支持语法高亮、自动补全、括号匹配 · 提交后系统会进行样例运行、输出匹配、语法、逻辑和效率评分</span>
        <span>{(current.code || '').length} 字符</span>
      </div>
    </div>
  )
}

function EssayAnswer({ value, onChange }) {
  return (
    <div className="space-y-3" key="essay-answer-container">
      <p className="text-sm font-medium text-gray-700 mb-3">请作答：</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="在此输入你的答案..."
        rows={8}
        className="text-base leading-relaxed resize-none"
        autoComplete="off"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>支持多段落作答</span>
        <span>{value.length} 字</span>
      </div>
    </div>
  )
}
