import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  BookOpen,
  MessageCircle,
  Target,
  TrendingUp,
  Clock,
  Award,
  Play,
  CheckCircle,
  Send,
  BarChart3,
  User,
  Calendar,
  Star,
  RefreshCw,
  AlertCircle,
  Settings,
  Flag,
  BookX,
  FileText,
  StickyNote,
  AlertTriangle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { courses, ai, auth, student, studentSettings as studentSettingsApi, notes, mistakeBook } from '../services/api'
import { useNavigate } from 'react-router-dom'
import PracticeModule from './Practice'
import StudentSettings from './StudentSettings'
import { AIChatPanel } from './AIChatPanel'
import MistakeBook from './MistakeBook'
import StudyNotes from './StudyNotes'

const AI_REQUEST_TIMEOUT = 30000
const ASSESSMENT_POLL_INTERVAL = 2000

export default function StudentDashboard({ user, onLogout }) {
  const navigate = useNavigate()
  const [currentView, setCurrentView] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [studentSettings, setStudentSettings] = useState(null)
  const [stats, setStats] = useState({
    enrolledCourses: 0,
    completedExams: 0,
    practiceCount: 0,
    averageScore: 0
  })

  const [mistakeStats, setMistakeStats] = useState({
    total: 0,
    unmastered: 0,
    reviewing: 0,
    mastered: 0,
    todayReview: 0
  })

  const [noteStats, setNoteStats] = useState({
    total: 0,
    public: 0,
    recentNotes: []
  })

  const [myCourses, setMyCourses] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState(null)

  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const [practiceQuestions, setPracticeQuestions] = useState([
    {
      question: '以下关于 Python 变量的说法，正确的是？',
      options: ['变量需要声明类型', '变量名区分大小写', '变量必须以数字开头'],
      correctAnswer: 1,
      userAnswer: null,
      explanation: 'Python 中变量名是区分大小写的。'
    },
    {
      question: '函数用于：',
      options: ['封装可复用逻辑', '定义变量类型', '提升样式性能'],
      correctAnswer: 0,
      userAnswer: null,
      explanation: '函数用于封装可复用逻辑段。'
    }
  ])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [practiceScore, setPracticeScore] = useState(null)
  const [practiceStats, setPracticeStats] = useState(null) // {overall: number, questions: [{correct:bool, optionCounts:[]}]}
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [newAssessmentsCount, setNewAssessmentsCount] = useState(0)
  const [lastAssessmentId, setLastAssessmentId] = useState(null)
  const [currentAssessmentId, setCurrentAssessmentId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState(0)
  const [networkStatus, setNetworkStatus] = useState('online')
  const [syncStatus, setSyncStatus] = useState(null)
  const [availableAssessments, setAvailableAssessments] = useState([])
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null)
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)

  const abortControllerRef = useRef(null)
  const pollIntervalRef = useRef(null)

  const weeklyProgressData = [
    { day: '周一', hours: 2.5, completed: 3 },
    { day: '周二', hours: 3.2, completed: 4 },
    { day: '周三', hours: 1.8, completed: 2 },
    { day: '周四', hours: 4.1, completed: 5 },
    { day: '周五', hours: 3.5, completed: 4 },
    { day: '周六', hours: 2.0, completed: 2 },
    { day: '周日', hours: 2.8, completed: 3 }
  ]

  const courseProgressData = [
    { name: 'Python基础', progress: 78, color: '#3B82F6' },
    { name: 'TensorFlow.js', progress: 65, color: '#10B981' },
    { name: '深度学习', progress: 45, color: '#F59E0B' }
  ]

  const menuItems = [
    { id: 'overview', label: '学习概览', icon: BarChart3 },
    { id: 'courses', label: '我的课程', icon: BookOpen },
    { id: 'assistant', label: 'AI学习助手', icon: MessageCircle },
    { id: 'practice', label: '练习评测', icon: Target },
    { id: 'mistakeBook', label: '错题本', icon: BookX },
    { id: 'notes', label: '学习笔记', icon: StickyNote },
    { id: 'progress', label: '学习进度', icon: TrendingUp },
    { id: 'settings', label: '学生设置', icon: Settings }
  ]

  const loadStudentSettings = useCallback(async () => {
    try {
      const response = await studentSettingsApi.getSettings()
      setStudentSettings(response.settings)
    } catch (error) {
      console.error('加载学生设置失败:', error)
    }
  }, [])

  useEffect(() => {
    loadStudentSettings()
  }, [loadStudentSettings])

  const handleSettingsChange = useCallback((newSettings) => {
    setStudentSettings(newSettings)
  }, [])

  const fetchMyCourses = useCallback(async () => {
    setCoursesLoading(true)
    setCoursesError(null)
    try {
      const response = await student.getMyCourses()
      const coursesData = response.courses || []
      if (coursesData.length > 0) {
        setMyCourses(coursesData.map(c => ({
          id: c.id,
          title: c.title,
          subtitle: c.description?.slice(0, 50) || '',
          description: c.description || '',
          progress: c.progress_percentage || 0,
          instructor: c.teacher_name || '未知教师',
          instructorId: c.teacher_id,
          lessonsCount: 24,
          durationHours: 12,
          nextLesson: '继续学习',
          nextLessonDate: new Date().toISOString().split('T')[0],
          status: 'active',
          tags: [],
          modules: []
        })))
        setStats(prev => ({
          ...prev,
          enrolledCourses: coursesData.length,
          averageScore: coursesData.reduce((sum, c) => sum + (c.progress_percentage || 0), 0) / coursesData.length
        }))
      } else {
        setMyCourses([])
      }
    } catch (error) {
      console.error('获取课程失败:', error)
      setCoursesError('无法加载课程数据，请稍后重试')
      setMyCourses([])
    } finally {
      setCoursesLoading(false)
    }
  }, [])

  const fetchLearningStats = useCallback(async () => {
    try {
      const response = await student.getLearningStats()
      if (response.stats) {
        setStats(prev => ({
          ...prev,
          enrolledCourses: response.stats.enrolled_courses || prev.enrolledCourses,
          completedExams: response.stats.completed_assessments || prev.completedExams,
          practiceCount: response.stats.total_practices || prev.practiceCount,
          averageScore: response.stats.average_score || prev.averageScore
        }))
      }
    } catch (error) {
      console.warn('获取学习统计失败:', error)
    }
  }, [])

  const fetchMistakeStats = useCallback(async () => {
    try {
      const response = await mistakeBook.getStats()
      if (response) {
        // 修复：适配后端返回的数据结构，stats 字段包含详细的统计数据
        const stats = response.stats || response
        setMistakeStats({
          total: stats.total_mistakes || stats.total || 0,
          unmastered: stats.by_status?.unmastered || 0,
          reviewing: stats.by_status?.reviewing || 0,
          mastered: stats.by_status?.mastered || 0,
          todayReview: stats.today_review || response.today_review || 0
        })
      }
    } catch (error) {
      console.warn('获取错题统计失败:', error)
    }
  }, [])

  const fetchNoteStats = useCallback(async () => {
    try {
      const [statsResponse, notesResponse] = await Promise.all([
        notes.getStats(),
        notes.getNotes({ per_page: 5 })
      ])
      setNoteStats({
        total: statsResponse?.total_notes || 0,
        public: statsResponse?.public_notes || 0,
        recentNotes: notesResponse?.notes || []
      })
    } catch (error) {
      console.warn('获取笔记统计失败:', error)
    }
  }, [])

  useEffect(() => {
    fetchMyCourses()
    fetchLearningStats()
    fetchMistakeStats()
    fetchNoteStats()
  }, [fetchMyCourses, fetchLearningStats, fetchMistakeStats, fetchNoteStats])

  // 修复：监听视图切换，当从练习页切回概览时自动刷新错题和学习统计
  useEffect(() => {
    if (currentView === 'overview') {
      console.log('[视图切换] 切换到概览页面，刷新统计数据')
      fetchMistakeStats()
      fetchLearningStats()
      fetchNoteStats()
    }
  }, [currentView, fetchMistakeStats, fetchLearningStats, fetchNoteStats])

  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus('online')
      const pendingSubmissions = JSON.parse(localStorage.getItem('pendingPracticeSubmissions') || '[]')
      if (pendingSubmissions.length > 0) {
        console.log('网络恢复，正在同步待提交的练习结果...')
        syncPendingSubmissions()
      }
    }
    
    const handleOffline = () => {
      setNetworkStatus('offline')
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    setNetworkStatus(navigator.onLine ? 'online' : 'offline')
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  const syncPendingSubmissions = useCallback(async () => {
    const pendingSubmissions = JSON.parse(localStorage.getItem('pendingPracticeSubmissions') || '[]')
    if (pendingSubmissions.length === 0) return
    
    const submissionsToSync = pendingSubmissions.map(s => ({
      assessment_id: s.assessmentId,
      answers: JSON.stringify(s.answers),
      score: s.score,
      evaluation_result: s.evaluationResult || '',
      timestamp: s.timestamp
    }))
    
    try {
      const result = await student.syncPracticeData({ submissions: submissionsToSync })
      
      console.log(`同步完成: ${result.synced_count} 条成功, ${result.failed_count} 条失败`)
      
      if (result.failed_count > 0) {
        const failedTimestamps = result.failed_submissions.map(f => f.submission?.timestamp)
        const stillPending = pendingSubmissions.filter(s => failedTimestamps.includes(s.timestamp))
        localStorage.setItem('pendingPracticeSubmissions', JSON.stringify(stillPending))
      } else {
        localStorage.removeItem('pendingPracticeSubmissions')
      }
      
      if (result.updated_stats) {
        setStats(prev => ({
          ...prev,
          practiceCount: result.updated_stats.total_practices,
          averageScore: result.updated_stats.avg_score
        }))
      }
      
      fetchLearningStats()
      
    } catch (error) {
      console.error('批量同步失败:', error)
    }
  }, [fetchLearningStats])

  const loadAvailableAssessments = useCallback(async () => {
    if (!myCourses || myCourses.length === 0) return
    
    setAssessmentsLoading(true)
    const allAssessments = []
    
    try {
      for (const course of myCourses) {
        try {
          const res = await courses.getAssessments(course.id)
          const assessments = (res.assessments || []).map(a => ({
            ...a,
            courseId: course.id,
            courseName: course.title
          }))
          allAssessments.push(...assessments)
        } catch (err) {
          console.warn(`加载课程 ${course.id} 的考核失败:`, err)
        }
      }
      
      allAssessments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setAvailableAssessments(allAssessments)
      
      if (allAssessments.length > 0) {
        const latestAssessment = allAssessments[0]
        const latestId = latestAssessment.id
        
        if (!selectedAssessmentId) {
          setSelectedAssessmentId(latestId)
          setLastAssessmentId(latestId)
          setCurrentAssessmentId(latestId)
          
          const normalizeQuestions = (raw) => {
            let data = raw
            if (typeof data === 'string') {
              let trimmed = data.trim()
              if (trimmed.toLowerCase().startsWith('json')) trimmed = trimmed.replace(/^json/i, '').trim()
              if (trimmed.startsWith('`') && trimmed.endsWith('`')) trimmed = trimmed.slice(1, -1).trim()
              try {
                data = JSON.parse(trimmed)
              } catch {
                const parts = trimmed.split(/\n\n+/).filter(Boolean)
                data = parts.map((p) => ({
                  question: p.slice(0, 200),
                  options: [],
                  correctAnswer: null,
                  userAnswer: null,
                  explanation: ''
                }))
              }
            } else if (Array.isArray(data)) {
              if (data.length > 0 && typeof data[0] === 'string') {
                data = data.map(p => ({ question: String(p), options: [], correctAnswer: null, userAnswer: null, explanation: '' }))
              }
            }

            if (!Array.isArray(data)) return []
            return data.map((q) => ({
              question: q?.question || '',
              options: Array.isArray(q?.options) ? q.options : [],
              correctAnswer: typeof q?.correctAnswer === 'number' ? q.correctAnswer : null,
              userAnswer: null,
              explanation: q?.explanation || ''
            })).filter(q => q.question)
          }

          const normalized = normalizeQuestions(latestAssessment.questions)
          setPracticeQuestions(normalized)
          setCurrentQuestionIndex(0)
          setPracticeScore(null)
          setPracticeStats(null)
        }
      }
    } catch (error) {
      console.error('加载考核列表失败:', error)
    } finally {
      setAssessmentsLoading(false)
    }
  }, [myCourses, selectedAssessmentId])

  const selectAssessment = useCallback(async (assessmentId) => {
    const assessment = availableAssessments.find(a => a.id === assessmentId)
    if (!assessment) {
      console.error('未找到对应的考核:', assessmentId)
      return
    }
    
    setSelectedAssessmentId(assessmentId)
    setCurrentAssessmentId(assessmentId)
    setPracticeScore(null)
    setPracticeStats(null)
    setCurrentQuestionIndex(0)
    setPracticeLoading(true)
    
    try {
      const normalizeQuestions = (raw) => {
        let data = raw
        if (typeof data === 'string') {
          let trimmed = data.trim()
          if (trimmed.toLowerCase().startsWith('json')) trimmed = trimmed.replace(/^json/i, '').trim()
          if (trimmed.startsWith('`') && trimmed.endsWith('`')) trimmed = trimmed.slice(1, -1).trim()
          try {
            data = JSON.parse(trimmed)
          } catch {
            const parts = trimmed.split(/\n\n+/).filter(Boolean)
            data = parts.map((p) => ({
              question: p.slice(0, 200),
              options: [],
              correctAnswer: null,
              userAnswer: null,
              explanation: ''
            }))
          }
        } else if (Array.isArray(data)) {
          if (data.length > 0 && typeof data[0] === 'string') {
            data = data.map(p => ({ question: String(p), options: [], correctAnswer: null, userAnswer: null, explanation: '' }))
          }
        }

        if (!Array.isArray(data)) return []
        return data.map((q, idx) => {
          // 严格的题目数据验证
          if (!q || typeof q !== 'object') {
            console.warn(`[题目${idx + 1}] 数据格式错误:`, q)
            return null
          }
          
          const question = q.question || ''
          if (!question || question.trim() === '') {
            console.warn(`[题目${idx + 1}] 题目内容为空`)
            return null
          }
          
          const options = Array.isArray(q.options) ? q.options.filter(opt => opt && String(opt).trim()) : []
          const correctAnswer = typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < options.length 
            ? q.correctAnswer 
            : null
          
          return {
            question: String(question).trim(),
            options,
            correctAnswer,
            userAnswer: null,
            explanation: q.explanation ? String(q.explanation).trim() : ''
          }
        }).filter(q => q && q.question)
      }

      const normalized = normalizeQuestions(assessment.questions)
      
      if (normalized.length === 0) {
        console.warn('考核题目为空或格式错误:', assessmentId)
      }
      
      setPracticeQuestions(normalized)
      
      console.log(`[数据一致性] 已加载考核 ${assessmentId}，题目数量: ${normalized.length}`)
    } catch (err) {
      console.error('加载考核题目失败:', err)
      setPracticeQuestions([])
    } finally {
      setPracticeLoading(false)
    }
  }, [availableAssessments])

  useEffect(() => {
    if (currentView === 'practice' && myCourses.length > 0 && availableAssessments.length === 0) {
      loadAvailableAssessments()
    }
  }, [currentView, myCourses, availableAssessments.length, loadAvailableAssessments])

  useEffect(() => {
    if (currentView !== 'practice') return
    if (selectedAssessmentId && practiceQuestions.length > 0) {
      const currentAssessment = availableAssessments.find(a => a.id === selectedAssessmentId)
      if (currentAssessment) {
        const expectedCount = Array.isArray(currentAssessment.questions) 
          ? currentAssessment.questions.length 
          : (typeof currentAssessment.questions === 'string' ? 1 : 0)
        
        if (practiceQuestions.length !== expectedCount && expectedCount > 0) {
          console.warn(`[数据一致性警告] 题目数量不匹配: 期望 ${expectedCount}, 实际 ${practiceQuestions.length}`)
        }
      }
    }
  }, [currentView, selectedAssessmentId, practiceQuestions.length, availableAssessments])



  const loadAssessmentsForPractice = useCallback(async (showLoading = true) => {
    if (currentView !== 'practice') return
    if (!myCourses || myCourses.length === 0) return
    
    // 如果用户正在答题过程中，跳过轮询（防止连续答题时白屏）
    if (practiceQuestions && practiceQuestions.length > 0) {
      const hasAnyAnswer = practiceQuestions.some(q => q && typeof q.userAnswer === 'number' && q.userAnswer >= 0)
      if (hasAnyAnswer) {
        console.log('[跳过轮询] 用户已开始答题，避免干扰')
        return
      }
    }
    
    if (showLoading) setPracticeLoading(true)
    
    try {
      const courseId = myCourses[0].id
      const res = await courses.getAssessments(courseId)
      const serverAssessments = res.assessments || []
      
      if (serverAssessments.length > 0) {
        const latestAssessment = serverAssessments[0]
        if (lastAssessmentId && latestAssessment.id !== lastAssessmentId) {
          setNewAssessmentsCount(prev => prev + 1)
        }
        setLastAssessmentId(latestAssessment.id)
        setCurrentAssessmentId(latestAssessment.id)
        
        const normalizeQuestions = (raw) => {
          let data = raw
          if (typeof data === 'string') {
            // 去掉可能的 “`json ” 前缀或反引号包裹
            let trimmed = data.trim()
            if (trimmed.toLowerCase().startsWith('json')) trimmed = trimmed.replace(/^json/i, '').trim()
            if (trimmed.startsWith('`') && trimmed.endsWith('`')) trimmed = trimmed.slice(1, -1).trim()
            try {
              data = JSON.parse(trimmed)
            } catch {
              const parts = trimmed.split(/\n\n+/).filter(Boolean)
              data = parts.map((p) => ({
                question: p.slice(0, 200),
                options: [],
                correctAnswer: null,
                userAnswer: null,
                explanation: ''
              }))
            }
          } else if (Array.isArray(data)) {
            if (data.length > 0 && typeof data[0] === 'string') {
              data = data.map(p => ({ question: String(p), options: [], correctAnswer: null, userAnswer: null, explanation: '' }))
            }
          }

          if (!Array.isArray(data)) return []
          return data.map((q, idx) => {
            // 严格的题目数据验证
            if (!q || typeof q !== 'object') {
              console.warn(`[题目${idx + 1}] 数据格式错误:`, q)
              return null
            }
            
            const question = q.question || ''
            if (!question || question.trim() === '') {
              console.warn(`[题目${idx + 1}] 题目内容为空`)
              return null
            }
            
            const options = Array.isArray(q.options) ? q.options.filter(opt => opt && String(opt).trim()) : []
            const correctAnswer = typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < options.length 
              ? q.correctAnswer 
              : null
            
            return {
              question: String(question).trim(),
              options,
              correctAnswer,
              userAnswer: null,
              explanation: q.explanation ? String(q.explanation).trim() : ''
            }
          }).filter(q => q && q.question)
        }

        const normalized = normalizeQuestions(latestAssessment.questions)

        if (normalized.length > 0) {
          // 保留用户已作答的答案
          const mergedQuestions = (() => {
            const prev = practiceQuestions
            if (!prev || prev.length === 0) {
              return normalized
            }
            return normalized.map((q, idx) => {
              if (prev[idx] && typeof prev[idx].userAnswer === 'number' && prev[idx].userAnswer >= 0) {
                return {
                  ...q,
                  userAnswer: prev[idx].userAnswer
                }
              }
              return q
            })
          })()
          
          // 计算安全的新索引值
          const safeIndex = (() => {
            const prev = currentQuestionIndex
            if (prev === 0) return 0
            const maxIndex = mergedQuestions.length - 1
            return Math.max(0, Math.min(prev, maxIndex))
          })()
          
          // 批量更新状态，确保数据一致性
          setPracticeQuestions(mergedQuestions)
          setCurrentQuestionIndex(safeIndex)
          setPracticeScore(null)
          setPracticeStats(null)
        }
      }
    } catch (err) {
      console.warn('拉取练习题失败', err)
    } finally {
      if (showLoading) setPracticeLoading(false)
    }
  }, [currentView, myCourses, lastAssessmentId])

  const handleRefreshAssessments = () => {
    setNewAssessmentsCount(0)
    loadAvailableAssessments()
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsSending(true)
    const userMessage = { id: Date.now(), type: 'user', content: newMessage }
    setChatMessages(prev => [...prev, userMessage])
    setNewMessage('')

    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }, AI_REQUEST_TIMEOUT)

    try {
      const response = await ai.chat({
        message: userMessage.content,
        context: 'student_learning'
      })
      
      clearTimeout(timeoutId)
      
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: response.reply
      }
      setChatMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        const timeoutMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: '抱歉，请求超时了。请稍后重试。'
        }
        setChatMessages(prev => [...prev, timeoutMessage])
      } else {
        console.error('AI助手回复失败:', error)
        const assistantMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: `关于"${userMessage.content}"这个问题，我来为你详细解答：\n\n这是一个很好的问题！让我从几个方面来解释：\n\n**基本概念：**\n${userMessage.content}涉及到编程的核心概念，理解它对你的学习很重要。\n\n**实际应用：**\n在实际编程中，这个概念经常被用到，特别是在数据处理和算法实现方面。\n\n**学习建议：**\n1. 多做练习题来加深理解\n2. 查看相关的代码示例\n3. 尝试自己编写相关的程序\n\n有其他问题随时问我！`
        }
        setChatMessages(prev => [...prev, assistantMessage])
      }
    }
    setIsSending(false)
  }

  const submitPracticeAnswer = (questionIndex, answerIndex) => {
    if (!practiceQuestions || practiceQuestions.length === 0) {
      console.error('No questions available')
      return
    }
    const safeQuestionIndex = Math.max(0, Math.min(questionIndex, practiceQuestions.length - 1))
    if (answerIndex < 0 || !practiceQuestions[safeQuestionIndex]?.options || answerIndex >= practiceQuestions[safeQuestionIndex].options.length) {
      console.error('Invalid answer index:', answerIndex)
      return
    }
    const updatedQuestions = [...practiceQuestions]
    updatedQuestions[safeQuestionIndex] = {
      ...updatedQuestions[safeQuestionIndex],
      userAnswer: answerIndex
    }
    setPracticeQuestions(updatedQuestions)
  }

  const handleQuestionNavigation = (targetIndex) => {
    if (!practiceQuestions || practiceQuestions.length === 0) {
      console.error('No questions available')
      return
    }
    const numericIndex = typeof targetIndex === 'number' ? targetIndex : parseInt(targetIndex, 10)
    if (isNaN(numericIndex)) {
      console.error('Invalid target index (not a number):', targetIndex)
      return
    }
    const maxIndex = practiceQuestions.length - 1
    const safeIndex = Math.max(0, Math.min(numericIndex, maxIndex))
    if (safeIndex === currentQuestionIndex) {
      return
    }
    console.log('Navigating to question:', safeIndex, 'out of', practiceQuestions.length, 'questions')
    setCurrentQuestionIndex(safeIndex)
  }

  const isQuestionAnswered = (question) => {
    return question && typeof question.userAnswer === 'number' && question.userAnswer >= 0
  }

  const completePractice = async () => {
    if (isSubmitting) return
    
    const validatePracticeData = () => {
      const errors = []
      const warnings = []
      
      if (!practiceQuestions || practiceQuestions.length === 0) {
        errors.push('没有可提交的题目')
        return { isValid: false, errors, warnings }
      }
      
      const unansweredQuestions = practiceQuestions
        .map((q, idx) => ({ q, idx }))
        .filter(({ q }) => q.options && q.options.length > 0 && !isQuestionAnswered(q))
      
      if (unansweredQuestions.length > 0) {
        errors.push(`第 ${unansweredQuestions.map(({ idx }) => idx + 1).join(', ')} 题未作答`)
      }
      
      practiceQuestions.forEach((q, idx) => {
        if (!q.question || q.question.trim() === '') {
          warnings.push(`第 ${idx + 1} 题题目内容为空`)
        }
        if (q.options && q.options.some(opt => !opt || opt.trim() === '')) {
          warnings.push(`第 ${idx + 1} 题存在空选项`)
        }
      })
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    }
    
    const validation = validatePracticeData()
    if (!validation.isValid) {
      alert(`数据校验失败:\n${validation.errors.join('\n')}`)
      return
    }
    
    if (validation.warnings.length > 0) {
      console.warn('数据校验警告:', validation.warnings)
    }
    
    setIsSubmitting(true)
    setSubmitProgress(0)
    setSyncStatus('calculating')
    
    const validQuestions = practiceQuestions.filter(q => q.options && q.options.length > 0)
    const correctAnswers = validQuestions.filter(q => 
      typeof q.userAnswer === 'number' && 
      typeof q.correctAnswer === 'number' && 
      q.userAnswer === q.correctAnswer
    ).length
    const score = validQuestions.length > 0 ? Math.round((correctAnswers / validQuestions.length) * 100) : 0
    
    await new Promise(resolve => setTimeout(resolve, 100))
    setSubmitProgress(20)
    
    const questionStats = practiceQuestions.map((q) => {
      const hasOptions = Array.isArray(q.options) && q.options.length > 0
      const optionCounts = hasOptions ? q.options.map((_, idx) => (typeof q.userAnswer === 'number' && q.userAnswer === idx ? 1 : 0)) : []
      const isCorrect = typeof q.userAnswer === 'number' && 
                        typeof q.correctAnswer === 'number' && 
                        q.userAnswer === q.correctAnswer
      return {
        correct: isCorrect,
        optionCounts
      }
    })
    
    setPracticeStats({
      overall: score,
      questions: questionStats
    })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    setSubmitProgress(40)
    setSyncStatus('submitting')
    
    try {
      const answers = practiceQuestions.map(q => q.userAnswer)
      
      if (currentAssessmentId) {
        try {
          await student.validatePracticeData({
            assessment_id: currentAssessmentId,
            answers: answers,
            score: score
          })
        } catch (validationError) {
          console.warn('后端数据校验警告:', validationError)
        }
        
        await ai.evaluatePractice({
          assessment_id: currentAssessmentId,
          user_answer: JSON.stringify(answers),
          score: score,
          student_id: user?.id || 'current_student'
        })
      } else {
        await ai.evaluatePractice({
          questions: practiceQuestions,
          score: score,
          student_id: user?.id || 'current_student'
        })
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
      setSubmitProgress(70)
      setSyncStatus('syncing')
      
      try {
        const dashboardSummary = await student.getDashboardSummary()
        if (dashboardSummary && dashboardSummary.stats) {
          setStats(prev => ({
            ...prev,
            practiceCount: dashboardSummary.stats.total_practices,
            averageScore: dashboardSummary.stats.avg_score
          }))
        }
        
        // 修复：练习提交成功后自动刷新错题统计，确保概览页展示最新数据
        try {
          await fetchMistakeStats()
          console.log('[练习提交] 错题统计已刷新')
        } catch (mistakeError) {
          console.warn('[练习提交] 刷新错题统计失败:', mistakeError)
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        setSubmitProgress(90)
      } catch (syncError) {
        console.warn('同步统计数据失败:', syncError)
      }
      
      setSubmitProgress(100)
      setSyncStatus('completed')
      
      await new Promise(resolve => setTimeout(resolve, 300))
      setPracticeScore(score)
      setSyncStatus(null)
      
    } catch (error) {
      console.error('练习评测提交失败:', error)
      setSyncStatus('error')
      setNetworkStatus(navigator.onLine ? 'online' : 'offline')
      
      const savedData = {
        assessmentId: currentAssessmentId,
        answers: practiceQuestions.map(q => q.userAnswer),
        score: score,
        timestamp: Date.now(),
        evaluationResult: ''
      }
      
      try {
        const pendingSubmissions = JSON.parse(localStorage.getItem('pendingPracticeSubmissions') || '[]')
        const existingIndex = pendingSubmissions.findIndex(s => s.assessmentId === currentAssessmentId)
        
        if (existingIndex >= 0) {
          if (score > (pendingSubmissions[existingIndex].score || 0)) {
            pendingSubmissions[existingIndex] = savedData
            console.log('更新本地缓存的练习结果（更高分数）')
          }
        } else {
          pendingSubmissions.push(savedData)
          console.log('练习结果已保存到本地，将在网络恢复后同步')
        }
        
        localStorage.setItem('pendingPracticeSubmissions', JSON.stringify(pendingSubmissions))
      } catch (e) {
        console.error('本地保存失败:', e)
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setPracticeScore(score)
      setSyncStatus(null)
    } finally {
      setIsSubmitting(false)
      setSubmitProgress(0)
    }
  }

  const renderContent = () => {
    switch (currentView) {
      case 'courses':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">我的课程</h2>
                <p className="text-gray-600">查看和管理你的学习课程</p>
              </div>
              <Button variant="outline" onClick={fetchMyCourses} disabled={coursesLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${coursesLoading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>

            {coursesError && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 flex items-center text-red-700">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {coursesError}
                </CardContent>
              </Card>
            )}

            {coursesLoading ? (
              <div className="flex justify-center items-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">加载中...</span>
              </div>
            ) : myCourses.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">暂无课程，请联系教师添加课程</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <BookOpen className="h-8 w-8 text-blue-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">已选课程</p>
                          <p className="text-2xl font-bold text-gray-900">{myCourses.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-green-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">平均进度</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {myCourses.length > 0 ? Math.round(myCourses.reduce((sum, course) => sum + course.progress, 0) / myCourses.length) : 0}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <CheckCircle className="h-8 w-8 text-purple-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">完成考核</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.completedExams}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {myCourses.map((course) => (
                    <Card key={course.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{course.title}</CardTitle>
                            {course.subtitle && <p className="text-sm text-gray-700">{course.subtitle}</p>}
                            <p className="text-sm text-gray-600">讲师：{course.instructor}</p>
                          </div>
                          <Badge className={course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {course.status === 'active' ? '进行中' : '已完成'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <div>
                                <span className="mr-4">进度：{course.progress}%</span>
                                <span className="mr-4">章节：{course.lessonsCount ?? (course.modules ? course.modules.reduce((s,m)=>s+(m.lessons||0),0):'-')}</span>
                                <span>时长：{course.durationHours ?? '-'}小时</span>
                              </div>
                              <span>{course.progress}%</span>
                            </div>
                            <Progress value={course.progress} className="h-2" />
                          </div>
                          <div>
                            {course.description && <p className="text-sm text-gray-700 line-clamp-2">{course.description}</p>}
                            <p className="text-sm text-gray-600">下节课：{course.nextLesson} · {course.nextLessonDate || ''}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(course.tags || []).slice(0,4).map((t, i) => (
                            <Badge key={i} className="bg-gray-100 text-gray-800">{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" className="flex-1" onClick={() => navigate(`/student/course/${course.id}`)}>
                          <Play className="w-4 h-4 mr-2" />
                          继续学习
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/student/course/${course.id}`)}>
                          查看详情
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
          )}
          </div>
        )

      case 'assistant':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">AI学习助手</h2>
              <p className="text-gray-600">智能问答，解决你的学习疑问</p>
            </div>

            <AIChatPanel
              title="智能对话"
              placeholder="输入你的学习问题..."
              context="student_learning"
              showConnectionStatus={true}
              className="h-[600px]"
            />
          </div>
        )

      case 'practice':
        return (
          <PracticeModule 
            myCourses={myCourses} 
            onBack={() => setCurrentView('courses')}
          />
        )

      case 'mistakeBook':
        return (
          <MistakeBook myCourses={myCourses} />
        )

      case 'notes':
        return (
          <StudyNotes myCourses={myCourses} />
        )

      case 'progress':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">学习进度</h2>
              <p className="text-gray-600">你的学习时长和课程完成情况</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookX className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">错题总数</p>
                      <p className="text-2xl font-bold text-gray-900">{mistakeStats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">待复习</p>
                      <p className="text-2xl font-bold text-gray-900">{mistakeStats.unmastered + mistakeStats.reviewing}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">已掌握</p>
                      <p className="text-2xl font-bold text-gray-900">{mistakeStats.mastered}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <StickyNote className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">学习笔记</p>
                      <p className="text-2xl font-bold text-gray-900">{noteStats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>每周学习时长</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={weeklyProgressData}
                      margin={{
                        top: 10, right: 30, left: 0, bottom: 0,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="hours" stroke="#8884d8" fill="#8884d8" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>课程完成度</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={courseProgressData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="progress" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookX className="h-5 w-5 text-red-500" />
                    错题掌握情况
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>未掌握</span>
                        <span className="text-red-600">{mistakeStats.unmastered} 道</span>
                      </div>
                      <Progress 
                        value={mistakeStats.total > 0 ? (mistakeStats.unmastered / mistakeStats.total) * 100 : 0} 
                        className="h-2 bg-red-100 [&>div]:bg-red-500" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>复习中</span>
                        <span className="text-orange-600">{mistakeStats.reviewing} 道</span>
                      </div>
                      <Progress 
                        value={mistakeStats.total > 0 ? (mistakeStats.reviewing / mistakeStats.total) * 100 : 0} 
                        className="h-2 bg-orange-100 [&>div]:bg-orange-500" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>已掌握</span>
                        <span className="text-green-600">{mistakeStats.mastered} 道</span>
                      </div>
                      <Progress 
                        value={mistakeStats.total > 0 ? (mistakeStats.mastered / mistakeStats.total) * 100 : 0} 
                        className="h-2 bg-green-100 [&>div]:bg-green-500" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <StickyNote className="h-5 w-5 text-purple-500" />
                    笔记活动时间线
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {noteStats.recentNotes.length > 0 ? (
                    <div className="space-y-4">
                      {noteStats.recentNotes.map((note, index) => (
                        <div key={note.id || index} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            {index < noteStats.recentNotes.length - 1 && (
                              <div className="w-0.5 h-full bg-purple-200 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-medium text-gray-800">
                              {note.title || '无标题笔记'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {note.created_at ? new Date(note.created_at).toLocaleString('zh-CN') : ''}
                            </p>
                            {note.course_title && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {note.course_title}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <StickyNote className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">暂无笔记记录</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>学习成就</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3">
                    <Award className="h-8 w-8 text-yellow-500" />
                    <div>
                      <p className="font-medium">初级Python开发者</p>
                      <p className="text-sm text-gray-600">完成Python基础课程</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Star className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">AI学习之星</p>
                      <p className="text-sm text-gray-600">AI助手互动超过100次</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="font-medium">连续学习者</p>
                      <p className="text-sm text-gray-600">连续学习7天</p>
                    </div>
                  </div>
                  {mistakeStats.mastered >= 10 && (
                    <div className="flex items-center space-x-3">
                      <BookX className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="font-medium">错题克星</p>
                        <p className="text-sm text-gray-600">掌握10道以上错题</p>
                      </div>
                    </div>
                  )}
                  {noteStats.total >= 10 && (
                    <div className="flex items-center space-x-3">
                      <StickyNote className="h-8 w-8 text-purple-500" />
                      <div>
                        <p className="font-medium">笔记达人</p>
                        <p className="text-sm text-gray-600">创建10篇以上笔记</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">学生设置</h2>
              <p className="text-gray-600">管理你的个人信息和偏好设置</p>
            </div>
            <StudentSettings 
              onSettingsChange={handleSettingsChange} 
              initialSettings={studentSettings} 
            />
          </div>
        )

      default:
        return (
          <div className="space-y-6">
            {studentSettings?.learning_goal && (
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <Flag className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg text-blue-800">我的学习目标</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm text-blue-900">
                    {studentSettings.learning_goal}
                  </pre>
                </CardContent>
              </Card>
            )}
            
            {/* 概览标题 */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">学生概览</h2>
              <p className="text-gray-600">欢迎回来！</p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">已选课程</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.enrolledCourses}</p>
                      <p className="text-xs text-gray-500">你正在学习的课程</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Award className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">完成考核</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.completedExams}</p>
                      <p className="text-xs text-gray-500">已完成的考试和测验</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Target className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">练习次数</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.practiceCount}</p>
                      <p className="text-xs text-gray-500">累计练习次数</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">平均得分</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.averageScore}</p>
                      <p className="text-xs text-gray-500">所有考核的平均分</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCurrentView('mistakeBook')}>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookX className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">错题总数</p>
                      <p className="text-2xl font-bold text-gray-900">{mistakeStats.total}</p>
                      <p className="text-xs text-gray-500">待复习: {mistakeStats.unmastered + mistakeStats.reviewing}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCurrentView('notes')}>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <StickyNote className="h-8 w-8 text-indigo-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">学习笔记</p>
                      <p className="text-2xl font-bold text-gray-900">{noteStats.total}</p>
                      <p className="text-xs text-gray-500">公开: {noteStats.public}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 快速操作 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
              <p className="text-gray-600 mb-6">常用学习功能快速入口</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('courses')}>
                  <CardContent className="p-6 text-center">
                    <BookOpen className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">我的课程</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('assistant')}>
                  <CardContent className="p-6 text-center">
                    <MessageCircle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">AI学习助手</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('practice')}>
                  <CardContent className="p-6 text-center">
                    <Target className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">练习评测</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow relative" onClick={() => setCurrentView('mistakeBook')}>
                  <CardContent className="p-6 text-center">
                    <BookX className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">错题本</h4>
                    {mistakeStats.todayReview > 0 && (
                      <Badge className="absolute -top-2 -right-2 bg-red-500 text-white">
                        {mistakeStats.todayReview}
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('notes')}>
                  <CardContent className="p-6 text-center">
                    <StickyNote className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">学习笔记</h4>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 最近活动和系统警告 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>最近活动</CardTitle>
                  <p className="text-sm text-gray-600">你的学习活动记录</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">完成了Python基础练习</p>
                        <p className="text-xs text-gray-500">1小时前</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">向AI助手提问了关于函数的问题</p>
                        <p className="text-xs text-gray-500">3小时前</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <BookOpen className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium">提交了《数据结构》测验</p>
                        <p className="text-xs text-gray-500">1天前</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    错题复习提醒
                  </CardTitle>
                  <p className="text-sm text-gray-600">今日待复习的错题</p>
                </CardHeader>
                <CardContent>
                  {mistakeStats.todayReview > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <BookX className="h-5 w-5 text-red-600" />
                          <span className="text-sm font-medium text-red-800">
                            今日待复习: {mistakeStats.todayReview} 道错题
                          </span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setCurrentView('mistakeBook')}
                          className="text-red-600 border-red-200 hover:bg-red-100"
                        >
                          去复习
                        </Button>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>未掌握: {mistakeStats.unmastered} 道</p>
                        <p>复习中: {mistakeStats.reviewing} 道</p>
                        <p>已掌握: {mistakeStats.mastered} 道</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                        <p className="text-sm text-gray-600">今日错题已复习完毕</p>
                        <p className="text-xs text-gray-400 mt-1">继续保持！</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <StickyNote className="h-5 w-5 text-purple-500" />
                    最近笔记
                  </CardTitle>
                  <p className="text-sm text-gray-600">你最近创建的学习笔记</p>
                </CardHeader>
                <CardContent>
                  {noteStats.recentNotes.length > 0 ? (
                    <div className="space-y-3">
                      {noteStats.recentNotes.slice(0, 3).map((note, index) => (
                        <div 
                          key={note.id || index}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                          onClick={() => setCurrentView('notes')}
                        >
                          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {note.title || '无标题笔记'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {note.created_at ? new Date(note.created_at).toLocaleDateString('zh-CN') : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                      {noteStats.total > 3 && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          onClick={() => setCurrentView('notes')}
                          className="w-full text-purple-600"
                        >
                          查看全部 {noteStats.total} 篇笔记
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <div className="text-center">
                        <StickyNote className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">暂无笔记</p>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setCurrentView('notes')}
                          className="mt-2"
                        >
                          创建笔记
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">生</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">学生控台</h1>
                  <p className="text-sm text-gray-600">欢迎回来</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={studentSettings?.avatar} alt={studentSettings?.real_name || user?.username} />
                  <AvatarFallback>
                    {(studentSettings?.real_name || user?.username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {studentSettings?.real_name || user?.username}
                  </p>
                  <p className="text-xs text-gray-500">学生</p>
                </div>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600">
                在线
              </Badge>
              <Button variant="outline" onClick={async () => {
                try {
                  await auth.logout()
                } catch (err) {
                  console.warn('后台登出请求失败:', err)
                }
                localStorage.removeItem('currentUser')
                if (typeof onLogout === 'function') onLogout()
                navigate('/login')
              }}>
                退出登录
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          {/* 侧边栏 */}
          <div className="w-64 mr-8">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      currentView === item.id
                        ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* 主内容区 */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

