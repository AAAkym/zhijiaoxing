import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Brain, FileText, AlertTriangle, TrendingUp, TrendingDown,
  Users, BookOpen, BarChart3, Bell, RefreshCw, Eye,
  ChevronRight, Zap, Shield, Target, Lightbulb,
  Activity, Clock, CheckCircle, XCircle, Sparkles,
  Sliders, Send
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { aiAnalysis } from '../services/api'

const RISK_COLORS = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' }
const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

const INSIGHT_TYPE_MAP = {
  churn_prediction: { label: '流失预测', icon: Users, color: 'text-red-600' },
  content_trend: { label: '内容趋势', icon: TrendingUp, color: 'text-blue-600' },
  teaching_attribution: { label: '教学归因', icon: Target, color: 'text-purple-600' },
  resource_optimization: { label: '资源优化', icon: Lightbulb, color: 'text-amber-600' },
}

const REPORT_TYPE_MAP = {
  weekly: { label: '周报', color: 'bg-blue-100 text-blue-700' },
  monthly: { label: '月报', color: 'bg-purple-100 text-purple-700' },
  quarterly: { label: '季报', color: 'bg-amber-100 text-amber-700' },
}

function StatCard({ title, value, subtitle, icon: Icon, color = 'text-blue-600', trend }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-gray-50`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className="flex items-center mt-2 text-xs">
            {trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500 mr-1" /> :
             trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-500 mr-1" /> :
             <Activity className="w-3 h-3 text-gray-400 mr-1" />}
            <span className={trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'}>
              {trend === 'up' ? '上升' : trend === 'down' ? '下降' : '持平'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InsightCard({ insight, onDismiss, onViewDetail }) {
  const config = INSIGHT_TYPE_MAP[insight.insight_type] || { label: insight.insight_type, icon: Brain, color: 'text-gray-600' }
  const Icon = config.icon
  const riskColor = RISK_COLORS[insight.risk_level] || '#6B7280'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-gray-50 mt-0.5">
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm text-gray-900 truncate">{insight.title}</h4>
                <Badge variant="outline" style={{ borderColor: riskColor, color: riskColor }} className="text-xs shrink-0">
                  {insight.risk_level === 'high' ? '高风险' : insight.risk_level === 'medium' ? '中风险' : '低风险'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{insight.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-400">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(insight.created_at).toLocaleDateString()}
                </span>
                <span className="text-xs text-gray-400">
                  置信度: {Math.round((insight.confidence || 0) * 100)}%
                </span>
                <span className="text-xs text-gray-400">
                  影响人数: {insight.affected_count || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onViewDetail(insight)}>
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400" onClick={() => onDismiss(insight.id)}>
              <XCircle className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ReportCard({ report, onViewDetail }) {
  const typeConfig = REPORT_TYPE_MAP[report.report_type] || { label: report.report_type, color: 'bg-gray-100 text-gray-700' }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewDetail(report)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
              <FileText className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="font-semibold text-sm text-gray-900 truncate">{report.title}</h4>
            <p className="text-xs text-gray-500 line-clamp-2 mt-1">{report.summary}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-gray-400">
                {new Date(report.period_start).toLocaleDateString()} ~ {new Date(report.period_end).toLocaleDateString()}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-2" />
        </div>
        {report.key_metrics && report.key_metrics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {report.key_metrics.slice(0, 4).map((m, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {m.name}: {m.value}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NotificationItem({ notification, onMarkRead }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${notification.is_read ? 'bg-white' : 'bg-blue-50'}`}>
      <div className="p-1.5 rounded-full bg-gray-100 mt-0.5">
        <Bell className="w-3.5 h-3.5 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{notification.content}</p>
        <span className="text-xs text-gray-400">{new Date(notification.created_at).toLocaleString()}</span>
      </div>
      {!notification.is_read && (
        <Button variant="ghost" size="sm" className="h-6 text-xs shrink-0" onClick={() => onMarkRead(notification.id)}>
          标记已读
        </Button>
      )}
    </div>
  )
}

