import React, { useState, useEffect, useCallback } from 'react'
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
  Activity,
  RefreshCw
} from 'lucide-react'
import { contentReview } from '@/services/api'

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899']

const contentTypeLabels = {
  knowledge_point: '知识点',
  teaching_case: '教学案例',
  exercise: '练习',
  teaching_content: '教学内容',
}

export default function ReviewDataAnalytics() {
  const [timeRange, setTimeRange] = useState('7days')
  const [loading, setLoading] = useState(false)
  const [analytics, setAnalytics] = useState({
    daily_counts: [],
    pass_rate_by_type: [],
    avg_auto_score: 0,
    mechanism_distribution: [],
  })

  const loadAnalyticsData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await contentReview.getAnalytics()
      if (response.success) {
        setAnalytics(response.data)
      }
    } catch (error) {
      console.error('加载分析数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnalyticsData()
  }, [loadAnalyticsData])

  const handleExport = () => {
    console.log('导出数据报告...')
  }

  const totalPassed = analytics.daily_counts.reduce((sum, d) => sum + d.passed, 0)
  const totalRejected = analytics.daily_counts.reduce((sum, d) => sum + d.rejected, 0)
  const totalReviewed = totalPassed + totalRejected
  const passRate = totalReviewed > 0 ? ((totalPassed / totalReviewed) * 100).toFixed(1) : 0

  const contentTypeData = analytics.pass_rate_by_type.map(item => ({
    name: contentTypeLabels[item.content_type] || item.content_type,
    value: item.total,
    pass_rate: item.pass_rate,
    color: COLORS[analytics.pass_rate_by_type.indexOf(item) % COLORS.length],
  }))

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
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAnalyticsData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={handleExport} className="bg-slate-900 hover:bg-slate-800">
            <Download className="h-4 w-4 mr-2" />
            导出报告
          </Button>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{totalReviewed}</p>
            <p className="text-xs text-blue-600">总审核数</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-700">{passRate}%</p>
            <p className="text-xs text-green-600">审核通过率</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-700">{analytics.avg_auto_score}</p>
            <p className="text-xs text-purple-600">平均自动评分</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700">{totalRejected}</p>
            <p className="text-xs text-red-600">已拒绝数</p>
          </CardContent>
        </Card>
      </div>

      {/* 审核趋势 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-slate-600" />
            审核通过/拒绝趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.daily_counts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="passed" fill="#10B981" name="通过" />
              <Bar dataKey="rejected" fill="#EF4444" name="拒绝" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 内容类型分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-slate-600" />
              内容类型分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contentTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={contentTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {contentTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 各类型通过率 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-slate-600" />
              各类型通过率
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.pass_rate_by_type.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.pass_rate_by_type.map(item => ({
                  ...item,
                  name: contentTypeLabels[item.content_type] || item.content_type,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pass_rate" fill="#10B981" name="通过率(%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 审核机制分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-slate-600" />
            审核机制分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.mechanism_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.mechanism_distribution.map(item => ({
                ...item,
                name: item.mechanism === 'auto' ? '自动审核' : item.mechanism === 'manual' ? '人工审核' : '抽查审核',
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" name="数量" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 各类型详细统计 */}
      <Card>
        <CardHeader>
          <CardTitle>各内容类型详细统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.pass_rate_by_type.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold`} style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                    {index + 1}
                  </div>
                  <span className="font-medium">{contentTypeLabels[item.content_type] || item.content_type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">总数: {item.total}</span>
                  <span className="text-sm text-gray-500">通过: {item.passed}</span>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    {item.pass_rate}%
                  </Badge>
                </div>
              </div>
            ))}
            {analytics.pass_rate_by_type.length === 0 && (
              <div className="text-center py-8 text-gray-400">暂无数据</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
