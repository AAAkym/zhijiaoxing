import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  FileSearch, 
  BarChart3, 
  History,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Radio
} from 'lucide-react'
import { contentReview } from '@/services/api'
import ContentReviewList from './ContentReviewList'
import ReviewMechanism from './ReviewMechanism'
import ReviewDataAnalytics from './ReviewDataAnalytics'
import OperationLog from './OperationLog'

// 默认空统计数据，仅用于初始化；真实数据由 loadStats 从 API 拉取
const DEFAULT_STATS = {
  pending: 0,
  auto_reviewing: 0,
  manual_reviewing: 0,
  spot_checking: 0,
  passed: 0,
  rejected: 0,
  today_reviewed: 0
}

export default function AIContentReview() {
  const [activeTab, setActiveTab] = useState('pending')
  const [stats, setStats] = useState(DEFAULT_STATS)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await contentReview.getReviewStats()
      if (response.success) {
        const apiData = response.data || {}
        // 直接使用 API 真实数据，缺失字段以 0 兜底
        setStats({
          pending: apiData.pending || 0,
          auto_reviewing: apiData.auto_reviewing || 0,
          manual_reviewing: apiData.manual_reviewing || 0,
          spot_checking: apiData.spot_checking || 0,
          passed: apiData.passed || 0,
          rejected: apiData.rejected || 0,
          today_reviewed: apiData.today_reviewed || 0,
        })
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // 自动刷新统计（每30秒）
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      loadStats(true)
    }, 30000)
    return () => clearInterval(timer)
  }, [autoRefresh, loadStats])

  const handleRefresh = () => {
    loadStats()
  }

  const handleExportData = () => {
    console.log('导出审核数据...')
  }

  const statCards = [
    { key: 'pending', label: '待审核', icon: Clock, gradient: 'from-blue-50 to-blue-100/50', border: 'border-blue-200', text: 'text-blue-600', valueText: 'text-blue-700', iconBg: 'bg-blue-500/20' },
    { key: 'auto_reviewing', label: '自动审核中', icon: RefreshCw, gradient: 'from-purple-50 to-purple-100/50', border: 'border-purple-200', text: 'text-purple-600', valueText: 'text-purple-700', iconBg: 'bg-purple-500/20' },
    { key: 'manual_reviewing', label: '人工审核中', icon: FileSearch, gradient: 'from-orange-50 to-orange-100/50', border: 'border-orange-200', text: 'text-orange-600', valueText: 'text-orange-700', iconBg: 'bg-orange-500/20' },
    { key: 'spot_checking', label: '抽查审核', icon: Filter, gradient: 'from-cyan-50 to-cyan-100/50', border: 'border-cyan-200', text: 'text-cyan-600', valueText: 'text-cyan-700', iconBg: 'bg-cyan-500/20' },
    { key: 'passed', label: '已通过', icon: CheckCircle, gradient: 'from-green-50 to-green-100/50', border: 'border-green-200', text: 'text-green-600', valueText: 'text-green-700', iconBg: 'bg-green-500/20' },
    { key: 'rejected', label: '已拒绝', icon: AlertTriangle, gradient: 'from-red-50 to-red-100/50', border: 'border-red-200', text: 'text-red-600', valueText: 'text-red-700', iconBg: 'bg-red-500/20' },
    { key: 'today_reviewed', label: '今日审核', icon: History, gradient: 'from-amber-50 to-amber-100/50', border: 'border-amber-200', text: 'text-amber-600', valueText: 'text-amber-700', iconBg: 'bg-amber-500/20' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
      {/* 页面标题区 */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">AI内容审核中心</h2>
            </div>
            <p className="text-slate-400 text-sm">三重审核机制 · 智能内容筛查 · 质量评分系统</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setAutoRefresh(v => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors ${
                autoRefresh
                  ? 'bg-green-900/50 text-green-400 ring-green-700'
                  : 'bg-slate-800 text-slate-500 ring-slate-700 hover:bg-slate-700'
              }`}
            >
              <Radio className={`h-3 w-3 ${autoRefresh ? 'animate-pulse text-green-400' : ''}`} />
              {autoRefresh ? '自动同步' : '已暂停'}
            </button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </Button>
            <Button 
              size="sm"
              onClick={handleExportData}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium"
            >
              <Download className="h-4 w-4 mr-2" />
              导出报告
            </Button>
          </div>
        </div>
      </div>

      {/* 统计概览卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map(card => {
          const Icon = card.icon
          return (
            <Card key={card.key} className={`bg-gradient-to-br ${card.gradient} ${card.border} hover:shadow-lg transition-all duration-300`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-medium ${card.text} mb-1`}>{card.label}</p>
                    <p className={`text-xl sm:text-2xl font-bold ${card.valueText}`}>{stats[card.key]}</p>
                  </div>
                  <div className={`p-1.5 sm:p-2 ${card.iconBg} rounded-lg`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.text}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 主功能区 - 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <div className="bg-white rounded-lg shadow-sm border p-1">
          <TabsList className="grid w-full grid-cols-4 gap-1">
            <TabsTrigger 
              value="pending" 
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <FileSearch className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">待审核列表</span>
              <span className="sm:hidden">待审核</span>
            </TabsTrigger>
            <TabsTrigger 
              value="mechanism"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <Shield className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">审核机制</span>
              <span className="sm:hidden">机制</span>
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">数据分析</span>
              <span className="sm:hidden">分析</span>
            </TabsTrigger>
            <TabsTrigger 
              value="logs"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <History className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">操作日志</span>
              <span className="sm:hidden">日志</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="mt-0">
          <ContentReviewList onStatsChange={loadStats} />
        </TabsContent>

        <TabsContent value="mechanism" className="mt-0">
          <ReviewMechanism />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <ReviewDataAnalytics />
        </TabsContent>

        <TabsContent value="logs" className="mt-0">
          <OperationLog />
        </TabsContent>
      </Tabs>
    </div>
  )
}
