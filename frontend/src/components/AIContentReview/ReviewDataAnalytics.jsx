import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
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
  Area,
  Legend
} from 'recharts'
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  Clock,
  MessageSquare,
  FileText,
  CheckCircle,
  AlertTriangle,
  Download,
  Calendar,
  BookOpen,
  Star,
  Activity
} from 'lucide-react'

const usageData = {
  daily: [
    { date: '03-21', teacher: 45, student: 120, total: 165 },
    { date: '03-22', teacher: 52, student: 135, total: 187 },
    { date: '03-23', teacher: 38, student: 98, total: 136 },
    { date: '03-24', teacher: 61, student: 142, total: 203 },
    { date: '03-25', teacher: 55, student: 156, total: 211 },
    { date: '03-26', teacher: 48, student: 128, total: 176 },
    { date: '03-27', teacher: 67, student: 178, total: 245 }
  ],
  contentType: [
    { name: '教程生成', value: 35, color: '#3B82F6' },
    { name: '练习题', value: 28, color: '#10B981' },
    { name: '知识解释', value: 20, color: '#8B5CF6' },
    { name: '总结归纳', value: 12, color: '#F59E0B' },
    { name: '问答互动', value: 5, color: '#EC4899' }
  ],
  reviewStats: [
    { date: '03-21', passed: 42, rejected: 3, modified: 8 },
    { date: '03-22', passed: 48, rejected: 5, modified: 12 },
    { date: '03-23', passed: 35, rejected: 2, modified: 6 },
    { date: '03-24', passed: 55, rejected: 4, modified: 15 },
    { date: '03-25', passed: 52, rejected: 6, modified: 10 },
    { date: '03-26', passed: 45, rejected: 3, modified: 9 },
    { date: '03-27', passed: 62, rejected: 5, modified: 14 }
  ],
  feedbackData: [
    { category: '内容质量', positive: 85, neutral: 10, negative: 5 },
    { category: '响应速度', positive: 92, neutral: 6, negative: 2 },
    { category: '准确性', positive: 78, neutral: 15, negative: 7 },
    { category: '实用性', positive: 88, neutral: 8, negative: 4 }
  ],
  moduleUsage: [
    { module: 'AI助手', teacher: 125, student: 456 },
    { module: '内容生成', teacher: 89, student: 234 },
    { module: '练习评估', teacher: 67, student: 312 },
    { module: '知识搜索', teacher: 45, student: 178 }
  ]
}

const summaryStats = {
  totalUsage: 1247,
  teacherUsage: 326,
  studentUsage: 921,
  avgResponseTime: '2.3s',
  satisfactionRate: 87.5,
  passRate: 91.2,
  totalFeedback: 456
}

export default function ReviewDataAnalytics() {
  const [timeRange, setTimeRange] = useState('7days')
  const [roleFilter, setRoleFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const loadAnalyticsData = async () => {
    setLoading(true)
    try {
      // API调用
    } catch (error) {
      console.error('加载分析数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalyticsData()
  }, [timeRange, roleFilter])

  const handleExport = () => {
    console.log('导出数据报告...')
  }

  return (
    <div className="space-y-6">
      {/* 页面控制区 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
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
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="角色筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              <SelectItem value="teacher">仅教师</SelectItem>
              <SelectItem value="student">仅学生</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleExport} className="bg-slate-900 hover:bg-slate-800">
          <Download className="h-4 w-4 mr-2" />
          导出报告
        </Button>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <Badge variant="outline" className="text-blue-600 border-blue-300">+12.5%</Badge>
            </div>
            <p className="text-2xl font-bold text-blue-700">{summaryStats.totalUsage}</p>
            <p className="text-xs text-blue-600">总使用次数</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-amber-600" />
              <Badge variant="outline" className="text-amber-600 border-amber-300">教师</Badge>
            </div>
            <p className="text-2xl font-bold text-amber-700">{summaryStats.teacherUsage}</p>
            <p className="text-xs text-amber-600">教师使用次数</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-green-600" />
              <Badge variant="outline" className="text-green-600 border-green-300">学生</Badge>
            </div>
            <p className="text-2xl font-bold text-green-700">{summaryStats.studentUsage}</p>
            <p className="text-xs text-green-600">学生使用次数</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-700">{summaryStats.avgResponseTime}</p>
            <p className="text-xs text-purple-600">平均响应时间</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-cyan-600" />
            </div>
            <p className="text-2xl font-bold text-cyan-700">{summaryStats.passRate}%</p>
            <p className="text-xs text-cyan-600">审核通过率</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-rose-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-rose-600" />
            </div>
            <p className="text-2xl font-bold text-rose-700">{summaryStats.satisfactionRate}%</p>
            <p className="text-xs text-rose-600">用户满意度</p>
          </CardContent>
        </Card>
      </div>

      {/* 使用频次统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-slate-600" />
              使用频次趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={usageData.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="teacher" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="教师" />
                <Area type="monotone" dataKey="student" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="学生" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-slate-600" />
              内容生成类型分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={usageData.contentType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {usageData.contentType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 审核通过率及修改记录分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-slate-600" />
            审核通过率及修改记录分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={usageData.reviewStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="passed" fill="#10B981" name="通过" />
              <Bar dataKey="rejected" fill="#EF4444" name="拒绝" />
              <Bar dataKey="modified" fill="#F59E0B" name="修改后通过" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 功能模块使用情况 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpen className="h-5 w-5 mr-2 text-slate-600" />
            功能模块使用情况
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={usageData.moduleUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="module" type="category" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="teacher" fill="#F59E0B" name="教师" />
              <Bar dataKey="student" fill="#10B981" name="学生" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 用户反馈收集与可视化展示 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-slate-600" />
            用户反馈分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={usageData.feedbackData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="positive" fill="#10B981" name="正面" />
                  <Bar dataKey="neutral" fill="#6B7280" name="中性" />
                  <Bar dataKey="negative" fill="#EF4444" name="负面" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium">反馈摘要</h4>
              {usageData.feedbackData.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{item.category}</span>
                    <Badge className="bg-green-100 text-green-700">{item.positive}% 满意</Badge>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-2 bg-green-500 rounded-l-full" style={{ width: `${item.positive}%` }}></div>
                    <div className="h-2 bg-gray-300" style={{ width: `${item.neutral}%` }}></div>
                    <div className="h-2 bg-red-500 rounded-r-full" style={{ width: `${item.negative}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 详细统计表格 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>高频使用时段</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { time: '09:00-11:00', count: 234, label: '上午高峰' },
                { time: '14:00-16:00', count: 189, label: '下午高峰' },
                { time: '19:00-21:00', count: 312, label: '晚间高峰' },
                { time: '21:00-23:00', count: 156, label: '夜间学习' }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{item.time}</p>
                      <p className="text-xs text-gray-500">{item.label}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{item.count}</p>
                    <p className="text-xs text-gray-500">次使用</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>热门功能排行</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: 'AI智能问答', usage: 456, trend: '+15%' },
                { name: '练习题生成', usage: 312, trend: '+8%' },
                { name: '知识点解释', usage: 234, trend: '+12%' },
                { name: '学习总结', usage: 178, trend: '+5%' }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{item.usage}</span>
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      {item.trend}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
