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
  MessageCircle,
  Zap,
  Network,
  GitCompare,
  AlertCircle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { courses, content, ai, auth, videos, teacher as teacherApi, programming, courseGeneration } from '../services/api'
import ErrorBoundary from './ErrorBoundary'
import VideoLessonManager from './VideoLessonManager'
import CourseGenerationWizard from './CourseGenerationWizard'
import PersonalizationComparisonDemo from './PersonalizationComparisonDemo'
import ClassManagement from './ClassManagement'
import TeacherInteractionPanel from './TeacherInteractionPanel'
import InteractiveMindMap from './ui/InteractiveMindMap'
import CodePlayground from './ui/CodePlayground'
import ContentSaveSyncPanel from './ui/ContentSaveSyncPanel'
import AgentCollaborationProgress from './AgentCollaborationProgress'
import ContentQualityPanel from './ContentQualityPanel'
import KnowledgeGraphManager from './KnowledgeGraphManager'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNavigate } from 'react-router-dom'

/**
 * 检测代码字符串是否为占位文字而非真实代码。
 * 当AI生成的代码模板/参考实现若为描述性文字而非真实代码时，前端应隐藏该区域。
 */
function isPlaceholderCode(code) {
  if (!code || typeof code !== 'string') return true
  const trimmed = code.trim()
  if (trimmed.length < 30) return true
  const lower = trimmed.toLowerCase()
  const patterns = [
    '代码模板', '参考实现', '参考代码', '待补充',
    'todo.*标记', '占位', '完整可运行',
    '代码骨架', '这里写代码', '请在此',
    'your code', 'code here', '代码示例',
  ]
  for (const p of patterns) {
    if (new RegExp(p, 'i').test(lower)) return true
  }
  return false
}

/**
 * AI 生成内容去重：相同标题的 AI 生成项仅保留最新一条，保持原列表顺序。
 * 非AI生成项与无标题项原样保留。
 */
