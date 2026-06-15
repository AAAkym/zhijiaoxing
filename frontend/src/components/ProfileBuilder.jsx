import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  User, MessageCircle, Radar, ChevronRight, Loader2,
  CheckCircle, BookOpen, Brain, Target, Clock, Sparkles,
  TrendingUp, BarChart3, PieChart, Activity, Award, Map,
  RefreshCw, Calendar, Video, MessageSquare, PenTool
} from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, AreaChart, Area,
} from 'recharts'
import { profileApi } from '@/services/api'

const DIMENSION_LABELS = {
  knowledge_base: '知识基础',
  cognitive_style: '认知风格',
  error_patterns: '易错模式',
  learning_pace: '学习节奏',
  interest_areas: '兴趣领域',
  goal_orientation: '目标导向',
  time_availability: '时间可用性',
  interaction_preference: '互动偏好',
}

const DIMENSION_COLORS = {
  knowledge_base: '#3B82F6',
  cognitive_style: '#8B5CF6',
  error_patterns: '#EF4444',
  learning_pace: '#F59E0B',
  interest_areas: '#10B981',
  goal_orientation: '#EC4899',
  time_availability: '#14B8A6',
  interaction_preference: '#F97316',
}

const STYLE_LABELS = {
  visual: '视觉型', auditory: '听觉型', kinesthetic: '动觉型',
  reading: '阅读型', mixed: '混合型',
}
const PACE_LABELS = {
  fast: '快速型', moderate: '适中型', slow: '深度型', adaptive: '灵活型',
}
const GOAL_LABELS = {
  exam: '应试导向', career: '职业发展', hobby: '兴趣驱动', research: '学术研究',
}
const INTERACTION_LABELS = {
  guided: '引导式', exploratory: '探索式', challenging: '挑战式',
}

const ERROR_TYPE_LABELS = {
  calculation_error: '计算失误',
  concept_understanding: '概念理解偏差',
  question_misread: '审题不清',
  programming_error: '编程错误',
  careless: '粗心失误',
  other: '其他',
}

const ACHIEVEMENT_CATEGORY_LABELS = {
  knowledge: '知识',
  learning_time: '学习时长',
  practice: '练习',
  accuracy: '准确率',
  mistake: '错题',
}

const DIFFICULTY_LABELS = {
  beginner: '入门',
  basic: '入门',
  intermediate: '中级',
  advanced: '高级',
}

const COURSE_CATEGORY_LABELS = {
  programming: '编程',
  math: '数学',
  science: '科学',
  language: '语言',
  art: '艺术',
  other: '其他',
}

const MASTERY_STATUS_LABELS = {
  unmastered: '未掌握',
  learning: '学习中',
  mastered: '已掌握',
  reviewing: '复习中',
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </p>
      ))}
    </div>
  )
}

