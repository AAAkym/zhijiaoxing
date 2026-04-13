import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Trophy, 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  BookOpen,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Home,
  AlertTriangle
} from 'lucide-react'
import { usePractice } from './PracticeContext'

export default function ResultPage({ onRestart, onBackToList, submitResponse }) {
  const { result, questions, answers, timeElapsed, selectedPractice } = usePractice()
  const navigate = useNavigate()
  
  const [expandedQuestions, setExpandedQuestions] = React.useState(new Set())

  if (!result) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">暂无结果数据</p>
        </CardContent>
      </Card>
    )
  }

  const { results, totalScore, maxScore, answeredCount, totalQuestions } = result
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  const correctCount = results.filter(r => r.isCorrect).length
  const wrongCount = results.length - correctCount

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
  }

  const getGrade = () => {
    if (percentage >= 90) return { label: '优秀', color: 'text-green-600', icon: Trophy }
    if (percentage >= 80) return { label: '良好', color: 'text-blue-600', icon: Award }
    if (percentage >= 60) return { label: '及格', color: 'text-yellow-600', icon: Target }
    return { label: '需努力', color: 'text-red-600', icon: TrendingUp }
  }

  const grade = getGrade()
  const GradeIcon = grade.icon

  const toggleQuestion = (questionId) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedQuestions(newExpanded)
  }

  const typeStats = useMemo(() => {
    const stats = {}
    results.forEach(r => {
      const q = questions.find(q => q.id === r.questionId)
      if (q) {
        const type = q.type || 'choice'
        if (!stats[type]) {
          stats[type] = { total: 0, correct: 0, score: 0, maxScore: 0 }
        }
        stats[type].total++
        stats[type].maxScore += r.score
        if (r.isCorrect) {
          stats[type].correct++
          stats[type].score += r.score
        }
      }
    })
    return stats
  }, [results, questions])

  const mistakeCount = wrongCount > 0 ? wrongCount : (submitResponse?.extracted_mistakes ?? submitResponse?.extracted_mistake_count ?? 0)
  const hasMistakes = mistakeCount > 0

  const handleViewMistakes = () => {
    window.location.href = '/student/mistakes'
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className={`bg-gradient-to-r ${
          percentage >= 80 ? 'from-green-500 to-emerald-600' :
          percentage >= 60 ? 'from-blue-500 to-indigo-600' :
          'from-orange-500 to-red-600'
        } text-white`}>
          <div className="px-6 py-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                <GradeIcon className="w-10 h-10" />
              </div>
            </div>
            <div className="text-6xl font-bold mb-2">{totalScore}</div>
            <div className="text-xl opacity-90">总分 / {maxScore}</div>
            <div className="mt-4 flex justify-center gap-2">
              <Badge className="bg-white/20 text-white text-lg px-4 py-1">
                {grade.label}
              </Badge>
              <Badge className="bg-white/20 text-white text-lg px-4 py-1">
                {percentage}%
              </Badge>
            </div>
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<CheckCircle className="w-5 h-5 text-green-500" />}
              label="正确"
              value={correctCount}
              subValue={`题`}
            />
            <StatCard
              icon={<XCircle className="w-5 h-5 text-red-500" />}
              label="错误"
              value={wrongCount}
              subValue={`题`}
            />
            <StatCard
              icon={<Target className="w-5 h-5 text-blue-500" />}
              label="正确率"
              value={percentage}
              subValue={`%`}
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-purple-500" />}
              label="用时"
              value={formatTime(timeElapsed)}
              subValue=""
            />
          </div>
        </CardContent>
      </Card>

      {Object.keys(typeStats).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              题型分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(typeStats).map(([type, stats]) => {
                const typeLabels = {
                  choice: '选择题',
                  fill: '填空题',
                  essay: '简答题'
                }
                const typePercentage = stats.maxScore > 0 
                  ? Math.round((stats.score / stats.maxScore) * 100) 
                  : 0
                
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{typeLabels[type] || type}</span>
                      <span className="text-sm text-gray-500">
                        {stats.correct}/{stats.total} 正确 · {typePercentage}%
                      </span>
                    </div>
                    <Progress value={typePercentage} className="h-2" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            答题详情
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {results.map((result, index) => {
              const isExpanded = expandedQuestions.has(result.questionId)
              const hasExplanation = result.explanation && result.explanation.trim() !== ''
              
              return (
                <div 
                  key={result.questionId}
                  className={`border-l-4 ${
                    result.isCorrect 
                      ? 'border-green-500 bg-green-50/50' 
                      : 'border-red-500 bg-red-50/50'
                  }`}
                >
                  <button
                    className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50/50 transition-colors"
                    onClick={() => toggleQuestion(result.questionId)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      result.isCorrect 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 line-clamp-2">
                        {result.question}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {result.isCorrect ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            正确
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 text-xs">
                            <XCircle className="w-3 h-3 mr-1" />
                            错误
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          得分: {result.isCorrect ? result.score : 0}/{result.score}
                        </span>
                        {hasExplanation && (
                          <span className="text-xs text-blue-500">
                            点击{isExpanded ? '收起' : '展开'}解析
                          </span>
                        )}
                      </div>
                    </div>
                    {hasExplanation && (
                      isExpanded 
                        ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                        : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-15 ml-11">
                      {result.options && result.options.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {result.options.map((opt, optIdx) => {
                            const optLabel = String.fromCharCode(65 + optIdx)
                            const isUserAnswer = result.userAnswer === optIdx
                            const isCorrectAnswer = result.correctAnswer === optIdx
                            
                            return (
                              <div 
                                key={optIdx}
                                className={`flex items-start gap-2 p-2 rounded text-sm ${
                                  isCorrectAnswer 
                                    ? 'bg-green-100 text-green-800 font-medium' 
                                    : isUserAnswer && !isCorrectAnswer
                                      ? 'bg-red-100 text-red-800 line-through'
                                      : 'text-gray-600'
                                }`}
                              >
                                <span className="font-bold">{optLabel}.</span>
                                <span>{opt}</span>
                                {isCorrectAnswer && (
                                  <CheckCircle className="w-4 h-4 ml-auto text-green-600" />
                                )}
                                {isUserAnswer && !isCorrectAnswer && (
                                  <XCircle className="w-4 h-4 ml-auto text-red-600" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      
                      {hasExplanation && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                          <span className="font-medium">解析：</span>
                          {result.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          variant="outline"
          size="lg"
          onClick={onBackToList}
          className="gap-2"
        >
          <Home className="w-5 h-5" />
          返回练习列表
        </Button>
        
        {hasMistakes && (
          <Button
            size="lg"
            onClick={handleViewMistakes}
            className="gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white"
          >
            <AlertTriangle className="w-5 h-5" />
            查看错题
            {mistakeCount > 0 && (
              <span className="bg-white/20 text-white text-sm px-2 py-0.5 rounded-full font-medium">
                {mistakeCount}
              </span>
            )}
          </Button>
        )}
        
        <Button
          size="lg"
          onClick={onRestart}
          className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <RefreshCw className="w-5 h-5" />
          重新练习
        </Button>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, subValue }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">
        {value}{subValue}
      </div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}
