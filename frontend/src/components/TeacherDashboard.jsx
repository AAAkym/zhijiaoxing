import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  Users, 
  FileText, 
  BarChart3, 
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Sparkles,
  Brain,
  Target,
  TrendingUp,
  Clock,
  Award,
  Activity,
  Video,
  MessageCircle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { courses, content, ai, auth, videos, teacher as teacherApi } from '../services/api'
import ErrorBoundary from './ErrorBoundary'
import VideoLessonManager from './VideoLessonManager'
import CourseGenerationWizard from './CourseGenerationWizard'
import ClassManagement from './ClassManagement'
import TeacherInteractionPanel from './TeacherInteractionPanel'
import { useNavigate } from 'react-router-dom'

export default function TeacherDashboard({ user, onLogout }) {
  const navigate = useNavigate()
  const [currentView, setCurrentView] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    myCourses: 0,
    totalStudents: 0,
    completedExams: 0,
    aiGeneratedContent: 0
  })

  // 课程管理状态
  const [courseList, setCourseList] = useState([])
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false)
  const [newCourse, setNewCourse] = useState({ title: '', description: '', category: 'programming', difficulty: 'beginner' })

  // AI内容生成状态
  const [selectedCourse, setSelectedCourse] = useState('')
  const [contentTopic, setContentTopic] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState('')
  const [videoList, setVideoList] = useState([])
  const [videosLoading, setVideosLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'saving' | 'success' | 'error' | null

  // 考核管理状态
  const [examList, setExamList] = useState([])
  const [isAddExamOpen, setIsAddExamOpen] = useState(false)
  const [examTopic, setExamTopic] = useState('')
  const [questionCount, setQuestionCount] = useState(5)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [generatedParseError, setGeneratedParseError] = useState(null)
  const [lastAssessmentId, setLastAssessmentId] = useState(null)
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [assessmentStats, setAssessmentStats] = useState(null)
  const [statsAssessmentTitle, setStatsAssessmentTitle] = useState('')

  // 题目编辑器辅助方法
  const updateQuestionText = (index, text) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev]
      copy[index] = { ...(copy[index] || {}), question: text }
      return copy
    })
  }

  const updateOptionText = (qIndex, oIndex, text) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev]
      const q = { ...(copy[qIndex] || {}) }
      q.options = Array.isArray(q.options) ? [...q.options] : []
      q.options[oIndex] = text
      copy[qIndex] = q
      return copy
    })
  }

  const addOption = (qIndex) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev]
      const q = { ...(copy[qIndex] || {}) }
      q.options = Array.isArray(q.options) ? [...q.options] : []
      q.options.push('')
      copy[qIndex] = q
      return copy
    })
  }

  const removeOption = (qIndex, oIndex) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev]
      const q = { ...(copy[qIndex] || {}) }
      q.options = Array.isArray(q.options) ? q.options.filter((_, i) => i !== oIndex) : []
      // 如果删除了正确答案，重置
      if (typeof q.correctAnswer === 'number' && q.correctAnswer === oIndex) q.correctAnswer = null
      copy[qIndex] = q
      return copy
    })
  }

  const setCorrectAnswer = (qIndex, oIndex) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev]
      const q = { ...(copy[qIndex] || {}) }
      q.correctAnswer = typeof oIndex === 'number' ? oIndex : null
      copy[qIndex] = q
      return copy
    })
  }

  const addQuestion = () => {
    setGeneratedQuestions(prev => ([...prev, { question: '新题目', type: 'choice', options: ['', ''], correctAnswer: null, explanation: '' }]))
  }

  const removeQuestion = (qIndex) => {
    setGeneratedQuestions(prev => prev.filter((_, i) => i !== qIndex))
  }

  const moveQuestionUp = (index) => {
    if (index <= 0) return
    setGeneratedQuestions(prev => {
      const copy = [...prev]
      const item = copy.splice(index, 1)[0]
      copy.splice(index - 1, 0, item)
      return copy
    })
  }

  const moveQuestionDown = (index) => {
    setGeneratedQuestions(prev => {
      if (index >= prev.length - 1) return prev
      const copy = [...prev]
      const item = copy.splice(index, 1)[0]
      copy.splice(index + 1, 0, item)
      return copy
    })
  }

  const [editingExam, setEditingExam] = useState(null)

  const handleDeleteExam = async (examId) => {
    if (!confirm('确定要删除这个考核吗？此操作不可撤销。')) return
    
    try {
      await courses.deleteAssessment(examId)
      setExamList(prev => prev.filter(exam => exam.id !== examId))
      alert('删除成功')
    } catch (error) {
      console.error('删除考核失败:', error)
      alert('删除失败: ' + (error.message || '未知错误'))
    }
  }

  const handleToggleRecommended = async (exam) => {
    try {
      const currentStatus = exam?.is_recommended || false
      const newStatus = !currentStatus
      await courses.updateAssessment(exam.id, { is_recommended: newStatus })
      setExamList(prev => prev.map(e => 
        e.id === exam.id ? { ...e, is_recommended: newStatus } : e
      ))
      alert(newStatus ? '已设为推荐练习' : '已取消推荐')
    } catch (error) {
      console.error('更新推荐状态失败:', error)
      alert('操作失败: ' + (error.message || '未知错误'))
    }
  }

  const handleEditExam = async (exam) => {
    setEditingExam(exam)
    setExamTopic(exam.title)
    
    // 设置课程ID
    if (exam.courseId) {
      setSelectedCourse(String(exam.courseId))
    } else if (exam.course) {
      // 如果只有课程名称，查找对应的课程ID
      const course = courseList.find(c => c.title === exam.course)
      if (course) {
        setSelectedCourse(String(course.id))
      }
    }
    
    setLastAssessmentId(exam.id)
    
    // 从后端加载完整的考核数据
    try {
      const courseId = exam.courseId || (courseList.find(c => c.title === exam.course)?.id)
      if (courseId) {
        const res = await courses.getAssessments(courseId)
        const assessment = (res.assessments || []).find(a => a.id === exam.id)
        
        if (assessment && assessment.questions) {
          let questionsData = assessment.questions
          if (typeof questionsData === 'string') {
            try {
              questionsData = JSON.parse(questionsData)
            } catch (e) {
              console.error('解析题目数据失败:', e)
              const parts = questionsData.split(/\n\n+/).filter(Boolean)
              questionsData = parts.map((p) => ({
                question: p,
                options: [],
                correctAnswer: null,
                explanation: ''
              }))
            }
          }
          
          if (Array.isArray(questionsData) && questionsData.length > 0) {
            setGeneratedQuestions(questionsData.map(q => ({
              question: q.question || '',
              type: q.type || 'choice',
              options: q.options || [],
              correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : null,
              explanation: q.explanation || ''
            })))
          } else {
            setGeneratedQuestions([])
          }
        } else {
          setGeneratedQuestions([])
        }
      }
    } catch (err) {
      console.error('加载考核数据失败:', err)
      setGeneratedQuestions([])
    }
    
    setIsAddExamOpen(true)
  }

  const handleViewStats = async (exam) => {
    if (!exam || !exam.id) return
    setStatsAssessmentTitle(exam.title || '考核统计')
    setStatsDialogOpen(true)
    setStatsLoading(true)
    setAssessmentStats(null)
    try {
      const res = await courses.getAssessmentStats(exam.id)
      setAssessmentStats(res)
    } catch (err) {
      console.error('获取考核统计失败:', err)
      setAssessmentStats({ error: true })
    } finally {
      setStatsLoading(false)
    }
  }

  const setQuestionType = (qIndex, type) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev]
      const q = { ...(copy[qIndex] || {}) }
      q.type = type
      // ensure options exist for choice type
      if (type === 'choice' && !Array.isArray(q.options)) q.options = ['', '']
      if (type !== 'choice') q.options = []
      if (type !== 'choice') q.correctAnswer = null
      copy[qIndex] = q
      return copy
    })
  }

  // 学情分析数据
  const [studentProgressData, setStudentProgressData] = useState([
    { name: '优秀', value: 30, color: '#10B981' },
    { name: '良好', value: 45, color: '#3B82F6' },
    { name: '一般', value: 20, color: '#F59E0B' },
    { name: '待提高', value: 5, color: '#EF4444' }
  ])
  const [weeklyActivityData, setWeeklyActivityData] = useState([
    { day: '周一', activity: 45 },
    { day: '周二', activity: 52 },
    { day: '周三', activity: 38 },
    { day: '周四', activity: 61 },
    { day: '周五', activity: 55 },
    { day: '周六', activity: 28 },
    { day: '周日', activity: 32 }
  ])
  const [learningTrendData, setLearningTrendData] = useState([
    { name: '01/01', pv: 4000, uv: 2400 },
    { name: '01/02', pv: 3000, uv: 1398 },
    { name: '01/03', pv: 9800, uv: 2290 },
    { name: '01/04', pv: 2780, uv: 3908 },
    { name: '01/05', pv: 4800, uv: 2181 },
    { name: '01/06', pv: 3800, uv: 2500 },
    { name: '01/07', pv: 4300, uv: 2100 }
  ])
  const [recentActivities, setRecentActivities] = useState([])

  const menuItems = [
    { id: 'overview', label: '概览', icon: BarChart3 },
    { id: 'courses', label: '课程管理', icon: BookOpen },
    { id: 'courseGen', label: '课程生成', icon: Sparkles },
    { id: 'classMgmt', label: '班级管理', icon: Users },
    { id: 'videos', label: '视频管理', icon: Video },
    { id: 'interaction', label: '互动管理', icon: MessageCircle },
    { id: 'content', label: '内容生成', icon: FileText },
    { id: 'exams', label: '考核管理', icon: Target },
    { id: 'analytics', label: '学情分析', icon: BarChart3 }
  ]

  // 初始加载：从后端拉取课程列表以保证与服务器同步
  useEffect(() => {
    let mounted = true
    const loadCourses = async () => {
      try {
        const listRes = await courses.getAll()
        const serverCourses = listRes.courses || []
        const seen = new Map()
        const mapped = []
        for (const c of serverCourses) {
          if (!c || typeof c.id === 'undefined' || c.id === null) continue
          if (seen.has(c.id)) continue
          seen.set(c.id, true)
          mapped.push({
            id: c.id,
            title: c.title,
            students: c.students || 0,
            progress: c.progress || 0,
            status: c.status || 'active',
            created_at: c.created_at ? c.created_at.split('T')[0] : ''
          })
        }
        if (mounted) setCourseList(mapped)
      } catch (err) {
        console.warn('加载课程列表失败', err)
      }
    }

    const loadStats = async () => {
      try {
        const res = await teacherApi.getDashboardStats()
        const s = res?.stats || res || {}
        if (mounted) {
          setStats(prev => ({
            ...prev,
            myCourses: s.my_courses ?? s.course_count ?? prev.myCourses,
            totalStudents: s.total_students ?? prev.totalStudents,
            completedExams: s.completed_exams ?? s.assessment_count ?? prev.completedExams,
            aiGeneratedContent: s.ai_generated_content ?? s.content_count ?? prev.aiGeneratedContent
          }))
        }
      } catch (err) {
        console.warn('加载教师统计失败', err)
      }
    }

    const loadAnalyticsData = async () => {
      try {
        const [progressRes, activityRes, trendRes] = await Promise.allSettled([
          teacherApi.getStudentProgressDistribution(),
          teacherApi.getWeeklyActivity(),
          teacherApi.getLearningTrend()
        ])
        
        // 学生进度分布
        if (progressRes.status === 'fulfilled') {
          const data = progressRes.value?.data || progressRes.value?.distribution || []
          if (Array.isArray(data) && data.length > 0) {
            setStudentProgressData(data)
          } else {
            // 模拟数据：学生学习进度分布
            setStudentProgressData([
              { name: '优秀', value: 30, color: '#10B981' },
              { name: '良好', value: 45, color: '#3B82F6' },
              { name: '一般', value: 20, color: '#F59E0B' },
              { name: '待提高', value: 5, color: '#EF4444' }
            ])
          }
        }
        
        // 每周活动数据
        if (activityRes.status === 'fulfilled') {
          const data = activityRes.value?.data || activityRes.value?.activity || []
          if (Array.isArray(data) && data.length > 0) {
            setWeeklyActivityData(data)
          } else {
            // 模拟数据：每周学习活动
            setWeeklyActivityData([
              { day: '周一', activity: 45 },
              { day: '周二', activity: 52 },
              { day: '周三', activity: 38 },
              { day: '周四', activity: 61 },
              { day: '周五', activity: 55 },
              { day: '周六', activity: 28 },
              { day: '周日', activity: 32 }
            ])
          }
        }
        
        // 学习趋势数据
        if (trendRes.status === 'fulfilled') {
          const data = trendRes.value?.data || trendRes.value?.trend || []
          if (Array.isArray(data) && data.length > 0) {
            setLearningTrendData(data)
          } else {
            // 模拟数据：学习趋势
            setLearningTrendData([
              { name: '01/01', pv: 4000, uv: 2400 },
              { name: '01/02', pv: 3000, uv: 1398 },
              { name: '01/03', pv: 9800, uv: 2290 },
              { name: '01/04', pv: 2780, uv: 3908 },
              { name: '01/05', pv: 4800, uv: 2181 },
              { name: '01/06', pv: 3800, uv: 2500 },
              { name: '01/07', pv: 4300, uv: 2100 }
            ])
          }
        }
      } catch (err) {
        console.warn('加载分析数据失败，使用模拟数据', err)
        // 全部使用模拟数据
        setStudentProgressData([
          { name: '优秀', value: 30, color: '#10B981' },
          { name: '良好', value: 45, color: '#3B82F6' },
          { name: '一般', value: 20, color: '#F59E0B' },
          { name: '待提高', value: 5, color: '#EF4444' }
        ])
        setWeeklyActivityData([
          { day: '周一', activity: 45 },
          { day: '周二', activity: 52 },
          { day: '周三', activity: 38 },
          { day: '周四', activity: 61 },
          { day: '周五', activity: 55 },
          { day: '周六', activity: 28 },
          { day: '周日', activity: 32 }
        ])
        setLearningTrendData([
          { name: '01/01', pv: 4000, uv: 2400 },
          { name: '01/02', pv: 3000, uv: 1398 },
          { name: '01/03', pv: 9800, uv: 2290 },
          { name: '01/04', pv: 2780, uv: 3908 },
          { name: '01/05', pv: 4800, uv: 2181 },
          { name: '01/06', pv: 3800, uv: 2500 },
          { name: '01/07', pv: 4300, uv: 2100 }
        ])
      }
    }

    const loadRecentActivities = async () => {
      try {
        const res = await teacherApi.getRecentActivities()
        const data = res?.activities || res?.data || []
        if (mounted && Array.isArray(data)) setRecentActivities(data)
      } catch (err) {
        console.warn('加载最近活动失败', err)
      }
    }

    loadCourses()
    loadStats()
    loadAnalyticsData()
    loadRecentActivities()
    return () => { mounted = false }
  }, [])

  // 加载所有课程的考核列表
  const loadAllAssessments = async () => {
    try {
      const allAssessments = []
      for (const course of courseList) {
        try {
          const res = await courses.getAssessments(course.id)
          const serverAssessments = res.assessments || []
          for (const a of serverAssessments) {
            const q = a?.questions
            let questionCount = 0
            if (Array.isArray(q)) {
              questionCount = q.length
            } else if (typeof q === 'string') {
              try {
                const parsed = JSON.parse(q)
                questionCount = Array.isArray(parsed) ? parsed.length : 0
              } catch {
                const parts = q.split(/\n\n+/).filter(Boolean)
                questionCount = parts.length
              }
            }
            allAssessments.push({
              id: a.id,
              title: a.title,
              course: course.title,
              courseId: course.id,
              questions: questionCount,
              submissions: a.submissions || 0,
              avg_score: a.avg_score || 0
            })
          }
        } catch (err) {
          console.warn(`加载课程 ${course.id} 的考核失败:`, err)
        }
      }
      setExamList(allAssessments)
    } catch (err) {
      console.error('加载考核列表失败:', err)
    }
  }

  // 当课程列表加载完成后，加载所有考核
  useEffect(() => {
    if (courseList.length > 0) {
      loadAllAssessments()
    }
  }, [courseList])

  // 当选择课程后，加载该课程的视频列表
  useEffect(() => {
    const loadVideos = async () => {
      if (!selectedCourse) {
        setVideoList([])
        setSelectedVideo('')
        return
      }
      
      setVideosLoading(true)
      try {
        const res = await videos.getByCourse(selectedCourse)
        const videosData = res.videos || []
        setVideoList(videosData)
        // 如果只有一个视频，自动选中
        if (videosData.length === 1) {
          setSelectedVideo(String(videosData[0].id))
        } else {
          setSelectedVideo('')
        }
      } catch (err) {
        console.warn('加载视频列表失败:', err)
        setVideoList([])
      } finally {
        setVideosLoading(false)
      }
    }
    
    // 只在内容生成页面加载视频
    if (currentView === 'content') {
      loadVideos()
    }
  }, [selectedCourse, currentView])

  // 生成教学内容
  const generateContent = async () => {
    if (!selectedCourse || !contentTopic) {
      alert('请选择课程和输入主题')
      return
    }

    setIsGenerating(true)
    setSaveStatus(null)
    try {
      // 调用后端生成并保存教学内容（后端期望 course_id）
      const params = {
        course_id: parseInt(selectedCourse, 10),
        topic: contentTopic
      }
      // 如果选择了视频，传递video_id
      if (selectedVideo) {
        params.video_id = parseInt(selectedVideo, 10)
      }
      const res = await content.generate(params)
      // 后端返回的结构: { content: teaching_content.to_dict() }
      setGeneratedContent(res.content ? res.content.content : '')
    } catch (error) {
      console.error('生成内容失败:', error)
      setGeneratedContent('')
      alert('生成内容失败: ' + (error.message || '请检查网络连接后重试'))
    }
    setIsGenerating(false)
  }

  // 保存教学内容
  const saveContent = async () => {
    if (!selectedCourse || !generatedContent) {
      alert('没有可保存的内容')
      return
    }

    setSaveStatus('saving')
    try {
      const params = {
        course_id: parseInt(selectedCourse, 10),
        title: contentTopic || '教学内容',
        content: generatedContent
      }
      // 如果选择了视频，传递video_id
      if (selectedVideo) {
        params.video_id = parseInt(selectedVideo, 10)
      }
      
      const res = await content.create(params)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (error) {
      console.error('保存内容失败:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  // 生成考试题目
  const generateExam = async () => {
    if (!selectedCourse || !examTopic) {
      alert('请选择课程和输入考试主题')
      return
    }

    setIsGenerating(true)
    setGeneratedParseError(null)
    
    try {
      // 调用后端生成并保存考核（后端期望 course_id, title, topic, question_count）
      const res = await content.generateAssessment({
        course_id: parseInt(selectedCourse, 10),
        topic: examTopic,
        title: examTopic,
        question_count: questionCount
      })
      
      // 后端返回 { assessment: assessment }
      const rawQ = res.assessment ? res.assessment.questions : []
      
      // 解析并规范化题目数据
      const normalizedQuestions = normalizeQuestions(rawQ)
      
      if (normalizedQuestions.length === 0) {
        setGeneratedParseError('AI未返回有效题目，请重试')
        setGeneratedQuestions([])
      } else {
        setGeneratedQuestions(normalizedQuestions)
        setGeneratedParseError(null)
      }
      
      if (res.assessment && res.assessment.id) setLastAssessmentId(res.assessment.id)

      // 重新从后端拉取该课程的考核列表以保证同步
      try {
        const assessmentsRes = await courses.getAssessments(parseInt(selectedCourse, 10))
        const serverAssessments = assessmentsRes.assessments || []
        const mapped = serverAssessments.map(a => {
          const q = a?.questions
          let questionCount = 0
          if (Array.isArray(q)) {
            questionCount = q.length
          } else if (typeof q === 'string') {
            try {
              const parsed = JSON.parse(q)
              questionCount = Array.isArray(parsed) ? parsed.length : 0
            } catch {
              const parts = q.split(/\n\n+/).filter(Boolean)
              questionCount = parts.length
            }
          }
          return {
            id: a.id,
            title: a.title,
            course: a.course_id,
            questions: questionCount,
            submissions: a.submissions || 0,
            avg_score: a.avg_score || 0,
            is_recommended: a.is_recommended || false
          }
        })
        setExamList(mapped)
      } catch (err) {
        console.warn('拉取考核列表失败', err)
      }
    } catch (error) {
      console.error('生成题目失败:', error)
      setGeneratedParseError(`生成失败: ${error.message || '网络错误'}`)
      setGeneratedQuestions([])
      setLastAssessmentId(null)
    }
    setIsGenerating(false)
  }

  // 规范化题目数据格式
  const normalizeQuestions = (rawData) => {
    if (!rawData) return []
    
    // 如果已经是数组
    if (Array.isArray(rawData)) {
      return rawData.map((q, idx) => normalizeQuestion(q, idx))
    }
    
    // 如果是字符串，尝试解析
    if (typeof rawData === 'string') {
      try {
        const parsed = JSON.parse(rawData)
        if (Array.isArray(parsed)) {
          return parsed.map((q, idx) => normalizeQuestion(q, idx))
        }
        return [normalizeQuestion(parsed, 0)]
      } catch (e) {
        // 尝试文本解析
        return parseTextToQuestions(rawData)
      }
    }
    
    return []
  }

  // 规范化单个题目
  const normalizeQuestion = (q, idx) => {
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
      id: q.id || `q-${idx}-${Date.now()}`,
      question: q.question || '',
      options: options,
      correctAnswer: correctAnswer,
      explanation: q.explanation || '',
      type: questionType,
      score: typeof q.score === 'number' ? q.score : 10,
      difficulty: q.difficulty || 'medium'
    }
  }

  // 将纯文本解析为题目
  const parseTextToQuestions = (text) => {
    if (!text || typeof text !== 'string') return []
    
    // 按题号分割
    const parts = text.split(/(?=\d+[\.\、][^\d])/).filter(Boolean)
    
    return parts.map((part, idx) => {
      const lines = part.trim().split('\n').filter(Boolean)
      const questionLine = lines[0] || ''
      
      // 提取选项
      const options = []
      const optionPattern = /^([A-D])[\.\、]\s*(.+)$/
      lines.forEach(line => {
        const match = line.match(optionPattern)
        if (match) {
          options.push(match[2].trim())
        }
      })
      
      // 提取答案
      let correctAnswer = 0
      const answerMatch = part.match(/答案[：:]\s*([A-D])/i)
      if (answerMatch) {
        correctAnswer = answerMatch[1].toUpperCase().charCodeAt(0) - 65
      }
      
      return {
        id: `q-${idx}-${Date.now()}`,
        question: questionLine.replace(/^\d+[\.\、]\s*/, '').replace(/答案[：:].*/i, '').trim(),
        options: options.length >= 2 ? options : ['选项A', '选项B', '选项C', '选项D'],
        correctAnswer,
        explanation: '',
        type: 'choice',
        score: 10,
        difficulty: 'medium'
      }
    }).filter(q => q.question)
  }

  const validateQuestions = (questions) => {
    const errors = []
    const warnings = []
    
    if (!questions || questions.length === 0) {
      errors.push('没有可保存的题目')
      return { isValid: false, errors, warnings }
    }
    
    questions.forEach((q, index) => {
      const qNum = index + 1
      
      if (!q.question || q.question.trim() === '') {
        errors.push(`第 ${qNum} 题：题干不能为空`)
      }
      
      if (q.type === 'choice' || !q.type) {
        if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
          errors.push(`第 ${qNum} 题：选择题至少需要2个选项`)
        } else {
          const emptyOptions = q.options.map((opt, i) => opt && opt.trim() === '' ? i : -1).filter(i => i >= 0)
          if (emptyOptions.length > 0) {
            errors.push(`第 ${qNum} 题：选项 ${emptyOptions.map(i => String.fromCharCode(65 + i)).join(', ')} 为空`)
          }
        }
        
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer >= (q.options?.length || 0)) {
          errors.push(`第 ${qNum} 题：未设置正确答案`)
        }
      }
      
      if (!q.explanation || q.explanation.trim() === '') {
        warnings.push(`第 ${qNum} 题：缺少解析说明`)
      }
    })
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  const handleSaveGeneratedExam = async () => {
    if (!selectedCourse) { alert('请选择课程'); return }
    if (!generatedQuestions || !Array.isArray(generatedQuestions) || generatedQuestions.length === 0) { alert('没有题目可保存'); return }

    const validation = validateQuestions(generatedQuestions)
    
    if (!validation.isValid) {
      alert(`题目校验失败:\n\n${validation.errors.join('\n')}`)
      return
    }
    
    if (validation.warnings.length > 0) {
      const proceed = confirm(`题目存在以下警告:\n\n${validation.warnings.join('\n')}\n\n是否继续保存？`)
      if (!proceed) return
    }

    setIsGenerating(true)
    try {
      const normalizedQuestions = generatedQuestions.map(q => ({
        question: q.question || '',
        type: q.type || 'choice',
        options: Array.isArray(q.options) ? q.options.filter(opt => opt && opt.trim() !== '') : [],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : null,
        explanation: q.explanation || ''
      }))

      if (lastAssessmentId) {
        await courses.updateAssessment(lastAssessmentId, { title: examTopic || '练习题目', questions: normalizedQuestions })
      } else {
        const res = await courses.createAssessment(parseInt(selectedCourse, 10), { title: examTopic || '练习题目', questions: normalizedQuestions })
        if (res && res.assessment && res.assessment.id) setLastAssessmentId(res.assessment.id)
      }

      await loadAllAssessments()

      alert('保存成功！题目已同步到学生端')
    } catch (err) {
      console.error('保存题目失败:', err)
      alert('保存失败: ' + (err.message || '未知错误'))
    } finally {
      setIsGenerating(false)
    }
  }

  // 添加课程
  const handleAddCourse = async () => {
    try {
      const res = await courses.create(newCourse)
      // 如果后端返回了创建的课程，重新从后端拉取课程列表以保证同步
      if (res && (res.course || res.message)) {
        try {
          const listRes = await courses.getAll()
          const serverCourses = listRes.courses || []
            // 去重：以 id 为 key
            const seen = new Map()
            const mapped = []
            for (const c of serverCourses) {
              if (!c || typeof c.id === 'undefined' || c.id === null) continue
              if (seen.has(c.id)) continue
              seen.set(c.id, true)
              mapped.push({
                id: c.id,
                title: c.title,
                students: c.students || 0,
                progress: c.progress || 0,
                status: c.status || 'active',
                created_at: c.created_at ? c.created_at.split('T')[0] : ''
              })
            }
            setCourseList(mapped)
        } catch (err) {
          console.warn('拉取课程列表失败，继续使用本地追加显示', err)
          const created = res.course || null
          if (created) {
            const displayCourse = {
              id: created.id,
              title: created.title,
              students: 0,
              progress: 0,
              status: 'active',
              created_at: created.created_at ? created.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
            }
            // 追加但避免重复 id
            setCourseList(prev => {
              if (prev.some(x => x.id === displayCourse.id)) return prev
              return [...prev, displayCourse]
            })
          }
        }
      }
      setIsAddCourseOpen(false)
      setNewCourse({ title: '', description: '', category: 'programming', difficulty: 'beginner' })
      alert('课程添加成功！')
    } catch (error) {
      console.error('添加课程失败:', error)
      alert('课程添加失败：' + (error.message || '未知错误'))
    }
  }

  // 删除课程
  const handleDeleteCourse = async (courseId) => {
    if (!confirm('确定要删除这个课程吗？')) return

    try {
      await courses.delete(courseId)
      setCourseList(prev => prev.filter(c => c.id !== courseId))
      alert('课程删除成功！')
    } catch (error) {
      console.error('删除课程失败:', error)
      alert('课程删除失败：' + (error.message || '未知错误'))
    }
  }

  const renderContent = () => {
    switch (currentView) {
      case 'courses':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">课程管理</h2>
                <p className="text-gray-600">管理您的教学课程</p>
              </div>
              <Dialog open={isAddCourseOpen} onOpenChange={setIsAddCourseOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    添加课程
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加新课程</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">课程标题</Label>
                      <Input
                        id="title"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                        placeholder="请输入课程标题"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">课程描述</Label>
                      <Textarea
                        id="description"
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                        placeholder="请输入课程描述"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsAddCourseOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleAddCourse}>
                        添加
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">我的课程</p>
                      <p className="text-2xl font-bold text-gray-900">{courseList.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">总学生数</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {courseList.reduce((sum, course) => sum + course.students, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">平均进度</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {courseList.length > 0 ? Math.round(courseList.reduce((sum, course) => sum + course.progress, 0) / courseList.length) : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>课程列表</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>课程名称</TableHead>
                      <TableHead>类别</TableHead>
                      <TableHead>级别</TableHead>
                      <TableHead>学生数</TableHead>
                      <TableHead>进度</TableHead>
                      <TableHead>章节</TableHead>
                      <TableHead>课时</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseList.map((course, idx) => (
                      <TableRow key={`course-${String(course.id ?? idx)}`}>
                        <TableCell className="font-medium">{course.title}<div className="text-sm text-gray-600">{course.subtitle}</div></TableCell>
                        <TableCell>{course.category || '-'}</TableCell>
                        <TableCell>{course.level || '-'}</TableCell>
                        <TableCell>{course.students}</TableCell>
                        <TableCell>{course.progress}%</TableCell>
                        <TableCell>{course.lessonsCount ?? (course.modules ? course.modules.reduce((s,m)=>s+(m.lessons||0),0):'-')}</TableCell>
                        <TableCell>{course.durationHours ?? '-'}</TableCell>
                        <TableCell>
                          <Badge className={course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {course.status === 'active' ? '活跃' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>{course.created_at}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCourse(course.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )

      case 'content':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">内容生成</h2>
              <p className="text-gray-600">使用AI生成教学内容</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sparkles className="h-5 w-5 mr-2" />
                  AI教学内容生成
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="course-select">选择课程</Label>
                    <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择课程" />
                      </SelectTrigger>
                      <SelectContent>
                        {courseList.map((course) => (
                          <SelectItem key={`select-${String(course.id)}`} value={String(course.id)}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="video-select">选择视频（可选）</Label>
                    <Select 
                      value={selectedVideo} 
                      onValueChange={setSelectedVideo}
                      disabled={!selectedCourse || videosLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={videosLoading ? "加载中..." : "请选择视频"} />
                      </SelectTrigger>
                      <SelectContent>
                        {videoList.length === 0 ? (
                          <SelectItem value="no-videos" disabled>暂无视频</SelectItem>
                        ) : (
                          videoList.map((video) => (
                            <SelectItem key={`video-${video.id}`} value={String(video.id)}>
                              {video.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="topic">教学主题</Label>
                  <Input
                    id="topic"
                    value={contentTopic}
                    onChange={(e) => setContentTopic(e.target.value)}
                    placeholder="例如：Python变量和数据类型"
                  />
                </div>
                <Button onClick={generateContent} disabled={isGenerating} className="w-full">
                  {isGenerating ? '生成中...' : '生成教学内容'}
                </Button>
                {generatedContent && (
                  <div className="mt-4">
                    <Label>生成的教学内容</Label>
                    <Textarea
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      rows={15}
                      className="mt-2"
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <Button onClick={saveContent} disabled={saveStatus === 'saving'}>
                        {saveStatus === 'saving' ? '保存中...' : '保存内容'}
                      </Button>
                      {saveStatus === 'success' && (
                        <span className="text-green-600 text-sm">✓ 保存成功</span>
                      )}
                      {saveStatus === 'error' && (
                        <span className="text-red-600 text-sm">✗ 保存失败，请重试</span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case 'videos':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">视频管理</h2>
              <p className="text-gray-600">管理课程视频内容</p>
            </div>
            
            {courseList.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Video className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">请先创建课程后再管理视频</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>选择课程</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择课程" />
                    </SelectTrigger>
                    <SelectContent>
                      {courseList.map((course) => (
                        <SelectItem key={`video-select-${course.id}`} value={String(course.id)}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedCourse && (
                  <VideoLessonManager courseId={parseInt(selectedCourse)} />
                )}
              </div>
            )}
          </div>
        )

      case 'interaction':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">互动管理</h2>
              <p className="text-gray-600">管理学生问答、讨论和举手</p>
            </div>
            
            {courseList.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">请先创建课程</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>选择课程</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择课程" />
                    </SelectTrigger>
                    <SelectContent>
                      {courseList.map((course) => (
                        <SelectItem key={`interaction-select-${course.id}`} value={String(course.id)}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedCourse && (
                  <TeacherInteractionPanel courseId={parseInt(selectedCourse)} />
                )}
              </div>
            )}
          </div>
        )

      case 'courseGen':
        return (
          <CourseGenerationWizard
            myCourses={courseList}
            onBack={() => setCurrentView('overview')}
          />
        )

      case 'classMgmt':
        return (
          <ClassManagement myCourses={courseList} />
        )

      case 'exams':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">考核管理</h2>
                <p className="text-gray-600">管理考试和生成题目</p>
              </div>
              <Dialog open={isAddExamOpen} onOpenChange={(open) => {
                setIsAddExamOpen(open)
                if (!open) {
                  setEditingExam(null)
                  setGeneratedQuestions([])
                  setExamTopic('')
                  setLastAssessmentId(null)
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Brain className="w-4 h-4 mr-2" />
                    AI生成题目
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
                  <DialogHeader className="flex-shrink-0">
                    <DialogTitle>{editingExam ? '编辑考核' : 'AI生成考试题目'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 overflow-y-auto flex-1 pr-1 -mr-1" style={{ minHeight: '150px', maxHeight: 'calc(90vh - 80px)' }}>
                    <div>
                      <Label htmlFor="exam-course">选择课程</Label>
                      <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择课程" />
                        </SelectTrigger>
                        <SelectContent>
                            {courseList.map((course) => (
                              <SelectItem key={`select-${String(course.id)}`} value={String(course.id)}>
                                {course.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex justify-between items-center">
                        <Label htmlFor="exam-topic" className="text-sm">考试主题</Label>
                        <span className="text-xs text-gray-500">{examTopic.length}/50字</span>
                      </div>
                      <Input
                        id="exam-topic"
                        value={examTopic}
                        onChange={(e) => setExamTopic(e.target.value.slice(0, 50))}
                        placeholder="例如：Python函数"
                        className="h-9"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="question-count" className="text-sm">题目数量</Label>
                      <Input
                        id="question-count"
                        type="number"
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                        min={1}
                        max={20}
                        className="h-9 w-24"
                      />
                    </div>
                    <Button onClick={generateExam} disabled={isGenerating} className="w-full">
                      {isGenerating ? '生成中...' : '生成考试题目'}
                    </Button>
                    {generatedQuestions && generatedQuestions.length > 0 && (
                      <div className="mt-4">
                        <Label>生成的题目（JSON）</Label>
                        <Textarea
                          value={JSON.stringify(generatedQuestions, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value)
                              setGeneratedQuestions(Array.isArray(parsed) ? parsed : [parsed])
                              setGeneratedParseError(null)
                            } catch (err) {
                              setGeneratedParseError('JSON 解析错误，请确保输入有效的 JSON 数组')
                            }
                          }}
                          rows={6}
                          className="mt-2 font-mono text-xs"
                        />
                        {generatedParseError && <p className="text-sm text-red-600 mt-2">{generatedParseError}</p>}

                        <div className="mt-4 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <Label className="text-base font-semibold">题目编辑器</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{generatedQuestions.length} 道题目</span>
                              <Button size="sm" variant="outline" onClick={addQuestion} className="gap-1">
                                <span>+</span> 添加题目
                              </Button>
                            </div>
                          </div>
                          
                          {generatedQuestions.length === 0 && (
                            <div className="text-center py-8 sm:py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                              <p>暂无题目，请点击"添加题目"或"生成题目"</p>
                            </div>
                          )}
                          
                          {generatedQuestions.length > 0 && (
                            <div className="relative">
                              <div 
                                className="max-h-[60vh] sm:max-h-[500px] overflow-y-auto overflow-x-hidden pr-1 space-y-4 border-2 border-gray-200 rounded-lg p-2 sm:p-4 bg-gray-50 scroll-smooth"
                                style={{ 
                                  WebkitOverflowScrolling: 'touch',
                                  scrollBehavior: 'smooth'
                                }}
                              >
                                {generatedQuestions.map((q, qi) => (
                                  <div 
                                    key={`q-${qi}`} 
                                    className="border-2 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                                  >
                                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                      <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm sm:text-base shrink-0">
                                          {qi + 1}
                                        </div>
                                        <span className="font-medium text-sm sm:text-base">第 {qi + 1} 题</span>
                                      </div>
                                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                        <select 
                                          value={q.type || 'choice'} 
                                          onChange={(e) => setQuestionType(qi, e.target.value)} 
                                          className="border rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-white text-gray-700"
                                        >
                                          <option value="choice">选择题</option>
                                          <option value="fill">填空题</option>
                                          <option value="essay">主观题</option>
                                        </select>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-white hover:bg-white/20" onClick={() => moveQuestionUp(qi)} disabled={qi === 0}>↑</Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-white hover:bg-white/20" onClick={() => moveQuestionDown(qi)} disabled={qi === generatedQuestions.length - 1}>↓</Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-white hover:bg-red-500/50" onClick={() => removeQuestion(qi)}>×</Button>
                                      </div>
                                    </div>
                                    
                                    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                                      <div>
                                        <div className="flex justify-between items-center mb-1">
                                          <Label className="text-xs sm:text-sm font-medium text-gray-700">题干</Label>
                                          <span className="text-xs text-gray-400">{(q.question || '').length}/200字</span>
                                        </div>
                                        <Textarea 
                                          value={q.question || ''} 
                                          onChange={(e) => updateQuestionText(qi, e.target.value.slice(0, 200))} 
                                          className="min-h-[50px] sm:min-h-[60px] text-xs sm:text-sm resize-none" 
                                          maxLength={200}
                                          placeholder="请输入题目内容..."
                                        />
                                      </div>

                                      {q.type === 'choice' && (
                                        <div>
                                          <div className="flex justify-between items-center mb-2">
                                            <Label className="text-xs sm:text-sm font-medium text-gray-700">选项</Label>
                                            <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600" onClick={() => addOption(qi)}>+ 添加选项</Button>
                                          </div>
                                          <div className="space-y-2">
                                            {(Array.isArray(q.options) ? q.options : []).map((opt, oi) => {
                                              const optionLabel = String.fromCharCode(65 + oi)
                                              const isCorrect = typeof q.correctAnswer === 'number' && q.correctAnswer === oi
                                              return (
                                                <div 
                                                  key={`q-${qi}-o-${oi}`} 
                                                  className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                                                    isCorrect 
                                                      ? 'border-green-500 bg-green-50' 
                                                      : 'border-gray-200 hover:border-gray-300'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-2 flex-1">
                                                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${
                                                      isCorrect 
                                                        ? 'bg-green-500 text-white' 
                                                        : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                      {optionLabel}
                                                    </div>
                                                    <Input 
                                                      value={opt || ''} 
                                                      onChange={(e) => updateOptionText(qi, oi, e.target.value.slice(0, 100))} 
                                                      className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" 
                                                      maxLength={100}
                                                      placeholder={`选项${optionLabel}的内容`}
                                                    />
                                                  </div>
                                                  <div className="flex items-center gap-1 sm:gap-2 justify-end">
                                                    <Button 
                                                      variant={isCorrect ? "default" : "outline"} 
                                                      size="sm" 
                                                      className={`h-6 sm:h-7 text-xs ${isCorrect ? 'bg-green-500 hover:bg-green-600' : ''}`}
                                                      onClick={() => setCorrectAnswer(qi, isCorrect ? null : oi)}
                                                    >
                                                      {isCorrect ? '✓ 正确' : '设为答案'}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => removeOption(qi, oi)}>×</Button>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                            {(!Array.isArray(q.options) || q.options.length === 0) && (
                                              <div className="text-center py-3 sm:py-4 text-gray-400 bg-gray-50 rounded-lg text-xs sm:text-sm">
                                                请添加选项
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      <div>
                                        <div className="flex justify-between items-center mb-1">
                                          <Label className="text-xs sm:text-sm font-medium text-gray-700">解析</Label>
                                          <span className="text-xs text-gray-400">{(q.explanation || '').length}/200字</span>
                                        </div>
                                        <Textarea 
                                          value={q.explanation || ''} 
                                          onChange={(e) => {
                                            setGeneratedQuestions(prev => {
                                              const copy = [...prev]
                                              copy[qi] = { ...(copy[qi] || {}), explanation: e.target.value.slice(0, 200) }
                                              return copy
                                            })
                                          }} 
                                          rows={2} 
                                          className="text-xs sm:text-sm resize-none" 
                                          maxLength={200}
                                          placeholder="请输入题目解析（可选）..."
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none sm:hidden" />
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-2">
                          <Button className="w-full sm:w-auto" onClick={handleSaveGeneratedExam} disabled={isGenerating || generatedParseError}>
                            保存题目
                          </Button>
                          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setGeneratedQuestions([])}>
                            清空题目
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
              <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>{statsAssessmentTitle || '考核统计'}</DialogTitle>
                </DialogHeader>
                {statsLoading ? (
                  <div className="py-6 text-sm text-gray-600">加载统计中...</div>
                ) : assessmentStats?.error ? (
                  <div className="py-6 text-sm text-red-600">统计加载失败，请稍后重试。</div>
                ) : assessmentStats ? (
                  <div className="space-y-4 overflow-y-auto flex-1 pr-2 -mr-2" style={{ minHeight: '200px', maxHeight: 'calc(85vh - 120px)' }}>
                    <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between flex-shrink-0">
                      <div>
                        <span className="text-sm text-gray-600">总提交数</span>
                        <p className="text-2xl font-bold text-blue-600">{assessmentStats.total_submissions || 0}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-600">整体正确率</span>
                        <p className="text-2xl font-bold text-green-600">{assessmentStats.overall_correct_rate || 0}%</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(assessmentStats.questions || []).map((q) => (
                        <div key={`stat-q-${q.index}`} className="border-2 rounded-lg overflow-hidden flex-shrink-0">
                          <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                                {q.index + 1}
                              </div>
                              <span className="font-medium text-gray-800 line-clamp-1">{q.question}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={`${(q.correctRate || 0) >= 70 ? 'bg-green-100 text-green-700' : (q.correctRate || 0) >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                正确率 {q.correctRate || 0}%
                              </Badge>
                            </div>
                          </div>
                          <div className="px-4 py-3 bg-white">
                            <div className="text-xs text-gray-500 mb-2">
                              答对 {q.correctCount || 0} 人 / 共 {q.attempts || 0} 人作答
                            </div>
                            {Array.isArray(q.optionCounts) && q.optionCounts.length > 0 && (
                              <div className="space-y-1">
                                {q.optionCounts.map((c, i) => {
                                  const total = q.optionCounts.reduce((a, b) => a + b, 0) || 1
                                  const percent = Math.round((c / total) * 100)
                                  const label = String.fromCharCode(65 + i)
                                  return (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">{label}</span>
                                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden min-w-[100px]">
                                        <div 
                                          className="h-full bg-blue-500 rounded-full transition-all" 
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-600 w-16 text-right flex-shrink-0">{c}人 ({percent}%)</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-sm text-gray-600">暂无统计数据。</div>
                )}
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle>考试列表</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>考试名称</TableHead>
                      <TableHead>所属课程</TableHead>
                      <TableHead>题目数量</TableHead>
                      <TableHead>提交人数</TableHead>
                      <TableHead>平均分</TableHead>
                      <TableHead>推荐练习</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(examList || []).map((exam, idx) => {
                      const qCount = typeof exam?.questions === 'number' ? exam.questions : 0
                      const subCount = typeof exam?.submissions === 'number' ? exam.submissions : 0
                      const avgScore = typeof exam?.avg_score === 'number' ? exam.avg_score : 0
                      const isRecommended = exam?.is_recommended || false
                      return (
                        <TableRow key={`exam-${exam?.id ?? idx}`}>
                          <TableCell className="font-medium">{exam?.title || '-'}</TableCell>
                          <TableCell>{exam?.course || '-'}</TableCell>
                          <TableCell>{qCount}</TableCell>
                          <TableCell>{subCount}</TableCell>
                          <TableCell>{avgScore}</TableCell>
                          <TableCell>
                            <Button
                              variant={isRecommended ? "default" : "outline"}
                              size="sm"
                              className={isRecommended ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}
                              onClick={() => handleToggleRecommended(exam)}
                            >
                              {isRecommended ? '★ 推荐' : '☆ 未推荐'}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewStats(exam)}>
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEditExam(exam)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteExam(exam?.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )

      case 'analytics':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">学情分析</h2>
              <p className="text-gray-600">学生学习情况和趋势分析</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>学生学习进度分布</CardTitle>
                </CardHeader>
                <CardContent>
                  {studentProgressData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={studentProgressData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {studentProgressData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-400">
                      <p>暂无进度分布数据</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>学生每周学习活动</CardTitle>
                </CardHeader>
                <CardContent>
                  {weeklyActivityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={weeklyActivityData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="activity" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-400">
                      <p>暂无活动数据</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>近期学习趋势</CardTitle>
              </CardHeader>
              <CardContent>
                {learningTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={learningTrendData}
                      margin={{
                        top: 5, right: 30, left: 20, bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="pv" stroke="#8884d8" activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="uv" stroke="#82ca9d" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-400">
                    <p>暂无趋势数据</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      default:
        return (
          <div className="space-y-6">
            {/* 概览标题 */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">教师概览</h2>
              <p className="text-gray-600">欢迎回来，教师！</p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">我的课程</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.myCourses}</p>
                      <p className="text-xs text-gray-500">您创建的课程</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">学生总数</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                      <p className="text-xs text-gray-500">所有课程的学生</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Award className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">已完成考核</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.completedExams}</p>
                      <p className="text-xs text-gray-500">学生完成的考核</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Sparkles className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">AI生成内容</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.aiGeneratedContent}</p>
                      <p className="text-xs text-gray-500">已生成教学内容</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 快速操作 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
              <p className="text-gray-600 mb-6">常用教学功能快速入口</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('courses')}>
                  <CardContent className="p-6 text-center">
                    <BookOpen className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">课程管理</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('content')}>
                  <CardContent className="p-6 text-center">
                    <Sparkles className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">AI内容生成</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('exams')}>
                  <CardContent className="p-6 text-center">
                    <Target className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">考核管理</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('analytics')}>
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">学情分析</h4>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 最近活动和系统警告 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>最近活动</CardTitle>
                  <p className="text-sm text-gray-600">您的教学活动记录</p>
                </CardHeader>
                <CardContent>
                  {recentActivities.length > 0 ? (
                    <div className="space-y-4">
                      {recentActivities.map((activity, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          {activity.icon === 'check' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                           activity.icon === 'activity' ? <Activity className="h-5 w-5 text-blue-600" /> :
                           <BookOpen className="h-5 w-5 text-orange-600" />}
                          <div>
                            <p className="text-sm font-medium">{activity.description || activity.title}</p>
                            <p className="text-xs text-gray-500">{activity.time || activity.created_at || ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <CheckCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-gray-500">暂无活动记录</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>学生反馈</CardTitle>
                  <p className="text-sm text-gray-600">学生对您的课程和教学的反馈</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-green-600">暂无新反馈</h4>
                      <p className="text-sm text-gray-500">所有反馈已处理</p>
                    </div>
                  </div>
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
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">师</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">教师控台</h1>
                  <p className="text-sm text-gray-600">欢迎回来，教师</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}
