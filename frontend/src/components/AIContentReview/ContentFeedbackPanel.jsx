import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Users,
  GraduationCap,
  BookOpen,
  Star,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Bot,
  Inbox,
  Radio,
} from 'lucide-react'
import { admin } from '@/services/api'

// 配色常量(与模块内 ReviewDataAnalytics 保持一致)
const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899']

// 审核状态中文标签
const statusLabels = {
  pending: '待审核',
  auto_reviewing: '自动审核中',
  manual_reviewing: '人工审核中',
  spot_checking: '抽查审核',
  passed: '已通过',
  rejected: '已拒绝',
}

// 审核状态颜色(pending=灰,审核中=蓝,通过=绿,拒绝=红)
const statusColors = {
  pending: '#9CA3AF',
  auto_reviewing: '#3B82F6',
  manual_reviewing: '#3B82F6',
  spot_checking: '#3B82F6',
  passed: '#10B981',
  rejected: '#EF4444',
}

// 内容类型中文标签
const contentTypeLabels = {
  knowledge_point: '知识点',
  teaching_case: '教学案例',
  exercise: '习题',
  teaching_content: '教学内容',
}

// 操作类型中文标签
const operationLabels = {
  submit: '提交',
  auto_review: '自动审核',
  manual_review: '人工审核',
  approve: '通过',
  reject: '拒绝',
  spot_check: '抽查',
}

// 友好空状态组件
function FriendlyEmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// 默认空数据结构,避免渲染时 undefined 报错
const emptyStats = {
  source_stats: { teacher: 0, student: 0, ai: 0 },
  status_stats: {
    pending: 0,
    auto_reviewing: 0,
    manual_reviewing: 0,
    spot_checking: 0,
    passed: 0,
    rejected: 0,
  },
  type_stats: { knowledge_point: 0, teaching_case: 0, exercise: 0, teaching_content: 0 },
  avg_auto_score: 0,
  avg_manual_score: 0,
  operation_stats: {
    submit: 0,
    auto_review: 0,
    manual_review: 0,
    approve: 0,
    reject: 0,
    spot_check: 0,
  },
  feedback_by_role: { teacher: 0, student: 0 },
}

