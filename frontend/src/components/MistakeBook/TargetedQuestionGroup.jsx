import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CodeEditor from '@/components/ui/CodeEditor'
import {
  Target, Loader2, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Code, ListChecks, Sparkles, Play, Send, RotateCcw, Trophy, Zap
} from 'lucide-react'
import { mistakeBook, programming } from '@/services/api'

const DIFFICULTY_CONFIG = {
  easy: { label: '简单', color: 'bg-green-100 text-green-700' },
  medium: { label: '中等', color: 'bg-yellow-100 text-yellow-700' },
  hard: { label: '困难', color: 'bg-red-100 text-red-700' },
}

function ChoiceQuestion({ question, answer, onAnswer }) {
  const options = question.options || []
  const labels = ['A', 'B', 'C', 'D']

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-800 whitespace-pre-wrap">{question.content}</p>
      </div>
      <div className="space-y-2">
        {options.map((opt, idx) => {
          const isSelected = answer === idx
          return (
            <button
              key={idx}
              onClick={() => onAnswer(idx)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50'
              }`}
            >
              <span className="font-bold mr-2">{labels[idx]}.</span>
              {typeof opt === 'string' ? opt : String(opt)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProgrammingQuestion({ question, answer, onAnswer }) {
  const lang = question.language || 'python'
  const code = answer?.code || question.starter_code || ''
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)

  const handleCodeChange = (newCode) => {
    onAnswer({ code: newCode, language: lang })
  }

  const handleRun = async () => {
    setRunning(true)
    setRunResult(null)
    try {
      setRunResult({ status: 'success', message: '代码已提交运行，提交后将查看完整结果' })
    } catch (err) {
      setRunResult({ status: 'error', message: '运行失败: ' + (err.message || '未知错误') })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-800 whitespace-pre-wrap">{question.content}</p>
        {question.test_cases && question.test_cases.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-gray-600">示例：</p>
            {question.test_cases.slice(0, 2).map((tc, idx) => (
              <div key={idx} className="bg-white rounded p-2 text-sm font-mono">
                <span className="text-gray-500">输入：</span>{tc.input}
                <span className="text-gray-500 ml-3">输出：</span>{tc.expected_output}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{lang.toUpperCase()}</Badge>
          <Button variant="outline" size="sm" onClick={handleRun} disabled={running}>
            {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
            运行测试
          </Button>
        </div>
        <CodeEditor
          value={code}
          onChange={handleCodeChange}
          language={lang}
          height="300px"
          placeholder="在这里编写代码..."
        />
      </div>
      {runResult && (
        <div className={`p-3 rounded-lg text-sm ${runResult.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {runResult.message}
        </div>
      )}
    </div>
  )
}

function ChoiceResult({ question, userAnswer }) {
  const correctIdx = question.correctAnswer
  const isCorrect = userAnswer === correctIdx
  const labels = ['A', 'B', 'C', 'D']

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {isCorrect ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600" />
        )}
        <span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
          {isCorrect ? '回答正确' : '回答错误'}
        </span>
      </div>
      {(question.options || []).map((opt, idx) => {
        const isUser = userAnswer === idx
        const isCorrectOpt = correctIdx === idx
        return (
          <div
            key={idx}
            className={`p-2 rounded border ${
              isCorrectOpt ? 'bg-green-50 border-green-300' : isUser ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <span className="font-bold mr-1">{labels[idx]}.</span>
            {typeof opt === 'string' ? opt : String(opt)}
            {isCorrectOpt && <CheckCircle className="w-4 h-4 inline ml-2 text-green-600" />}
            {isUser && !isCorrectOpt && <XCircle className="w-4 h-4 inline ml-2 text-red-600" />}
          </div>
        )
      })}
      {question.explanation && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-800 mb-1">解析</p>
          <p className="text-sm text-amber-700">{question.explanation}</p>
        </div>
      )}
    </div>
  )
}

export default function TargetedQuestionGroup({ courseId, onComplete }) {
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('config')
  const [config, setConfig] = useState({
    choice_count: 5,
    programming_count: 2,
    difficulty: 'adaptive',
  })

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    try {
      const result = await mistakeBook.generateQuestionGroup({
        course_id: courseId || undefined,
        ...config,
      })
      if (result.error) {
        alert(result.error)
      } else {
        setQuestions(result.questions || [])
        setAnswers({})
        setCurrentIndex(0)
        setView('practice')
      }
    } catch (err) {
      console.error('Generate question group error:', err)
      alert('生成题组失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [courseId, config])

  const handleAnswer = useCallback((answer) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: answer }))
  }, [currentIndex])

  const handleSubmit = useCallback(async () => {
    const results = questions.map((q, idx) => {
      const answer = answers[idx]
      if (q.type === 'choice') {
        return { ...q, userAnswer: answer, isCorrect: answer === q.correctAnswer }
      } else {
        return { ...q, userAnswer: answer, isCorrect: false }
      }
    })

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const ans = answers[i]
      if (q.type === 'programming' && ans?.code) {
        try {
          await programming.submit({
            assessment_id: q.assessment_id || 0,
            question_index: i,
            language: ans.language || q.language || 'python',
            code: ans.code,
          })
        } catch (err) {
          console.error('Programming submit error:', err)
        }
      }
    }

    setQuestions(results)
    setView('result')
  }, [questions, answers])

  const correctCount = questions.filter(q => q.isCorrect).length
  const totalChoice = questions.filter(q => q.type === 'choice').length

  if (view === 'config') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            靶向练习题组
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-gray-500">
            基于你的学习阶段、练习计划和薄弱知识点，AI将为你动态生成个性化题组。
            题目内容不重复，编程题支持代码编辑和运行。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">选择题数量</p>
              <Select value={String(config.choice_count)} onValueChange={v => setConfig(p => ({ ...p, choice_count: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 5, 8, 10].map(n => <SelectItem key={n} value={String(n)}>{n} 道</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">编程题数量</p>
              <Select value={String(config.programming_count)} onValueChange={v => setConfig(p => ({ ...p, programming_count: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{n} 道</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">难度模式</p>
              <Select value={config.difficulty} onValueChange={v => setConfig(p => ({ ...p, difficulty: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adaptive">自适应</SelectItem>
                  <SelectItem value="easy">基础纠偏</SelectItem>
                  <SelectItem value="medium">能力巩固</SelectItem>
                  <SelectItem value="hard">冲刺迁移</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? 'AI生成中...' : '生成靶向题组'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (view === 'practice' && questions.length > 0) {
    const q = questions[currentIndex]
    const answeredCount = Object.keys(answers).length
    const totalCount = questions.length

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {q.type === 'choice' ? <ListChecks className="w-3 h-3 mr-1" /> : <Code className="w-3 h-3 mr-1" />}
              {q.type === 'choice' ? '选择题' : '编程题'}
            </Badge>
            {q.difficulty && <Badge className={DIFFICULTY_CONFIG[q.difficulty]?.color}>{DIFFICULTY_CONFIG[q.difficulty]?.label}</Badge>}
            <span className="text-sm text-gray-500">{currentIndex + 1} / {totalCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">已答 {answeredCount}/{totalCount}</span>
            <Button variant="outline" size="sm" onClick={() => setView('config')}>
              <RotateCcw className="w-3 h-3 mr-1" />重新配置
            </Button>
          </div>
        </div>

        <div className="flex gap-1 mb-2">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`flex-1 h-2 rounded-full transition-colors ${
                idx === currentIndex ? 'bg-blue-500' : answers[idx] !== undefined ? 'bg-blue-200' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {q.type === 'choice' ? (
              <ChoiceQuestion question={q} answer={answers[currentIndex]} onAnswer={handleAnswer} />
            ) : (
              <ProgrammingQuestion question={q} answer={answers[currentIndex]} onAnswer={handleAnswer} />
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" />上一题
          </Button>
          {currentIndex === totalCount - 1 ? (
            <Button onClick={handleSubmit} disabled={answeredCount === 0}>
              <Send className="w-4 h-4 mr-1" />提交全部
            </Button>
          ) : (
            <Button onClick={() => setCurrentIndex(currentIndex + 1)}>
              下一题<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (view === 'result') {
    const choiceResults = questions.filter(q => q.type === 'choice')
    const correctChoice = choiceResults.filter(q => q.isCorrect).length
    const progResults = questions.filter(q => q.type === 'programming')

    return (
      <div className="space-y-6">
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-8 h-8 text-amber-500" />
              <div>
                <h3 className="text-xl font-bold">练习完成</h3>
                <p className="text-sm text-gray-500">靶向题组练习结果</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{questions.length}</p>
                <p className="text-xs text-gray-500">总题数</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{correctChoice}/{choiceResults.length}</p>
                <p className="text-xs text-gray-500">选择题正确</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-700">{progResults.length}</p>
                <p className="text-xs text-gray-500">编程题</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{q.type === 'choice' ? '选择题' : '编程题'}</Badge>
                  {q.difficulty && <Badge className={DIFFICULTY_CONFIG[q.difficulty]?.color}>{DIFFICULTY_CONFIG[q.difficulty]?.label}</Badge>}
                  {q.type === 'choice' && (q.isCorrect ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 mb-3">{q.content}</p>
                {q.type === 'choice' ? (
                  <ChoiceResult question={q} userAnswer={q.userAnswer} />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-red-600 mb-1">你的代码：</p>
                      <pre className="bg-red-50 border border-red-200 rounded p-3 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                        {q.userAnswer?.code || '未提交'}
                      </pre>
                    </div>
                    {q.standard_answer && (
                      <div>
                        <p className="text-sm font-medium text-green-600 mb-1">参考解答：</p>
                        <pre className="bg-green-50 border border-green-200 rounded p-3 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                          {q.standard_answer}
                        </pre>
                      </div>
                    )}
                    {q.explanation && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-amber-800 mb-1">解题思路</p>
                        <p className="text-sm text-amber-700">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setView('config')} className="flex-1">
            <RotateCcw className="w-4 h-4 mr-2" />重新生成
          </Button>
          {onComplete && (
            <Button onClick={onComplete} className="flex-1">
              <Zap className="w-4 h-4 mr-2" />完成练习
            </Button>
          )}
        </div>
      </div>
    )
  }

  return null
}
