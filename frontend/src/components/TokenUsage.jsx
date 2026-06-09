import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import {
  Zap,
  Users,
  TrendingUp,
  Hash,
  GraduationCap,
  UserCog,
  ArrowUpDown,
} from 'lucide-react'
import { admin } from '../services/api'

const COLORS = {
  teacher: '#d4a853',
  student: '#5a9e6f',
  total: '#8b6fb0',
}

const ROLE_LABELS = {
  all: '全部用户',
  teacher: '教师',
  student: '学生',
}

const PERIOD_LABELS = {
  daily: '按天',
  weekly: '按周',
  monthly: '按月',
}

export default function TokenUsage() {
  const [role, setRole] = useState('all')
  const [period, setPeriod] = useState('daily')
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({
    total_tokens: 0,
    total_prompt_tokens: 0,
    total_completion_tokens: 0,
    call_count: 0,
    avg_tokens_per_call: 0,
    teacher_tokens: 0,
    student_tokens: 0,
  })
  const [trendData, setTrendData] = useState([])
  const [ranking, setRanking] = useState([])
  const [records, setRecords] = useState([])
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsPages, setRecordsPages] = useState(1)

  const buildParams = useCallback(() => {
    const params = {}
    if (role && role !== 'all') params.role = role
    if (days) params.days = days
    if (period) params.period = period
    return params
  }, [role, days, period])

  const loadSummary = useCallback(async () => {
    try {
      const params = buildParams()
      delete params.days
      delete params.period
      const res = await admin.getTokenUsageSummary(params)
      setSummary(res.summary || {})
    } catch (err) {
      console.error('加载Token汇总失败:', err)
    }
  }, [buildParams])

  const loadTrend = useCallback(async () => {
    try {
      const params = buildParams()
      const res = await admin.getTokenUsageTrend(params)
      const raw = res.trend || []
      const sanitized = raw.map((item) => ({
        ...item,
        date: typeof item.date === 'string' ? item.date : String(item.date ?? ''),
        teacher_tokens: Number(item.teacher_tokens) || 0,
        student_tokens: Number(item.student_tokens) || 0,
        total_tokens: Number(item.total_tokens) || 0,
      })).filter((item) => item.date)
      setTrendData(sanitized)
    } catch (err) {
      console.error('加载Token趋势失败:', err)
      setTrendData([])
    }
  }, [buildParams])

  const loadRanking = useCallback(async () => {
    try {
      const params = { limit: 10 }
      if (role && role !== 'all') params.role = role
      const res = await admin.getTokenUsageUserRanking(params)
      setRanking(res.ranking || [])
    } catch (err) {
      console.error('加载用户排名失败:', err)
    }
  }, [role])

  const loadRecords = useCallback(async () => {
    try {
      const params = { page: recordsPage, per_page: 10 }
      if (role && role !== 'all') params.role = role
      const res = await admin.getTokenUsageRecords(params)
      setRecords(res.records || [])
      setRecordsTotal(res.total || 0)
      setRecordsPages(res.pages || 1)
    } catch (err) {
      console.error('加载调用记录失败:', err)
    }
  }, [role, recordsPage])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadSummary(), loadTrend(), loadRanking(), loadRecords()]).finally(() => setLoading(false))
  }, [loadSummary, loadTrend, loadRanking, loadRecords])

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    if (dateStr.length === 7) return dateStr
    if (dateStr.length === 10) return dateStr.slice(5)
    return dateStr.slice(5, 10)
  }

  const getRoleBadge = (userRole) => {
    if (userRole === 'teacher') return <Badge className="bg-[#d4a85312] text-[#d4a853]">教师</Badge>
    if (userRole === 'student') return <Badge className="bg-[#5a9e6f12] text-[#5a9e6f]">学生</Badge>
    return <Badge className="bg-[#8b6fb012] text-[#8b6fb0]">{userRole || '未知'}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Token 用量统计</h2>
          <p className="text-[#6b6560]">监控AI接口的Token消耗情况，按用户类型和时间范围分析</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#6b6560]">用户类型</span>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部用户</SelectItem>
              <SelectItem value="teacher">教师</SelectItem>
              <SelectItem value="student">学生</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#6b6560]">时间范围</span>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近7天</SelectItem>
              <SelectItem value="30">近30天</SelectItem>
              <SelectItem value="90">近90天</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#6b6560]">聚合周期</span>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">按天</SelectItem>
              <SelectItem value="weekly">按周</SelectItem>
              <SelectItem value="monthly">按月</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-[#d4a853]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">总Token消耗</p>
                <p className="text-2xl font-bold text-[#2d2a26]">{formatNumber(summary.total_tokens)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Hash className="h-8 w-8 text-[#5a9e6f]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">调用次数</p>
                <p className="text-2xl font-bold text-[#2d2a26]">{formatNumber(summary.call_count)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-[#8b6fb0]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">次均消耗</p>
                <p className="text-2xl font-bold text-[#2d2a26]">{summary.avg_tokens_per_call}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <ArrowUpDown className="h-8 w-8 text-[#c47a3a]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">输入/输出比</p>
                <p className="text-2xl font-bold text-[#2d2a26]">
                  {summary.total_completion_tokens > 0
                    ? (summary.total_prompt_tokens / summary.total_completion_tokens).toFixed(1)
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserCog className="h-8 w-8 text-[#d4a853]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">教师Token消耗</p>
                <p className="text-2xl font-bold text-[#2d2a26]">{formatNumber(summary.teacher_tokens)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-[#5a9e6f]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">学生Token消耗</p>
                <p className="text-2xl font-bold text-[#2d2a26]">{formatNumber(summary.student_tokens)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-[#f0ece7]">
        <CardHeader>
          <CardTitle className="text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Token消耗趋势
          </CardTitle>
          <p className="text-sm text-[#6b6560]">{PERIOD_LABELS[period]}趋势 · 近{days}天</p>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece7" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: '#6b6560', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#6b6560', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #f0ece7',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [formatNumber(value), '']}
                />
                <Legend />
                {role !== 'student' && (
                  <Area
                    type="monotone"
                    dataKey="teacher_tokens"
                    name="教师Token"
                    stroke={COLORS.teacher}
                    fill={COLORS.teacher}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                )}
                {role !== 'teacher' && (
                  <Area
                    type="monotone"
                    dataKey="student_tokens"
                    name="学生Token"
                    stroke={COLORS.student}
                    fill={COLORS.student}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <TrendingUp className="h-16 w-16 text-[#e8e4df] mx-auto mb-4" />
                <p className="text-sm text-[#9a9590]">暂无趋势数据</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-xl border-[#f0ece7]">
          <CardHeader>
            <CardTitle className="text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              用户Token用量排名
            </CardTitle>
            <p className="text-sm text-[#6b6560]">Top 10 Token消耗用户</p>
          </CardHeader>
          <CardContent>
            {ranking.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ranking} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ece7" />
                  <XAxis type="number" tick={{ fill: '#6b6560', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="real_name"
                    tick={{ fill: '#6b6560', fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #f0ece7',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [formatNumber(value), 'Token']}
                  />
                  <Bar
                    dataKey="total_tokens"
                    name="Token消耗"
                    fill="#8b6fb0"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Users className="h-16 w-16 text-[#e8e4df] mx-auto mb-4" />
                  <p className="text-sm text-[#9a9590]">暂无排名数据</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#f0ece7]">
          <CardHeader>
            <CardTitle className="text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              用户排名列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length > 0 ? (
              <div className="space-y-3">
                {ranking.map((item, index) => (
                  <div
                    key={item.user_id || index}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#faf8f5] hover:bg-[#f5f2ee] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index < 3 ? 'bg-[#d4a853] text-white' : 'bg-[#e8e4df] text-[#6b6560]'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[#2d2a26]">
                          {item.real_name || item.username || `用户${item.user_id}`}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {getRoleBadge(item.user_role)}
                          <span className="text-xs text-[#9a9590]">{item.call_count}次调用</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#2d2a26]">{formatNumber(item.total_tokens)}</p>
                      <p className="text-xs text-[#9a9590]">均次 {item.avg_tokens_per_call}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Users className="h-16 w-16 text-[#e8e4df] mx-auto mb-4" />
                  <p className="text-sm text-[#9a9590]">暂无排名数据</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-[#f0ece7]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                调用明细记录
              </CardTitle>
              <p className="text-sm text-[#6b6560]">共 {recordsTotal} 条记录</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRecordsPage(p => Math.max(1, p - 1))}
                disabled={recordsPage <= 1}
                className="px-3 py-1 text-sm rounded-lg border border-[#e8e4df] hover:bg-[#f5f2ee] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="text-sm text-[#6b6560]">{recordsPage} / {recordsPages}</span>
              <button
                onClick={() => setRecordsPage(p => Math.min(recordsPages, p + 1))}
                disabled={recordsPage >= recordsPages}
                className="px-3 py-1 text-sm rounded-lg border border-[#e8e4df] hover:bg-[#f5f2ee] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0ece7]">
                    <th className="text-left py-3 px-2 text-[#6b6560] font-medium">用户</th>
                    <th className="text-left py-3 px-2 text-[#6b6560] font-medium">角色</th>
                    <th className="text-right py-3 px-2 text-[#6b6560] font-medium">输入Token</th>
                    <th className="text-right py-3 px-2 text-[#6b6560] font-medium">输出Token</th>
                    <th className="text-right py-3 px-2 text-[#6b6560] font-medium">总Token</th>
                    <th className="text-left py-3 px-2 text-[#6b6560] font-medium">调用类型</th>
                    <th className="text-left py-3 px-2 text-[#6b6560] font-medium">模型</th>
                    <th className="text-left py-3 px-2 text-[#6b6560] font-medium">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-[#f5f2ee] hover:bg-[#faf8f5]">
                      <td className="py-3 px-2 text-[#2d2a26]">
                        {record.real_name || record.username || '-'}
                      </td>
                      <td className="py-3 px-2">{getRoleBadge(record.user_role)}</td>
                      <td className="py-3 px-2 text-right text-[#2d2a26]">
                        {formatNumber(record.prompt_tokens)}
                      </td>
                      <td className="py-3 px-2 text-right text-[#2d2a26]">
                        {formatNumber(record.completion_tokens)}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-[#2d2a26]">
                        {formatNumber(record.total_tokens)}
                      </td>
                      <td className="py-3 px-2 text-[#6b6560]">
                        {record.call_type || '-'}
                      </td>
                      <td className="py-3 px-2 text-[#6b6560]">
                        {record.model || '-'}
                      </td>
                      <td className="py-3 px-2 text-[#9a9590]">
                        {record.created_at ? new Date(record.created_at).toLocaleString('zh-CN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Hash className="h-16 w-16 text-[#e8e4df] mx-auto mb-4" />
                <p className="text-sm text-[#9a9590]">暂无调用记录</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
