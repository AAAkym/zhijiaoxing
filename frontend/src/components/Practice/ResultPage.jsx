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
        if (r.type === 'programming') {
          stats[type].maxScore += r.maxScore || r.score || 10
        } else {
          stats[type].maxScore += r.score
        }
        if (r.isCorrect) {
          stats[type].correct++
          stats[type].score += r.type === 'programming' ? (r.score || 0) : r.score
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
                      {result.type === 'programming' && result.programmingFeedback && (
                        <ProgrammingFeedbackSection feedback={result.programmingFeedback} />
                      )}
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

function ProgrammingFeedbackSection({ feedback }) {
  const [showAiAnalysis, setShowAiAnalysis] = React.useState(false)
  const dimensions = feedback.dimensions || {}
  const aiDetailed = feedback.aiDetailedAnalysis
  const aiFeedback = feedback.aiFeedback || {}

  const dimensionLabels = {
    compile: { label: '编译', icon: '⚙️', max: 15, desc: '代码能否通过编译/解释' },
    runtime: { label: '运行', icon: '▶️', max: 15, desc: '运行时是否产生正确输出' },
    io_match: { label: 'IO匹配', icon: '🔄', max: 35, desc: '输入输出是否与预期完全匹配' },
    syntax: { label: '语法', icon: '📝', max: 15, desc: '代码语法规范性' },
    logic: { label: '逻辑', icon: '🧠', max: 25, desc: '算法逻辑与参考答案的相似度' },
    efficiency: { label: '效率', icon: '⚡', max: 10, desc: '代码复杂度和执行效率' },
  }

  return (
    <div className="space-y-4 mb-4">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-indigo-800 flex items-center gap-2">
            <Target className="w-4 h-4" />
            AI/OJ 综合评分：{feedback.score}/100
          </h4>
          <Badge className={feedback.score >= 90 ? 'bg-green-100 text-green-700' : feedback.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
            {feedback.score >= 90 ? '优秀' : feedback.score >= 60 ? '及格' : '需改进'}
          </Badge>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {Object.entries(dimensionLabels).map(([key, config]) => {
            const dim = dimensions[key] || {}
            const score = typeof dim.score === 'number' ? dim.score : '-'
            return (
              <div key={key} className="bg-white rounded-lg p-2 text-center border" title={config.desc}>
                <div className="text-lg">{config.icon}</div>
                <div className="text-xs text-gray-500">{config.label}</div>
                <div className={`text-sm font-bold ${typeof score === 'number' && score >= 80 ? 'text-green-600' : typeof score === 'number' && score >= 50 ? 'text-yellow-600' : typeof score === 'number' ? 'text-red-600' : 'text-gray-400'}`}>
                  {score}<span className="text-xs text-gray-400 font-normal">/{config.max}</span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">评分标准：编译15% + IO匹配35% + 语法15% + 逻辑25% + 效率10%</p>
      </div>

      {feedback.lineComparison && feedback.lineComparison.length > 0 && (
        <div className="border rounded-lg p-3">
          <h5 className="font-medium text-gray-700 mb-2">代码差异对比</h5>
          <div className="space-y-1 text-sm font-mono">
            {feedback.lineComparison.map((item, idx) => (
              <div key={idx} className={`flex items-start gap-2 px-2 py-1 rounded ${
                item.type === 'missing_from_student' ? 'bg-red-50 text-red-700' :
                item.type === 'extra_in_student' ? 'bg-amber-50 text-amber-700' :
                'bg-gray-50 text-gray-600'
              }`}>
                <span className="shrink-0 w-5 text-center font-bold text-xs mt-0.5">
                  {item.type === 'missing_from_student' ? '-' : item.type === 'extra_in_student' ? '+' : ' '}
                </span>
                <span className="whitespace-pre-wrap break-all">{item.content}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-100 rounded"></span> 参考答案有但你的代码缺少</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-amber-100 rounded"></span> 你的代码有但参考答案没有</span>
          </div>
        </div>
      )}

      {aiFeedback.summary && (
        <div className="bg-gray-50 border rounded-lg p-3">
          <h5 className="font-medium text-gray-700 mb-1">总评</h5>
          <p className="text-sm text-gray-600">{aiFeedback.summary}</p>
        </div>
      )}

      {aiFeedback.improvement_suggestions && aiFeedback.improvement_suggestions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h5 className="font-medium text-amber-800 mb-2">改进建议</h5>
          <ul className="space-y-1">
            {aiFeedback.improvement_suggestions.map((s, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiDetailed && (
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-left flex items-center justify-between hover:from-purple-700 hover:to-indigo-700 transition-colors"
            onClick={() => setShowAiAnalysis(!showAiAnalysis)}
          >
            <span className="font-medium flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              AI 深度代码分析
            </span>
            {showAiAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAiAnalysis && (
            <div className="p-4 space-y-3 bg-white">
              {aiDetailed.error_analysis && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <h5 className="font-medium text-red-800 mb-1 flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> 错误分析
                  </h5>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{aiDetailed.error_analysis}</p>
                </div>
              )}
              {aiDetailed.code_quality && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h5 className="font-medium text-blue-800 mb-1 flex items-center gap-1">
                    <BookOpen className="w-4 h-4" /> 代码质量
                  </h5>
                  <p className="text-sm text-blue-700 whitespace-pre-wrap">{aiDetailed.code_quality}</p>
                </div>
              )}
              {aiDetailed.optimization_suggestions && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h5 className="font-medium text-green-800 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" /> 优化建议
                  </h5>
                  <p className="text-sm text-green-700 whitespace-pre-wrap">{aiDetailed.optimization_suggestions}</p>
                </div>
              )}
              {aiDetailed.best_practices && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <h5 className="font-medium text-purple-800 mb-1 flex items-center gap-1">
                    <Award className="w-4 h-4" /> 最佳实践
                  </h5>
                  <p className="text-sm text-purple-700 whitespace-pre-wrap">{aiDetailed.best_practices}</p>
                </div>
              )}
              {aiDetailed.learning_points && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <h5 className="font-medium text-indigo-800 mb-1 flex items-center gap-1">
                    <Lightbulb className="w-4 h-4" /> 学习要点
                  </h5>
                  <p className="text-sm text-indigo-700 whitespace-pre-wrap">{aiDetailed.learning_points}</p>
                </div>
              )}
              {aiDetailed.step_by_step_fix && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h5 className="font-medium text-amber-800 mb-1 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> 逐步修复
                  </h5>
                  <p className="text-sm text-amber-700 whitespace-pre-wrap">{aiDetailed.step_by_step_fix}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