function dedupeAiItems(items) {
  if (!Array.isArray(items)) return []
  // 记录每个 AI 标题最后一次出现的位置（列表按创建时间升序时即最新一条）
  const lastAiIndexByTitle = new Map()
  items.forEach((item, index) => {
    const isAi = item && item.generated_by_llm
    const title = item && (item.title || '').trim()
    if (isAi && title) {
      lastAiIndexByTitle.set(title, index)
    }
  })
  // 过滤：非AI/无标题项全部保留；AI项仅保留该标题最后一次出现的那条
  return items.filter((item, index) => {
    const isAi = item && item.generated_by_llm
    const title = item && (item.title || '').trim()
    if (!isAi || !title) return true
    return lastAiIndexByTitle.get(title) === index
  })
}

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
  const [deletingCourseId, setDeletingCourseId] = useState(null)
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

  const [multimodalResults, setMultimodalResults] = useState(null)
  const [isGeneratingMultimodal, setIsGeneratingMultimodal] = useState(false)
  const [activeMultimodalTab, setActiveMultimodalTab] = useState('document')
  const [selectedResourceTypes, setSelectedResourceTypes] = useState(['document', 'mindmap', 'project', 'recommendation', 'media'])
  const [agentProgress, setAgentProgress] = useState(null)
  const [qualityReport, setQualityReport] = useState(null)
  // 视频脚本解析失败时，控制原始 JSON 折叠展示
  const [showRawMediaJson, setShowRawMediaJson] = useState(false)

  const RESOURCE_TYPE_OPTIONS = [
    { value: 'document', label: '核心概念文档', icon: FileText, description: '结构化讲解文档，含概念定义、核心要素、应用场景' },
    { value: 'mindmap', label: '知识点思维导图', icon: Brain, description: '可视化知识结构，含层级关系和概念连接' },
    { value: 'project', label: '代码实操案例', icon: Target, description: '可执行的代码演示，含语法注释和实现细节' },
    { value: 'recommendation', label: '拓展阅读推荐', icon: BookOpen, description: '相关学习资源和延伸材料推荐' },
    { value: 'media', label: '视频脚本', icon: Video, description: '教学视频脚本，含分镜规划、台词、拍摄形式与视觉元素' },
  ]

  const toggleResourceType = (type) => {
    setSelectedResourceTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length <= 1) return prev
        return prev.filter(t => t !== type)
      }
      return [...prev, type]
    })
  }

  // 考核管理状态
  const [examList, setExamList] = useState([])
  const [isAddExamOpen, setIsAddExamOpen] = useState(false)
  const [examTopic, setExamTopic] = useState('')
  const [questionCount, setQuestionCount] = useState(5)
  const [programmingLanguage, setProgrammingLanguage] = useState('python')
  const [programmingSubmissions, setProgrammingSubmissions] = useState([])
  const [programmingSubmissionsLoading, setProgrammingSubmissionsLoading] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [generatedParseError, setGeneratedParseError] = useState(null)
  const [lastAssessmentId, setLastAssessmentId] = useState(null)
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [assessmentStats, setAssessmentStats] = useState(null)
  const [statsAssessmentTitle, setStatsAssessmentTitle] = useState('')
  const [courseDetailOpen, setCourseDetailOpen] = useState(false)
  const [courseDetail, setCourseDetail] = useState(null)
  const [courseDetailLoading, setCourseDetailLoading] = useState(false)

  const [tokenSummary, setTokenSummary] = useState(null)
  const [tokenTrend, setTokenTrend] = useState([])
  const [tokenRecent, setTokenRecent] = useState([])
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenPeriod, setTokenPeriod] = useState('daily')
  const [tokenDays, setTokenDays] = useState(30)

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
              title: q.title || q.question || '',
              type: q.type || 'choice',
              options: q.options || [],
              correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : null,
              explanation: q.explanation || '',
              description: q.description || q.content || '',
              input_format: q.input_format || q.inputFormat || '',
              output_format: q.output_format || q.outputFormat || '',
              constraints: q.constraints || '',
              samples: Array.isArray(q.samples) ? q.samples : [],
              test_cases: Array.isArray(q.test_cases) ? q.test_cases : [],
              standard_answer: q.standard_answer || q.reference_answer || '',
              language: q.language || 'python',
              knowledge_tags: Array.isArray(q.knowledge_tags) ? q.knowledge_tags : [],
              score: typeof q.score === 'number' ? q.score : 10,
              difficulty: q.difficulty || 'medium'
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
      if (type === 'choice' && !Array.isArray(q.options)) q.options = ['', '']
      if (type === 'programming') {
        q.description = q.description || ''
        q.input_format = q.input_format || ''
        q.output_format = q.output_format || ''
        q.constraints = q.constraints || ''
        q.samples = Array.isArray(q.samples) ? q.samples : []
        q.test_cases = Array.isArray(q.test_cases) ? q.test_cases : []
        q.standard_answer = q.standard_answer || ''
        q.language = q.language || programmingLanguage || 'python'
        q.knowledge_tags = Array.isArray(q.knowledge_tags) ? q.knowledge_tags : []
        q.options = []
        q.correctAnswer = null
      }
      if (type === 'fill' || type === 'essay') {
        q.options = []
        q.correctAnswer = null
      }
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
    { id: 'personalizationDemo', label: '个性化对比', icon: GitCompare },
    { id: 'classMgmt', label: '班级管理', icon: Users },
    { id: 'videos', label: '视频管理', icon: Video },
    { id: 'interaction', label: '互动管理', icon: MessageCircle },
    { id: 'content', label: '内容生成', icon: FileText },
    { id: 'knowledgeGraph', label: '知识图谱', icon: Network },
    { id: 'exams', label: '考核管理', icon: Target },
    { id: 'analytics', label: '学情分析', icon: BarChart3 },
    { id: 'token-usage', label: 'Token用量', icon: Zap }
  ]

  // 初始加载：从后端拉取课程列表以保证与服务器同步
  const refreshDashboardStats = async () => {
    try {
      const res = await teacherApi.getDashboardStats()
      const s = res?.stats || res || {}
      setStats(prev => ({
        ...prev,
        myCourses: s.my_courses ?? s.course_count ?? prev.myCourses,
        totalStudents: s.total_students ?? prev.totalStudents,
        completedExams: s.completed_exams ?? s.assessment_count ?? prev.completedExams,
        aiGeneratedContent: s.ai_generated_content ?? s.content_count ?? prev.aiGeneratedContent
      }))
    } catch (err) {
      console.warn('加载教师统计失败', err)
    }
  }

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
            students: c.student_count || c.students || 0,
            progress: c.progress || c.progress_percentage || 0,
            status: c.status || 'active',
            created_at: c.created_at ? c.created_at.split('T')[0] : '',
            description: c.description || '',
            category: c.category || '',
            difficulty: c.difficulty || '',
            duration: c.duration || '',
            teacher_name: c.teacher_name || ''
          })
        }
        if (mounted) setCourseList(mapped)
      } catch (err) {
        console.warn('加载课程列表失败', err)
      }
    }

    const loadStats = async () => {
      if (!mounted) return
      await refreshDashboardStats()
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

  useEffect(() => {
    if (currentView !== 'token-usage') return
    const loadTokenData = async () => {
      setTokenLoading(true)
      try {
        const [summaryRes, trendRes, recentRes] = await Promise.all([
          teacherApi.getTokenUsageSummary({ days: tokenDays }),
          teacherApi.getTokenUsageTrend({ days: tokenDays, period: tokenPeriod }),
          teacherApi.getTokenUsageRecent({ limit: 20 }),
        ])
        setTokenSummary(summaryRes?.summary || null)
        const raw = trendRes?.trend || []
        setTokenTrend(raw.map(item => ({
          ...item,
          date: typeof item.date === 'string' ? item.date : String(item.date ?? ''),
          tokens: Number(item.tokens || item.total_tokens || 0),
          calls: Number(item.calls || item.count || 0),
        })).filter(item => item.date))
        setTokenRecent(recentRes?.records || [])
      } catch (err) {
        console.error('加载Token数据失败:', err)
      } finally {
        setTokenLoading(false)
      }
    }
    loadTokenData()
  }, [currentView, tokenDays, tokenPeriod])

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
      await refreshDashboardStats()
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
      await refreshDashboardStats()
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (error) {
      console.error('保存内容失败:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  const generatePersonalizedContent = async () => {
    if (!selectedCourse || !contentTopic) {
      alert('请选择课程并输入教学主题')
      return
    }
    if (selectedResourceTypes.length === 0) {
      alert('请至少选择一种内容类型')
      return
    }

    setIsGeneratingMultimodal(true)
    setMultimodalResults(null)
    setAgentProgress({
      overall_progress: 5,
      stage: 'planning',
      steps: selectedResourceTypes.map((resourceType) => ({
        resource_type: resourceType,
        agent_name: `${resourceType}_agent`,
        task_type: '',
        status: 'pending',
        progress: 0,
      })),
    })
    setQualityReport(null)
    try {
      const res = await courseGeneration.generatePersonalizedResources({
        course_id: parseInt(selectedCourse, 10),
        topic: contentTopic,
        student_profile: { major: '', weaknesses: [], learning_needs: [] },
        resource_types: selectedResourceTypes,
      })
      const resources = res.resources || res
      setMultimodalResults(resources)
      if (res.agent_progress) {
        setAgentProgress(res.agent_progress)
      }
      if (res.content_quality_report) {
        setQualityReport(res.content_quality_report)
      }
      const firstAvailable = selectedResourceTypes.find(t => resources[t])
      if (firstAvailable) setActiveMultimodalTab(firstAvailable)
    } catch (error) {
      console.error('多模态内容生成失败:', error)
      alert('生成失败: ' + (error.message || '请重试'))
      setAgentProgress((prev) => ({
        ...(prev || {}),
        overall_progress: 0,
        stage: 'failed',
        steps: (prev?.steps || []).map((step) => ({ ...step, status: 'failed' })),
      }))
    } finally {
      setIsGeneratingMultimodal(false)
    }
  }

  const [syncStatus, setSyncStatus] = useState(null)
  const [versionHistory, setVersionHistory] = useState([])

  const saveMultimodalContent = async (type, data) => {
    if (!selectedCourse) return
    setSaveStatus('saving')
    try {
      const typeLabels = { document: '核心概念文档', mindmap: '知识点思维导图', project: '代码实操案例', recommendation: '拓展阅读材料', media: '视频脚本' }
      const label = typeLabels[type] || type

      // 根据内容类型提取格式化后的文本内容，避免存储原始 JSON
      let formattedContent = ''
      if (type === 'document' && data) {
        // 文档类型：优先使用 markdown 字段，否则从结构化字段构建 Markdown
        if (data.markdown) {
          formattedContent = data.markdown
        } else if (data.sections) {
          const parts = []
          if (data.title) parts.push(`# ${data.title}\n`)
          if (data.summary) parts.push(`> ${data.summary}\n`)
          for (const sec of data.sections) {
            parts.push(`## ${sec.title || ''}\n`)
            if (sec.key_points?.length) {
              parts.push('**核心要点：**')
              for (const kp of sec.key_points) parts.push(`- ${kp}`)
              parts.push('')
            }
            if (sec.content) parts.push(sec.content + '\n')
            if (sec.examples?.length) {
              for (const ex of sec.examples) {
                parts.push(`### ${ex.title || '示例'}\n`)
                if (ex.description) parts.push(ex.description + '\n')
                if (ex.content) parts.push('```\n' + ex.content + '\n```\n')
              }
            }
            if (sec.common_mistakes?.length) {
              parts.push('**常见误区：**')
              for (const cm of sec.common_mistakes) parts.push(`- ${cm}`)
              parts.push('')
            }
          }
          if (data.glossary?.length) {
            parts.push('## 术语表\n')
            for (const g of data.glossary) parts.push(`- **${g.term}**：${g.definition}`)
          }
          if (data.review_questions?.length) {
            parts.push('\n## 复习思考题\n')
            data.review_questions.forEach((q, i) => parts.push(`${i + 1}. ${q}`))
          }
          formattedContent = parts.join('\n')
        } else {
          formattedContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        }
      } else if (type === 'mindmap' && data) {
        // 思维导图：构建可读的结构化文本
        const parts = [`# ${data.title || contentTopic || '思维导图'}\n`]
        const buildNode = (node, depth = 0) => {
          if (!node) return
          const indent = '  '.repeat(depth)
          parts.push(`${indent}- ${node.name || '未命名节点'}`)
          if (node.description) parts.push(`${indent}  ${node.description}`)
          if (node.children?.length) {
            for (const child of node.children) buildNode(child, depth + 1)
          }
        }
        if (data.root) buildNode(data.root)
        else buildNode(data)
        formattedContent = parts.join('\n')
      } else if (type === 'project' && data) {
        // 代码实操：构建项目说明文档
        const parts = [`# ${data.title || data.project_title || contentTopic || '代码实操项目'}\n`]
        if (data.description || data.project_description) {
          parts.push(`${data.description || data.project_description}\n`)
        }
        if (data.learning_objectives?.length) {
          parts.push('## 学习目标\n')
          for (const obj of data.learning_objectives) parts.push(`- ${obj}`)
          parts.push('')
        }
        if (data.tasks?.length) {
          parts.push('## 任务分解\n')
          data.tasks.forEach((task, i) => {
            parts.push(`### 任务${i + 1}：${task.title || ''}\n`)
            if (task.description) parts.push(`${task.description}\n`)
            if (task.steps?.length) {
              parts.push('**步骤：**')
              task.steps.forEach((step, j) => {
                const stepText = typeof step === 'string' ? step : (step.instruction || step.step || '')
                if (stepText) parts.push(`${j + 1}. ${stepText}`)
              })
              parts.push('')
            }
            if (task.code_template) {
              parts.push('**代码模板：**\n```' + (data.language || data.programming_language || 'python').toLowerCase() + '\n' + task.code_template + '\n```\n')
            }
            if (task.reference_solution) {
              parts.push('**参考答案：**\n```' + (data.language || data.programming_language || 'python').toLowerCase() + '\n' + task.reference_solution + '\n```\n')
            }
          })
        }
        if (data.full_code) {
          parts.push('## 完整代码\n```' + (data.language || data.programming_language || 'python').toLowerCase() + '\n' + data.full_code + '\n```\n')
        }
        formattedContent = parts.join('\n')
      } else if (type === 'recommendation' && data) {
        // 拓展推荐：构建推荐列表
        const parts = [`# ${contentTopic || '拓展学习资源'}\n`]
        const recs = data.recommendations || data.resources || (Array.isArray(data) ? data : [data])
        if (Array.isArray(recs)) {
          recs.forEach((rec, i) => {
            parts.push(`## ${i + 1}. ${rec.title || rec.name || '推荐资源'}\n`)
            if (rec.description) parts.push(`${rec.description}\n`)
            if (rec.url) parts.push(`链接：${rec.url}\n`)
            if (rec.reason) parts.push(`推荐理由：${rec.reason}\n`)
          })
        }
        formattedContent = parts.join('\n')
      } else if (type === 'media' && data) {
        // 视频脚本：保存规范化结构化 JSON，便于学生端 CourseLearningPage.jsx
        // 通过 JSON.parse 解析后直接渲染分镜表格（对齐教师端表格结构）。
        // 字段名容错：LLM 可能用 narrative/keyframes/shooting_format 等变体，统一映射。
        const media = data.media || data
        const rawScript = media.script || {}
        const rawScenes = Array.isArray(rawScript.scenes) ? rawScript.scenes
          : (Array.isArray(media.scenes) ? media.scenes
          : (Array.isArray(data.narrative) ? data.narrative : []))
        const scenes = rawScenes.map((sc, i) => {
          if (!sc || typeof sc !== 'object') return null
          const kf = Array.isArray(sc.keyframes) ? sc.keyframes : null
          return {
            scene_id: sc.scene_id ?? (i + 1),
            stage: sc.stage || '',
            duration_seconds: sc.duration_seconds ?? sc.duration ?? '?',
            visual_description: sc.visual_description || sc.visual || sc.description || sc.content || '',
            narration: sc.narration || sc.narrative || sc.voiceover || sc.narrator || '',
            subtitle: sc.subtitle || '',
            shooting_format: sc.shooting_format || '',
            animation_notes: sc.animation_notes || sc.animation || '',
            key_frame_description: sc.key_frame_description || (kf ? kf.map(k => k.title ? `${k.title}：${k.content||''}` : (k.content||'')).join('；') : ''),
            visual_elements: Array.isArray(sc.visual_elements) ? sc.visual_elements : (kf ? kf.map(k => k.title).filter(Boolean) : []),
            transition: sc.transition || '',
          }
        }).filter(Boolean)
        const script = {
          ...rawScript,
          visual_style: rawScript.visual_style || media.visual_style || '',
          shooting_format_suggestion: rawScript.shooting_format_suggestion || media.shooting_format || '',
          background_music_suggestion: rawScript.background_music_suggestion || media.background_music_suggestion || '',
          total_duration_seconds: rawScript.total_duration_seconds || media.total_duration_seconds,
          scenes,
        }
        // 规范化 JSON 结构：顶层 media 包含 title/presentation_style/估计时长等元信息，
        // media.script 包含整体视觉风格与分镜数组，供学生端表格直接消费。
        const normalizedMedia = {
          ...media,
          title: media.title || contentTopic || '教学视频脚本',
          presentation_style: media.presentation_style || '',
          estimated_duration_minutes: media.estimated_duration_minutes ?? null,
          target_style: media.target_style || '',
          supplementary_materials: Array.isArray(media.supplementary_materials) ? media.supplementary_materials : [],
          script,
        }
        formattedContent = JSON.stringify({ media: normalizedMedia }, null, 2)
      } else {
        formattedContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }

      await content.create({
        course_id: parseInt(selectedCourse, 10),
        title: `${contentTopic || '教学内容'} - ${label}`,
        content: formattedContent,
        content_type: type,
      })
      setSaveStatus('success')

      setVersionHistory(prev => [{
        id: Date.now(),
        type,
        topic: contentTopic,
        timestamp: new Date().toLocaleString('zh-CN'),
        action: '保存',
      }, ...prev].slice(0, 20))

      setSyncStatus('syncing')
      try {
        await courseGeneration.saveAndSync({
          course_id: parseInt(selectedCourse, 10),
          content_type: type,
          content_data: data,
          topic: contentTopic,
          save_format: 'json',
        })
        setSyncStatus('synced')
      } catch (syncErr) {
        console.warn('自动同步失败:', syncErr)
        setSyncStatus('sync_failed')
      }

      setTimeout(() => { setSaveStatus(null); setSyncStatus(null) }, 5000)
    } catch (error) {
      console.error('保存失败:', error)
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

  const generateProgrammingExam = async () => {
    if (!selectedCourse || !examTopic) {
      alert('请选择课程和输入考试主题')
      return
    }

    setIsGenerating(true)
    setGeneratedParseError(null)

    try {
      const res = await programming.generate({
        course_id: parseInt(selectedCourse, 10),
        topic: examTopic,
        title: `${examTopic}编程题`,
        question_count: Math.max(1, Math.min(20, Number(questionCount) || 1)),
        difficulty: 'medium',
        language: programmingLanguage
      })
      const normalizedQuestions = normalizeQuestions(res.questions || res.assessment?.questions || [])
      if (normalizedQuestions.length === 0) {
        setGeneratedParseError('AI未返回有效编程题，请重试')
        setGeneratedQuestions([])
      } else {
        setGeneratedQuestions(normalizedQuestions)
        setGeneratedParseError(null)
      }
      if (res.assessment?.id) setLastAssessmentId(res.assessment.id)
      await loadAllAssessments()
      alert('编程题生成成功，已保存到考核列表')
    } catch (error) {
      console.error('生成编程题失败:', error)
      setGeneratedParseError(error.message || '生成编程题失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const loadProgrammingSubmissions = async () => {
    setProgrammingSubmissionsLoading(true)
    try {
      const res = await programming.getTeacherSubmissions(selectedCourse ? { course_id: selectedCourse } : {})
      setProgrammingSubmissions(res.submissions || [])
    } catch (error) {
      console.warn('加载编程题提交详情失败:', error)
      setProgrammingSubmissions([])
    } finally {
      setProgrammingSubmissionsLoading(false)
    }
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
      question: q.question || q.title || '',
      title: q.title || q.question || '',
      description: q.description || q.content || '',
      input_format: q.input_format || q.inputFormat || '',
      output_format: q.output_format || q.outputFormat || '',
      constraints: q.constraints || '',
      samples: Array.isArray(q.samples) ? q.samples : [],
      test_cases: Array.isArray(q.test_cases) ? q.test_cases : [],
      standard_answer: q.standard_answer || q.reference_answer || '',
      language: q.language || programmingLanguage || 'python',
      knowledge_tags: Array.isArray(q.knowledge_tags) ? q.knowledge_tags : [],
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
      
      if (q.type === 'choice' || (!q.type && q.options && q.options.length >= 2)) {
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

      if (q.type === 'programming') {
        if (!q.description || q.description.trim() === '') {
          warnings.push(`第 ${qNum} 题：编程题缺少详细描述`)
        }
        if (!q.standard_answer || q.standard_answer.trim() === '') {
          warnings.push(`第 ${qNum} 题：编程题缺少参考答案`)
        }
        if (!Array.isArray(q.test_cases) || q.test_cases.length === 0) {
          warnings.push(`第 ${qNum} 题：编程题缺少测试用例`)
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
        question: q.question || q.title || '',
        title: q.title || q.question || '',
        type: q.type || 'choice',
        options: Array.isArray(q.options) ? q.options.filter(opt => opt && opt.trim() !== '') : [],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : null,
        explanation: q.explanation || '',
        description: q.description || '',
        input_format: q.input_format || '',
        output_format: q.output_format || '',
        constraints: q.constraints || '',
        samples: Array.isArray(q.samples) ? q.samples : [],
        test_cases: Array.isArray(q.test_cases) ? q.test_cases : [],
        standard_answer: q.standard_answer || '',
        language: q.language || programmingLanguage || 'python',
        knowledge_tags: Array.isArray(q.knowledge_tags) ? q.knowledge_tags : []
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
              students: created.student_count || created.students || 0,
              progress: created.progress || created.progress_percentage || 0,
              status: 'active',
              created_at: created.created_at ? created.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              description: created.description || '',
              category: created.category || '',
              difficulty: created.difficulty || '',
              duration: created.duration || '',
              teacher_name: created.teacher_name || ''
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
      await refreshDashboardStats()
      alert('课程添加成功！')
    } catch (error) {
      console.error('添加课程失败:', error)
      alert('课程添加失败：' + (error.message || '未知错误'))
    }
  }

  // 删除课程
  const handleDeleteCourse = async (course) => {
    const courseId = course?.id
    if (!courseId || deletingCourseId) return

    const message = `删除课程确认\n\n即将删除课程：「${course?.title || courseId}」\n\n此操作不可撤销，并会永久清除以下所有关联数据：\n- 课程基本信息、描述与封面\n- 视频教学资源与讲义文档\n- 学习资料、PDF、PPT、补充材料\n- 章节结构、知识点与知识图谱\n- 学生学习记录与进度数据\n- 课程讨论、评论、题库与练习记录\n\n确定要继续删除吗？`
    if (!confirm(message)) return

    try {
      setDeletingCourseId(courseId)
      const result = await courses.delete(courseId)
      setCourseList(prev => prev.filter(c => c.id !== courseId))
      await refreshDashboardStats()
      alert(result?.message || '课程删除成功！所有关联数据已清除。')
    } catch (error) {
      console.error('删除课程失败:', error)
      alert('课程删除失败：' + (error.message || '未知错误'))
    } finally {
      setDeletingCourseId(null)
    }
  }

  const handleViewCourseDetail = async (course) => {
    setCourseDetail(course)
    setCourseDetailOpen(true)
    setCourseDetailLoading(true)
    try {
      const [contentRes, assessmentsRes, videosRes] = await Promise.allSettled([
        courses.getContent(course.id),
        courses.getAssessments(course.id),
        videos.getByCourse(course.id)
      ])
      const rawContents = contentRes.status === 'fulfilled' ? (contentRes.value?.contents || []) : []
      const rawAssessments = assessmentsRes.status === 'fulfilled' ? (assessmentsRes.value?.assessments || []) : []
      const videoList = videosRes.status === 'fulfilled' ? (videosRes.value?.videos || []) : []
      // AI 生成内容去重：相同标题的 AI 生成项仅保留一条（取最新）
      const contents = dedupeAiItems(rawContents)
      const assessments = dedupeAiItems(rawAssessments)
      setCourseDetail(prev => ({
        ...prev,
        contents,
        assessments,
        videoList,
        contentCount: contents.length,
        assessmentCount: assessments.length,
        videoCount: videoList.length
      }))
    } catch (err) {
      console.warn('加载课程详情失败:', err)
    } finally {
      setCourseDetailLoading(false)
    }
  }

  // 删除课程详情中的视频项
  const handleDeleteVideoItem = async (videoId, title) => {
    if (!confirm(`确定要删除视频「${title}」吗？此操作将同步至学生端且不可撤销。`)) return
    try {
      await videos.delete(videoId)
      setCourseDetail(prev => prev ? {
        ...prev,
        videoList: (prev.videoList || []).filter(v => v.id !== videoId),
        videoCount: Math.max(0, (prev.videoCount || 0) - 1)
      } : prev)
      alert('视频已删除并同步至学生端')
    } catch (error) {
      console.error('删除视频失败:', error)
      alert('删除视频失败: ' + (error.message || '未知错误'))
    }
  }

  // 删除课程详情中的考核项
  const handleDeleteAssessmentItem = async (assessmentId, title) => {
    if (!confirm(`确定要删除考核「${title}」吗？此操作将同步至学生端且不可撤销。`)) return
    try {
      await courses.deleteAssessment(assessmentId)
      setCourseDetail(prev => prev ? {
        ...prev,
        assessments: (prev.assessments || []).filter(a => a.id !== assessmentId),
        assessmentCount: Math.max(0, (prev.assessmentCount || 0) - 1)
      } : prev)
      alert('考核已删除并同步至学生端')
    } catch (error) {
      console.error('删除考核失败:', error)
      alert('删除考核失败: ' + (error.message || '未知错误'))
    }
  }

  // 删除课程详情中的讲义项
  const handleDeleteContentItem = async (contentId, title) => {
    if (!confirm(`确定要删除讲义「${title}」吗？此操作将同步至学生端且不可撤销。`)) return
    try {
      await courses.deleteContent(contentId)
      setCourseDetail(prev => prev ? {
        ...prev,
        contents: (prev.contents || []).filter(c => c.id !== contentId),
        contentCount: Math.max(0, (prev.contentCount || 0) - 1)
      } : prev)
      alert('讲义已删除并同步至学生端')
    } catch (error) {
      console.error('删除讲义失败:', error)
      alert('删除讲义失败: ' + (error.message || '未知错误'))
    }
  }

  const renderContent = () => {
    switch (currentView) {
      case 'courses':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>课程管理</h2>
                <p className="text-[#6b6560]">管理您的教学课程</p>
              </div>
              <Dialog open={isAddCourseOpen} onOpenChange={setIsAddCourseOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#d4a853] hover:bg-[#c49a48]">
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
                    <BookOpen className="h-8 w-8 text-[#d4a853]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">我的课程</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{courseList.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-[#5a9e6f]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">总学生数</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">
                        {stats.totalStudents || courseList.reduce((sum, course) => sum + course.students, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-[#8b6fb0]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">平均进度</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">
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
                        <TableCell className="font-medium">{course.title}<div className="text-sm text-[#6b6560]">{course.subtitle}</div></TableCell>
                        <TableCell>{course.category || '-'}</TableCell>
                        <TableCell>{course.level || '-'}</TableCell>
                        <TableCell>{course.students}</TableCell>
                        <TableCell>{course.progress}%</TableCell>
                        <TableCell>{course.lessonsCount ?? (course.modules ? course.modules.reduce((s,m)=>s+(m.lessons||0),0):'-')}</TableCell>
                        <TableCell>{course.durationHours ?? '-'}</TableCell>
                        <TableCell>
                          <Badge className={course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-[#f5f2ee] text-[#2d2a26]'}>
                            {course.status === 'active' ? '活跃' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>{course.created_at}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewCourseDetail(course)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCourse(course)}
                              disabled={deletingCourseId === course.id}
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

      case 'knowledgeGraph':
        return <KnowledgeGraphManager courses={courseList} onRefresh={refreshDashboardStats} />
      case 'content':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>内容生成</h2>
              <p className="text-[#6b6560]">使用AI生成教学内容</p>
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
                        <span className="text-[#5a9e6f] text-sm">✓ 保存成功</span>
                      )}
                      {saveStatus === 'error' && (
                        <span className="text-red-600 text-sm">✗ 保存失败，请重试</span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="h-5 w-5 mr-2" />
                  多模态教学内容生成
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">选择需要生成的内容类型，AI将为您生成个性化教学资源</p>
                <div className="grid grid-cols-2 gap-2">
                  {RESOURCE_TYPE_OPTIONS.map(opt => {
                    const isSelected = selectedResourceTypes.includes(opt.value)
                    const IconComp = opt.icon
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleResourceType(opt.value)}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 bg-white'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-600'}`}>{opt.label}</span>
                          </div>
                          <p className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-600/70' : 'text-gray-400'}`}>{opt.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <Button
                  onClick={generatePersonalizedContent}
                  disabled={isGeneratingMultimodal || !selectedCourse || !contentTopic || selectedResourceTypes.length === 0}
                  className="w-full"
                  variant="outline"
                >
                  {isGeneratingMultimodal ? '正在生成...' : `生成 ${selectedResourceTypes.length} 种教学内容`}
                </Button>

                {isGeneratingMultimodal && !multimodalResults && (
                  <div className="mt-4">
                    <AgentCollaborationProgress
                      progress={agentProgress}
                      loading={isGeneratingMultimodal}
                      title="多 Agent 协作生成进度"
                    />
                  </div>
                )}

                {multimodalResults && agentProgress && (
                  <div className="mt-4">
                    <AgentCollaborationProgress
                      progress={agentProgress}
                      loading={false}
                      title="Agent 协作执行记录"
                    />
                  </div>
                )}

                {multimodalResults && (
                  <div className="space-y-4 mt-4">
                    <Tabs value={activeMultimodalTab} onValueChange={setActiveMultimodalTab}>
                      <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Object.keys(multimodalResults).filter(k => multimodalResults[k]).length}, 1fr)` }}>
                        {multimodalResults.document && <TabsTrigger value="document">文档</TabsTrigger>}
                        {multimodalResults.mindmap && <TabsTrigger value="mindmap">思维导图</TabsTrigger>}
                        {multimodalResults.project && <TabsTrigger value="project">代码实操</TabsTrigger>}
                        {multimodalResults.recommendation && <TabsTrigger value="recommendation">拓展推荐</TabsTrigger>}
                        {multimodalResults.media && <TabsTrigger value="media">视频脚本</TabsTrigger>}
                      </TabsList>
                    </Tabs>

                    {multimodalResults.document && (() => {
                      const doc = multimodalResults.document
                      return (
                        <div className={activeMultimodalTab === 'document' ? '' : 'hidden'}>
                          {doc && typeof doc === 'object' && (doc.sections || doc.title) ? (
                            <div className="border rounded-lg p-4 bg-white space-y-4">
                              {doc.title && <h3 className="text-lg font-bold">{doc.title}</h3>}
                              {doc.summary && <p className="text-sm text-gray-600">{doc.summary}</p>}
                              {(doc.sections || []).map((sec, i) => (
                                <div key={i} className="border-l-2 border-indigo-300 pl-3">
                                  <h4 className="font-semibold text-sm">{sec.title || `第${i+1}节`}</h4>
                                  {sec.key_points?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {sec.key_points.map((kp, j) => (
                                        <span key={j} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">{kp}</span>
                                      ))}
                                    </div>
                                  )}
                                  {sec.content && <p className="text-sm text-gray-700 mt-1">{sec.content}</p>}
                                  {sec.examples?.length > 0 && sec.examples.map((ex, j) => (
                                    <div key={j} className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                      <span className="font-medium">{ex.title || `示例${j+1}`}</span>
                                      {ex.description && <p className="text-gray-500 mt-0.5">{ex.description}</p>}
                                      {ex.content && <pre className="mt-1 p-1.5 bg-white border rounded text-[11px] whitespace-pre-wrap text-gray-700">{ex.content}</pre>}
                                    </div>
                                  ))}
                                </div>
                              ))}
                              {doc.glossary?.length > 0 && (
                                <div className="mt-3">
                                  <h4 className="font-semibold text-sm mb-1">术语表</h4>
                                  <div className="grid grid-cols-2 gap-1">
                                    {doc.glossary.map((g, i) => (
                                      <span key={i} className="text-xs"><strong>{g.term}</strong>: {g.definition}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-2 pt-2">
                                <Button size="sm" onClick={() => saveMultimodalContent('document', doc)} disabled={saveStatus === 'saving'}>
                                  {saveStatus === 'saving' ? '保存中...' : '保存到课程'}
                                </Button>
                                {saveStatus === 'success' && <span className="text-green-600 text-xs">✓ 已保存</span>}
                              </div>
                            </div>
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm p-4 border rounded-lg bg-gray-50">{typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2)}</pre>
                          )}
                        </div>
                      )
                    })()}

                    {multimodalResults.mindmap && (() => {
                      const mindmapData = multimodalResults.mindmap
                      let data = null
                      if (mindmapData?.root) {
                        data = mindmapData
                      } else if (mindmapData?.mindmap?.root) {
                        data = mindmapData.mindmap
                      } else if (Array.isArray(mindmapData?.children)) {
                        data = { root: { name: contentTopic || '知识结构', description: '', is_core: true, relationship_type: null, children: mindmapData.children } }
                      } else if (mindmapData?.nodes) {
                        data = { root: mindmapData }
                      }
                      return (
                        <div className={activeMultimodalTab === 'mindmap' ? '' : 'hidden'}>
                          {data?.root ? (
                            <div>
                              <div className="border rounded-lg bg-white" style={{ height: 400 }}>
                                <InteractiveMindMap data={data} />
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Button size="sm" onClick={() => saveMultimodalContent('mindmap', mindmapData)} disabled={saveStatus === 'saving'}>
                                  {saveStatus === 'saving' ? '保存中...' : '保存到课程'}
                                </Button>
                                {saveStatus === 'success' && <span className="text-green-600 text-xs">✓ 已保存</span>}
                              </div>
                            </div>
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm p-4 border rounded-lg bg-gray-50">{typeof mindmapData === 'string' ? mindmapData : JSON.stringify(mindmapData, null, 2)}</pre>
                          )}
                        </div>
                      )
                    })()}

                    {multimodalResults.project && (() => {
                      const proj = multimodalResults.project
                      // 兼容 coordinator_agent._normalize_resources_for_output 的字段重命名
                      // (project_title→title, project_description→description, programming_language→language)
                      const projTitle = proj.project_title || proj.title
                      const projDesc = proj.project_description || proj.description
                      const projLang = proj.programming_language || proj.language
                      // 只要存在任意结构化字段即视为可结构化展示，避免 fallback 到 JSON dump
                      const hasStructuredData = proj && typeof proj === 'object' && (
                        proj.tasks?.length > 0
                        || projTitle
                        || projDesc
                        || proj.full_code
                        || proj.code_template
                        || proj.reference_solution
                        || proj.starter_code
                        || proj.learning_objectives?.length > 0
                        || proj.prerequisites?.length > 0
                        || proj.knowledge_points_covered?.length > 0
                      )
                      const displayTitle = projTitle || `${contentTopic || ''} 代码实操案例`
                      const displayLang = projLang || 'python'
                      // 完整代码优先级：full_code > reference_solution > starter_code > code_template
                      const rawCode = proj.full_code || proj.reference_solution || proj.starter_code || proj.code_template || ''
                      // 空代码时提供语言对应的占位模板，保证编辑器始终可用
                      const placeholderTemplates = {
                        python: `# ${displayTitle}\n# 在此处编写你的代码实现\n\ndef main():\n    pass\n\nif __name__ == '__main__':\n    main()\n`,
                        javascript: `// ${displayTitle}\n// 在此处编写你的代码实现\n\nfunction main() {\n  // TODO: 实现功能\n}\n\nmain();\n`,
                        java: `// ${displayTitle}\npublic class Main {\n    public static void main(String[] args) {\n        // TODO: 实现功能\n    }\n}\n`,
                        cpp: `// ${displayTitle}\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // TODO: 实现功能\n    return 0;\n}\n`,
                      }
                      const displayCode = rawCode || placeholderTemplates[displayLang] || placeholderTemplates.python
                      const tasks = proj.tasks || []
                      const prerequisites = proj.prerequisites || proj.knowledge_points_covered || []
                      const scoringCriteria = proj.scoring_criteria || proj.rubric || []
                      return (
                        <div className={activeMultimodalTab === 'project' ? '' : 'hidden'}>
                          {hasStructuredData ? (
                            <div className="border rounded-lg p-4 bg-white space-y-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold">{displayTitle}</h3>
                                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{displayLang}</span>
                                {proj.difficulty && <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded">{proj.difficulty}</span>}
                                {proj.estimated_time && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded">{proj.estimated_time}</span>}
                              </div>
                              {projDesc && <p className="text-sm text-gray-600">{projDesc}</p>}
                              {prerequisites.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  <span className="text-xs text-gray-500 mr-1">前置知识:</span>
                                  {prerequisites.map((p, i) => (
                                    <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{typeof p === 'string' ? p : p.title || p.name || ''}</span>
                                  ))}
                                </div>
                              )}
                              {tasks.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-sm text-gray-800">任务分解</h4>
                                  {tasks.map((task, i) => (
                                    <div key={i} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{task.task_id || i + 1}</span>
                                        <span className="font-medium text-sm">{task.title || `任务${i + 1}`}</span>
                                      </div>
                                      {task.description && <p className="text-xs text-gray-600 ml-8">{task.description}</p>}
                                      {task.steps?.length > 0 && (
                                        <div className="ml-8 space-y-1">
                                          {task.steps.map((step, j) => (
                                            <div key={j} className="text-xs text-gray-500 flex items-start gap-1">
                                              <span className="text-gray-300 mt-0.5">•</span>
                                              <span>{typeof step === 'string' ? step : step.instruction || step.step || ''}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {task.code_template && !isPlaceholderCode(task.code_template) && (
                                        <div className="ml-8 mt-2">
                                          <p className="text-xs text-gray-500 mb-1">代码模板:</p>
                                          <pre className="text-xs bg-gray-800 text-green-300 p-2 rounded overflow-x-auto max-h-40 whitespace-pre">{task.code_template}</pre>
                                        </div>
                                      )}
                                      {task.reference_solution && !isPlaceholderCode(task.reference_solution) && (
                                        <details className="ml-8 mt-1">
                                          <summary className="text-xs text-indigo-600 cursor-pointer hover:text-indigo-800">查看参考实现</summary>
                                          <pre className="text-xs bg-gray-800 text-green-300 p-2 rounded overflow-x-auto max-h-60 mt-1 whitespace-pre">{task.reference_solution}</pre>
                                        </details>
                                      )}
                                      {task.hints?.length > 0 && (
                                        <div className="ml-8 mt-1">
                                          <span className="text-xs text-amber-600">💡 提示: {task.hints.join(' | ')}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {displayCode && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm text-gray-800">
                                      {rawCode ? '完整代码' : '代码编辑器'}
                                    </h4>
                                    {!rawCode && (
                                      <span className="text-xs text-amber-600">⚠ AI 未生成完整代码，已提供模板，请在此基础上编写</span>
                                    )}
                                  </div>
                                  <CodePlayground
                                    initialCode={displayCode}
                                    language={displayLang}
                                    readOnly={false}
                                  />
                                </div>
                              )}
                              {scoringCriteria.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm text-gray-800">评分标准</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    {scoringCriteria.map((c, i) => (
                                      <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                                        <span>{typeof c === 'string' ? c : c.item || c.description || ''}</span>
                                        {c.points && <span className="font-medium text-indigo-600">{c.points}分</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-2 pt-2">
                                <Button size="sm" onClick={() => saveMultimodalContent('project', proj)} disabled={saveStatus === 'saving'}>
                                  {saveStatus === 'saving' ? '保存中...' : '保存到课程'}
                                </Button>
                                {saveStatus === 'success' && <span className="text-green-600 text-xs">✓ 已保存</span>}
                              </div>
                            </div>
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm p-4 border rounded-lg bg-gray-50">{typeof proj === 'string' ? proj : JSON.stringify(proj, null, 2)}</pre>
                          )}
                        </div>
                      )
                    })()}

                    {multimodalResults.recommendation && (() => {
                      const rec = multimodalResults.recommendation
                      const items = rec?.items || (Array.isArray(rec) ? rec : [])
                      const categories = rec?.categories || {}
                      const hasCategories = Object.keys(categories).length > 0
                      const catLabels = {
                        textbook: '📚 教材与书籍', tutorial: '📖 教程与指南', video: '🎬 视频课程',
                        paper: '📄 学术论文', practice: '💻 练习与实训', tool: '🔧 工具与平台',
                        reference: '📋 参考文档', general: '📌 综合资源',
                      }
                      const priorityCfg = {
                        high: { label: '高优先', cls: 'bg-red-100 text-red-700 border-red-200' },
                        medium: { label: '中优先', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
                        low: { label: '低优先', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
                      }
                      return (
                        <div className={activeMultimodalTab === 'recommendation' ? '' : 'hidden'}>
                          {items.length > 0 ? (
                            <div className="border rounded-lg p-4 bg-white space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">{rec?.title || '拓展学习推荐'}</h4>
                                {rec?.summary && <span className="text-xs text-gray-500">{rec.summary}</span>}
                              </div>
                              {hasCategories ? (
                                Object.entries(categories).map(([cat, catItems]) => (
                                  <div key={cat} className="space-y-2">
                                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b pb-1">
                                      {catLabels[cat] || cat}
                                    </h5>
                                    {catItems.map((item, i) => {
                                      const pri = priorityCfg[item.priority] || priorityCfg.medium
                                      return (
                                        <div key={i} className="p-3 border rounded-lg bg-gray-50 space-y-1.5">
                                          <div className="flex items-start justify-between gap-2">
                                            <span className="text-sm font-medium">{item.title}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${pri.cls}`}>{pri.label}</span>
                                          </div>
                                          {item.description && <p className="text-xs text-gray-600">{item.description}</p>}
                                          {item.key_points?.length > 0 && (
                                            <ul className="space-y-0.5">
                                              {item.key_points.map((kp, j) => (
                                                <li key={j} className="text-xs text-gray-500 flex items-start gap-1">
                                                  <span className="text-gray-300 mt-0.5">•</span>
                                                  <span>{kp}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                          <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                            {item.author && <span>👤 {item.author}</span>}
                                            {item.difficulty && <span>📊 {item.difficulty}</span>}
                                            {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">🔗 链接</a>}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ))
                              ) : (
                                items.map((item, i) => {
                                  const pri = priorityCfg[item.priority] || priorityCfg.medium
                                  return (
                                    <div key={i} className="p-3 border rounded-lg bg-gray-50 space-y-1.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-sm font-medium">{typeof item === 'string' ? item : item.title}</span>
                                        {typeof item === 'object' && <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${pri.cls}`}>{pri.label}</span>}
                                      </div>
                                      {typeof item === 'object' && item.description && <p className="text-xs text-gray-600">{item.description}</p>}
                                    </div>
                                  )
                                })
                              )}
                              <div className="flex items-center gap-2 pt-2">
                                <Button size="sm" onClick={() => saveMultimodalContent('recommendation', rec)} disabled={saveStatus === 'saving'}>
                                  {saveStatus === 'saving' ? '保存中...' : '保存到课程'}
                                </Button>
                                {saveStatus === 'success' && <span className="text-green-600 text-xs">✓ 已保存</span>}
                              </div>
                            </div>
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm p-4 border rounded-lg bg-gray-50">{typeof rec === 'string' ? rec : JSON.stringify(rec, null, 2)}</pre>
                          )}
                        </div>
                      )
                    })()}

                    {multimodalResults.media && (() => {
                      const rawMedia = multimodalResults.media
                      // JS 字面量 → JSON 修复：LLM 偶尔输出 { stage: "1. 引言" } 而非 { "stage": "1. 引言" }，
                      // 用状态机给无引号的 key 加双引号，避免误伤字符串内部的冒号
                      const fixJsLiteralKeys = (text) => {
                        if (!text || typeof text !== 'string') return text
                        const result = []
                        let i = 0
                        const n = text.length
                        let inStr = false, esc = false
                        while (i < n) {
                          const ch = text[i]
                          if (esc) { result.push(ch); esc = false; i++; continue }
                          if (ch === '\\' && inStr) { result.push(ch); esc = true; i++; continue }
                          if (ch === '"') { inStr = !inStr; result.push(ch); i++; continue }
                          if (inStr) { result.push(ch); i++; continue }
                          if (ch === '{' || ch === ',') {
                            result.push(ch); i++
                            while (i < n && /\s/.test(text[i])) { result.push(text[i]); i++ }
                            if (i < n && /[A-Za-z_]/.test(text[i])) {
                              const ks = i
                              while (i < n && /[A-Za-z0-9_]/.test(text[i])) i++
                              const key = text.slice(ks, i)
                              while (i < n && /\s/.test(text[i])) i++
                              if (i < n && text[i] === ':') {
                                result.push('"', key, '"')
                              } else {
                                result.push(key)
                              }
                            }
                            continue
                          }
                          result.push(ch); i++
                        }
                        return result.join('')
                      }
                      // 截断 JSON 修复：补全未闭合的字符串/数组/对象
                      const repairTruncatedJson = (text) => {
                        if (!text) return null
                        const stack = []
                        let inStr = false, esc = false
                        for (const ch of text) {
                          if (esc) { esc = false; continue }
                          if (ch === '\\') { esc = true; continue }
                          if (ch === '"') { inStr = !inStr; continue }
                          if (inStr) continue
                          if (ch === '{' || ch === '[') stack.push(ch)
                          else if (ch === '}' && stack[stack.length-1] === '{') stack.pop()
                          else if (ch === ']' && stack[stack.length-1] === '[') stack.pop()
                        }
                        let suffix = ''
                        if (inStr) suffix += '"'
                        for (let i = stack.length - 1; i >= 0; i--) suffix += stack[i] === '{' ? '}' : ']'
                        return suffix ? text + suffix : null
                      }
                      // 解析容错：若后端返回 parse_error + raw_response（LLM 输出被截断或 JS 字面量语法），
                      // 尝试从前端再次解析 raw_response，依次尝试：直接解析 → JS 字面量修复 → 截断修复 → 组合修复 → partial 提取兜底
                      let baseMedia = rawMedia
                      if (rawMedia && rawMedia.parse_error && typeof rawMedia.raw_response === 'string') {
                        const tryParse = (s) => { try { return JSON.parse(s) } catch { return null } }
                        let rs = rawMedia.raw_response.trim()
                        if (rs.startsWith('```')) { const lns = rs.split('\n'); rs = lns.slice(1, lns[lns.length-1].trim()==='```'?-1:undefined).join('\n') }
                        let parsed = tryParse(rs)
                        if (!parsed) {
                          const s = rs.indexOf('{')
                          if (s >= 0) {
                            const frag = rs.slice(s)
                            parsed = tryParse(frag)
                            if (!parsed) parsed = tryParse(fixJsLiteralKeys(frag))
                            if (!parsed) {
                              const repaired = repairTruncatedJson(frag)
                              if (repaired) parsed = tryParse(repaired)
                            }
                            if (!parsed) {
                              const fixed = fixJsLiteralKeys(frag)
                              const repairedFixed = repairTruncatedJson(fixed)
                              if (repairedFixed) parsed = tryParse(repairedFixed)
                            }
                          }
                        }
                        // partial 提取兜底：当上述修复全部失败时，从截断的 JSON 文本中
                        // 用括号栈逐个提取已完成的 scene 对象，组装成可用的 media 结构。
                        // 这样即使 LLM 在第 N 个分镜处截断，前 N-1 个完整分镜仍可渲染为分镜表格。
                        if (!parsed) {
                          const extractPartialMedia = (text) => {
                            if (!text || typeof text !== 'string') return null
                            const media = { scenes: [] }
                            // 提取顶层简单字符串/数字字段
                            const simpleFields = ['type', 'title', 'topic', 'target_style', 'presentation_style',
                              'visual_style', 'shooting_format', 'shooting_format_suggestion',
                              'background_music_suggestion', 'estimated_duration_minutes']
                            for (const field of simpleFields) {
                              const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.){0,200})"`, 'm')
                              const m = text.match(re)
                              if (m) media[field] = m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ')
                              else {
                                const re2 = new RegExp(`"${field}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'm')
                                const m2 = text.match(re2)
                                if (m2) media[field] = parseFloat(m2[1])
                              }
                            }
                            // 定位 "scenes": [ 之后的内容
                            const scenesMatch = text.match(/"scenes"\s*:\s*\[/)
                            if (!scenesMatch) {
                              if (!media.type && !media.title) return null
                              return { media, partial_extracted: true }
                            }
                            let i = scenesMatch.index + scenesMatch[0].length
                            const n = text.length
                            const scenes = []
                            while (i < n) {
                              while (i < n && ' \t\n\r,'.includes(text[i])) i++
                              if (i >= n || text[i] === ']') break
                              if (text[i] !== '{') { i++; continue }
                              // 用括号栈找一个完整的 {...}
                              let depth = 0, inStr = false, esc = false, objStart = i, objEnd = -1
                              while (i < n) {
                                const ch = text[i]
                                if (esc) { esc = false; i++; continue }
                                if (ch === '\\' && inStr) { esc = true; i++; continue }
                                if (ch === '"') { inStr = !inStr; i++; continue }
                                if (inStr) { i++; continue }
                                if (ch === '{') depth++
                                else if (ch === '}') { depth--; if (depth === 0) { objEnd = i + 1; break } }
                                i++
                              }
                              if (objEnd > objStart) {
                                const sceneStr = text.slice(objStart, objEnd)
                                let sceneObj = tryParse(sceneStr)
                                if (!sceneObj) {
                                  const repaired = repairTruncatedJson(sceneStr)
                                  if (repaired) sceneObj = tryParse(repaired)
                                }
                                if (sceneObj) scenes.push(sceneObj)
                                i = objEnd
                              } else break
                            }
                            if (scenes.length > 0) media.scenes = scenes
                            if (!media.type && !media.title && scenes.length === 0) return null
                            return { media, partial_extracted: true }
                          }
                          const partial = extractPartialMedia(rs)
                          if (partial) parsed = partial
                        }
                        if (parsed) baseMedia = parsed
                      }
                      // 兼容 coordinator 标准化输出：顶层可能直接是 media 对象，或包在 media 字段中
                      let media = baseMedia?.media?.script ? baseMedia.media : (baseMedia?.script ? baseMedia : (baseMedia?.media || baseMedia))
                      // 字段名容错：LLM 可能用 narrative 数组（而非 script.scenes）、narrator（而非 narration）、
                      // content（而非 visual_description）、keyframes 等变体，统一映射
                      const rawScript = media.script || media.scenes || baseMedia?.narrative ? { ...media } : {}
                      const rawScenes = Array.isArray(rawScript.scenes) ? rawScript.scenes
                        : (Array.isArray(media.scenes) ? media.scenes
                        : (Array.isArray(baseMedia?.narrative) ? baseMedia.narrative : []))
                      const scenes = rawScenes.map((sc, i) => {
                        if (!sc || typeof sc !== 'object') return null
                        const keyframes = Array.isArray(sc.keyframes) ? sc.keyframes : null
                        return {
                          scene_id: sc.scene_id ?? (i + 1),
                          stage: sc.stage || '',
                          duration_seconds: sc.duration_seconds ?? sc.duration ?? '?',
                          visual_description: sc.visual_description || sc.visual || sc.description || sc.content || '',
                          narration: sc.narration || sc.narrative || sc.voiceover || sc.narrator || '',
                          subtitle: sc.subtitle || '',
                          shooting_format: sc.shooting_format || '',
                          animation_notes: sc.animation_notes || sc.animation || '',
                          key_frame_description: sc.key_frame_description || (keyframes ? keyframes.map(k => k.title ? `${k.title}：${k.content||''}` : (k.content||'')).join('；') : ''),
                          visual_elements: Array.isArray(sc.visual_elements) ? sc.visual_elements : (keyframes ? keyframes.map(k => k.title).filter(Boolean) : []),
                          transition: sc.transition || '',
                        }
                      }).filter(Boolean)
                      const script = {
                        ...(media.script || {}),
                        scenes,
                        visual_style: (media.script && media.script.visual_style) || media.visual_style || '',
                        shooting_format_suggestion: (media.script && media.script.shooting_format_suggestion) || media.shooting_format || media.shooting_format_suggestion || '',
                        background_music_suggestion: (media.script && media.script.background_music_suggestion) || media.background_music_suggestion || '',
                        total_duration_seconds: (media.script && media.script.total_duration_seconds) || media.total_duration_seconds,
                      }
                      const supplements = Array.isArray(media.supplementary_materials) ? media.supplementary_materials : []
                      const stageLabels = { '引入': 'bg-amber-100 text-amber-700', '讲解': 'bg-blue-100 text-blue-700', '演示': 'bg-purple-100 text-purple-700', '总结': 'bg-green-100 text-green-700', '引入阶段': 'bg-amber-100 text-amber-700', '讲解阶段': 'bg-blue-100 text-blue-700', '演示阶段': 'bg-purple-100 text-purple-700', '总结阶段': 'bg-green-100 text-green-700' }
                      const hasStructured = scenes.length > 0 || media.presentation_style || script.visual_style || media.estimated_duration_minutes
                      return (
                        <div className={activeMultimodalTab === 'media' ? '' : 'hidden'}>
                          {hasStructured ? (
                            <div className="border rounded-lg p-4 bg-white space-y-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold">{media.title || contentTopic || '教学视频脚本'}</h3>
                                {media.estimated_duration_minutes && (
                                  <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">⏱ {media.estimated_duration_minutes} 分钟</span>
                                )}
                                {media.target_style && (
                                  <span className="text-xs px-2 py-0.5 bg-pink-50 text-pink-700 rounded">🎯 {media.target_style}</span>
                                )}
                                {script.total_duration_seconds && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{Math.floor(script.total_duration_seconds / 60)}:{(script.total_duration_seconds % 60).toString().padStart(2, '0')}</span>
                                )}
                                {scenes.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">📑 {scenes.length} 个分镜</span>
                                )}
                              </div>

                              {media.presentation_style && (
                                <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                  <div className="text-xs font-semibold text-indigo-700 mb-1">🎬 视频呈现方式说明</div>
                                  <p className="text-sm text-gray-700">{media.presentation_style}</p>
                                </div>
                              )}

                              {(script.visual_style || script.shooting_format_suggestion || script.background_music_suggestion) && (
                                <div className="grid grid-cols-1 gap-2 text-xs">
                                  {script.visual_style && (
                                    <div className="p-2 bg-gray-50 rounded"><span className="font-medium text-gray-600">整体视觉风格：</span><span className="text-gray-700">{script.visual_style}</span></div>
                                  )}
                                  {script.shooting_format_suggestion && (
                                    <div className="p-2 bg-gray-50 rounded"><span className="font-medium text-gray-600">拍摄形式建议：</span><span className="text-gray-700">{script.shooting_format_suggestion}</span></div>
                                  )}
                                  {script.background_music_suggestion && (
                                    <div className="p-2 bg-gray-50 rounded"><span className="font-medium text-gray-600">背景音乐建议：</span><span className="text-gray-700">{script.background_music_suggestion}</span></div>
                                  )}
                                </div>
                              )}

                              {scenes.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">📑 分镜规划表格（共 {scenes.length} 个分镜）</h4>
                                  <div className="overflow-x-auto border rounded-lg">
                                    <table className="w-full text-xs border-collapse">
                                      <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                          <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700 whitespace-nowrap">序号</th>
                                          <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700 whitespace-nowrap">阶段</th>
                                          <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700 whitespace-nowrap">时长</th>
                                          <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700" style={{ minWidth: '180px' }}>画面描述</th>
                                          <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700" style={{ minWidth: '220px' }}>台词/旁白</th>
                                          <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700" style={{ minWidth: '120px' }}>拍摄形式</th>
                                          <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700" style={{ minWidth: '140px' }}>视觉元素</th>
                                          <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700 whitespace-nowrap">转场</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {scenes.map((scene, i) => {
                                          const stage = scene.stage || ''
                                          const stageCls = stageLabels[stage] || 'bg-gray-100 text-gray-700'
                                          const visualElems = Array.isArray(scene.visual_elements) ? scene.visual_elements : []
                                          return (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                              <td className="border border-slate-200 px-2 py-1.5 font-semibold text-slate-700 whitespace-nowrap">{scene.scene_id ?? i + 1}</td>
                                              <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">
                                                {stage ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${stageCls}`}>{stage}</span> : <span className="text-gray-400">-</span>}
                                              </td>
                                              <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{scene.duration_seconds ?? '?'} 秒</span>
                                              </td>
                                              <td className="border border-slate-200 px-2 py-1.5 text-gray-700 align-top">
                                                {scene.visual_description ? (
                                                  <div className="space-y-1">
                                                    <div>{scene.visual_description}</div>
                                                    {scene.animation_notes && <div className="text-[10px] text-purple-600">✨ {scene.animation_notes}</div>}
                                                    {scene.key_frame_description && <div className="text-[10px] text-indigo-600">🖼 {scene.key_frame_description}</div>}
                                                  </div>
                                                ) : <span className="text-gray-400">-</span>}
                                              </td>
                                              <td className="border border-slate-200 px-2 py-1.5 text-gray-700 align-top">
                                                {scene.narration ? (
                                                  <blockquote className="pl-2 border-l-2 border-indigo-200 italic">{scene.narration}</blockquote>
                                                ) : <span className="text-gray-400">-</span>}
                                                {scene.subtitle && <div className="mt-1 text-[10px] text-gray-500 not-italic">字幕：{scene.subtitle}</div>}
                                              </td>
                                              <td className="border border-slate-200 px-2 py-1.5 text-gray-700 align-top">
                                                {scene.shooting_format || <span className="text-gray-400">-</span>}
                                              </td>
                                              <td className="border border-slate-200 px-2 py-1.5 align-top">
                                                {visualElems.length > 0 ? (
                                                  <div className="flex flex-wrap gap-1">
                                                    {visualElems.map((ve, j) => (
                                                      <span key={j} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded">{ve}</span>
                                                    ))}
                                                  </div>
                                                ) : <span className="text-gray-400">-</span>}
                                              </td>
                                              <td className="border border-slate-200 px-2 py-1.5 text-[10px] text-gray-500 whitespace-nowrap align-top">
                                                {scene.transition || <span className="text-gray-400">-</span>}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {supplements.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">📎 辅助教学材料</h4>
                                  <div className="space-y-1.5">
                                    {supplements.map((sup, i) => (
                                      <div key={i} className="p-2 border rounded bg-white">
                                        <div className="text-sm font-medium">{sup.title || `辅助材料${i + 1}`}{sup.type && <span className="text-[10px] text-gray-500 ml-1">({sup.type})</span>}</div>
                                        {sup.description && <p className="text-xs text-gray-600 mt-0.5">{sup.description}</p>}
                                        {sup.content_spec && <p className="text-[10px] text-gray-400 mt-0.5">规格：{sup.content_spec}</p>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-2">
                                <Button size="sm" onClick={() => saveMultimodalContent('media', rawMedia)} disabled={saveStatus === 'saving'}>
                                  {saveStatus === 'saving' ? '保存中...' : '保存到课程'}
                                </Button>
                                {saveStatus === 'success' && <span className="text-green-600 text-xs">✓ 已保存</span>}
                              </div>
                            </div>
                          ) : (
                            <div className="border rounded-lg p-4 bg-amber-50/50 border-amber-200 space-y-3">
                              {/* 友好的解析失败提示 */}
                              <div className="flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                  <div className="font-semibold mb-1">视频脚本结构化解析未完成</div>
                                  <div className="text-xs text-amber-700">
                                    AI 生成的脚本内容较长或格式异常，无法完整解析为分镜表格。下面已尽可能提取可识别字段，您可展开"查看原始内容"获取完整文本，或重新生成。
                                  </div>
                                </div>
                              </div>

                              {/* 尝试从 raw_response 中提取可识别字段部分展示 */}
                              {(() => {
                                const rawText = typeof rawMedia === 'string'
                                  ? rawMedia
                                  : (rawMedia?.raw_response || JSON.stringify(rawMedia, null, 2))
                                // 轻量正则提取：从被截断的 JSON 文本中找出 title / topic / presentation_style 等字段值
                                const extractField = (field) => {
                                  const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.){0,200})"`, 'm')
                                  const m = rawText.match(re)
                                  return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : ''
                                }
                                const title = extractField('title')
                                const topic = extractField('topic')
                                const presentationStyle = extractField('presentation_style')
                                const visualStyle = extractField('visual_style')
                                const shootingFormat = extractField('shooting_format_suggestion') || extractField('shooting_format')
                                // 统计 scenes 数量（数 "scene_id" 或 "stage" 出现次数）
                                const sceneCount = (rawText.match(/"scene_id"\s*:/g) || []).length
                                  || (rawText.match(/"stage"\s*:/g) || []).length
                                const hasAny = title || topic || presentationStyle || visualStyle || shootingFormat || sceneCount > 0
                                if (!hasAny) return null
                                return (
                                  <div className="space-y-2 text-xs bg-white rounded-md p-3 border border-amber-100">
                                    {title && (
                                      <div className="flex gap-2">
                                        <span className="font-semibold text-gray-600 shrink-0">标题：</span>
                                        <span className="text-gray-800">{title}</span>
                                      </div>
                                    )}
                                    {topic && (
                                      <div className="flex gap-2">
                                        <span className="font-semibold text-gray-600 shrink-0">主题：</span>
                                        <span className="text-gray-800">{topic}</span>
                                      </div>
                                    )}
                                    {presentationStyle && (
                                      <div className="flex gap-2">
                                        <span className="font-semibold text-gray-600 shrink-0">呈现方式：</span>
                                        <span className="text-gray-800">{presentationStyle}</span>
                                      </div>
                                    )}
                                    {visualStyle && (
                                      <div className="flex gap-2">
                                        <span className="font-semibold text-gray-600 shrink-0">视觉风格：</span>
                                        <span className="text-gray-800">{visualStyle}</span>
                                      </div>
                                    )}
                                    {shootingFormat && (
                                      <div className="flex gap-2">
                                        <span className="font-semibold text-gray-600 shrink-0">拍摄形式：</span>
                                        <span className="text-gray-800">{shootingFormat}</span>
                                      </div>
                                    )}
                                    {sceneCount > 0 && (
                                      <div className="flex gap-2">
                                        <span className="font-semibold text-gray-600 shrink-0">分镜数量：</span>
                                        <span className="text-gray-800">约 {sceneCount} 个分镜（部分内容被截断）</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}

                              {/* 折叠的原始 JSON 文本 */}
                              <div className="border border-amber-200 rounded-md overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => setShowRawMediaJson(v => !v)}
                                  className="w-full flex items-center justify-between px-3 py-2 bg-amber-100/50 hover:bg-amber-100 text-xs text-amber-800 font-medium transition-colors"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5" />
                                    {showRawMediaJson ? '收起原始内容' : '查看原始内容（开发者模式）'}
                                  </span>
                                  <span className="text-amber-600">{showRawMediaJson ? '▴' : '▾'}</span>
                                </button>
                                {showRawMediaJson && (
                                  <pre className="whitespace-pre-wrap text-xs p-3 bg-gray-50 max-h-96 overflow-y-auto text-gray-700 border-t border-amber-200">
                                    {typeof rawMedia === 'string' ? rawMedia : JSON.stringify(rawMedia, null, 2)}
                                  </pre>
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <Button size="sm" variant="outline" onClick={() => saveMultimodalContent('media', rawMedia)} disabled={saveStatus === 'saving'}>
                                  {saveStatus === 'saving' ? '保存中...' : '保存到课程'}
                                </Button>
                                {saveStatus === 'success' && <span className="text-green-600 text-xs">✓ 已保存</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    <ContentQualityPanel report={qualityReport} />

                    <ContentSaveSyncPanel
                      courseId={selectedCourse ? parseInt(selectedCourse) : null}
                      resources={multimodalResults}
                      topic={contentTopic}
                    />

                    {syncStatus && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        syncStatus === 'syncing' ? 'bg-blue-50 text-blue-700' :
                        syncStatus === 'synced' ? 'bg-green-50 text-green-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {syncStatus === 'syncing' && (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                            <span>正在同步到学生端资源库...</span>
                          </>
                        )}
                        {syncStatus === 'synced' && (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>已同步到学生端资源库</span>
                          </>
                        )}
                        {syncStatus === 'sync_failed' && (
                          <>
                            <span>⚠ 同步失败，内容已保存到本地，可通过同步面板重试</span>
                          </>
                        )}
                      </div>
                    )}

                    {versionHistory.length > 0 && (
                      <div className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-xs font-semibold text-gray-600">版本历史</span>
                          <Badge variant="outline" className="text-[10px] ml-1">{versionHistory.length}</Badge>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {versionHistory.map(v => (
                            <div key={v.id} className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="text-gray-400 shrink-0">{v.timestamp}</span>
                              <Badge variant="outline" className="text-[10px] py-0">{v.type}</Badge>
                              <span className="truncate">{v.topic}</span>
                              <span className="text-green-600 shrink-0">{v.action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>视频管理</h2>
              <p className="text-[#6b6560]">管理课程视频内容</p>
            </div>
            
            {courseList.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Video className="w-12 h-12 mx-auto text-[#b5b0ab] mb-4" />
                  <p className="text-[#9a9590]">请先创建课程后再管理视频</p>
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
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>互动管理</h2>
              <p className="text-[#6b6560]">管理学生问答、讨论和举手</p>
            </div>
            
            {courseList.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MessageCircle className="w-12 h-12 mx-auto text-[#b5b0ab] mb-4" />
                  <p className="text-[#9a9590]">请先创建课程</p>
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

      case 'personalizationDemo':
        return <PersonalizationComparisonDemo />

      case 'classMgmt':
        return (
          <ClassManagement myCourses={courseList} />
        )

      case 'exams':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>考核管理</h2>
                <p className="text-[#6b6560]">管理考试和生成题目</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadProgrammingSubmissions}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  编程评分详情
                </Button>
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
                  <Button className="bg-[#d4a853] hover:bg-[#c49a48]">
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
                        <span className="text-xs text-[#9a9590]">{examTopic.length}/50字</span>
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
                    <div>
                      <Label className="text-sm">编程题参考语言</Label>
                      <Select value={programmingLanguage} onValueChange={setProgrammingLanguage}>
                        <SelectTrigger className="h-9">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button onClick={generateExam} disabled={isGenerating} className="w-full">
                        {isGenerating ? '生成中...' : '生成客观题'}
                      </Button>
                      <Button onClick={generateProgrammingExam} disabled={isGenerating} variant="outline" className="w-full">
                        {isGenerating ? '生成中...' : '生成编程题'}
                      </Button>
                    </div>
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
                              <span className="text-xs text-[#9a9590] bg-[#f5f2ee] px-2 py-1 rounded">{generatedQuestions.length} 道题目</span>
                              <Button size="sm" variant="outline" onClick={addQuestion} className="gap-1">
                                <span>+</span> 添加题目
                              </Button>
                            </div>
                          </div>
                          
                          {generatedQuestions.length === 0 && (
                            <div className="text-center py-8 sm:py-12 text-[#9a9590] bg-[#f5f2ee] rounded-xl border-2 border-dashed border-[#f0ece7]">
                              <p>暂无题目，请点击"添加题目"或"生成题目"</p>
                            </div>
                          )}
                          
                          {generatedQuestions.length > 0 && (
                            <div className="relative">
                              <div 
                                className="max-h-[60vh] sm:max-h-[500px] overflow-y-auto overflow-x-hidden pr-1 space-y-4 border-2 border-[#e8e4df] rounded-xl p-2 sm:p-4 bg-[#f5f2ee] scroll-smooth"
                                style={{ 
                                  WebkitOverflowScrolling: 'touch',
                                  scrollBehavior: 'smooth'
                                }}
                              >
                                {generatedQuestions.map((q, qi) => (
                                  <div 
                                    key={`q-${qi}`} 
                                    className="border-2 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                                  >
                                    <div className="bg-gradient-to-r from-[#d4a853] to-[#c49a48] text-white px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
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
                                          className="border rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-white text-[#6b6560]"
                                        >
                                          <option value="choice">选择题</option>
                                          <option value="fill">填空题</option>
                                          <option value="essay">主观题</option>
                                          <option value="programming">编程题</option>
                                        </select>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-white hover:bg-white/20" onClick={() => moveQuestionUp(qi)} disabled={qi === 0}>↑</Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-white hover:bg-white/20" onClick={() => moveQuestionDown(qi)} disabled={qi === generatedQuestions.length - 1}>↓</Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-white hover:bg-red-500/50" onClick={() => removeQuestion(qi)}>×</Button>
                                      </div>
                                    </div>
                                    
                                    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                                      <div>
                                        <div className="flex justify-between items-center mb-1">
                                          <Label className="text-xs sm:text-sm font-medium text-[#6b6560]">题干</Label>
                                          <span className="text-xs text-[#b5b0ab]">{(q.question || '').length}/200字</span>
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
                                            <Label className="text-xs sm:text-sm font-medium text-[#6b6560]">选项</Label>
                                            <Button size="sm" variant="ghost" className="h-6 text-xs text-[#d4a853]" onClick={() => addOption(qi)}>+ 添加选项</Button>
                                          </div>
                                          <div className="space-y-2">
                                            {(Array.isArray(q.options) ? q.options : []).map((opt, oi) => {
                                              const optionLabel = String.fromCharCode(65 + oi)
                                              const isCorrect = typeof q.correctAnswer === 'number' && q.correctAnswer === oi
                                              return (
                                                <div 
                                                  key={`q-${qi}-o-${oi}`} 
                                                  className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-xl border-2 transition-all ${
                                                    isCorrect 
                                                      ? 'border-green-500 bg-green-50' 
                                                      : 'border-[#e8e4df] hover:border-[#f0ece7]'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-2 flex-1">
                                                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${
                                                      isCorrect 
                                                        ? 'bg-green-500 text-white' 
                                                        : 'bg-[#e8e4df] text-[#6b6560]'
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
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-[#b5b0ab] hover:text-red-500" onClick={() => removeOption(qi, oi)}>×</Button>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                            {(!Array.isArray(q.options) || q.options.length === 0) && (
                                              <div className="text-center py-3 sm:py-4 text-[#b5b0ab] bg-[#f5f2ee] rounded-xl text-xs sm:text-sm">
                                                请添加选项
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {q.type === 'programming' && (
                                        <div className="space-y-3 border border-[#e8e4df] rounded-xl p-3 bg-[#f5f2ee]/30">
                                          <div className="text-xs font-semibold text-[#d4a853] mb-2">编程题详细配置</div>
                                          <div>
                                            <Label className="text-xs font-medium text-[#6b6560]">题目描述</Label>
                                            <Textarea
                                              value={q.description || ''}
                                              onChange={(e) => {
                                                setGeneratedQuestions(prev => {
                                                  const copy = [...prev]
                                                  copy[qi] = { ...(copy[qi] || {}), description: e.target.value }
                                                  return copy
                                                })
                                              }}
                                              className="mt-1 min-h-[60px] text-xs sm:text-sm resize-none"
                                              placeholder="详细描述编程题要求..."
                                            />
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                              <Label className="text-xs font-medium text-[#6b6560]">输入格式</Label>
                                              <Input
                                                value={q.input_format || ''}
                                                onChange={(e) => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    copy[qi] = { ...(copy[qi] || {}), input_format: e.target.value }
                                                    return copy
                                                  })
                                                }}
                                                className="mt-1 h-8 text-xs sm:text-sm"
                                                placeholder="输入格式说明"
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-xs font-medium text-[#6b6560]">输出格式</Label>
                                              <Input
                                                value={q.output_format || ''}
                                                onChange={(e) => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    copy[qi] = { ...(copy[qi] || {}), output_format: e.target.value }
                                                    return copy
                                                  })
                                                }}
                                                className="mt-1 h-8 text-xs sm:text-sm"
                                                placeholder="输出格式说明"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <Label className="text-xs font-medium text-[#6b6560]">约束条件</Label>
                                            <Input
                                              value={q.constraints || ''}
                                              onChange={(e) => {
                                                setGeneratedQuestions(prev => {
                                                  const copy = [...prev]
                                                  copy[qi] = { ...(copy[qi] || {}), constraints: e.target.value }
                                                  return copy
                                                })
                                              }}
                                              className="mt-1 h-8 text-xs sm:text-sm"
                                              placeholder="如：1 <= n <= 1000"
                                            />
                                          </div>
                                          <div>
                                            <div className="flex justify-between items-center mb-1">
                                              <Label className="text-xs font-medium text-[#6b6560]">样例 (JSON)</Label>
                                              <Button size="sm" variant="ghost" className="h-5 text-xs text-[#d4a853]" onClick={() => {
                                                setGeneratedQuestions(prev => {
                                                  const copy = [...prev]
                                                  const q = { ...(copy[qi] || {}) }
                                                  q.samples = [...(Array.isArray(q.samples) ? q.samples : []), { input: '', output: '', explanation: '' }]
                                                  copy[qi] = q
                                                  return copy
                                                })
                                              }}>+ 添加样例</Button>
                                            </div>
                                            {(Array.isArray(q.samples) ? q.samples : []).map((s, si) => (
                                              <div key={`sample-${qi}-${si}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2 p-2 bg-white rounded border">
                                                <Input value={s.input || ''} onChange={(e) => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    const q = { ...(copy[qi] || {}) }
                                                    q.samples = [...(q.samples || [])]
                                                    q.samples[si] = { ...q.samples[si], input: e.target.value }
                                                    copy[qi] = q
                                                    return copy
                                                  })
                                                }} placeholder="样例输入" className="h-7 text-xs" />
                                                <Input value={s.output || ''} onChange={(e) => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    const q = { ...(copy[qi] || {}) }
                                                    q.samples = [...(q.samples || [])]
                                                    q.samples[si] = { ...q.samples[si], output: e.target.value }
                                                    copy[qi] = q
                                                    return copy
                                                  })
                                                }} placeholder="样例输出" className="h-7 text-xs" />
                                                <div className="flex gap-1">
                                                  <Input value={s.explanation || ''} onChange={(e) => {
                                                    setGeneratedQuestions(prev => {
                                                      const copy = [...prev]
                                                      const q = { ...(copy[qi] || {}) }
                                                      q.samples = [...(q.samples || [])]
                                                      q.samples[si] = { ...q.samples[si], explanation: e.target.value }
                                                      copy[qi] = q
                                                      return copy
                                                    })
                                                  }} placeholder="样例说明" className="h-7 text-xs flex-1" />
                                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#b5b0ab] hover:text-red-500" onClick={() => {
                                                    setGeneratedQuestions(prev => {
                                                      const copy = [...prev]
                                                      const q = { ...(copy[qi] || {}) }
                                                      q.samples = (q.samples || []).filter((_, i) => i !== si)
                                                      copy[qi] = q
                                                      return copy
                                                    })
                                                  }}>×</Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          <div>
                                            <div className="flex justify-between items-center mb-1">
                                              <Label className="text-xs font-medium text-[#6b6560]">测试用例 (JSON)</Label>
                                              <Button size="sm" variant="ghost" className="h-5 text-xs text-[#d4a853]" onClick={() => {
                                                setGeneratedQuestions(prev => {
                                                  const copy = [...prev]
                                                  const q = { ...(copy[qi] || {}) }
                                                  q.test_cases = [...(Array.isArray(q.test_cases) ? q.test_cases : []), { input: '', output: '' }]
                                                  copy[qi] = q
                                                  return copy
                                                })
                                              }}>+ 添加测试用例</Button>
                                            </div>
                                            {(Array.isArray(q.test_cases) ? q.test_cases : []).map((tc, tci) => (
                                              <div key={`tc-${qi}-${tci}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2 p-2 bg-white rounded border">
                                                <Input value={tc.input || ''} onChange={(e) => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    const q = { ...(copy[qi] || {}) }
                                                    q.test_cases = [...(q.test_cases || [])]
                                                    q.test_cases[tci] = { ...q.test_cases[tci], input: e.target.value }
                                                    copy[qi] = q
                                                    return copy
                                                  })
                                                }} placeholder="测试输入" className="h-7 text-xs" />
                                                <Input value={tc.output || ''} onChange={(e) => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    const q = { ...(copy[qi] || {}) }
                                                    q.test_cases = [...(q.test_cases || [])]
                                                    q.test_cases[tci] = { ...q.test_cases[tci], output: e.target.value }
                                                    copy[qi] = q
                                                    return copy
                                                  })
                                                }} placeholder="期望输出" className="h-7 text-xs" />
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#b5b0ab] hover:text-red-500" onClick={() => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    const q = { ...(copy[qi] || {}) }
                                                    q.test_cases = (q.test_cases || []).filter((_, i) => i !== tci)
                                                    copy[qi] = q
                                                    return copy
                                                  })
                                                }}>×</Button>
                                              </div>
                                            ))}
                                          </div>
                                          <div>
                                            <Label className="text-xs font-medium text-[#6b6560]">参考答案</Label>
                                            <Textarea
                                              value={q.standard_answer || ''}
                                              onChange={(e) => {
                                                setGeneratedQuestions(prev => {
                                                  const copy = [...prev]
                                                  copy[qi] = { ...(copy[qi] || {}), standard_answer: e.target.value }
                                                  return copy
                                                })
                                              }}
                                              className="mt-1 min-h-[80px] text-xs sm:text-sm font-mono resize-none"
                                              placeholder="参考代码答案..."
                                            />
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                              <Label className="text-xs font-medium text-[#6b6560]">编程语言</Label>
                                              <select
                                                value={q.language || 'python'}
                                                onChange={(e) => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    copy[qi] = { ...(copy[qi] || {}), language: e.target.value }
                                                    return copy
                                                  })
                                                }}
                                                className="mt-1 border rounded px-2 py-1 text-xs w-full"
                                              >
                                                <option value="python">Python</option>
                                                <option value="javascript">JavaScript</option>
                                                <option value="java">Java</option>
                                                <option value="cpp">C++</option>
                                                <option value="c">C</option>
                                              </select>
                                            </div>
                                            <div>
                                              <Label className="text-xs font-medium text-[#6b6560]">知识点标签 (逗号分隔)</Label>
                                              <Input
                                                value={Array.isArray(q.knowledge_tags) ? q.knowledge_tags.join(', ') : ''}
                                                onChange={(e) => {
                                                  setGeneratedQuestions(prev => {
                                                    const copy = [...prev]
                                                    copy[qi] = { ...(copy[qi] || {}), knowledge_tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }
                                                    return copy
                                                  })
                                                }}
                                                className="mt-1 h-8 text-xs sm:text-sm"
                                                placeholder="如：数组, 排序, 动态规划"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      <div>
                                        <div className="flex justify-between items-center mb-1">
                                          <Label className="text-xs sm:text-sm font-medium text-[#6b6560]">解析</Label>
                                          <span className="text-xs text-[#b5b0ab]">{(q.explanation || '').length}/200字</span>
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
            </div>

            {(programmingSubmissionsLoading || programmingSubmissions.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>编程题评分详情</CardTitle>
                </CardHeader>
                <CardContent>
                  {programmingSubmissionsLoading ? (
                    <div className="py-6 text-sm text-[#9a9590]">正在加载...</div>
                  ) : (
                    <div className="space-y-3">
                      {programmingSubmissions.map((item) => (
                        <div key={item.id} className="border rounded-xl p-4 bg-white">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                            <div>
                              <div className="font-semibold">{item.assessment_title} · 第 {item.question_index + 1} 题</div>
                              <div className="text-sm text-[#9a9590]">{item.user_name || `学生${item.user_id}`} · {item.language} · {item.created_at}</div>
                            </div>
                            <Badge className={item.score >= 90 ? 'bg-green-100 text-green-700' : item.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                              {item.score}/{item.max_score}
                            </Badge>
                          </div>
                          <div className="grid md:grid-cols-5 gap-2 text-xs">
                            <div className="bg-[#f5f2ee] rounded p-2">编译 {item.compile_result?.score ?? '-'}</div>
                            <div className="bg-[#f5f2ee] rounded p-2">运行 {item.runtime_result?.score ?? '-'}</div>
                            <div className="bg-[#f5f2ee] rounded p-2">IO {item.io_match_result?.score ?? '-'}</div>
                            <div className="bg-[#f5f2ee] rounded p-2">逻辑 {item.logic_result?.score ?? '-'}</div>
                            <div className="bg-[#f5f2ee] rounded p-2">效率 {item.efficiency_result?.score ?? '-'}</div>
                          </div>
                          <pre className="mt-3 bg-slate-950 text-slate-100 rounded p-3 overflow-auto text-xs max-h-48">{item.code}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
              <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>{statsAssessmentTitle || '考核统计'}</DialogTitle>
                </DialogHeader>
                {statsLoading ? (
                  <div className="py-6 text-sm text-[#6b6560]">加载统计中...</div>
                ) : assessmentStats?.error ? (
                  <div className="py-6 text-sm text-red-600">统计加载失败，请稍后重试。</div>
                ) : assessmentStats ? (
                  <div className="space-y-4 overflow-y-auto flex-1 pr-2 -mr-2" style={{ minHeight: '200px', maxHeight: 'calc(85vh - 120px)' }}>
                    <div className="bg-[#d4a85312] rounded-xl p-4 flex items-center justify-between flex-shrink-0">
                      <div>
                        <span className="text-sm text-[#6b6560]">总提交数</span>
                        <p className="text-2xl font-bold text-[#d4a853]">{assessmentStats.total_submissions || 0}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-[#6b6560]">整体正确率</span>
                        <p className="text-2xl font-bold text-[#5a9e6f]">{assessmentStats.overall_correct_rate || 0}%</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(assessmentStats.questions || []).map((q) => (
                        <div key={`stat-q-${q.index}`} className="border-2 rounded-xl overflow-hidden flex-shrink-0">
                          <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-[#d4a853] text-white flex items-center justify-center font-bold text-sm">
                                {q.index + 1}
                              </div>
                              <span className="font-medium text-[#2d2a26] line-clamp-1">{q.question}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={`${(q.correctRate || 0) >= 70 ? 'bg-green-100 text-green-700' : (q.correctRate || 0) >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                正确率 {q.correctRate || 0}%
                              </Badge>
                            </div>
                          </div>
                          <div className="px-4 py-3 bg-white">
                            <div className="text-xs text-[#9a9590] mb-2">
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
                                      <span className="w-5 h-5 rounded-full bg-[#e8e4df] flex items-center justify-center text-xs font-bold flex-shrink-0">{label}</span>
                                      <div className="flex-1 h-4 bg-[#f5f2ee] rounded-full overflow-hidden min-w-[100px]">
                                        <div 
                                          className="h-full bg-[#d4a85312]0 rounded-full transition-all" 
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-[#6b6560] w-16 text-right flex-shrink-0">{c}人 ({percent}%)</span>
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
                  <div className="py-6 text-sm text-[#6b6560]">暂无统计数据。</div>
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

      case 'token-usage':
        const s = tokenSummary || {}
        const byType = s.by_type || {}
        const typeEntries = Object.entries(byType).sort((a, b) => b[1].tokens - a[1].tokens)
        const typeLabels = {
          teaching_content: '教学内容生成', assessment: '考核题目生成', ai_tutor_chat: 'AI辅导对话',
          analyze_mistake: '错题分析', analyze_mistake_stream: '错题流式分析', summarize_note: '笔记摘要',
          organize_notes: '笔记整理', chat: '通用对话', chat_stream: '流式对话',
          generate_practice: '练习生成', generate_study_plan: '学习计划', other: '其他'
        }
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Token 用量监控</h2>
                <p className="text-[#6b6560]">实时监测您的AI调用Token消耗情况</p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={String(tokenDays)} onValueChange={v => setTokenDays(Number(v))}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">近7天</SelectItem>
                    <SelectItem value="30">近30天</SelectItem>
                    <SelectItem value="90">近90天</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tokenPeriod} onValueChange={setTokenPeriod}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">按天</SelectItem>
                    <SelectItem value="weekly">按周</SelectItem>
                    <SelectItem value="monthly">按月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tokenLoading && !tokenSummary ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4a853] mr-3" />
                <span className="text-[#6b6560]">加载Token数据...</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Zap className="h-8 w-8 text-[#d4a853]" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-[#6b6560]">总消耗Token</p>
                          <p className="text-2xl font-bold text-[#2d2a26]">{(s.total_tokens || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Activity className="h-8 w-8 text-[#5a9e6f]" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-[#6b6560]">调用次数</p>
                          <p className="text-2xl font-bold text-[#2d2a26]">{s.call_count || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-[#8b6fb0]" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-[#6b6560]">次均消耗</p>
                          <p className="text-2xl font-bold text-[#2d2a26]">{s.avg_per_call || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <FileText className="h-8 w-8 text-[#c47a3a]" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-[#6b6560]">输入/输出比</p>
                          <p className="text-2xl font-bold text-[#2d2a26]">
                            {s.completion_tokens ? ((s.prompt_tokens || 0) / s.completion_tokens).toFixed(1) : '-'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>Token消耗趋势</CardTitle></CardHeader>
                    <CardContent>
                      {tokenTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={tokenTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="tokens" stroke="#d4a853" fill="#d4a85320" name="Token数" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-[#b5b0ab]">暂无趋势数据</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>按类型分布</CardTitle></CardHeader>
                    <CardContent>
                      {typeEntries.length > 0 ? (
                        <div className="space-y-3">
                          {typeEntries.slice(0, 8).map(([type, data]) => (
                            <div key={type} className="flex items-center justify-between">
                              <span className="text-sm text-[#6b6560] truncate mr-2">{typeLabels[type] || type}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-semibold text-[#2d2a26]">{data.tokens.toLocaleString()}</span>
                                <span className="text-xs text-[#9a9590]">({data.calls}次)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-[#b5b0ab]">暂无数据</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle>最近调用记录</CardTitle></CardHeader>
                  <CardContent>
                    {tokenRecent.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-[#6b6560]">
                              <th className="text-left py-2 px-3">时间</th>
                              <th className="text-left py-2 px-3">类型</th>
                              <th className="text-right py-2 px-3">Token</th>
                              <th className="text-right py-2 px-3">输入</th>
                              <th className="text-right py-2 px-3">输出</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tokenRecent.map((r, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-2 px-3 text-[#6b6560] whitespace-nowrap">
                                  {r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '-'}
                                </td>
                                <td className="py-2 px-3">
                                  <Badge variant="outline" className="text-[10px]">
                                    {typeLabels[r.call_type] || r.call_type || 'other'}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3 text-right font-medium">{(r.total_tokens || 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right text-[#6b6560]">{(r.prompt_tokens || 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right text-[#6b6560]">{(r.completion_tokens || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-12 text-[#b5b0ab]">暂无调用记录</div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )

      case 'analytics':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>学情分析</h2>
              <p className="text-[#6b6560]">学生学习情况和趋势分析</p>
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
                    <div className="flex items-center justify-center h-[300px] text-[#b5b0ab]">
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
                    <div className="flex items-center justify-center h-[300px] text-[#b5b0ab]">
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
                  <div className="flex items-center justify-center h-[300px] text-[#b5b0ab]">
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
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>教师概览</h2>
              <p className="text-[#6b6560]">欢迎回来，教师！</p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-[#d4a853]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">我的课程</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.myCourses}</p>
                      <p className="text-xs text-[#9a9590]">您创建的课程</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-[#5a9e6f]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">学生总数</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.totalStudents}</p>
                      <p className="text-xs text-[#9a9590]">所有课程的学生</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Award className="h-8 w-8 text-[#8b6fb0]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">已完成考核</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.completedExams}</p>
                      <p className="text-xs text-[#9a9590]">学生完成的考核</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Sparkles className="h-8 w-8 text-[#c47a3a]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">AI生成内容</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.aiGeneratedContent}</p>
                      <p className="text-xs text-[#9a9590]">已生成教学内容</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 快速操作 */}
            <div>
              <h3 className="text-lg font-semibold text-[#2d2a26] mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>快速操作</h3>
              <p className="text-[#6b6560] mb-6">常用教学功能快速入口</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('courses')}>
                  <CardContent className="p-6 text-center">
                    <BookOpen className="h-12 w-12 text-[#d4a853] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>课程管理</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('content')}>
                  <CardContent className="p-6 text-center">
                    <Sparkles className="h-12 w-12 text-[#c47a3a] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>AI内容生成</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('exams')}>
                  <CardContent className="p-6 text-center">
                    <Target className="h-12 w-12 text-[#5a9e6f] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>考核管理</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('analytics')}>
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-12 w-12 text-[#8b6fb0] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>学情分析</h4>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 最近活动和系统警告 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>最近活动</CardTitle>
                  <p className="text-sm text-[#6b6560]">您的教学活动记录</p>
                </CardHeader>
                <CardContent>
                  {recentActivities.length > 0 ? (
                    <div className="space-y-4">
                      {recentActivities.map((activity, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          {activity.icon === 'check' ? <CheckCircle className="h-5 w-5 text-[#5a9e6f]" /> :
                           activity.icon === 'activity' ? <Activity className="h-5 w-5 text-[#d4a853]" /> :
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
                        <CheckCircle className="h-16 w-16 text-[#c5c0bb] mx-auto mb-4" />
                        <p className="text-sm text-[#9a9590]">暂无活动记录</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>学生反馈</CardTitle>
                  <p className="text-sm text-[#6b6560]">学生对您的课程和教学的反馈</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <CheckCircle className="h-16 w-16 text-[#5a9e6f] mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-[#5a9e6f]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>暂无新反馈</h4>
                      <p className="text-sm text-[#9a9590]">所有反馈已处理</p>
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
    <div className="min-h-screen bg-[#faf8f5]">
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm border-b border-[#e8e4df]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#d4a853] rounded-xl flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="white" stroke="white" strokeWidth="0.5"/>
                    <path d="M6 6V18C6 18 8 16 12 16C16 16 18 18 18 18V6C18 6 16 8 12 8C8 8 6 6 6 6Z" fill="rgba(255,255,255,0.4)" stroke="white" strokeWidth="0.8"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>智教星</h1>
                  <p className="text-xs text-[#9a9590]">自适应错题诊疗系统</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-[#5a9e6f] border-[#5a9e6f]">
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
          <div className="w-64 mr-8">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-[10px] text-left transition-colors ${
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

          {/* 主内容区 */}
          <div className="flex-1">
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </div>
      </div>

      <Dialog open={courseDetailOpen} onOpenChange={setCourseDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#d4a853]" />
              课程详情
            </DialogTitle>
          </DialogHeader>
          {courseDetail ? (
            <div className="space-y-5 overflow-y-auto flex-1 pr-1" style={{ maxHeight: 'calc(85vh - 80px)' }}>
              <div className="bg-gradient-to-r from-[#d4a85312] to-[#d4a85308] rounded-xl p-4">
                <h3 className="text-xl font-bold text-[#2d2a26] mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{courseDetail.title}</h3>
                {courseDetail.description && (
                  <p className="text-sm text-[#6b6560]">{courseDetail.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#d4a85312] rounded-xl p-3 text-center">
                  <Users className="h-5 w-5 text-[#d4a853] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#2d2a26]">{courseDetail.students}</p>
                  <p className="text-xs text-[#9a9590]">学生数</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <Video className="h-5 w-5 text-[#5a9e6f] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#2d2a26]">{courseDetail.videoCount ?? '-'}</p>
                  <p className="text-xs text-[#9a9590]">视频数</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <FileText className="h-5 w-5 text-[#8b6fb0] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#2d2a26]">{courseDetail.contentCount ?? '-'}</p>
                  <p className="text-xs text-[#9a9590]">讲义数</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <Target className="h-5 w-5 text-[#c47a3a] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#2d2a26]">{courseDetail.assessmentCount ?? '-'}</p>
                  <p className="text-xs text-[#9a9590]">考核数</p>
                </div>
              </div>

              {courseDetailLoading && (
                <div className="text-center py-4 text-sm text-[#9a9590]">加载详细数据中...</div>
              )}

              {!courseDetailLoading && (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[#9a9590]">分类：</span>
                      <span className="font-medium">{courseDetail.category || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#9a9590]">难度：</span>
                      <span className="font-medium">{courseDetail.difficulty || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#9a9590]">时长：</span>
                      <span className="font-medium">{courseDetail.duration || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#9a9590]">状态：</span>
                      <Badge className={courseDetail.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-[#f5f2ee] text-[#2d2a26]'}>
                        {courseDetail.status === 'active' ? '活跃' : '停用'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-[#9a9590]">创建时间：</span>
                      <span className="font-medium">{courseDetail.created_at || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#9a9590]">教师：</span>
                      <span className="font-medium">{courseDetail.teacher_name || '-'}</span>
                    </div>
                  </div>

                  {courseDetail.videoList && courseDetail.videoList.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#2d2a26] mb-2 flex items-center gap-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <Video className="h-4 w-4" /> 视频列表
                      </h4>
                      <div className="space-y-1">
                        {courseDetail.videoList.map((v, i) => (
                          <div key={v.id} className="group flex items-center justify-between bg-[#f5f2ee] rounded px-3 py-2 text-sm">
                            <span className="flex-1 truncate">{i + 1}. {v.title}</span>
                            <div className="flex items-center gap-2">
                              {v.duration && <span className="text-[#b5b0ab]">{Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, '0')}</span>}
                              <button
                                type="button"
                                aria-label={`删除视频 ${v.title}`}
                                onClick={() => handleDeleteVideoItem(v.id, v.title)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {courseDetail.assessments && courseDetail.assessments.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#2d2a26] mb-2 flex items-center gap-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <Target className="h-4 w-4" /> 考核列表
                        {courseDetail.assessments.some(a => a.generated_by_llm) && (
                          <Badge className="bg-[#d4a853] text-white text-[10px] px-1.5 py-0 ml-1">含AI生成</Badge>
                        )}
                      </h4>
                      <div className="space-y-1">
                        {courseDetail.assessments.map((a, i) => (
                          <div key={a.id} className={`group flex items-center justify-between rounded px-3 py-2 text-sm ${a.generated_by_llm ? 'bg-[#d4a8530a] border-l-2 border-[#d4a853]' : 'bg-[#f5f2ee]'}`}>
                            <span className="flex-1 truncate flex items-center gap-2">
                              {a.generated_by_llm && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-[#d4a853] px-1.5 py-0.5 rounded shrink-0">AI生成</span>
                              )}
                              {i + 1}. {a.title}
                            </span>
                            <div className="flex items-center gap-2">
                              {a.is_recommended && <Badge className="bg-yellow-100 text-yellow-700 text-xs">推荐</Badge>}
                              {!a.generated_by_llm && <Badge className="bg-[#f5f2ee] text-[#6b6560] text-xs">手动</Badge>}
                              <button
                                type="button"
                                aria-label={`删除考核 ${a.title}`}
                                onClick={() => handleDeleteAssessmentItem(a.id, a.title)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {courseDetail.contents && courseDetail.contents.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#2d2a26] mb-2 flex items-center gap-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        <FileText className="h-4 w-4" /> 讲义列表
                        {courseDetail.contents.some(c => c.generated_by_llm) && (
                          <Badge className="bg-[#d4a853] text-white text-[10px] px-1.5 py-0 ml-1">含AI生成</Badge>
                        )}
                      </h4>
                      <div className="space-y-1">
                        {courseDetail.contents.map((c, i) => (
                          <div key={c.id} className={`group flex items-center justify-between rounded px-3 py-2 text-sm ${c.generated_by_llm ? 'bg-[#d4a8530a] border-l-2 border-[#d4a853]' : 'bg-[#f5f2ee]'}`}>
                            <span className="flex-1 truncate flex items-center gap-2">
                              {c.generated_by_llm && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-[#d4a853] px-1.5 py-0.5 rounded shrink-0">AI生成</span>
                              )}
                              {i + 1}. {c.title}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label={`删除讲义 ${c.title}`}
                                onClick={() => handleDeleteContentItem(c.id, c.title)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="py-6 text-sm text-[#9a9590]">暂无课程数据</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
