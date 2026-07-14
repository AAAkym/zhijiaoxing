import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Bot,
  Activity,
  ListChecks,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertCircle,
  MessageSquare,
  GitBranch,
  ArrowRight,
  Inbox,
  Radio,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { admin } from '@/services/api'

// 状态配置：颜色映射参考 AgentCollaborationProgress 的 STATUS_CONFIG 风格
const STATUS_CONFIG = {
  running: {
    label: '运行中',
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  idle: {
    label: '空闲',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
  },
  success: {
    label: '已完成',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  failed: {
    label: '失败',
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  waiting: {
    label: '等待中',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dot: 'bg-yellow-500',
  },
}

// Agent 名称兜底映射（与 AgentCollaborationProgress 保持一致）
const AGENT_LABELS = {
  coordinator: '协调Agent',
  exercise_agent: '习题设计Agent',
  document_agent: '课程文档Agent',
  media_agent: '多媒体Agent',
  recommendation_agent: '资源推荐Agent',
  project_agent: '实践项目Agent',
}

// Agent 图标映射（与后端 agent_meta icon 一致，用于历史记录表格）
const AGENT_ICON_MAP = {
  coordinator: '🎛️',
  exercise_agent: '✏️',
  document_agent: '📄',
  media_agent: '🎬',
  recommendation_agent: '📚',
  project_agent: '💻',
}

// 图表配色（沿用 AIAnalysisDashboard 的 CHART_COLORS）
const AGENT_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
]

// 雷达图五个维度
const RADAR_DIMENSIONS = ['响应速度', '成功率', '质量评分', 'Token效率', '引用覆盖']

const REFRESH_INTERVAL = 5000

// 将后端 ISO 时间串解析为 Date 对象。
// 后端 datetime.utcnow().isoformat() 返回不带时区标记的 UTC 时间（如 2026-07-12T10:00:00.123456），
// 浏览器 new Date() 会按本地时区解析，导致中国 UTC+8 用户看到的相对时间偏差 8 小时。
// 这里识别无时区标记的 ISO 串并补 'Z'，让浏览器正确按 UTC 解析。
function parseServerTime(iso) {
  if (!iso) return null
  let normalized = iso
  if (typeof iso === 'string') {
    // 已带 Z 或 ±HH:MM 时区偏移的不再补，避免重复
    if (!/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) {
      normalized = iso + 'Z'
    }
  }
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatRelativeTime(iso) {
  const d = parseServerTime(iso)
  if (!d) return '—'
  const diff = Date.now() - d.getTime()
  if (diff < 0) return '刚刚'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  return `${day} 天前`
}

function formatTimestamp(iso) {
  const d = parseServerTime(iso)
  if (!d) return '—'
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(text, n = 80) {
  if (!text) return ''
  const str = String(text)
  return str.length > n ? str.slice(0, n) + '…' : str
}

// 统计卡片
function StatCard({ title, value, subtitle, icon: Icon, accentBg, accentText }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 sm:p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
          <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${accentBg}`}>
            <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${accentText}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 单个 Agent 状态卡片
function AgentStatusCard({ agent }) {
  const status = STATUS_CONFIG[agent.status] || STATUS_CONFIG.idle
  const successRate = agent.success_rate ?? 0
  const currentTaskText = (() => {
    const t = agent.current_task
    if (!t) return null
    if (typeof t === 'string') return t
    return t.task_type || t.description || t.title || '执行中'
  })()

  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-3 sm:p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-slate-100 text-base sm:text-xl">
              {agent.icon || '🤖'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm sm:font-semibold font-medium text-gray-900">
                {agent.display_name || AGENT_LABELS[agent.name] || agent.name}
              </p>
              <p className="truncate text-xs text-gray-500">{agent.role || ''}</p>
            </div>
          </div>
          <Badge variant="outline" className={`shrink-0 text-xs ${status.badge}`}>
            <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </Badge>
        </div>

        {agent.description && (
          <p className="mt-2 sm:mt-3 line-clamp-2 text-xs text-gray-500">{agent.description}</p>
        )}

        <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-base sm:text-lg font-bold text-gray-900">{agent.task_count ?? 0}</p>
            <p className="text-xs text-gray-400">今日任务</p>
          </div>
          <div>
            <p className="text-base sm:text-lg font-bold text-gray-900">{successRate}%</p>
            <p className="text-xs text-gray-400">成功率</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-gray-900">
              {formatRelativeTime(agent.last_heartbeat)}
            </p>
            <p className="text-xs text-gray-400">最后活跃</p>
          </div>
        </div>

        <div className="mt-3 sm:mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>成功率</span>
            <span>{successRate}%</span>
          </div>
          <Progress value={successRate} className="h-1.5" />
        </div>

        {agent.status === 'running' && currentTaskText && (
          <div className="mt-2 sm:mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-700">
            <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" />
            <span className="truncate">{truncate(currentTaskText, 60)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 时间线单条记录
function TaskTimelineItem({ task, resolveName }) {
  const isMessage = task.type === 'message'
  const Icon = isMessage ? MessageSquare : GitBranch
  const actor = isMessage ? task.sender : task.agent
  const action = isMessage
    ? task.msg_type || '消息'
    : `${task.key || '状态'}: ${String(task.old_value ?? '')} → ${String(task.new_value ?? '')}`
  const payload = isMessage ? task.payload_summary : null

  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isMessage ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {resolveName(actor) || actor || '系统'}
          </span>
          {isMessage && task.receiver && (
            <>
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <span className="text-sm text-gray-600">{resolveName(task.receiver) || task.receiver}</span>
            </>
          )}
          <Badge variant="outline" className="text-xs">
            {action}
          </Badge>
        </div>
        {payload && (
          <p className="mt-1 truncate text-xs text-gray-500">{truncate(payload, 80)}</p>
        )}
      </div>
      <span className="shrink-0 text-xs text-gray-400">{formatTimestamp(task.timestamp)}</span>
    </div>
  )
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-gray-400">
      <div className="text-center">
        <Icon className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2 text-sm">{text}</p>
      </div>
    </div>
  )
}

/**
 * 智能体监控与管理中心
 *
 * 面向管理员的 Multi-Agent 监控面板，提供：
 *  - 实时 Agent 状态与任务分配可视化
 *  - 性能雷达图与指标对比柱状图
 *  - 最近任务时间线
 *
 * 数据来源：admin.getAgentsStatus / getAgentsPerformance / getRecentAgentTasks
 */
export default function AgentMonitorCenter() {
  const [agents, setAgents] = useState([])
  const [summary, setSummary] = useState({})
  const [performance, setPerformance] = useState([])
  const [radarData, setRadarData] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  // 持久化执行历史记录（独立分页，不随 5s 自动刷新）
  const [historyRecords, setHistoryRecords] = useState([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyTotalPages, setHistoryTotalPages] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyAgentFilter, setHistoryAgentFilter] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState('')

  // 防止刷新请求重入
  const inFlightRef = useRef(false)

  const loadData = useCallback(async (silent = false) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (!silent) setRefreshing(true)
    setError(null)
    try {
      const [statusRes, perfRes, tasksRes] = await Promise.all([
        admin.getAgentsStatus(),
        admin.getAgentsPerformance(),
        admin.getRecentAgentTasks({ limit: 30 }),
      ])
      setAgents(statusRes?.agents || [])
      setSummary(statusRes?.summary || {})
      setPerformance(perfRes?.performance || [])
      setRadarData(perfRes?.radar_data || [])
      setTasks(tasksRes?.tasks || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('加载智能体监控数据失败:', err)
      setError(err?.message || '加载监控数据失败，请稍后重试')
    } finally {
      setRefreshing(false)
      setLoading(false)
      inFlightRef.current = false
    }
  }, [])

  // 首次加载
  useEffect(() => {
    loadData()
  }, [loadData])

  // 加载持久化执行历史（分页，受页码与筛选控制）
  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true)
    try {
      const params = { page, per_page: 15 }
      if (historyAgentFilter) params.agent_name = historyAgentFilter
      if (historyStatusFilter) params.status = historyStatusFilter
      const res = await admin.getAgentExecutionsHistory(params)
      setHistoryRecords(res?.records || [])
      setHistoryTotal(res?.total || 0)
      setHistoryTotalPages(res?.total_pages || 0)
      setHistoryPage(res?.page || page)
    } catch (err) {
      console.error('加载执行历史失败:', err)
      setHistoryRecords([])
    } finally {
      setHistoryLoading(false)
    }
  }, [historyAgentFilter, historyStatusFilter])

  useEffect(() => {
    loadHistory(1)
  }, [loadHistory])

  // 自动刷新（每 5 秒），在 useEffect 返回中清理定时器
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      loadData(true)
    }, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [autoRefresh, loadData])

  // Agent 名称解析：优先使用接口返回的 display_name
  const nameMap = useMemo(() => {
    const map = {}
    agents.forEach((a) => {
      if (a?.name) map[a.name] = a.display_name || AGENT_LABELS[a.name] || a.name
    })
    return map
  }, [agents])

  const resolveName = useCallback(
    (name) => (name ? nameMap[name] || AGENT_LABELS[name] || name : ''),
    [nameMap]
  )

  // 雷达图数据：将「每个 Agent 一条记录」透视成「每个维度一条记录」
  const radarChartData = useMemo(() => {
    return RADAR_DIMENSIONS.map((dim) => {
      const point = { dimension: dim }
      radarData.forEach((item) => {
        if (item && item.agent) {
          point[item.agent] = item[dim] ?? 0
        }
      })
      return point
    })
  }, [radarData])

  // 柱状图数据
  const barChartData = useMemo(() => {
    return performance.map((p) => ({
      name: resolveName(p.agent_name),
      task_count: p.task_count ?? 0,
      avg_response_time_ms: p.avg_response_time_ms ?? 0,
      quality_score: p.quality_score ?? 0,
    }))
  }, [performance, resolveName])

  const successRate = summary.success_rate ?? 0
  const recentTasks = tasks.slice(0, 20)

  // 初始加载态
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">正在加载智能体监控数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
      {/* 1. 头部：渐变背景 + 自动刷新 + 手动刷新 */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-5 md:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1
                className="text-lg sm:text-xl font-bold text-white"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                智能体监控与管理中心
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">多 Agent 实时状态 · 任务分配 · 性能指标</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lastUpdated && (
              <span className="hidden md:inline text-xs text-slate-400">
                更新于 {formatTimestamp(lastUpdated)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              disabled={refreshing}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                autoRefresh
                  ? 'bg-green-500/20 text-green-300 ring-green-400/40'
                  : 'bg-white/10 text-slate-300 ring-white/20 hover:bg-white/15'
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  autoRefresh ? 'animate-pulse bg-green-400' : 'bg-slate-400'
                }`}
              />
              自动刷新 {autoRefresh ? '已开启' : '已关闭'}
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示横幅（有数据时刷新失败展示） */}
      {error && agents.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={refreshing}>
            重试
          </Button>
        </div>
      )}

      {/* 错误态（无任何数据） */}
      {error && agents.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="mt-3 text-sm font-medium text-gray-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => loadData()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              重试
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 2. 汇总统计栏 */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              title="总Agent数"
              value={summary.total_agents ?? agents.length ?? 0}
              subtitle="协作智能体"
              icon={Bot}
              accentBg="bg-blue-50"
              accentText="text-blue-600"
            />
            <StatCard
              title="运行中"
              value={summary.running ?? 0}
              subtitle={`空闲 ${summary.idle ?? 0}`}
              icon={Activity}
              accentBg="bg-green-50"
              accentText="text-green-600"
            />
            <StatCard
              title="总任务数"
              value={summary.total_tasks ?? 0}
              subtitle={`成功 ${summary.total_success ?? 0} · 失败 ${summary.total_fail ?? 0}`}
              icon={ListChecks}
              accentBg="bg-amber-50"
              accentText="text-amber-600"
            />
            <StatCard
              title="成功率"
              value={`${successRate}%`}
              subtitle="整体执行成功率"
              icon={TrendingUp}
              accentBg="bg-purple-50"
              accentText="text-purple-600"
            />
          </div>

          {/* 3. Agent 状态卡片网格 */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Radio className="h-4 w-4 text-slate-600" />
              <h2
                className="text-base sm:text-lg font-semibold text-gray-900"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Agent 状态总览
              </h2>
            </div>
            {agents.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <AgentStatusCard key={agent.name} agent={agent} />
                ))}
              </div>
            ) : (
              <Card className="shadow-sm">
                <CardContent>
                  <EmptyState icon={Bot} text="暂无 Agent 状态数据" />
                </CardContent>
              </Card>
            )}
          </div>

          {/* 4 & 5. 性能图表：雷达图 + 柱状图 */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
            {/* 雷达图 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle
                  className="flex items-center gap-2 text-base"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  性能雷达图
                </CardTitle>
                <p className="text-xs text-gray-500">五维度对比各 Agent 综合表现</p>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <div className="h-64 sm:h-72 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarChartData} outerRadius="75%">
                        <PolarGrid />
                        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis tick={{ fontSize: 10 }} angle={30} domain={[0, 100]} />
                        {radarData.map((item, i) => (
                          <Radar
                            key={item.agent}
                            name={resolveName(item.agent)}
                            dataKey={item.agent}
                            stroke={AGENT_COLORS[i % AGENT_COLORS.length]}
                            fill={AGENT_COLORS[i % AGENT_COLORS.length]}
                            fillOpacity={0.15}
                          />
                        ))}
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon={TrendingUp} text="暂无性能数据" />
                )}
              </CardContent>
            </Card>

            {/* 柱状图（分组柱状） */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle
                  className="flex items-center gap-2 text-base"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  <ListChecks className="h-4 w-4 text-blue-500" />
                  性能指标对比
                </CardTitle>
                <p className="text-xs text-gray-500">任务数 · 平均响应时间(ms) · 质量评分</p>
              </CardHeader>
              <CardContent>
                {barChartData.length > 0 ? (
                  <div className="h-64 sm:h-72 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="task_count" name="任务数" fill="#3B82F6" minPointSize={3} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="avg_response_time_ms" name="平均响应(ms)" fill="#F59E0B" minPointSize={3} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="quality_score" name="质量评分" fill="#10B981" minPointSize={3} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon={ListChecks} text="暂无性能对比数据" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* 6. 最近任务时间线 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle
                className="flex items-center gap-2 text-base"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                <Activity className="h-4 w-4 text-green-500" />
                最近任务时间线
              </CardTitle>
              <p className="text-xs text-gray-500">展示最近 20 条任务分配与状态变更记录（持久化）</p>
            </CardHeader>
            <CardContent>
              {recentTasks.length > 0 ? (
                <div className="max-h-[320px] sm:max-h-[380px] md:max-h-[420px] overflow-y-auto pr-1 sm:pr-2">
                  {recentTasks.map((task, index) => (
                    <TaskTimelineItem
                      key={`${task.timestamp || ''}-${index}`}
                      task={task}
                      resolveName={resolveName}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Inbox} text="暂无最近任务记录" />
              )}
            </CardContent>
          </Card>

          {/* 7. 持久化执行历史记录（累计工作次数 + 可翻页明细） */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle
                    className="flex items-center gap-2 text-base"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    <History className="h-4 w-4 text-[#d4a853]" />
                    执行历史记录
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    累计 {historyTotal} 次执行记录（持久化，重启不丢失）
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={historyAgentFilter}
                    onChange={(e) => { setHistoryAgentFilter(e.target.value); setHistoryPage(1) }}
                    className="text-xs rounded-md border border-gray-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#d4a853]"
                  >
                    <option value="">全部 Agent</option>
                    {agents.map((a) => (
                      <option key={a.name} value={a.name}>{a.display_name || a.name}</option>
                    ))}
                  </select>
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => { setHistoryStatusFilter(e.target.value); setHistoryPage(1) }}
                    className="text-xs rounded-md border border-gray-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#d4a853]"
                  >
                    <option value="">全部状态</option>
                    <option value="success">成功</option>
                    <option value="failed">失败</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadHistory(historyPage)}
                    disabled={historyLoading}
                  >
                    {historyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyRecords.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="py-2 px-2 font-medium">Agent</th>
                          <th className="py-2 px-2 font-medium">任务类型</th>
                          <th className="py-2 px-2 font-medium">状态</th>
                          <th className="py-2 px-2 font-medium">耗时</th>
                          <th className="py-2 px-2 font-medium">时间</th>
                          <th className="py-2 px-2 font-medium">错误</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRecords.map((r) => (
                          <tr key={r.id} className="border-b border-gray-50 hover:bg-[#f5f2ee]/50">
                            <td className="py-2 px-2">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-base">{AGENT_ICON_MAP[r.agent_name] || '🔧'}</span>
                                <span className="text-xs text-gray-700">{resolveName(r.agent_name)}</span>
                              </span>
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-600 max-w-[180px] truncate" title={r.task_type || ''}>
                              {r.task_type || '-'}
                            </td>
                            <td className="py-2 px-2">
                              <Badge className={r.status === 'success'
                                ? 'bg-green-100 text-green-700 text-xs'
                                : 'bg-red-100 text-red-700 text-xs'}>
                                {r.status === 'success' ? '成功' : '失败'}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-600">
                              {r.duration_ms != null ? `${r.duration_ms}ms` : '-'}
                            </td>
                            <td className="py-2 px-2 text-xs text-gray-500 whitespace-nowrap">
                              {r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '-'}
                            </td>
                            <td className="py-2 px-2 text-xs text-red-500 max-w-[200px] truncate" title={r.error_message || ''}>
                              {r.error_message || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* 分页 */}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500">
                      第 {historyPage} / {historyTotalPages || 1} 页
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadHistory(historyPage - 1)}
                        disabled={historyLoading || historyPage <= 1}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadHistory(historyPage + 1)}
                        disabled={historyLoading || historyPage >= historyTotalPages}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState icon={History} text={historyLoading ? '加载中...' : '暂无执行历史记录'} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
