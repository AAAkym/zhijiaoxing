import React, { useState, useEffect } from 'react'
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
  Calendar,
  Target,
  Award,
  Clock
} from 'lucide-react'
import { admin } from '../services/api'

export default function DataAnalytics() {
  const [timeRange, setTimeRange] = useState('7days')
  const [loading, setLoading] = useState(false)
  
  // 模拟数据
  const userGrowthData = [
    { date: '2025-01-01', users: 120, teachers: 15, students: 105 },
    { date: '2025-01-02', users: 135, teachers: 18, students: 117 },
    { date: '2025-01-03', users: 142, teachers: 20, students: 122 },
    { date: '2025-01-04', users: 158, teachers: 22, students: 136 },
    { date: '2025-01-05', users: 167, teachers: 25, students: 142 },
    { date: '2025-01-06', users: 175, teachers: 27, students: 148 },
    { date: '2025-01-07', users: 189, teachers: 30, students: 159 }
  ]

  const courseActivityData = [
    { course: 'Python基础', students: 45, completion: 78 },
    { course: 'TensorFlow.js', students: 32, completion: 65 },
    { course: '数据结构', students: 28, completion: 82 },
    { course: 'Web开发', students: 38, completion: 71 },
    { course: '机器学习', students: 25, completion: 59 }
  ]

  const learningProgressData = [
    { name: '已完成', value: 35, color: '#10B981' },
    { name: '进行中', value: 45, color: '#3B82F6' },
    { name: '未开始', value: 20, color: '#6B7280' }
  ]

  const dailyActivityData = [
    { time: '00:00', activity: 5 },
    { time: '06:00', activity: 12 },
    { time: '09:00', activity: 45 },
    { time: '12:00', activity: 38 },
    { time: '15:00', activity: 52 },
    { time: '18:00', activity: 67 },
    { time: '21:00', activity: 43 },
    { time: '23:00', activity: 18 }
  ]

  const performanceMetrics = [
    {
      title: '总用户数',
      value: '189',
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: '活跃课程',
      value: '24',
      change: '+8.3%',
      trend: 'up',
      icon: BookOpen,
      color: 'text-green-600'
    },
    {
      title: '完成率',
      value: '78.2%',
      change: '+5.1%',
      trend: 'up',
      icon: Target,
      color: 'text-purple-600'
    },
    {
      title: '平均学习时长',
      value: '2.4h',
      change: '+15.2%',
      trend: 'up',
      icon: Clock,
      color: 'text-orange-600'
    }
  ]

  const loadAnalyticsData = async () => {
    setLoading(true)
    try {
      // 这里可以调用实际的API
      // const response = await admin.getAnalyticsData(timeRange)
      // 暂时使用模拟数据
    } catch (error) {
      console.error('加载分析数据失败:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAnalyticsData()
  }, [timeRange])

  return (
    <div className="space-y-6">
      {/* 页面标题和时间选择 */}
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

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceMetrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                    <p className={`text-sm ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.change} 较上期
                    </p>
                  </div>
                  <Icon className={`h-8 w-8 ${metric.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 用户增长趋势 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              用户增长趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* 课程活跃度 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              课程活跃度
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* 学习进度分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              学习进度分布
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* 每日活跃度 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              每日活跃度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="activity" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} name="活跃用户数" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计表格 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 热门课程排行 */}
        <Card>
          <CardHeader>
            <CardTitle>热门课程排行</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* 系统使用统计 */}
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
                <span className="text-xl font-bold text-blue-600">12</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-6 w-6 text-green-600" />
                  <span className="font-medium">今日课程完成</span>
                </div>
                <span className="text-xl font-bold text-green-600">28</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Activity className="h-6 w-6 text-purple-600" />
                  <span className="font-medium">今日AI问答</span>
                </div>
                <span className="text-xl font-bold text-purple-600">156</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Award className="h-6 w-6 text-orange-600" />
                  <span className="font-medium">今日练习提交</span>
                </div>
                <span className="text-xl font-bold text-orange-600">89</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