export default function ContentFeedbackPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(emptyStats)
  const [trend, setTrend] = useState({ trend: [], total_days: 30 })
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  // 并行加载反馈统计与30天趋势
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [statsRes, trendRes] = await Promise.all([
        admin.getContentReviewFeedbackStats(),
        admin.getContentReviewFeedbackTrend(),
      ])
      // 兼容直接返回数据或 {success, data} 包装
      if (statsRes) {
        setStats(statsRes.data || statsRes)
      }
      if (trendRes) {
        setTrend(trendRes.data || trendRes)
      }
      setLastUpdated(new Date())
    } catch (err) {
      console.error('加载反馈数据失败:', err)
      if (!silent) setError('加载反馈数据失败,请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 自动刷新（每 30 秒），确保教师/学生端操作后管理端数据同步
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      loadData(true)
    }, 30000)
    return () => clearInterval(timer)
  }, [autoRefresh, loadData])

  // ===== 派生数据计算 =====
  const sourceStats = stats.source_stats || {}
  const totalSource =
    (sourceStats.ai || 0) + (sourceStats.teacher || 0) + (sourceStats.student || 0)

  // 反馈来源卡片数据(类名需为完整静态字符串,Tailwind JIT 才能识别)
  const sourceCards = [
    {
      key: 'ai',
      label: 'AI生成内容',
      count: sourceStats.ai || 0,
      icon: Bot,
      cardClass: 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 hover:shadow-lg transition-all duration-300',
      iconWrapClass: 'p-2 bg-blue-500/20 rounded-lg',
      iconClass: 'h-6 w-6 text-blue-600',
      badgeClass: 'text-blue-600 border-blue-300',
      labelClass: 'text-sm text-blue-600 mt-1',
    },
    {
      key: 'teacher',
      label: '教师内容',
      count: sourceStats.teacher || 0,
      icon: GraduationCap,
      cardClass: 'bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 hover:shadow-lg transition-all duration-300',
      iconWrapClass: 'p-2 bg-purple-500/20 rounded-lg',
      iconClass: 'h-6 w-6 text-purple-600',
      badgeClass: 'text-purple-600 border-purple-300',
      labelClass: 'text-sm text-purple-600 mt-1',
    },
    {
      key: 'student',
      label: '学生内容',
      count: sourceStats.student || 0,
      icon: Users,
      cardClass: 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 hover:shadow-lg transition-all duration-300',
      iconWrapClass: 'p-2 bg-green-500/20 rounded-lg',
      iconClass: 'h-6 w-6 text-green-600',
      badgeClass: 'text-green-600 border-green-300',
      labelClass: 'text-sm text-green-600 mt-1',
    },
  ]

  // 审核状态柱状图数据
  const statusData = Object.keys(statusLabels).map((key) => ({
    key,
    name: statusLabels[key],
    count: (stats.status_stats && stats.status_stats[key]) || 0,
  }))

  // 评分差值(人工 - 自动)
  const avgAuto = stats.avg_auto_score || 0
  const avgManual = stats.avg_manual_score || 0
  const scoreDiff = (avgManual - avgAuto).toFixed(1)
  const isManualHigher = avgManual >= avgAuto

  // 按角色反馈饼图数据
  const feedbackByRole = stats.feedback_by_role || {}
  const roleData = [
    { name: '教师反馈', value: feedbackByRole.teacher || 0, color: '#8B5CF6' },
    { name: '学生反馈', value: feedbackByRole.student || 0, color: '#10B981' },
  ]
  const totalFeedback = roleData.reduce((sum, d) => sum + d.value, 0)

  // 30天趋势折线图数据
  const trendData = (trend.trend || []).map((item) => ({
    date: item.date,
    approve: item.approve || 0,
    reject: item.reject || 0,
  }))

  // 内容类型分布(水平柱状图)
  const typeData = Object.keys(contentTypeLabels).map((key, index) => ({
    key,
    name: contentTypeLabels[key],
    count: (stats.type_stats && stats.type_stats[key]) || 0,
    color: COLORS[index % COLORS.length],
  }))

  // 操作统计表格数据
  const operationStats = stats.operation_stats || {}
  const operationData = Object.keys(operationLabels).map((key) => ({
    key,
    name: operationLabels[key],
    count: operationStats[key] || 0,
  }))
  const maxOperationCount = Math.max(...operationData.map((d) => d.count), 1)

  // 计算百分比(保留1位小数,总数为0时返回0)
  const calcPercent = (value, total) => {
    if (!total || total === 0) return 0
    return ((value / total) * 100).toFixed(1)
  }

  // 判断是否所有数据均为零
  const isAllEmpty = totalSource === 0 && totalFeedback === 0 && avgAuto === 0 && avgManual === 0

  // 加载态(首次加载且无数据)
  const isFirstLoading = loading && isAllEmpty && !error

  // 格式化时间
  const formatTimestamp = (d) => {
    if (!d) return ''
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 顶部控制区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-slate-600" />
          <h3 className="text-base sm:text-lg font-semibold text-slate-800">用户反馈与审核结果</h3>
          <Badge variant="outline" className="ml-1 text-slate-500">
            近 {trend.total_days || 30} 天
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="hidden md:inline text-xs text-slate-400">
              更新于 {formatTimestamp(lastUpdated)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading}>
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

      {/* 加载状态 */}
      {isFirstLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mb-3" />
            <p className="text-sm text-slate-500">正在加载反馈数据...</p>
          </CardContent>
        </Card>
      )}

      {/* 错误状态 */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadData()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 全局空状态：所有数据均为零时展示友好提示 */}
      {!isFirstLoading && !error && isAllEmpty && (
        <Card>
          <CardContent>
            <FriendlyEmptyState
              icon={Inbox}
              title="暂无审核反馈数据"
              description="当教师或学生提交内容审核后，反馈数据将在此实时展示。包括审核状态分布、评分对比、用户反馈趋势等。"
              action={
                <Button variant="outline" size="sm" onClick={() => loadData()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新数据
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* 主内容区(加载/错误/全空态时不渲染) */}
      {!isFirstLoading && !error && !isAllEmpty && (
        <>
          {/* 区块1:反馈来源概览 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sourceCards.map((card) => {
              const Icon = card.icon
              const percent = calcPercent(card.count, totalSource)
              return (
                <Card key={card.key} className={card.cardClass}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className={card.iconWrapClass}>
                        <Icon className={card.iconClass} />
                      </div>
                      <Badge variant="outline" className={card.badgeClass}>
                        {percent}%
                      </Badge>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{card.count}</p>
                    <p className={card.labelClass}>{card.label}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* 区块2:审核状态分布 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-slate-600" />
                审核状态分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="数量" radius={[4, 4, 0, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={`status-cell-${index}`} fill={statusColors[entry.key]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <FriendlyEmptyState
                  icon={BarChart3}
                  title="暂无审核状态数据"
                  description="内容提交审核后，状态分布将在此展示"
                />
              )}
            </CardContent>
          </Card>

          {/* 区块3:评分对比 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Star className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-blue-600">自动评分均值</span>
                  </div>
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    自动
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-blue-700">{avgAuto}</span>
                  <span className="text-sm text-blue-500">分</span>
                </div>
                <Progress value={avgAuto} className="h-2 mt-3" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Star className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-purple-600">人工评分均值</span>
                  </div>
                  <Badge variant="outline" className="text-purple-600 border-purple-300">
                    人工
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-purple-700">{avgManual}</span>
                  <span className="text-sm text-purple-500">分</span>
                </div>
                <Progress value={avgManual} className="h-2 mt-3" />
              </CardContent>
            </Card>
          </div>

          {/* 评分差值指示器 */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">人工与自动评分差值</span>
                </div>
                <div className="flex items-center gap-2">
                  {isManualHigher ? (
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <ThumbsDown className="h-4 w-4 text-red-600" />
                  )}
                  <span
                    className={`text-lg font-bold ${
                      isManualHigher ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {isManualHigher ? '+' : ''}
                    {scoreDiff}
                  </span>
                  <span className="text-xs text-slate-500">分</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 区块4 + 区块6:按角色反馈 / 内容类型分布(并排) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 区块4:按角色反馈(环形饼图) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-slate-600" />
                  按角色反馈分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalFeedback > 0 ? (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={roleData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={2}
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          dataKey="value"
                        >
                          {roleData.map((entry, index) => (
                            <Cell key={`role-cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* 中心总数 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-slate-800">{totalFeedback}</span>
                      <span className="text-xs text-slate-500 mt-1">总反馈数</span>
                    </div>
                  </div>
                ) : (
                  <FriendlyEmptyState
                    icon={Users}
                    title="暂无角色反馈"
                    description="教师和学生审核操作后，反馈分布将在此展示"
                  />
                )}
              </CardContent>
            </Card>

            {/* 区块6:内容类型分布(水平柱状图) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2 text-slate-600" />
                  内容类型分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {typeData.some((d) => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={typeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="数量" radius={[0, 4, 4, 0]}>
                        {typeData.map((entry, index) => (
                          <Cell key={`type-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <FriendlyEmptyState
                    icon={BookOpen}
                    title="暂无内容类型数据"
                    description="不同类型内容的审核分布将在此展示"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* 区块5:30天反馈趋势(折线图) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-slate-600" />
                30天反馈趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="approve"
                      name="通过"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="reject"
                      name="拒绝"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <FriendlyEmptyState
                  icon={TrendingUp}
                  title="暂无反馈趋势数据"
                  description="近30天的审核通过/拒绝趋势将在此展示"
                />
              )}
            </CardContent>
          </Card>

          {/* 区块7:操作统计表格 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-slate-600" />
                操作统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {operationData.map((op) => {
                  const percent = (op.count / maxOperationCount) * 100
                  return (
                    <div
                      key={op.key}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 w-32">
                        {op.key === 'approve' && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {op.key === 'reject' && <XCircle className="h-4 w-4 text-red-600" />}
                        {op.key === 'submit' && <MessageSquare className="h-4 w-4 text-blue-600" />}
                        {op.key === 'auto_review' && (
                          <RefreshCw className="h-4 w-4 text-purple-600" />
                        )}
                        {op.key === 'manual_review' && (
                          <BarChart3 className="h-4 w-4 text-amber-600" />
                        )}
                        {op.key === 'spot_check' && <AlertCircle className="h-4 w-4 text-cyan-600" />}
                        <span className="font-medium text-sm">{op.name}</span>
                      </div>
                      <div className="flex-1 mx-4">
                        <Progress value={percent} className="h-2" />
                      </div>
                      <div className="flex items-center gap-2 w-20 justify-end">
                        <span className="text-sm font-bold text-slate-700">{op.count}</span>
                        <span className="text-xs text-slate-400">次</span>
                      </div>
                    </div>
                  )
                })}
                {operationData.every((d) => d.count === 0) && (
                  <FriendlyEmptyState
                    icon={BarChart3}
                    title="暂无操作记录"
                    description="审核操作统计将在教师/学生使用后自动汇总"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
