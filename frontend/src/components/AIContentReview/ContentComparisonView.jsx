import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Legend,
} from 'recharts'
import {
  BarChart3,
  GitCompare,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  FileText,
  Users,
  Sparkles,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Inbox,
  Radio,
} from 'lucide-react'
import { admin } from '@/services/api'

// 图表配色
const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4']

// 内容类型中文映射
const contentTypeLabels = {
  knowledge_point: '知识点',
  teaching_case: '教学案例',
  exercise: '习题',
  teaching_content: '教学内容',
}

// 内容来源中文映射
const sourceLabels = {
  ai: 'AI生成',
  teacher: '教师内容',
  student: '学生内容',
}

// 审核状态中文映射
const statusLabels = {
  pending: '待审核',
  auto_reviewing: '自动审核中',
  manual_reviewing: '人工审核中',
  spot_checking: '抽查中',
  passed: '已通过',
  rejected: '已拒绝',
}

// 友好空状态组件
function FriendlyEmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-400 max-w-xs">{description}</p>}
    </div>
  )
}

// 将文本截断到指定长度
const truncate = (text, length) => {
  if (!text) return ''
  return text.length > length ? text.slice(0, length) + '...' : text
}

// 根据审核状态返回对应 Badge
const getStatusBadge = (status) => {
  const label = statusLabels[status] || status
  if (status === 'passed') {
    return <Badge className="bg-green-600">{label}</Badge>
  }
  if (status === 'rejected') {
    return <Badge className="bg-red-600">{label}</Badge>
  }
  return <Badge variant="outline">{label}</Badge>
}

