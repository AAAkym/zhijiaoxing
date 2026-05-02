import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'
import { 
  TrendingUp, 
  Users, 
  BookOpen, 
  Activity,
  Target,
  Award,
  Clock
} from 'lucide-react'
import { analytics, admin } from '../services/api'

export default function DataAnalytics() {
  const [timeRange, setTimeRange] = useState('7days')
  const [loading, setLoading] = useState(false)
  const [userGrowthData, setUserGrowthData] = useState([])
  const [courseActivityData, setCourseActivityData] = useState([])
  const [learningProgressData, setLearningProgressData] = useState([])
  const [dailyActivityData, setDailyActivityData] = useState([])
  const [performanceMetrics, setPerformanceMetrics] = useState([])
  const [systemUsage, setSystemUsage] = useState({
    today_new_users: 0,
    today_course_completions: 0,
    today_ai_queries: 0,
    today_practice_submissions: 0
  })

  const loadAnalyticsData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { time_range: timeRange }
      const [growthRes, courseRes, progressRes, dailyRes, metricsRes, usageRes] = await Promise.allSettled([
        analytics.getUserGrowth(params),
        analytics.getCourseActivity(params),
        analytics.getLearningProgress(params),
        analytics.getDailyActivity(params),
        analytics.getPerformanceMetrics(params),
        analytics.getSystemUsage(params)
      ])

      if (growthRes.status === 'fulfilled') {
        const data = growthRes.value?.data || growthRes.value?.growth || []
        if (Array.isArray(data) && data.length > 0) setUserGrowthData(data)
        else setUserGrowthData([])
      }

      if (courseRes.status === 'fulfilled') {
        const data = courseRes.value?.data || courseRes.value?.courses || []
        if (Array.isArray(data) && data.length > 0) setCourseActivityData(data)
        else setCourseActivityData([])
      }

      if (progressRes.status === 'fulfilled') {
        const data = progressRes.value?.data || progressRes.value?.distribution || []
        if (Array.isArray(data) && data.length > 0) setLearningProgressData(data)
        else setLearningProgressData([])
      }

      if (dailyRes.status === 'fulfilled') {
        const data = dailyRes.value?.data || dailyRes.value?.activity || []
        if (Array.isArray(data) && data.length > 0) setDailyActivityData(data)
        else setDailyActivityData([])
      }

      if (metricsRes.status === 'fulfilled') {
        const data = metricsRes.value?.metrics || metricsRes.value?.data || []
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(m => ({
            title: m.title,
            value: String(m.value),
            change: m.change || '',
            trend: m.trend || 'up',
            icon: m.icon === 'Users' ? Users : m.icon === 'BookOpen' ? BookOpen : m.icon === 'Target' ? Target : Clock,
            color: m.color || 'text-blue-600'
          }))
          setPerformanceMetrics(mapped)
        } else {
          setPerformanceMetrics([])
        }
      }

      if (usageRes.status === 'fulfilled') {
        const data = usageRes.value?.usage || usageRes.value?.data || {}
        setSystemUsage({
          today_new_users: data.today_new_users ?? 0,
          today_course_completions: data.today_course_completions ?? 0,
          today_ai_queries: data.today_ai_queries ?? 0,
          today_practice_submissions: data.today_practice_submissions ?? 0
        })
      }
    } catch (error) {
      console.error('加载分析数据失败:', error)
    }
    setLoading(false)
  }, [timeRange])

  useEffect(() => {
    loadAnalyticsData()
  }, [loadAnalyticsData])

  const defaultMetrics = [
    { title: '总用户数', value: '0', change: '', trend: 'up', icon: Users, color: 'text-blue-600' },
    { title: '活跃课程', value: '0', change: '', trend: 'up', icon: BookOpen, color: 'text-green-600' },
    { title: '完成率', value: '0%', change: '', trend: 'up', icon: Target, color: 'text-purple-600' },
    { title: '平均学习时长', value: '0h', change: '', trend: 'up', icon: Clock, color: 'text-orange-600' }
  ]

  const displayMetrics = performanceMetrics.length > 0 ? performanceMetrics : defaultMetrics

  const EmptyChartPlaceholder = ({ text }) => (
    <div className="flex items-center justify-center h-[300px] text-gray-400">
      <p>{text}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">数据分析</h2>
          <p className="text-gray-600">系统使用情况和学习数据分析</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="选择时间范围" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">最近7天</SelectItem>
            <SelectItem value="30days">最近30天</SelectItem>
            <SelectItem value="90days">最近90天</SelectItem>
            <SelectItem value="1year">最近1年</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayMetrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                    {metric.change && (
                      <p className={`text-sm ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {metric.change} 较上期
                      </p>
                    )}
                  </div>
                  <Icon className={`h-8 w-8 ${metric.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              用户增长趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={2} name="总用户" />
                  <Line type="monotone" dataKey="teachers" stroke="#10B981" strokeWidth={2} name="教师" />
                  <Line type="monotone" dataKey="students" stroke="#F59E0B" strokeWidth={2} name="学生" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartPlaceholder text="暂无用户增长数据" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              课程活跃度
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courseActivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={courseActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="course" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="students" fill="#3B82F6" name="学生数" />
                  <Bar dataKey="completion" fill="#10B981" name="完成率%" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartPlaceholder text="暂无课程活跃度数据" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              学习进度分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {learningProgressData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={learningProgressData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {learningProgressData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartPlaceholder text="暂无学习进度数据" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              每日活跃度
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyActivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="activity" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} name="活跃用户数" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartPlaceholder text="暂无每日活跃度数据" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>热门课程排行</CardTitle>
          </CardHeader>
          <CardContent>
            {courseActivityData.length > 0 ? (
              <div className="space-y-4">
                {courseActivityData.map((course, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{course.course}</p>
                        <p className="text-sm text-gray-500">{course.students} 名学生</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{course.completion}%</p>
                      <p className="text-xs text-gray-500">完成率</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <p>暂无课程排行数据</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统使用统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Users className="h-6 w-6 text-blue-600" />
                  <span className="font-medium">今日新增用户</span>
                </div>
                <span className="text-xl font-bold text-blue-600">{systemUsage.today_new_users}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-6 w-6 text-green-600" />
                  <span className="font-medium">今日课程完成</span>
                </div>
                <span className="text-xl font-bold text-green-600">{systemUsage.today_course_completions}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Activity className="h-6 w-6 text-purple-600" />
                  <span className="font-medium">今日AI问答</span>
                </div>
                <span className="text-xl font-bold text-purple-600">{systemUsage.today_ai_queries}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Award className="h-6 w-6 text-orange-600" />
                  <span className="font-medium">今日练习提交</span>
                </div>
                <span className="text-xl font-bold text-orange-600">{systemUsage.today_practice_submissions}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
