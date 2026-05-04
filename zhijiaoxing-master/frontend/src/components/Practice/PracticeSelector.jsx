import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { usePractice } from './PracticeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  BookOpen, 
  Clock, 
  Target, 
  Star, 
  Filter, 
  Search,
  ChevronRight,
  Award,
  TrendingUp,
  Zap,
  Layers,
  CheckCircle,
  RefreshCw,
  X,
  Eye,
  Trophy,
  XCircle
} from 'lucide-react'
import { courses, student } from '../../services/api'

const difficultyConfig = {
  easy: { label: '简单', color: 'bg-green-100 text-green-700 border-green-300', stars: 1 },
  medium: { label: '中等', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', stars: 2 },
  hard: { label: '困难', color: 'bg-red-100 text-red-700 border-red-300', stars: 3 }
}

const typeConfig = {
  choice: { label: '选择题', icon: '📝' },
  fill: { label: '填空题', icon: '✏️' },
  essay: { label: '简答题', icon: '📄' },
  programming: { label: '编程题', icon: '</>' },
  mixed: { label: '混合题型', icon: '📋' }
}

export default function PracticeSelector({ myCourses, onSelectPractice }) {
  const { filters, setFilter } = usePractice()
  const [searchQuery, setSearchQuery] = useState('')
  const [assessments, setAssessments] = useState([])
  const [completedPractices, setCompletedPractices] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [searchHistory, setSearchHistory] = useState([])
  const [selectedCompleted, setSelectedCompleted] = useState(null)
  const searchInputRef = useRef(null)
  const lastSyncTimeRef = useRef(null)

  useEffect(() => {
    loadAssessments()
    loadCompletedPractices()
    const interval = setInterval(() => {
      syncAssessments()
      loadCompletedPractices()
    }, 30000)
    return () => clearInterval(interval)
  }, [myCourses])

  const loadAssessments = async () => {
    if (!myCourses || myCourses.length === 0) return
    
    setLoading(true)
    const allAssessments = []
    
    for (const course of myCourses) {
      try {
        const res = await courses.getAssessments(course.id)
        const courseAssessments = (res.assessments || []).map(a => ({
          ...a,
          courseId: course.id,
          courseName: course.title,
          subject: course.category || '通用',
          chapter: a.chapter || '综合练习',
          difficulty: a.difficulty || 'medium',
          type: a.type || (Array.isArray(a.questions) && a.questions.some(q => q?.type === 'programming') ? 'programming' : 'mixed'),
          questionCount: Array.isArray(a.questions) ? a.questions.length : 
            (typeof a.questions === 'string' ? (a.questions.match(/\?/g) || []).length || 1 : 0),
          duration: a.duration || 30,
          totalScore: a.total_score || 100,
          completedCount: a.completed_count || 0,
          avgScore: a.avg_score || 0,
          isRecommended: a.is_recommended || false
        }))
        allAssessments.push(...courseAssessments)
      } catch (err) {
        console.warn(`加载课程 ${course.id} 的练习失败:`, err)
      }
    }
    
    allAssessments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setAssessments(allAssessments)
    lastSyncTimeRef.current = Date.now()
    setLoading(false)
  }

  const loadCompletedPractices = useCallback(async () => {
    try {
      const res = await student.getPracticeStats()
      const practices = res.recent_practices || []
      setCompletedPractices(practices.map(p => ({
        id: p.id,
        assessmentId: p.assessment_id,
        title: p.assessment_title || `练习 #${p.assessment_id}`,
        courseName: p.course_name || '',
        score: p.score || 0,
        totalScore: p.total_score || 100,
        completedAt: p.created_at,
        answers: p.user_answer,
        evaluationResult: p.evaluation_result
      })))
    } catch (err) {
      console.warn('加载已完成练习失败:', err)
    }
  }, [])

  const syncAssessments = useCallback(async () => {
    if (syncing || !myCourses || myCourses.length === 0) return
    
    setSyncing(true)
    const allAssessments = []
    
    for (const course of myCourses) {
      try {
        const res = await courses.getAssessments(course.id)
        const courseAssessments = (res.assessments || []).map(a => ({
          ...a,
          courseId: course.id,
          courseName: course.title,
          subject: course.category || '通用',
          chapter: a.chapter || '综合练习',
          difficulty: a.difficulty || 'medium',
          type: a.type || (Array.isArray(a.questions) && a.questions.some(q => q?.type === 'programming') ? 'programming' : 'mixed'),
          questionCount: Array.isArray(a.questions) ? a.questions.length : 
            (typeof a.questions === 'string' ? (a.questions.match(/\?/g) || []).length || 1 : 0),
          duration: a.duration || 30,
          totalScore: a.total_score || 100,
          completedCount: a.completed_count || 0,
          avgScore: a.avg_score || 0,
          isRecommended: a.is_recommended || false
        }))
        allAssessments.push(...courseAssessments)
      } catch (err) {
        console.warn(`同步课程 ${course.id} 的练习失败:`, err)
      }
    }
    
    allAssessments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setAssessments(allAssessments)
    lastSyncTimeRef.current = Date.now()
    setSyncing(false)
  }, [myCourses, syncing])

  const handleSearch = useCallback((query) => {
    setSearchQuery(query)
    if (query.trim() && !searchHistory.includes(query.trim())) {
      setSearchHistory(prev => [query.trim(), ...prev.slice(0, 4)])
    }
  }, [searchHistory])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Escape') {
      clearSearch()
    }
  }, [clearSearch])

  const courseOptions = useMemo(() => {
    const courseMap = new Map()
    assessments.forEach(a => {
      if (a.courseId && a.courseName) {
        courseMap.set(a.courseId, { value: String(a.courseId), label: a.courseName })
      }
    })
    return [{ value: 'all', label: '全部课程' }, ...Array.from(courseMap.values())]
  }, [assessments])

  const chapters = useMemo(() => {
    const chapterSet = new Set(assessments.map(a => a.chapter).filter(Boolean))
    return [{ value: 'all', label: '全部章节' }, ...Array.from(chapterSet).map(c => ({ value: c, label: c }))]
  }, [assessments])

  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      if (filters.subject !== 'all' && String(a.courseId) !== filters.subject) return false
      if (filters.chapter !== 'all' && a.chapter !== filters.chapter) return false
      if (filters.difficulty !== 'all' && a.difficulty !== filters.difficulty) return false
      if (filters.type !== 'all' && a.type !== filters.type) return false
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim()
        const searchTerms = query.split(/\s+/).filter(Boolean)
        
        const searchableText = [
          a.title,
          a.courseName,
          a.subject,
          a.chapter,
          a.id?.toString()
        ].filter(Boolean).join(' ').toLowerCase()
        
        const matchesAllTerms = searchTerms.every(term => {
          if (term.startsWith('#')) {
            return a.id?.toString() === term.slice(1)
          }
          if (term.startsWith('course:')) {
            return a.courseName?.toLowerCase().includes(term.slice(7))
          }
          if (term.startsWith('subject:')) {
            return a.subject?.toLowerCase().includes(term.slice(8))
          }
          return searchableText.includes(term)
        })
        
        if (!matchesAllTerms) return false
      }
      
      if (activeTab === 'recommended') {
        return a.isRecommended === true
      } else if (activeTab === 'completed') {
        return completedPractices.some(cp => cp.assessmentId === a.id)
      }
      
      return true
    })
  }, [assessments, filters, searchQuery, activeTab, completedPractices])

  const handleViewCompleted = useCallback((practice) => {
    setSelectedCompleted(practice)
  }, [])

  const handleCloseCompleted = useCallback(() => {
    setSelectedCompleted(null)
  }, [])

  const handleSelectPractice = (assessment) => {
    let questionsData = assessment.questions
    if (typeof questionsData === 'string') {
      try {
        let trimmed = questionsData.trim()
        if (trimmed.toLowerCase().startsWith('json')) {
          trimmed = trimmed.replace(/^json/i, '').trim()
        }
        if (trimmed.startsWith('```')) {
          trimmed = trimmed.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim()
        }
        questionsData = JSON.parse(trimmed)
      } catch (parseError) {
        console.warn('JSON parse failed, trying text parse:', parseError)
        const parts = questionsData.split(/\n\n+/).filter(Boolean)
        questionsData = parts.map((p, idx) => ({
          id: idx + 1,
          question: p,
          type: 'essay',
          options: [],
          score: Math.floor((assessment.totalScore || 100) / parts.length),
          correctAnswer: null
        }))
      }
    }
    
    const normalizedQuestions = (Array.isArray(questionsData) ? questionsData : []).map((q, idx) => {
      const options = Array.isArray(q.options) ? q.options.filter(opt => opt && String(opt).trim() !== '') : []
      const hasOptions = options.length >= 2
      const questionType = q.type || (hasOptions ? 'choice' : 'essay')
      
      let correctAnswer = null
      if (questionType === 'choice' && hasOptions) {
        if (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < options.length) {
          correctAnswer = q.correctAnswer
        } else if (typeof q.correct_answer === 'number' && q.correct_answer >= 0 && q.correct_answer < options.length) {
          correctAnswer = q.correct_answer
        } else if (typeof q.correctAnswer === 'string') {
          const letter = q.correctAnswer.toUpperCase()
          const letterIndex = letter.charCodeAt(0) - 65
          if (letterIndex >= 0 && letterIndex < options.length) {
            correctAnswer = letterIndex
          }
        }
      }
      
      return {
        id: q.id || idx + 1,
        question: q.question || q.title || '',
        title: q.title || q.question || '',
        description: q.description || q.content || '',
        input_format: q.input_format || q.inputFormat || '',
        output_format: q.output_format || q.outputFormat || '',
        constraints: q.constraints || '',
        samples: Array.isArray(q.samples) ? q.samples : [],
        standard_answer: q.standard_answer || q.reference_answer || '',
        language: q.language || 'python',
        type: questionType,
        options: options,
        score: typeof q.score === 'number' ? q.score : Math.floor((assessment.totalScore || 100) / (questionsData.length || 1)),
        correctAnswer: correctAnswer,
        explanation: q.explanation || '',
        userAnswer: null
      }
    }).filter(q => q.question && q.question.trim() !== '')
    
    console.log('PracticeSelector - normalized questions:', normalizedQuestions.length, 'questions')
    
    onSelectPractice(assessment, normalizedQuestions)
  }

  const renderDifficultyStars = (difficulty) => {
    const config = difficultyConfig[difficulty] || difficultyConfig.medium
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3].map(star => (
          <Star 
            key={star} 
            className={`w-3 h-3 ${star <= config.stars ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">练习评测</h2>
          <p className="text-gray-600 mt-1">选择练习开始你的学习之旅</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <BookOpen className="w-4 h-4" />
            <span>共 {assessments.length} 套练习</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={syncAssessments}
            disabled={syncing || loading}
            className="gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同步中...' : '同步数据'}
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="搜索练习（支持：名称、课程、科目、章节、#编号、course:课程名、subject:科目）..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={handleKeyPress}
                className="pl-10 pr-10 bg-white"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filters.subject} onValueChange={(v) => setFilter({ subject: v })}>
                <SelectTrigger className="w-40 bg-white">
                  <SelectValue placeholder="选择课程" />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.difficulty} onValueChange={(v) => setFilter({ difficulty: v })}>
                <SelectTrigger className="w-28 bg-white">
                  <SelectValue placeholder="难度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部难度</SelectItem>
                  <SelectItem value="easy">简单</SelectItem>
                  <SelectItem value="medium">中等</SelectItem>
                  <SelectItem value="hard">困难</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.type} onValueChange={(v) => setFilter({ type: v })}>
                <SelectTrigger className="w-28 bg-white">
                  <SelectValue placeholder="题型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部题型</SelectItem>
                  <SelectItem value="choice">选择题</SelectItem>
                  <SelectItem value="fill">填空题</SelectItem>
                  <SelectItem value="essay">简答题</SelectItem>
                  <SelectItem value="programming">编程题</SelectItem>
                  <SelectItem value="mixed">混合题型</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {searchHistory.length > 0 && !searchQuery && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">最近搜索：</span>
              {searchHistory.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(term)}
                  className="text-xs px-2 py-1 bg-white rounded-full text-gray-600 hover:bg-gray-100 border"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
          
          {searchQuery && filteredAssessments.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              找到 {filteredAssessments.length} 个匹配结果
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">
            <Layers className="w-4 h-4 mr-2" />
            全部练习
          </TabsTrigger>
          <TabsTrigger value="recommended">
            <Zap className="w-4 h-4 mr-2" />
            推荐练习
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle className="w-4 h-4 mr-2" />
            已完成
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : activeTab === 'completed' ? (
            completedPractices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">暂无已完成的练习</p>
                  <p className="text-sm text-gray-400 mt-2">完成练习后将在此显示</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {completedPractices.map((practice) => (
                  <CompletedPracticeCard
                    key={practice.id}
                    practice={practice}
                    onView={() => handleViewCompleted(practice)}
                  />
                ))}
              </div>
            )
          ) : filteredAssessments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">暂无符合条件的练习</p>
                <p className="text-sm text-gray-400 mt-2">请调整筛选条件或等待教师发布新练习</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssessments.map((assessment) => (
                <PracticeCard
                  key={assessment.id}
                  assessment={assessment}
                  onSelect={() => handleSelectPractice(assessment)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedCompleted && (
        <CompletedPracticeDetail
          practice={selectedCompleted}
          onClose={handleCloseCompleted}
        />
      )}
    </div>
  )
}

function CompletedPracticeCard({ practice, onView }) {
  const percentage = practice.totalScore > 0 
    ? Math.round((practice.score / practice.totalScore) * 100) 
    : 0
  
  const completedDate = practice.completedAt 
    ? new Date(practice.completedAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '未知时间'

  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-300" onClick={onView}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{practice.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{practice.courseName}</p>
          </div>
          <Badge className={`${
            percentage >= 90 ? 'bg-green-100 text-green-700' :
            percentage >= 60 ? 'bg-blue-100 text-blue-700' :
            'bg-red-100 text-red-700'
          }`}>
            {percentage}%
          </Badge>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-gray-600">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">{practice.score}/{practice.totalScore}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{completedDate}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-blue-600 hover:text-blue-700">
            <Eye className="w-4 h-4" />
            查看详情
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CompletedPracticeDetail({ practice, onClose }) {
  const [expandedQuestions, setExpandedQuestions] = useState(new Set())

  let evaluationData = null
  try {
    evaluationData = typeof practice.evaluationResult === 'string' 
      ? JSON.parse(practice.evaluationResult) 
      : practice.evaluationResult
  } catch (e) {
    console.warn('解析评测结果失败:', e)
  }

  const results = evaluationData?.results || []
  const answers = typeof practice.answers === 'string' 
    ? JSON.parse(practice.answers) 
    : practice.answers || []

  const toggleQuestion = (questionId) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedQuestions(newExpanded)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle>{practice.title}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">{practice.courseName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{practice.score}</div>
                  <div className="text-xs text-gray-500">得分</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-400">{practice.totalScore}</div>
                  <div className="text-xs text-gray-500">总分</div>
                </div>
              </div>
              <Badge className={`text-lg px-4 py-1 ${
                (practice.score / practice.totalScore) >= 0.9 ? 'bg-green-100 text-green-700' :
                (practice.score / practice.totalScore) >= 0.6 ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>
                {Math.round((practice.score / practice.totalScore) * 100)}%
              </Badge>
            </div>
          </div>

          {results.length > 0 ? (
            <div className="divide-y">
              {results.map((result, index) => {
                const isExpanded = expandedQuestions.has(result.questionId)
                
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
                        </div>
                      </div>
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
                        
                        {result.explanation && (
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
          ) : (
            <div className="p-8 text-center text-gray-500">
              暂无详细答题记录
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PracticeCard({ assessment, onSelect }) {
  const difficultyConf = difficultyConfig[assessment.difficulty] || difficultyConfig.medium
  const typeConf = typeConfig[assessment.type] || typeConfig.mixed

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-blue-300 overflow-hidden" onClick={onSelect}>
      <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold line-clamp-1 group-hover:text-blue-600 transition-colors">
            {assessment.title || `练习 #${assessment.id}`}
          </CardTitle>
          <Badge className={difficultyConf.color}>
            {difficultyConf.label}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1">{assessment.courseName}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline" className="text-xs">
            {typeConf.icon} {typeConf.label}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {assessment.questionCount} 题
          </Badge>
          <Badge variant="outline" className="text-xs">
            {assessment.totalScore} 分
          </Badge>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{assessment.duration} 分钟</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="w-4 h-4" />
            <span>{assessment.chapter}</span>
          </div>
        </div>

        {assessment.completedCount > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>平均分</span>
              <span className="font-medium">{assessment.avgScore}%</span>
            </div>
            <Progress value={assessment.avgScore} className="h-1.5" />
          </div>
        )}

        <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 group-hover:shadow-md transition-all">
          开始练习
          <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  )
}