export default function ContentComparisonView() {
  // 对比数据
  const [comparisonData, setComparisonData] = useState({
    comparisons: [],
    summary: { total_comparisons: 0, avg_improvement: 0, improvement_rate: 0, positive_count: 0 },
    type_stats: [],
  })
  // 反馈趋势数据
  const [trendData, setTrendData] = useState({ trend: [], total_days: 30 })
  // 反馈统计数据
  const [statsData, setStatsData] = useState({
    source_stats: {},
    status_stats: {},
    type_stats: {},
    avg_auto_score: 0,
    avg_manual_score: 0,
    feedback_by_role: {},
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // 时间范围筛选(影响前端展示,保留与范本一致的控件)
  const [timeRange, setTimeRange] = useState('30days')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 加载全部数据,任一接口失败不阻断其他区块
  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    const results = await Promise.allSettled([
      admin.getContentReviewComparison(),
      admin.getContentReviewFeedbackTrend(),
      admin.getContentReviewFeedbackStats(),
    ])

    const errors = []
    if (results[0].status === 'fulfilled') {
      setComparisonData(results[0].value)
    } else {
      errors.push('对比数据')
      console.error('加载对比数据失败:', results[0].reason)
    }
    if (results[1].status === 'fulfilled') {
      setTrendData(results[1].value)
    } else {
      errors.push('反馈趋势')
      console.error('加载反馈趋势失败:', results[1].reason)
    }
    if (results[2].status === 'fulfilled') {
      setStatsData(results[2].value)
    } else {
      errors.push('反馈统计')
      console.error('加载反馈统计失败:', results[2].reason)
    }

    if (errors.length === 3) {
      if (!silent) setError('全部数据加载失败,请稍后重试')
    } else if (errors.length > 0 && !silent) {
      setError(`部分数据加载失败:${errors.join('、')}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // 自动刷新（每 30 秒），确保教师/学生端数据同步
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      loadAllData(true)
    }, 30000)
    return () => clearInterval(timer)
  }, [autoRefresh, loadAllData])

  // ===== 派生数据 =====
  const { summary, type_stats, comparisons } = comparisonData

  const barChartData = type_stats.map((item) => ({
    name: contentTypeLabels[item.content_type] || item.content_type,
    avg_improvement: item.avg_improvement,
    count: item.count,
    color: COLORS[type_stats.indexOf(item) % COLORS.length],
  }))

  const trendChartData = trendData.trend || []

  const sourceEntries = Object.entries(statsData.source_stats || {})
  const pieChartData = sourceEntries.map(([key, value], index) => ({
    name: sourceLabels[key] || key,
    value,
    color: COLORS[index % COLORS.length],
  }))
  const sourceTotal = pieChartData.reduce((sum, item) => sum + item.value, 0)

  const feedbackByRole = statsData.feedback_by_role || {}
  const teacherCount = feedbackByRole.teacher || 0
  const studentCount = feedbackByRole.student || 0
  const feedbackTotal = teacherCount + studentCount
  const teacherPct = feedbackTotal > 0 ? ((teacherCount / feedbackTotal) * 100).toFixed(1) : 0
  const studentPct = feedbackTotal > 0 ? ((studentCount / feedbackTotal) * 100).toFixed(1) : 0

  const avgImprovement = summary.avg_improvement || 0
  const improvementPositive = avgImprovement >= 0

  // ===== 加载态 =====
  if (loading && comparisons.length === 0 && trendChartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
        <p className="text-sm text-slate-500">数据加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 顶部控制区 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-800">AI内容优化对比分析</h3>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={() => loadAllData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors ${
              autoRefresh
                ? 'bg-green-50 text-green-700 ring-green-200'
                : 'bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100'
            }`}
          >
            <Radio className={`h-3 w-3 ${autoRefresh ? 'animate-pulse text-green-500' : ''}`} />
            {autoRefresh ? '自动同步' : '已暂停'}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 flex-1">{error}</p>
            <Button variant="outline" size="sm" onClick={loadAllData}>
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 1. 汇总卡片行 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 总对比数 */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{summary.total_comparisons || 0}</p>
            <p className="text-xs text-blue-600">总对比数</p>
          </CardContent>
        </Card>

        {/* 平均提升分数 */}
        <Card
          className={`bg-gradient-to-br ${
            improvementPositive
              ? 'from-green-50 to-green-100/50 border-green-200'
              : 'from-red-50 to-red-100/50 border-red-200'
          } shadow-sm`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              {improvementPositive ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </div>
            <p
              className={`text-2xl font-bold flex items-center gap-1 ${
                improvementPositive ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {improvementPositive ? (
                <ArrowUp className="h-5 w-5" />
              ) : (
                <ArrowDown className="h-5 w-5" />
              )}
              {avgImprovement.toFixed(1)}
            </p>
            <p className={`text-xs ${improvementPositive ? 'text-green-600' : 'text-red-600'}`}>
              平均提升分数
            </p>
          </CardContent>
        </Card>

        {/* 改进率 */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {(summary.improvement_rate || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600">改进率</p>
          </CardContent>
        </Card>

        {/* 正向改进数 */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700">{summary.positive_count || 0}</p>
            <p className="text-xs text-emerald-600">正向改进数</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. 各内容类型平均提升(柱状图) */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-slate-600" />
            各内容类型平均提升
          </CardTitle>
        </CardHeader>
        <CardContent>
          {barChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [`${value.toFixed(1)} 分`, '平均提升']}
                />
                <Legend />
                <Bar dataKey="avg_improvement" name="平均提升分数" radius={[4, 4, 0, 0]}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <FriendlyEmptyState icon={BarChart3} title="暂无类型改进数据" description="AI内容优化后将按类型展示改进分数" />
          )}
        </CardContent>
      </Card>

      {/* 3. 反馈趋势(折线图) */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-slate-600" />
            反馈趋势(最近{trendData.total_days || 30}天)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="teacher"
                  stroke="#3B82F6"
                  name="教师反馈"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="student"
                  stroke="#10B981"
                  name="学生反馈"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <FriendlyEmptyState icon={TrendingUp} title="暂无反馈趋势" description="近30天教师与学生反馈趋势将在此展示" />
          )}
        </CardContent>
      </Card>

      {/* 4. 内容来源分布(饼图) + 6. 角色反馈 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 内容来源分布 */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-slate-600" />
              内容来源分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <div className="relative">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      innerRadius={70}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                {/* donut 中心总数标签 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs text-gray-400">来源总数</p>
                  <p className="text-2xl font-bold text-slate-700">{sourceTotal}</p>
                </div>
              </div>
            ) : (
              <FriendlyEmptyState icon={Sparkles} title="暂无来源分布" description="AI/教师/学生内容占比将在此展示" />
            )}
          </CardContent>
        </Card>

        {/* 6. 角色反馈 */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-slate-600" />
              角色反馈分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feedbackTotal > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {/* 教师反馈 */}
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Users className="h-5 w-5 text-blue-600" />
                      <span className="text-xs font-medium text-blue-600">教师反馈</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-700">{teacherCount}</p>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>占比</span>
                        <span>{teacherPct}%</span>
                      </div>
                      <Progress value={Number(teacherPct)} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                {/* 学生反馈 */}
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Users className="h-5 w-5 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-600">学生反馈</span>
                    </div>
                    <p className="text-3xl font-bold text-emerald-700">{studentCount}</p>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>占比</span>
                        <span>{studentPct}%</span>
                      </div>
                      <Progress value={Number(studentPct)} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <FriendlyEmptyState icon={Users} title="暂无角色反馈" description="教师与学生的反馈数量占比将在此展示" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. 对比详情列表 */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-slate-600" />
            优化对比详情
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comparisons.length > 0 ? (
            <div className="space-y-4 max-h-[720px] overflow-y-auto pr-2">
              {comparisons.map((item) => {
                const improved =
                  (item.improvement?.score_delta || 0) >= 0
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-4 ${
                      improved
                        ? 'border-green-200 bg-green-50/40'
                        : 'border-red-200 bg-red-50/40'
                    }`}
                  >
                    {/* 标题行 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-800">
                          {item.content_title}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {contentTypeLabels[item.content_type] || item.content_type}
                        </Badge>
                      </div>
                      <Badge
                        className={improved ? 'bg-green-600' : 'bg-red-600'}
                      >
                        {improved ? '已提升' : '已下降'}
                      </Badge>
                    </div>

                    {/* 三栏:优化前 / 提升指标 / 优化后 */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                      {/* 优化前 */}
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500">优化前</span>
                          <Badge variant="outline" className="text-xs">
                            v{item.old_version?.version}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-blue-600 text-xs">
                            {item.old_version?.score} 分
                          </Badge>
                          {getStatusBadge(item.old_version?.status)}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          内容长度:{item.old_version?.content_length} 字
                        </p>
                        <p className="text-xs text-gray-600 line-clamp-3">
                          {truncate(item.old_version?.content_preview, 200)}
                        </p>
                      </div>

                      {/* 中间提升指标 */}
                      <div className="flex md:flex-col items-center justify-center gap-2 px-3 py-2 md:min-w-[140px]">
                        <div
                          className={`flex items-center gap-1 font-bold ${
                            improved ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {improved ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          )}
                          {item.improvement?.score_delta || 0} 分
                        </div>
                        <div className="text-xs text-gray-500 text-center">
                          <p>长度 +{item.improvement?.length_delta || 0}</p>
                          <p>提升 {(item.improvement?.improvement_pct || 0).toFixed(1)}%</p>
                        </div>
                        <ArrowRight className="hidden md:block h-4 w-4 text-gray-300 rotate-0 md:rotate-0" />
                      </div>

                      {/* 优化后 */}
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500">优化后</span>
                          <Badge variant="outline" className="text-xs">
                            v{item.new_version?.version}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-blue-600 text-xs">
                            {item.new_version?.score} 分
                          </Badge>
                          {getStatusBadge(item.new_version?.status)}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          内容长度:{item.new_version?.content_length} 字
                        </p>
                        <p className="text-xs text-gray-600 line-clamp-3">
                          {truncate(item.new_version?.content_preview, 200)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <FriendlyEmptyState
              icon={GitCompare}
              title="暂无对比数据"
              description="当AI生成内容经过多版本优化后，前后对比将在此展示，包括评分变化、内容差异等"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
