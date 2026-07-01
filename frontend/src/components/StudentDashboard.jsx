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
  GraduationCap,
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
  AlertTriangle,
  Crosshair,
  Radar,
  Map,
  Network,
  LogIn,
  Flame,
  Shield,
  Sparkles
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { courses, ai, auth, student, studentSettings as studentSettingsApi, notes, mistakeBook, achievements as achievementApi } from '../services/api'
import { useNavigate } from 'react-router-dom'
import PracticeModule from './Practice'
import LearningPlanSystem from './LearningPlanSystem'
import StudentSettings from './StudentSettings'
import { AITutorPanel } from '@/components/AITutor'
import MistakeBook from './MistakeBook'
import TargetedTherapy from './MistakeBook/TargetedTherapy'
import StudyNotes from './StudyNotes'
import AchievementPanel from './AchievementPanel'
import ProfileBuilder from './ProfileBuilder'
import { KnowledgeGraph3D } from '@/components/KnowledgeGraph3D'

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

  // 学习成就卡片数据：从后端成就系统获取真实数据，替代原本的硬编码启发式条件
  const [achievementSummary, setAchievementSummary] = useState(null)

  const [myCourses, setMyCourses] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState(null)

  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const [practiceQuestions, setPracticeQuestions] = useState([])
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

  const [weeklyProgressData, setWeeklyProgressData] = useState([
    { day: '周一', hours: 2.5, completed: 3 },
    { day: '周二', hours: 3.2, completed: 4 },
    { day: '周三', hours: 1.8, completed: 2 },
    { day: '周四', hours: 4.1, completed: 5 },
    { day: '周五', hours: 3.5, completed: 4 },
    { day: '周六', hours: 2.0, completed: 2 },
    { day: '周日', hours: 2.8, completed: 3 }
  ])
  const [courseProgressData, setCourseProgressData] = useState([
    { name: 'Python 基础', progress: 78, color: '#d4a853' },
    { name: 'TensorFlow.js', progress: 65, color: '#5a9e6f' },
    { name: '深度学习', progress: 45, color: '#c47a3a' }
  ])
  const [recentActivities, setRecentActivities] = useState([])

  const menuItems = [
    { id: 'overview', label: '学习概览', icon: BarChart3 },
    { id: 'courses', label: '我的课程', icon: BookOpen },
    { id: 'learningPlan', label: '学习规划', icon: Map },
    { id: 'knowledgeGraph', label: '知识图谱', icon: Network },
    { id: 'aiTutor', label: 'AI助教', icon: GraduationCap },
    { id: 'practice', label: '练习评测', icon: Target },
    { id: 'mistakeBook', label: '错题本', icon: BookX },
    { id: 'profile', label: '学习画像', icon: Radar },
    { id: 'notes', label: '学习笔记', icon: StickyNote },
    { id: 'achievements', label: '学习成就', icon: Award },
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
        setMyCourses(coursesData.map(c => {
          const vs = c.video_stats || {}
          // 基于视频完成状态计算真实进度、章节数、总时长和下节课信息
          const totalVideos = vs.total_videos ?? 0
          const completedVideos = vs.completed_videos ?? 0
          const progress = totalVideos > 0
            ? Math.round((completedVideos / totalVideos) * 100)
            : (c.progress_percentage || 0)
          const durationHours = vs.total_duration_hours ?? '-'
          const lastWatched = vs.last_watched_at || c.last_accessed
          const nextLessonTitle = vs.next_video_title || '继续学习'
          const nextLessonDate = lastWatched
            ? new Date(lastWatched).toISOString().split('T')[0]
            : ''

          return {
            id: c.id,
            title: c.title,
            subtitle: c.description?.slice(0, 50) || '',
            description: c.description || '',
            progress,
            instructor: c.teacher_name || '未知教师',
            instructorId: c.teacher_id,
            lessonsCount: totalVideos,
            durationHours,
            nextLesson: nextLessonTitle,
            nextLessonDate,
            lastWatchedAt: lastWatched,
            status: progress >= 100 ? 'completed' : 'active',
            tags: [],
            modules: []
          }
        }))
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

  const checkAchievements = useCallback(async () => {
    try {
      await achievementApi.check()
    } catch (error) {
      console.warn('成就检查失败:', error)
    }
  }, [])

  const fetchNoteStats = useCallback(async () => {
    try {
      const [statsResponse, notesResponse] = await Promise.all([
        notes.getStats(),
        notes.getNotes({ per_page: 5 })
      ])
      const s = statsResponse?.stats || statsResponse || {}
      setNoteStats({
        total: s.total_notes || 0,
        public: s.public_notes || 0,
        recentNotes: notesResponse?.notes || statsResponse?.recent_notes || []
      })
    } catch (error) {
      console.warn('获取笔记统计失败:', error)
    }
  }, [])

  // 拉取后端成就系统数据，用于概览页"学习成就"卡片展示真实解锁状态
  const fetchAchievementSummary = useCallback(async () => {
    try {
      const result = await achievementApi.getAll()
      setAchievementSummary(result)
    } catch (error) {
      console.warn('获取成就数据失败:', error)
    }
  }, [])

  const fetchProgressChartData = useCallback(async () => {
    try {
      const res = await student.getLearningProgressChart()
      const data = res?.data || res || {}
      if (data.weekly_progress && Array.isArray(data.weekly_progress) && data.weekly_progress.length > 0) {
        setWeeklyProgressData(data.weekly_progress)
      } else {
        // 模拟数据：每周学习时长
        setWeeklyProgressData([
          { day: '周一', hours: 2.5, completed: 3 },
          { day: '周二', hours: 3.2, completed: 4 },
          { day: '周三', hours: 1.8, completed: 2 },
          { day: '周四', hours: 4.1, completed: 5 },
          { day: '周五', hours: 3.5, completed: 4 },
          { day: '周六', hours: 2.0, completed: 2 },
          { day: '周日', hours: 2.8, completed: 3 }
        ])
      }
      if (data.course_progress && Array.isArray(data.course_progress) && data.course_progress.length > 0) {
        setCourseProgressData(data.course_progress)
      } else {
        // 模拟数据：课程完成度
        setCourseProgressData([
          { name: 'Python 基础', progress: 78, color: '#d4a853' },
          { name: 'TensorFlow.js', progress: 65, color: '#5a9e6f' },
          { name: '深度学习', progress: 45, color: '#c47a3a' }
        ])
      }
    } catch (error) {
      console.warn('获取学习进度图表数据失败，使用模拟数据', error)
      // 全部使用模拟数据
      setWeeklyProgressData([
        { day: '周一', hours: 2.5, completed: 3 },
        { day: '周二', hours: 3.2, completed: 4 },
        { day: '周三', hours: 1.8, completed: 2 },
        { day: '周四', hours: 4.1, completed: 5 },
        { day: '周五', hours: 3.5, completed: 4 },
        { day: '周六', hours: 2.0, completed: 2 },
        { day: '周日', hours: 2.8, completed: 3 }
      ])
      setCourseProgressData([
        { name: 'Python 基础', progress: 78, color: '#d4a853' },
        { name: 'TensorFlow.js', progress: 65, color: '#5a9e6f' },
        { name: '深度学习', progress: 45, color: '#c47a3a' }
      ])
    }
  }, [])

  const fetchRecentActivities = useCallback(async () => {
    try {
      const res = await student.getDashboardSummary()
      const activities = res?.recent_activities || res?.activities || []
      if (Array.isArray(activities)) setRecentActivities(activities)
    } catch (error) {
      console.warn('获取最近活动失败:', error)
    }
  }, [])

  useEffect(() => {
    fetchMyCourses()
    fetchLearningStats()
    fetchMistakeStats()
    fetchNoteStats()
    fetchProgressChartData()
    fetchRecentActivities()
    fetchAchievementSummary()
  }, [fetchMyCourses, fetchLearningStats, fetchMistakeStats, fetchNoteStats, fetchAchievementSummary])

  // 修复：监听视图切换，当从练习页切回概览时自动刷新错题和学习统计
  useEffect(() => {
    if (currentView === 'overview') {
      console.log('[视图切换] 切换到概览页面，刷新统计数据')
      fetchMistakeStats()
      fetchLearningStats()
      fetchNoteStats()
      fetchAchievementSummary()
      checkAchievements()
    }
  }, [currentView, fetchMistakeStats, fetchLearningStats, fetchNoteStats, fetchAchievementSummary, checkAchievements])

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
          content: '抱歉，回复生成失败，请稍后重试。'
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
      case 'learningPlan':
        return <LearningPlanSystem user={user} />
      case 'knowledgeGraph':
        return <KnowledgeGraph3D myCourses={myCourses} />
      case 'courses':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>我的课程</h2>
                <p className="text-[#6b6560]">查看和管理你的学习课程</p>
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
                <RefreshCw className="w-8 h-8 animate-spin text-[#d4a853]" />
                <span className="ml-2 text-[#6b6560]">加载中...</span>
              </div>
            ) : myCourses.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-[#9a9590] mb-4" />
                  <p className="text-[#6b6560]">暂无课程，请联系教师添加课程</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="rounded-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <BookOpen className="h-8 w-8 text-[#d4a853]" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-[#6b6560]">已选课程</p>
                          <p className="text-2xl font-bold text-[#2d2a26]">{myCourses.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-[#5a9e6f]" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-[#6b6560]">平均进度</p>
                          <p className="text-2xl font-bold text-[#2d2a26]">
                            {myCourses.length > 0 ? Math.round(myCourses.reduce((sum, course) => sum + course.progress, 0) / myCourses.length) : 0}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <CheckCircle className="h-8 w-8 text-[#8b6fb0]" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-[#6b6560]">完成考核</p>
                          <p className="text-2xl font-bold text-[#2d2a26]">{stats.completedExams}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {myCourses.map((course) => (
                    <Card key={course.id} className="hover:shadow-lg transition-shadow rounded-xl">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{course.title}</CardTitle>
                            {course.subtitle && <p className="text-sm text-[#6b6560]">{course.subtitle}</p>}
                            <p className="text-sm text-[#6b6560]">讲师：{course.instructor}</p>
                          </div>
                          <Badge className={course.status === 'active' ? 'bg-[#5a9e6f18] text-[#5a9e6f]' : 'bg-[#f5f2ee] text-[#6b6560]'}>
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
                            {course.description && <p className="text-sm text-[#6b6560] line-clamp-2">{course.description}</p>}
                            <p className="text-sm text-[#6b6560]">下节课：{course.nextLesson} · {course.nextLessonDate || ''}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(course.tags || []).slice(0,4).map((t, i) => (
                            <Badge key={i} className="bg-[#f5f2ee] text-[#6b6560]">{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" className="flex-1 rounded-[10px]" onClick={() => navigate(`/student/course/${course.id}`)}>
                          <Play className="w-4 h-4 mr-2" />
                          继续学习
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => navigate(`/student/course/${course.id}`)}>
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

      case 'aiTutor':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>AI助教</h2>
              <p className="text-[#6b6560]">智能答疑、知识讲解、学习引导与诊断</p>
            </div>

            <AITutorPanel className="h-[600px]" />
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

      case 'profile':
        return (
          <ProfileBuilder />
        )

      case 'targetedTherapy':
        return (
          <TargetedTherapy myCourses={myCourses} />
        )

      case 'notes':
        return (
          <StudyNotes myCourses={myCourses} />
        )

      case 'achievements':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>学习成就</h2>
              <p className="text-[#6b6560]">追踪你的学习里程碑，解锁更多成就</p>
            </div>
            <AchievementPanel />
          </div>
        )

      case 'progress':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>学习进度</h2>
              <p className="text-[#6b6560]">你的学习时长和课程完成情况</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookX className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">错题总数</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{mistakeStats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <AlertTriangle className="h-8 w-8 text-[#c47a3a]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">待复习</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{mistakeStats.unmastered + mistakeStats.reviewing}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-[#5a9e6f]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">已掌握</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{mistakeStats.mastered}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <StickyNote className="h-8 w-8 text-[#8b6fb0]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">学习笔记</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{noteStats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>每周学习时长</CardTitle>
                </CardHeader>
                <CardContent>
                  {weeklyProgressData.length > 0 ? (
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
                        <Area type="monotone" dataKey="hours" stroke="#d4a853" fill="#d4a85320" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-[#9a9590]">
                      <p>暂无学习时长数据</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>课程完成度</CardTitle>
                </CardHeader>
                <CardContent>
                  {courseProgressData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={courseProgressData} margin={{ bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, angle: -30, textAnchor: 'end' }} interval={0} height={60} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="progress" fill="#d4a853" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-[#9a9590]">
                      <p>暂无课程进度数据</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
                        <span className="text-[#c47a3a]">{mistakeStats.reviewing} 道</span>
                      </div>
                      <Progress 
                        value={mistakeStats.total > 0 ? (mistakeStats.reviewing / mistakeStats.total) * 100 : 0} 
                        className="h-2 bg-[#c47a3a20] [&>div]:bg-[#c47a3a]" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>已掌握</span>
                        <span className="text-[#5a9e6f]">{mistakeStats.mastered} 道</span>
                      </div>
                      <Progress 
                        value={mistakeStats.total > 0 ? (mistakeStats.mastered / mistakeStats.total) * 100 : 0} 
                        className="h-2 bg-[#5a9e6f20] [&>div]:bg-[#5a9e6f]" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <StickyNote className="h-5 w-5 text-[#8b6fb0]" />
                    笔记活动时间线
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {noteStats.recentNotes.length > 0 ? (
                    <div className="space-y-4">
                      {noteStats.recentNotes.map((note, index) => (
                        <div key={note.id || index} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-[#8b6fb0]" />
                            {index < noteStats.recentNotes.length - 1 && (
                              <div className="w-0.5 h-full bg-[#8b6fb040] mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-medium text-[#2d2a26]">
                              {note.title || '无标题笔记'}
                            </p>
                            <p className="text-xs text-[#9a9590]">
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
                    <div className="text-center py-8 text-[#9a9590]">
                      <StickyNote className="h-10 w-10 mx-auto mb-2 text-[#9a9590]" />
                      <p className="text-sm">暂无笔记记录</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>学习成就</CardTitle>
                  <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => setCurrentView('achievements')}>
                    查看全部
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  // 成就图标映射：与后端 achievement.icon 字段对齐，缺失时回退到 Award
                  const ICON_MAP = {
                    LogIn, Clock, Flame, Target, BookOpen, BookX, CheckCircle,
                    RefreshCw, FileText, GraduationCap, Shield, TrendingUp, Star, Award,
                  }
                  const renderIcon = (iconName, className) => {
                    const Comp = ICON_MAP[iconName] || Award
                    return <Comp className={className} />
                  }

                  // 后端成就数据已加载：展示真实解锁的成就
                  if (achievementSummary && Array.isArray(achievementSummary.achievements)) {
                    const total = achievementSummary.total_count || achievementSummary.achievements.length || 0
                    const unlockedCount = achievementSummary.unlocked_count || 0
                    const unlocked = achievementSummary.achievements
                      .filter(a => a && a.unlocked)
                      .sort((a, b) => new Date(b.unlocked_at || 0) - new Date(a.unlocked_at || 0))
                      .slice(0, 6)

                    if (unlocked.length > 0) {
                      return (
                        <>
                          <div className="flex items-center gap-2 mb-3 text-xs text-[#6b6560]">
                            <Sparkles className="h-3.5 w-3.5 text-[#d4a853]" />
                            <span>已解锁 {unlockedCount} / {total} 项成就</span>
                            {achievementSummary.total_points > 0 && (
                              <span className="ml-auto">累计积分 {achievementSummary.total_points}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {unlocked.map(a => (
                              <div key={a.id} className="flex items-center space-x-3">
                                {renderIcon(a.icon, 'h-8 w-8 text-[#d4a853]')}
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{a.name}</p>
                                  <p className="text-sm text-[#6b6560] truncate">{a.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    }
                    // 后端有成就定义但用户尚未解锁任何成就
                    return (
                      <div className="col-span-full flex items-center justify-center py-8 text-[#9a9590]">
                        <div className="text-center">
                          <Award className="h-12 w-12 mx-auto mb-3 text-[#9a9590]" />
                          <p className="text-sm">继续学习，解锁更多成就</p>
                          <p className="text-xs mt-1">已解锁 0 / {total} 项成就</p>
                        </div>
                      </div>
                    )
                  }

                  // 后端数据加载中或失败时的兜底（不再依赖本地启发式条件）
                  return (
                    <div className="col-span-full flex items-center justify-center py-8 text-[#9a9590]">
                      <div className="text-center">
                        <Award className="h-12 w-12 mx-auto mb-3 text-[#9a9590]" />
                        <p className="text-sm">成就数据加载中...</p>
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </div>
        )

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>学生设置</h2>
              <p className="text-[#6b6560]">管理你的个人信息和偏好设置</p>
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
              <Card className="bg-gradient-to-r from-[#faf8f5] to-[#f5f2ee] border-[#e8e4df] rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <Flag className="h-5 w-5 text-[#d4a853]" />
                    <CardTitle className="text-lg text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>我的学习目标</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm text-[#2d2a26]">
                    {studentSettings.learning_goal}
                  </pre>
                </CardContent>
              </Card>
            )}
            
            <div>
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>学生概览</h2>
              <p className="text-[#6b6560]">欢迎回来！</p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-[#d4a853]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">已选课程</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.enrolledCourses}</p>
                      <p className="text-xs text-[#9a9590]">你正在学习的课程</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Award className="h-8 w-8 text-[#5a9e6f]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">完成考核</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.completedExams}</p>
                      <p className="text-xs text-[#9a9590]">已完成的考试和测验</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Target className="h-8 w-8 text-[#8b6fb0]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">练习次数</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.practiceCount}</p>
                      <p className="text-xs text-[#9a9590]">累计练习次数</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-[#c47a3a]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">平均得分</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.averageScore}</p>
                      <p className="text-xs text-[#9a9590]">所有考核的平均分</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow rounded-xl" onClick={() => setCurrentView('mistakeBook')}>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookX className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">错题总数</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{mistakeStats.total}</p>
                      <p className="text-xs text-[#9a9590]">待复习: {mistakeStats.unmastered + mistakeStats.reviewing}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow rounded-xl" onClick={() => setCurrentView('notes')}>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <StickyNote className="h-8 w-8 text-[#8b6fb0]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">学习笔记</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{noteStats.total}</p>
                      <p className="text-xs text-[#9a9590]">公开: {noteStats.public}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 快速操作 */}
            <div>
              <h3 className="text-lg font-semibold text-[#2d2a26] mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>快速操作</h3>
              <p className="text-[#6b6560] mb-6">常用学习功能快速入口</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl" onClick={() => setCurrentView('courses')}>
                  <CardContent className="p-6 text-center">
                    <BookOpen className="h-12 w-12 text-[#d4a853] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">我的课程</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl" onClick={() => setCurrentView('aiTutor')}>
                  <CardContent className="p-6 text-center">
                    <GraduationCap className="h-12 w-12 text-[#c47a3a] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">AI助教</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl" onClick={() => setCurrentView('practice')}>
                  <CardContent className="p-6 text-center">
                    <Target className="h-12 w-12 text-[#5a9e6f] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">练习评测</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow relative rounded-xl" onClick={() => setCurrentView('mistakeBook')}>
                  <CardContent className="p-6 text-center">
                    <BookX className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">错题本</h4>
                    {mistakeStats.todayReview > 0 && (
                      <Badge className="absolute -top-2 -right-2 bg-red-500 text-white">
                        {mistakeStats.todayReview}
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl" onClick={() => setCurrentView('targetedTherapy')}>
                  <CardContent className="p-6 text-center">
                    <Crosshair className="h-12 w-12 text-[#8b6fb0] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">靶向治疗</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl" onClick={() => setCurrentView('notes')}>
                  <CardContent className="p-6 text-center">
                    <StickyNote className="h-12 w-12 text-[#8b6fb0] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">学习笔记</h4>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 最近活动和系统警告 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>最近活动</CardTitle>
                  <p className="text-sm text-[#6b6560]">你的学习活动记录</p>
                </CardHeader>
                <CardContent>
                  {recentActivities.length > 0 ? (
                    <div className="space-y-4">
                      {recentActivities.map((activity, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          {activity.icon === 'check' ? <CheckCircle className="h-5 w-5 text-[#5a9e6f]" /> :
                           activity.icon === 'message' ? <MessageCircle className="h-5 w-5 text-[#d4a853]" /> :
                           <BookOpen className="h-5 w-5 text-[#c47a3a]" />}
                          <div>
                            <p className="text-sm font-medium">{activity.description || activity.title}</p>
                            <p className="text-xs text-[#9a9590]">{activity.time || activity.created_at || ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <CheckCircle className="h-16 w-16 text-[#9a9590] mx-auto mb-4" />
                        <p className="text-sm text-[#9a9590]">暂无活动记录</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    错题复习提醒
                  </CardTitle>
                  <p className="text-sm text-[#6b6560]">今日待复习的错题</p>
                </CardHeader>
                <CardContent>
                  {mistakeStats.todayReview > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
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
                          className="text-red-600 border-red-200 hover:bg-red-100 rounded-[10px]"
                        >
                          去复习
                        </Button>
                      </div>
                      <div className="text-sm text-[#6b6560]">
                        <p>未掌握: {mistakeStats.unmastered} 道</p>
                        <p>复习中: {mistakeStats.reviewing} 道</p>
                        <p>已掌握: {mistakeStats.mastered} 道</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 text-[#5a9e6f] mx-auto mb-3" />
                        <p className="text-sm text-[#6b6560]">今日错题已复习完毕</p>
                        <p className="text-xs text-[#9a9590] mt-1">继续保持！</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <StickyNote className="h-5 w-5 text-[#8b6fb0]" />
                    最近笔记
                  </CardTitle>
                  <p className="text-sm text-[#6b6560]">你最近创建的学习笔记</p>
                </CardHeader>
                <CardContent>
                  {noteStats.recentNotes.length > 0 ? (
                    <div className="space-y-3">
                      {noteStats.recentNotes.slice(0, 3).map((note, index) => (
                        <div 
                          key={note.id || index}
                          className="flex items-center gap-3 p-2 hover:bg-[#f5f2ee] rounded-xl cursor-pointer"
                          onClick={() => setCurrentView('notes')}
                        >
                          <FileText className="h-4 w-4 text-[#9a9590] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#2d2a26] truncate">
                              {note.title || '无标题笔记'}
                            </p>
                            <p className="text-xs text-[#9a9590]">
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
                          className="w-full text-[#8b6fb0]"
                        >
                          查看全部 {noteStats.total} 篇笔记
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <div className="text-center">
                        <StickyNote className="h-12 w-12 text-[#9a9590] mx-auto mb-3" />
                        <p className="text-sm text-[#9a9590]">暂无笔记</p>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setCurrentView('notes')}
                          className="mt-2 rounded-[10px]"
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
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="bg-white shadow-sm border-b border-[#e8e4df]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#d4a853] rounded-[10px] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L14.09 8.26L20.18 8.63L15.54 12.74L16.91 19.02L12 15.77L7.09 19.02L8.46 12.74L3.82 8.63L9.91 8.26L12 2Z" fill="white" stroke="white" strokeWidth="1"/>
                    <path d="M6 20V14L12 18L18 14V20L12 22L6 20Z" fill="white" stroke="white" strokeWidth="0.5"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>智教星</h1>
                  <p className="text-xs text-[#9a9590]">自适应错题诊疗系统</p>
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
                  <p className="text-sm font-medium text-[#2d2a26]">
                    {studentSettings?.real_name || user?.username}
                  </p>
                  <p className="text-xs text-[#9a9590]">学生</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[#5a9e6f] border-[#5a9e6f]">
                在线
              </Badge>
              <Button variant="outline" className="rounded-[10px]" onClick={async () => {
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
          <div className="w-64 mr-8">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-colors ${
                      currentView === item.id
                        ? 'bg-[#d4a85312] text-[#d4a853] border-l-4 border-[#d4a853]'
                        : 'text-[#6b6560] hover:bg-[#f5f2ee]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