function CustomAnalysisPanel() {
  const [dimensions, setDimensions] = useState(['users', 'courses'])
  const [timeRange, setTimeRange] = useState('7days')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const dimensionOptions = [
    { key: 'users', label: '用户维度' },
    { key: 'courses', label: '课程维度' },
    { key: 'learning', label: '学习维度' },
    { key: 'content', label: '内容维度' },
    { key: 'practice', label: '练习维度' },
  ]

  const toggleDimension = (key) => {
    setDimensions(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    )
  }

  const runAnalysis = async () => {
    setLoading(true)
    try {
      const data = await aiAnalysis.customAnalysis({ dimensions, time_range: timeRange })
      setResult(data)
    } catch (err) {
      console.error('Custom analysis error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            自定义分析参数
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">分析维度</p>
            <div className="flex flex-wrap gap-2">
              {dimensionOptions.map(opt => (
                <Badge
                  key={opt.key}
                  variant={dimensions.includes(opt.key) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleDimension(opt.key)}
                >
                  {opt.label}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">时间范围</p>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">最近7天</SelectItem>
                <SelectItem value="30days">最近30天</SelectItem>
                <SelectItem value="90days">最近90天</SelectItem>
                <SelectItem value="1year">最近1年</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runAnalysis} disabled={loading || dimensions.length === 0}>
            {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {loading ? '分析中...' : '执行分析'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">分析结果</CardTitle>
          </CardHeader>
          <CardContent>
            {result.metrics.users && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">用户维度</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-700">{result.metrics.users.total}</p>
                    <p className="text-xs text-gray-500">总用户</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">{result.metrics.users.new}</p>
                    <p className="text-xs text-gray-500">新增用户</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-lg font-bold text-purple-700">
                      {result.metrics.users.by_role ? Object.values(result.metrics.users.by_role).reduce((a, b) => a + b, 0) : 0}
                    </p>
                    <p className="text-xs text-gray-500">活跃用户</p>
                  </div>
                </div>
                {result.metrics.users.by_role && (
                  <div className="mt-3 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(result.metrics.users.by_role).map(([k, v]) => ({ name: k, value: Number(v) || 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B82F6" minPointSize={3} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
            {result.metrics.courses && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">课程维度</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-lg font-bold text-orange-700">{result.metrics.courses.total}</p>
                    <p className="text-xs text-gray-500">总课程</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">{result.metrics.courses.active}</p>
                    <p className="text-xs text-gray-500">活跃课程</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-700">{result.metrics.courses.new}</p>
                    <p className="text-xs text-gray-500">新增课程</p>
                  </div>
                </div>
              </div>
            )}
            {result.metrics.learning && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">学习维度</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-700">{result.metrics.learning.total_records}</p>
                    <p className="text-xs text-gray-500">总记录</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">{result.metrics.learning.recent_records}</p>
                    <p className="text-xs text-gray-500">近期记录</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-lg font-bold text-purple-700">{result.metrics.learning.avg_progress}%</p>
                    <p className="text-xs text-gray-500">平均进度</p>
                  </div>
                </div>
              </div>
            )}
            {result.metrics.content && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">内容维度</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-700">{result.metrics.content.total_content}</p>
                    <p className="text-xs text-gray-500">教学内容</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">{result.metrics.content.ai_content}</p>
                    <p className="text-xs text-gray-500">AI生成</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <p className="text-lg font-bold text-amber-700">{result.metrics.content.total_assessments}</p>
                    <p className="text-xs text-gray-500">考核题</p>
                  </div>
                </div>
              </div>
            )}
            {result.metrics.practice && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">练习维度</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-700">{result.metrics.practice.total}</p>
                    <p className="text-xs text-gray-500">总练习</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">{result.metrics.practice.recent}</p>
                    <p className="text-xs text-gray-500">近期练习</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ReportDetailDialog({ report, open, onOpenChange }) {
  if (!report) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {report.title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">核心摘要</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{report.summary}</p>
            </div>

            {report.key_metrics && report.key_metrics.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">关键指标</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.key_metrics.map(m => ({ ...m, value: Number(m.value) || 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3B82F6" minPointSize={3} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {report.anomalies && report.anomalies.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">异常数据</h3>
                <div className="space-y-2">
                  {report.anomalies.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800">{a.metric}</p>
                        <p className="text-xs text-red-600">{a.description}</p>
                        {a.suggestion && <p className="text-xs text-red-500 mt-1">建议: {a.suggestion}</p>}
                      </div>
                      <Badge variant="outline" style={{ borderColor: RISK_COLORS[a.severity], color: RISK_COLORS[a.severity] }} className="text-xs shrink-0">
                        {a.severity === 'high' ? '严重' : a.severity === 'medium' ? '中等' : '轻微'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.recommendations && report.recommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">优化建议</h3>
                <div className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800">{r.area}</p>
                        <p className="text-xs text-green-600">{r.action}</p>
                        {r.expected_impact && <p className="text-xs text-green-500 mt-1">预期影响: {r.expected_impact}</p>}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {r.priority === 'high' ? '高优先' : r.priority === 'medium' ? '中优先' : '低优先'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.detailed_analysis && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">详细分析</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{report.detailed_analysis}</p>
              </div>
            )}

            {report.roi_analysis && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">ROI分析</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{report.roi_analysis}</p>
              </div>
            )}

            {report.resource_optimization && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">资源优化方案</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{report.resource_optimization}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function InsightDetailDialog({ insight, open, onOpenChange }) {
  if (!insight) return null
  const metricsData = insight.metrics_data || {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {insight.title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge style={{ backgroundColor: RISK_COLORS[insight.risk_level], color: 'white' }}>
                {insight.risk_level === 'high' ? '高风险' : insight.risk_level === 'medium' ? '中风险' : '低风险'}
              </Badge>
              <span className="text-sm text-gray-500">置信度: {Math.round((insight.confidence || 0) * 100)}%</span>
              <span className="text-sm text-gray-500">影响人数: {insight.affected_count}</span>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">{insight.description}</p>

            {insight.insight_type === 'churn_prediction' && metricsData.risk_distribution && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">流失风险分布</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '高风险', value: Number(metricsData.risk_distribution.high) || 0, fill: RISK_COLORS.high },
                          { name: '中风险', value: Number(metricsData.risk_distribution.medium) || 0, fill: RISK_COLORS.medium },
                          { name: '低风险', value: Number(metricsData.risk_distribution.low) || 0, fill: RISK_COLORS.low },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                        dataKey="value" label
                      >
                        {[
                          { fill: RISK_COLORS.high },
                          { fill: RISK_COLORS.medium },
                          { fill: RISK_COLORS.low },
                        ].map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {insight.insight_type === 'content_trend' && metricsData.top_courses && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">热门课程排行</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metricsData.top_courses.slice(0, 8).map(d => ({ ...d, heat_score: Number(d.heat_score) || 0 }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="course_title" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="heat_score" fill="#3B82F6" name="热度" minPointSize={3} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {insight.insight_type === 'teaching_attribution' && metricsData.factors && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">教学效果归因权重</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={metricsData.factors.map(f => ({ name: f.name, weight: Math.round(f.weight * 100) }))}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis tick={{ fontSize: 10 }} />
                      <Radar name="影响权重" dataKey="weight" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {insight.insight_type === 'resource_optimization' && metricsData.top_roi_courses && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">课程ROI排行</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metricsData.top_roi_courses.slice(0, 8).map(d => ({ ...d, roi: Number(d.roi) || 0 }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="course_title" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="roi" fill="#10B981" name="ROI" minPointSize={3} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {insight.recommendations && insight.recommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">建议措施</h3>
                <div className="space-y-2">
                  {insight.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                      <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-blue-800">{r.action || r}</p>
                        {r.target && <p className="text-xs text-blue-500">目标: {r.target}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default function AIAnalysisDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [reports, setReports] = useState([])
  const [insights, setInsights] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportDetailOpen, setReportDetailOpen] = useState(false)
  const [selectedInsight, setSelectedInsight] = useState(null)
  const [insightDetailOpen, setInsightDetailOpen] = useState(false)

  const loadDashboard = useCallback(async () => {
    try {
      const data = await aiAnalysis.getDashboard()
      setDashboard(data)
    } catch (err) {
      console.error('Load dashboard error:', err)
    }
  }, [])

  const loadReports = useCallback(async () => {
    try {
      const data = await aiAnalysis.getReports()
      setReports(data.reports || [])
    } catch (err) {
      console.error('Load reports error:', err)
    }
  }, [])

  const loadInsights = useCallback(async () => {
    try {
      const data = await aiAnalysis.getInsights({ status: 'active' })
      setInsights(data.insights || [])
    } catch (err) {
      console.error('Load insights error:', err)
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    try {
      const data = await aiAnalysis.getNotifications({ unread_only: 'true' })
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('Load notifications error:', err)
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadDashboard(), loadReports(), loadInsights(), loadNotifications()])
    setLoading(false)
  }, [loadDashboard, loadReports, loadInsights, loadNotifications])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleGenerateReport = async (type) => {
    setGenerating(type)
    try {
      await aiAnalysis.generateReport(type)
      await loadReports()
      await loadDashboard()
    } catch (err) {
      console.error('Generate report error:', err)
    } finally {
      setGenerating(null)
    }
  }

  const handleGenerateInsight = async (type) => {
    setGenerating(type)
    try {
      await aiAnalysis.generateInsight(type)
      await loadInsights()
      await loadDashboard()
      await loadNotifications()
    } catch (err) {
      console.error('Generate insight error:', err)
    } finally {
      setGenerating(null)
    }
  }

  const handleViewReportDetail = async (report) => {
    try {
      if (report.detailed_analysis) {
        setSelectedReport(report)
      } else {
        const detail = await aiAnalysis.getReportDetail(report.id)
        setSelectedReport(detail)
      }
      setReportDetailOpen(true)
    } catch (err) {
      console.error('View report detail error:', err)
    }
  }

  const handleViewInsightDetail = (insight) => {
    setSelectedInsight(insight)
    setInsightDetailOpen(true)
  }

  const handleDismissInsight = async (insightId) => {
    try {
      await aiAnalysis.dismissInsight(insightId)
      setInsights(prev => prev.filter(i => i.id !== insightId))
    } catch (err) {
      console.error('Dismiss insight error:', err)
    }
  }

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await aiAnalysis.markNotificationRead(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (err) {
      console.error('Mark notification read error:', err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await aiAnalysis.markAllNotificationsRead()
      setNotifications([])
    } catch (err) {
      console.error('Mark all read error:', err)
    }
  }

  const churnData = dashboard?.churn_summary || {}
  const churnPieData = [
    { name: '高风险', value: Number(churnData.high) || 0, fill: RISK_COLORS.high },
    { name: '中风险', value: Number(churnData.medium) || 0, fill: RISK_COLORS.medium },
    { name: '低风险', value: Number(churnData.low) || 0, fill: RISK_COLORS.low },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            AI智能分析中心
          </h2>
          <p className="text-gray-500 text-sm mt-1">人工智能驱动的数据分析与决策支持</p>
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <Badge variant="destructive" className="cursor-pointer" onClick={handleMarkAllRead}>
              <Bell className="w-3 h-3 mr-1" />{notifications.length} 条未读
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="分析报告"
          value={dashboard?.total_reports || 0}
          subtitle={`本周新增 ${dashboard?.recent_reports || 0}`}
          icon={FileText}
          color="text-blue-600"
        />
        <StatCard
          title="活跃洞察"
          value={dashboard?.active_insights || 0}
          subtitle={`需关注 ${dashboard?.high_risk_insights || 0}`}
          icon={Brain}
          color="text-purple-600"
        />
        <StatCard
          title="风险预警"
          value={dashboard?.high_risk_insights || 0}
          subtitle="中高风险洞察"
          icon={AlertTriangle}
          color="text-red-600"
          trend={dashboard?.high_risk_insights > 0 ? 'down' : 'up'}
        />
        <StatCard
          title="未读通知"
          value={dashboard?.unread_notifications || 0}
          subtitle="系统推送消息"
          icon={Bell}
          color="text-amber-600"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="reports">分析报告</TabsTrigger>
          <TabsTrigger value="insights">智能洞察</TabsTrigger>
          <TabsTrigger value="notifications">通知中心</TabsTrigger>
          <TabsTrigger value="custom">自定义分析</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  用户流失风险分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {churnPieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={churnPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                          {churnPieData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400">
                    <div className="text-center">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                      <p className="text-sm">暂无流失风险用户</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    最新洞察
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('insights')}>
                    查看全部 <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {dashboard?.latest_insights?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.latest_insights.map(insight => (
                      <div key={insight.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => handleViewInsightDetail(insight)}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RISK_COLORS[insight.risk_level] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{insight.title}</p>
                          <p className="text-xs text-gray-500 truncate">{insight.description}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {INSIGHT_TYPE_MAP[insight.insight_type]?.label || insight.insight_type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400">
                    <p className="text-sm">暂无洞察数据，请先生成洞察</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                快速生成
              </CardTitle>
              <CardDescription>一键生成AI分析报告和智能洞察</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { type: 'weekly', label: '生成周报', icon: FileText, color: 'bg-blue-500 hover:bg-blue-600' },
                  { type: 'monthly', label: '生成月报', icon: BarChart3, color: 'bg-purple-500 hover:bg-purple-600' },
                  { type: 'quarterly', label: '生成季报', icon: Target, color: 'bg-amber-500 hover:bg-amber-600' },
                  { type: 'churn_prediction', label: '流失预测', icon: Users, color: 'bg-red-500 hover:bg-red-600' },
                ].map(item => (
                  <Button
                    key={item.type}
                    className={`${item.color} text-white`}
                    onClick={() => ['weekly', 'monthly', 'quarterly'].includes(item.type) ? handleGenerateReport(item.type) : handleGenerateInsight(item.type)}
                    disabled={generating === item.type}
                  >
                    {generating === item.type ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <item.icon className="w-4 h-4 mr-2" />
                    )}
                    {item.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">分析报告</h3>
            <div className="flex items-center gap-2">
              {['weekly', 'monthly', 'quarterly'].map(type => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateReport(type)}
                  disabled={generating === type}
                >
                  {generating === type ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : null}
                  {REPORT_TYPE_MAP[type].label}
                </Button>
              ))}
            </div>
          </div>

          {reports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map(report => (
                <ReportCard key={report.id} report={report} onViewDetail={handleViewReportDetail} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center text-gray-400">
                  <FileText className="w-16 h-16 mx-auto mb-4" />
                  <p>暂无分析报告</p>
                  <p className="text-sm mt-1">点击上方按钮生成您的第一份报告</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">智能洞察</h3>
            <div className="flex items-center gap-2">
              {Object.entries(INSIGHT_TYPE_MAP).map(([type, config]) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateInsight(type)}
                  disabled={generating === type}
                >
                  {generating === type ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <config.icon className="w-3 h-3 mr-1" />}
                  {config.label}
                </Button>
              ))}
            </div>
          </div>

          {insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map(insight => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onDismiss={handleDismissInsight}
                  onViewDetail={handleViewInsightDetail}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center text-gray-400">
                  <Brain className="w-16 h-16 mx-auto mb-4" />
                  <p>暂无智能洞察</p>
                  <p className="text-sm mt-1">点击上方按钮生成洞察分析</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">通知中心</h3>
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                全部标记已读
              </Button>
            )}
          </div>

          {notifications.length > 0 ? (
            <Card>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {notifications.map(n => (
                    <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkNotificationRead} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center text-gray-400">
                  <Bell className="w-16 h-16 mx-auto mb-4" />
                  <p>暂无未读通知</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          <CustomAnalysisPanel />
        </TabsContent>
      </Tabs>

      <ReportDetailDialog
        report={selectedReport}
        open={reportDetailOpen}
        onOpenChange={setReportDetailOpen}
      />

      <InsightDetailDialog
        insight={selectedInsight}
        open={insightDetailOpen}
        onOpenChange={setInsightDetailOpen}
      />
    </div>
  )
}