export default function ProfileBuilder() {
  const [profile, setProfile] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [dialogSession, setDialogSession] = useState(null)
  const [dialogState, setDialogState] = useState(null)
  const [messages, setMessages] = useState([])
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [view, setView] = useState('dashboard')
  const [timeRange, setTimeRange] = useState('30')
  const [activeTab, setActiveTab] = useState('overview')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  const fetchProfile = useCallback(async () => {
    try {
      const result = await profileApi.getProfile()
      setProfile(result.profile)
    } catch (err) {
      console.error('Fetch profile error:', err)
    }
  }, [])

  const fetchDashboard = useCallback(async (range) => {
    setDashboardLoading(true)
    try {
      const result = await profileApi.getDashboard(range || timeRange)
      setDashboardData(result)
      if (result.profile) setProfile(result.profile)
    } catch (err) {
      console.error('Fetch dashboard error:', err)
    } finally {
      setDashboardLoading(false)
    }
  }, [timeRange])

  useEffect(() => { fetchProfile() }, [fetchProfile])
  useEffect(() => { fetchDashboard() }, [])

  const handleTimeRangeChange = (range) => {
    setTimeRange(range)
    fetchDashboard(range)
  }

  const handleSyncProfile = async () => {
    setLoading(true)
    try {
      await profileApi.syncProfile('all')
      await fetchDashboard(timeRange)
    } catch (err) {
      console.error('Sync profile error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartDialog = async () => {
    setLoading(true)
    try {
      const result = await profileApi.startDialog()
      setDialogSession(result.session)
      setDialogState(result.dialog)
      setMessages([
        { role: 'assistant', content: result.dialog.greeting },
        { role: 'assistant', content: result.dialog.question },
      ])
      setView('dialog')
    } catch (err) {
      console.error('Start dialog error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!userInput.trim() || !dialogSession) return
    const answer = userInput.trim()
    setUserInput('')
    setMessages(prev => [...prev, { role: 'user', content: answer }])
    setLoading(true)

    try {
      const result = await profileApi.continueDialog({
        session_id: dialogSession.id,
        answer,
      })
      setDialogSession(result.session)
      setDialogState(result.dialog)

      if (result.dialog.type === 'dialog_continue') {
        const feedback = result.dialog.feedback || ''
        const question = result.dialog.question
        const newMsgs = []
        if (feedback) newMsgs.push({ role: 'assistant', content: feedback })
        newMsgs.push({ role: 'assistant', content: question })
        setMessages(prev => [...prev, ...newMsgs])
      } else if (result.dialog.type === 'dialog_complete') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.dialog.message,
        }])
        await fetchProfile()
      }
    } catch (err) {
      console.error('Continue dialog error:', err)
      setMessages(prev => [...prev, {
        role: 'assistant', content: '抱歉，处理出现了问题，请重试。'
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // ====== 画像维度雷达图 ======
  const renderRadarChart = () => {
    if (!dashboardData?.dimension_scores) return null
    const radarData = Object.entries(dashboardData.dimension_scores).map(([key, value]) => ({
      dimension: DIMENSION_LABELS[key] || key,
      score: value,
      fullMark: 100,
    }))

    return (
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#6B7280' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <RechartsRadar
            name="维度评分"
            dataKey="score"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  // ====== 概览统计卡片 ======
  const renderOverviewStats = () => {
    const outcomes = dashboardData?.learning_outcomes || {}
    const interaction = dashboardData?.interaction_frequency || {}
    const timeDist = dashboardData?.time_distribution || {}

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-blue-200" />
              <span className="text-blue-100 text-xs">在学课程</span>
            </div>
            <p className="text-2xl font-bold">{outcomes.total_courses || 0}</p>
            <p className="text-blue-200 text-xs mt-1">已完成 {outcomes.completed_courses || 0} 门</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-200" />
              <span className="text-green-100 text-xs">平均成绩</span>
            </div>
            <p className="text-2xl font-bold">{outcomes.avg_score || 0}</p>
            <p className="text-green-200 text-xs mt-1">最高 {outcomes.max_score || 0} 分</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-200" />
              <span className="text-purple-100 text-xs">累计学习</span>
            </div>
            <p className="text-2xl font-bold">{timeDist.total_estimated_hours?.toFixed(1) || 0}h</p>
            <p className="text-purple-200 text-xs mt-1">近{timeRange}天</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-orange-200" />
              <span className="text-orange-100 text-xs">获得成就</span>
            </div>
            <p className="text-2xl font-bold">{outcomes.total_achievements || 0}</p>
            <p className="text-orange-200 text-xs mt-1">练习 {outcomes.total_practices || 0} 次</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== 画像维度详情卡片 ======
  const renderDimensionCards = () => {
    if (!profile) return null
    const dims = [
      {
        key: 'knowledge_base', label: '知识基础', icon: BookOpen, color: DIMENSION_COLORS.knowledge_base,
        value: profile.knowledge_base && Object.keys(profile.knowledge_base).length > 0
          ? Object.entries(profile.knowledge_base).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}:${v}`).join(', ') || '已设置'
          : '未设置',
        filled: profile.knowledge_base && Object.keys(profile.knowledge_base).length > 0,
      },
      {
        key: 'cognitive_style', label: '认知风格', icon: Brain, color: DIMENSION_COLORS.cognitive_style,
        value: STYLE_LABELS[profile.cognitive_style] || profile.cognitive_style || '未设置',
        filled: profile.cognitive_style && profile.cognitive_style !== 'mixed',
      },
      {
        key: 'error_patterns', label: '易错模式', icon: Target, color: DIMENSION_COLORS.error_patterns,
        value: profile.error_patterns && profile.error_patterns.length > 0
          ? profile.error_patterns.map(e => ERROR_TYPE_LABELS[e.error_type] || e.error_type).join(', ')
          : '未设置',
        filled: profile.error_patterns && profile.error_patterns.length > 0,
      },
      {
        key: 'learning_pace', label: '学习节奏', icon: Clock, color: DIMENSION_COLORS.learning_pace,
        value: PACE_LABELS[profile.learning_pace] || profile.learning_pace || '未设置',
        filled: profile.learning_pace && profile.learning_pace !== 'moderate',
      },
      {
        key: 'interest_areas', label: '兴趣领域', icon: Sparkles, color: DIMENSION_COLORS.interest_areas,
        value: profile.interest_areas && profile.interest_areas.length > 0
          ? profile.interest_areas.map(a => a.area).join(', ')
          : '未设置',
        filled: profile.interest_areas && profile.interest_areas.length > 0,
      },
      {
        key: 'goal_orientation', label: '目标导向', icon: Target, color: DIMENSION_COLORS.goal_orientation,
        value: GOAL_LABELS[profile.goal_orientation] || profile.goal_orientation || '未设置',
        filled: profile.goal_orientation && profile.goal_orientation !== 'exam',
      },
      {
        key: 'time_availability', label: '时间可用性', icon: Calendar, color: DIMENSION_COLORS.time_availability,
        value: profile.time_availability && Object.keys(profile.time_availability).length > 0
          ? Object.entries(profile.time_availability).map(([k, v]) => `${k}:${v}`).join(', ')
          : '未设置',
        filled: profile.time_availability && Object.keys(profile.time_availability).length > 0,
      },
      {
        key: 'interaction_preference', label: '互动偏好', icon: MessageCircle, color: DIMENSION_COLORS.interaction_preference,
        value: INTERACTION_LABELS[profile.interaction_preference] || profile.interaction_preference || '未设置',
        filled: profile.interaction_preference && profile.interaction_preference !== 'guided',
      },
    ]

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {dims.map(dim => {
          const Icon = dim.icon
          const score = dashboardData?.dimension_scores?.[dim.key] || 0
          return (
            <Card key={dim.key} className={`border-l-4 transition-shadow hover:shadow-md ${dim.filled ? 'border-l-green-400' : 'border-l-gray-300'}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" style={{ color: dim.color }} />
                  <span className="text-xs font-medium text-gray-600">{dim.label}</span>
                  {dim.filled && <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />}
                </div>
                <p className="text-sm font-medium truncate" title={dim.value}>{dim.value}</p>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>完成度</span>
                    <span>{score}%</span>
                  </div>
                  <Progress value={score} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  // ====== 学习内容偏好 ======
  const renderContentPreferences = () => {
    const prefs = dashboardData?.content_preferences || {}
    const categoryData = (prefs.category_distribution || []).map(c => ({
      ...c,
      name: COURSE_CATEGORY_LABELS[c.name] || c.name,
    }))
    const courses = (prefs.courses || []).map(c => ({
      ...c,
      category: COURSE_CATEGORY_LABELS[c.category] || c.category,
      difficulty: DIFFICULTY_LABELS[c.difficulty] || c.difficulty,
    }))

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-500" />课程类别分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <RechartsPie>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#9CA3AF' }}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">暂无课程数据</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-500" />课程进度一览
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courses.length > 0 ? (
              <div className="space-y-3 max-h-[260px] overflow-y-auto">
                {courses.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={c.progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-gray-500 w-10 text-right">{c.progress}%</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{c.difficulty}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">暂无课程数据</div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== 学习时长分布 ======
  const renderTimeDistribution = () => {
    const timeDist = dashboardData?.time_distribution || {}
    const dailyTrend = timeDist.daily_trend || []
    const hourlyData = timeDist.hourly_distribution || []

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />学习时长趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    name="学习时长"
                    stroke={CHART_COLORS.primary}
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">暂无学习时长数据</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />活跃时段分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyData.some(h => h.count > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={h => `${h}:00`} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="活跃次数" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">暂无活跃时段数据</div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== 知识点掌握程度 ======
  const renderKnowledgeMastery = () => {
    const mastery = dashboardData?.knowledge_mastery || {}
    const byCourse = mastery.by_course || []
    const errorTypes = (mastery.error_type_distribution || []).map(e => ({
      ...e,
      type: ERROR_TYPE_LABELS[e.type] || e.type,
    }))
    const weakPoints = mastery.weak_points || []

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />各课程成绩对比
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byCourse.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byCourse} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="course" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avg_score" name="平均分" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="max_score" name="最高分" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">暂无成绩数据</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-red-500" />错题类型分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errorTypes.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={180}>
                  <RechartsPie>
                    <Pie
                      data={errorTypes}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#9CA3AF' }}
                    >
                      {errorTypes.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
                {weakPoints.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">薄弱知识点</p>
                    <div className="flex flex-wrap gap-1.5">
                      {weakPoints.map(([point, count], i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {point} <span className="text-red-400 ml-1">x{count}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">暂无错题数据</div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== 学习路径轨迹 ======
  const renderLearningTrajectory = () => {
    const trajectory = dashboardData?.learning_trajectory || {}
    const paths = trajectory.paths || []
    const timeline = trajectory.progress_timeline || []

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Map className="w-4 h-4 text-blue-500" />学习路径进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paths.length > 0 ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {paths.map((path, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium truncate">{path.title}</p>
                      <Badge variant={path.status === 'active' ? 'default' : 'outline'} className="text-xs">
                        {path.status === 'active' ? '进行中' : path.status === 'completed' ? '已完成' : path.status}
                      </Badge>
                    </div>
                    {path.course && <p className="text-xs text-gray-500 mb-2">{path.course}</p>}
                    <div className="flex items-center gap-2">
                      <Progress value={path.progress} className="h-2 flex-1" />
                      <span className="text-xs text-gray-500 w-10 text-right">{path.progress}%</span>
                    </div>
                    {path.nodes && path.nodes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {path.nodes.slice(0, 8).map((node, j) => (
                          <div
                            key={j}
                            className={`w-6 h-6 rounded text-[10px] flex items-center justify-center font-medium ${
                              node.status === 'completed' ? 'bg-green-100 text-green-700' :
                              node.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              node.status === 'available' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-400'
                            }`}
                            title={node.title}
                          >
                            {j + 1}
                          </div>
                        ))}
                        {path.nodes.length > 8 && (
                          <span className="text-xs text-gray-400 self-center">+{path.nodes.length - 8}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">暂无学习路径数据</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />课程进度排行
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeline.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="course" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="progress" name="进度" radius={[0, 4, 4, 0]}>
                    {timeline.slice(0, 8).map((entry, i) => (
                      <Cell key={i} fill={entry.progress >= 80 ? CHART_COLORS.secondary : entry.progress >= 50 ? CHART_COLORS.accent : CHART_COLORS.danger} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">暂无课程进度数据</div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== 互动参与频率 ======
  const renderInteractionFrequency = () => {
    const interaction = dashboardData?.interaction_frequency || {}
    const weeklyData = interaction.weekly_interaction || []

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />互动频率趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.some(d => d.total > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="practices" name="练习" stackId="1" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.4} />
                  <Area type="monotone" dataKey="questions" name="提问" stackId="1" stroke={CHART_COLORS.accent} fill={CHART_COLORS.accent} fillOpacity={0.4} />
                  <Area type="monotone" dataKey="discussions" name="讨论" stackId="1" stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">暂无互动数据</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-500" />互动统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <MessageSquare className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-blue-700">{interaction.total_questions || 0}</p>
                <p className="text-xs text-blue-500">提问次数</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <Video className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-green-700">{interaction.completed_videos || 0}/{interaction.total_videos || 0}</p>
                <p className="text-xs text-green-500">视频完成</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <PenTool className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-purple-700">{interaction.study_notes_count || 0}</p>
                <p className="text-xs text-purple-500">学习笔记</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <Activity className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-orange-700">{interaction.video_completion_rate || 0}%</p>
                <p className="text-xs text-orange-500">视频完成率</p>
              </div>
            </div>
            {interaction.total_watch_minutes > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">累计观看时长</span>
                  <span className="text-sm font-medium">{interaction.total_watch_minutes} 分钟</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== 学习成果评估 ======
  const renderLearningOutcomes = () => {
    const outcomes = dashboardData?.learning_outcomes || {}
    const scoreDist = outcomes.score_distribution || []
    const masteryLevels = outcomes.mastery_levels || {}
    const achCategories = outcomes.achievement_categories || {}

    const masteryData = Object.entries(masteryLevels).map(([level, count]) => ({ level, count }))
    const achData = Object.entries(achCategories).map(([cat, count]) => ({
      category: ACHIEVEMENT_CATEGORY_LABELS[cat] || cat,
      count,
    }))

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />成绩分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreDist.some(s => s.count > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={scoreDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="次数" radius={[4, 4, 0, 0]}>
                    {scoreDist.map((entry, i) => (
                      <Cell key={i} fill={
                        entry.range === '80-100' ? CHART_COLORS.secondary :
                        entry.range === '60-80' ? CHART_COLORS.primary :
                        entry.range === '40-60' ? CHART_COLORS.accent :
                        CHART_COLORS.danger
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">暂无成绩数据</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />掌握程度与成就
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {masteryData.length > 0 && masteryData.some(m => m.count > 0) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">课程掌握程度</p>
                  <div className="flex gap-3">
                    {masteryData.map((m, i) => (
                      <div key={i} className="text-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          m.level === '精通' ? 'bg-green-500' :
                          m.level === '熟练' ? 'bg-blue-500' :
                          m.level === '了解' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}>
                          {m.count}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{m.level}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {achData.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">成就分类</p>
                  <div className="flex flex-wrap gap-2">
                    {achData.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {a.category} ({a.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t pt-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">{outcomes.total_practices || 0}</p>
                    <p className="text-xs text-gray-500">总练习次数</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{outcomes.completed_courses || 0}/{outcomes.total_courses || 0}</p>
                    <p className="text-xs text-gray-500">课程完成</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ====== 分数趋势折线图 ======
  const renderScoreTrend = () => {
    const mastery = dashboardData?.knowledge_mastery || {}
    const trend = mastery.score_trend || []

    if (trend.length === 0) return null

    const chartData = trend.map(t => ({
      ...t,
      date: t.date?.slice(0, 10) || '',
    }))

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />成绩趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="score" name="分数" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  // ====== Dashboard 主视图 ======
  const renderDashboard = () => {
    if (dashboardLoading && !dashboardData) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">加载看板数据...</span>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">时间范围:</span>
            {['7', '30', '90'].map(range => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeRangeChange(range)}
                className="text-xs"
              >
                近{range}天
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncProfile}
            disabled={loading}
            className="text-xs"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            同步数据
          </Button>
        </div>

        {/* 画像完整度 */}
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">画像完整度</p>
                <p className="text-3xl font-bold text-blue-900">{Math.round((profile?.confidence_score || 0) * 100)}%</p>
              </div>
              <div className="flex-1 mx-6">
                <Progress value={(profile?.confidence_score || 0) * 100} className="h-3" />
                <p className="text-xs text-blue-500 mt-1">
                  已填充 {profile ? Math.round((profile.confidence_score || 0) * 8) : 0}/8 个维度
                </p>
              </div>
              <Button size="sm" onClick={handleStartDialog} disabled={loading}>
                <MessageCircle className="w-4 h-4 mr-1" />完善画像
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 概览统计 */}
        {renderOverviewStats()}

        {/* 多维度 Tab 切换 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
            <TabsTrigger value="overview" className="text-xs">画像总览</TabsTrigger>
            <TabsTrigger value="content" className="text-xs">内容偏好</TabsTrigger>
            <TabsTrigger value="time" className="text-xs">时长分布</TabsTrigger>
            <TabsTrigger value="mastery" className="text-xs">知识掌握</TabsTrigger>
            <TabsTrigger value="trajectory" className="text-xs">学习轨迹</TabsTrigger>
            <TabsTrigger value="outcomes" className="text-xs">学习成果</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Radar className="w-4 h-4 text-blue-500" />画像雷达图
                  </CardTitle>
                </CardHeader>
                <CardContent>{renderRadarChart()}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-500" />维度详情
                  </CardTitle>
                </CardHeader>
                <CardContent>{renderDimensionCards()}</CardContent>
              </Card>
            </div>
            {renderScoreTrend()}
          </TabsContent>

          <TabsContent value="content" className="mt-4">
            {renderContentPreferences()}
          </TabsContent>

          <TabsContent value="time" className="mt-4">
            {renderTimeDistribution()}
          </TabsContent>

          <TabsContent value="mastery" className="space-y-6 mt-4">
            {renderKnowledgeMastery()}
            {renderScoreTrend()}
          </TabsContent>

          <TabsContent value="trajectory" className="mt-4">
            {renderLearningTrajectory()}
          </TabsContent>

          <TabsContent value="outcomes" className="space-y-6 mt-4">
            {renderLearningOutcomes()}
            <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
              <CardContent className="py-6 text-center">
                <MessageCircle className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-gray-600 mb-3 text-sm">通过对话完善画像，获取更精准的学习分析</p>
                <Button onClick={handleStartDialog} disabled={loading} size="sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                  开始对话构建
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-6 h-6" />学习画像
          </h2>
          <p className="text-gray-600">全面展示你的学习特征与行为模式，获取个性化学习方案</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'dashboard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('dashboard')}
          >
            <Radar className="w-4 h-4 mr-1" />画像看板
          </Button>
          <Button
            variant={view === 'dialog' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (!dialogSession) handleStartDialog()
              else setView('dialog')
            }}
          >
            <MessageCircle className="w-4 h-4 mr-1" />对话构建
          </Button>
        </div>
      </div>

      {view === 'dashboard' && renderDashboard()}

      {view === 'dialog' && (
        <Card className="flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />画像构建对话
              </CardTitle>
              {dialogState && (
                <Badge variant="outline">
                  {dialogState.current_round}/{dialogState.total_rounds} 轮
                </Badge>
              )}
            </div>
            {dialogState && (
              <Progress
                value={((dialogState.current_round || 0) / (dialogState.total_rounds || 6)) * 100}
                className="h-1.5 mt-2"
              />
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的回答..."
                disabled={loading || dialogState?.type === 'dialog_complete'}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!userInput.trim() || loading || dialogState?.type === 'dialog_complete'}
              >
                发送
              </Button>
            </div>
            {dialogState?.type === 'dialog_complete' && (
              <div className="mt-2 text-center">
                <Button variant="outline" size="sm" onClick={() => { setView('dashboard'); fetchDashboard(timeRange) }}>
                  <CheckCircle className="w-4 h-4 mr-1" />查看画像看板
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
