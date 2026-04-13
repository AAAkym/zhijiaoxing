import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Play,
  Settings,
  BookOpen,
  Target,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { mistakeBook } from '@/services/api'
import ReviewQuestion from './ReviewQuestion'
import ReviewResult from './ReviewResult'

export default function MistakeReview({ myCourses = [], onBack }) {
  const [step, setStep] = useState('config')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [config, setConfig] = useState({
    course_id: '',
    mastery_status: '',
    limit: 10
  })
  
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)

  const handleConfigChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleStartReview = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = {
        limit: config.limit
      }
      
      if (config.course_id && config.course_id !== 'all') {
        params.course_id = parseInt(config.course_id)
      }
      
      if (config.mastery_status && config.mastery_status !== 'all') {
        params.mastery_status = config.mastery_status
      }
      
      const response = await mistakeBook.startReview(params)
      
      if (response.questions && response.questions.length > 0) {
        setQuestions(response.questions)
        setCurrentIndex(0)
        setAnswers({})
        setStep('review')
      } else {
        setError('没有可复习的错题')
      }
    } catch (err) {
      console.error('开始复习失败:', err)
      setError('开始复习失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (mistakeId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [mistakeId]: answer
    }))
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    // 修复：检查是否所有题目都已作答
    const unansweredCount = questions.length - answeredCount
    if (unansweredCount > 0) {
      const proceed = confirm(`还有 ${unansweredCount} 道题目未作答，确定要提交吗？`)
      if (!proceed) return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // 修复：构建提交数据时增加数据校验
      const reviewResults = questions.map(q => {
        const userAnswer = answers[q.mistake_id]
        const isCorrect = checkAnswer(userAnswer, q)
        
        return {
          mistake_id: q.mistake_id,
          user_answer: userAnswer !== undefined ? userAnswer : null, // 修复：明确区分未作答和空字符串
          is_correct: isCorrect
        }
      })
      
      // 修复：检查是否有有效的结果数据
      if (reviewResults.length === 0) {
        throw new Error('没有可提交的复习结果')
      }
      
      const response = await mistakeBook.submitReview(reviewResults)
      setResults(response)
      setStep('result')
    } catch (err) {
      console.error('提交复习失败:', err)
      setError('提交复习失败，请重试: ' + (err.message || '未知错误')) // 修复：显示具体错误信息
    } finally {
      setLoading(false)
    }
  }

  // 修复：增强答案校验逻辑，处理更多边界情况
  const checkAnswer = (userAnswer, question) => {
    // 修复：空答案直接返回 false
    if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
      return false
    }
    
    // 修复：确保正确答案存在
    if (question.correct_answer === null || question.correct_answer === undefined) {
      return false
    }
    
    // 选择题：比较索引
    if (question.question_type === 'choice' && question.options) {
      const userNum = Number(userAnswer)
      const correctNum = Number(question.correct_answer)
      
      // 修复：如果转换失败，尝试字符串比较
      if (!isNaN(userNum) && !isNaN(correctNum)) {
        return userNum === correctNum
      }
    }
    
    // 通用情况：字符串比较（去除首尾空格，忽略大小写）
    const userStr = String(userAnswer).trim().toLowerCase()
    const correctStr = String(question.correct_answer).trim().toLowerCase()
    
    return userStr === correctStr
  }

  const handleRetry = () => {
    setStep('config')
    setQuestions([])
    setAnswers({})
    setResults(null)
    setCurrentIndex(0)
  }

  const progress = questions.length > 0 
    ? Math.round(((currentIndex + 1) / questions.length) * 100) 
    : 0

  const answeredCount = Object.keys(answers).length

  if (step === 'result' && results) {
    return (
      <ReviewResult
        results={results}
        questions={questions}
        answers={answers}
        onRetry={handleRetry}
        onBack={onBack}
      />
    )
  }

  if (step === 'review' && questions.length > 0) {
    const currentQuestion = questions[currentIndex]
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setStep('config')}>
              返回设置
            </Button>
            <h2 className="text-xl font-bold">错题复习</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              已答 {answeredCount} / {questions.length}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={answeredCount < questions.length || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                '提交复习'
              )}
            </Button>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <span>题目 {currentIndex + 1} / {questions.length}</span>
        </div>

        <ReviewQuestion
          question={currentQuestion}
          answer={answers[currentQuestion.mistake_id]}
          onAnswer={(answer) => handleAnswer(currentQuestion.mistake_id, answer)}
          showResult={false}
        />

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            上一题
          </Button>
          
          <div className="flex gap-2">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  idx === currentIndex
                    ? 'bg-blue-600 text-white'
                    : answers[questions[idx].mistake_id] !== undefined
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          
          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
          >
            下一题
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          返回错题本
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">错题复习</h2>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center text-red-700">
            <AlertTriangle className="w-5 h-5 mr-2" />
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            复习设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>选择课程</Label>
              <Select
                value={config.course_id}
                onValueChange={(value) => handleConfigChange('course_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部课程" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部课程</SelectItem>
                  {myCourses.map(course => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>掌握状态</Label>
              <Select
                value={config.mastery_status}
                onValueChange={(value) => handleConfigChange('mastery_status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="unmastered">未掌握</SelectItem>
                  <SelectItem value="reviewing">复习中</SelectItem>
                  <SelectItem value="mastered">已掌握</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>复习数量</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={config.limit}
                onChange={(e) => handleConfigChange('limit', parseInt(e.target.value) || 10)}
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">复习算法说明</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 优先复习"复习中"状态的错题（权重最高）</li>
              <li>• "未掌握"的题目次之</li>
              <li>• "已掌握"的题目偶尔出现（巩固记忆）</li>
              <li>• 错误次数越多，被抽中的概率越大</li>
              <li>• 距离上次错误时间越长，越可能被选中</li>
            </ul>
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={onBack}>
              取消
            </Button>
            <Button onClick={handleStartReview} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  加载中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  开始复习
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            复习建议
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">未掌握</span>
              </div>
              <p className="text-sm text-red-700">
                建议每天复习10-15题，直到全部转为"复习中"状态
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">复习中</span>
              </div>
              <p className="text-sm text-blue-700">
                连续答对2次可转为"已掌握"，答错则退回"未掌握"
              </p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">已掌握</span>
              </div>
              <p className="text-sm text-green-700">
                建议每周复习一次巩固，答错则退回"复习中"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
