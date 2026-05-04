import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  FileSearch, 
  Star, 
  GitCompare, 
  BarChart3, 
  History,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react'
import ContentReviewList from './ContentReviewList'
import QualityScoring from './QualityScoring'
import VersionCompare from './VersionCompare'
import ReviewMechanism from './ReviewMechanism'
import ReviewDataAnalytics from './ReviewDataAnalytics'
import OperationLog from './OperationLog'

export default function AIContentReview() {
  const [activeTab, setActiveTab] = useState('pending')
  const [stats, setStats] = useState({
    pending: 24,
    autoReviewing: 8,
    manualReviewing: 12,
    spotChecking: 4,
    passed: 156,
    rejected: 23,
    todayReviewed: 45
  })
  const [loading, setLoading] = useState(false)

  const loadStats = async () => {
    setLoading(true)
    try {
      // API调用将在这里实现
      // const response = await admin.getReviewStats()
      // setStats(response.stats)
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleRefresh = () => {
    loadStats()
  }

  const handleExportData = () => {
    // 导出数据功能
    console.log('导出审核数据...')
  }

  return (
    <div className="space-y-6">
      {/* 页面标题区 */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 shadow-xl">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Shield className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">AI内容审核中心</h2>
            </div>
            <p className="text-slate-400 text-sm">三重审核机制 · 智能内容筛查 · 质量评分系统</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600 mb-1">待审核</p>
                <p className="text-2xl font-bold text-blue-700">{stats.pending}</p>
              </div>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-600 mb-1">自动审核中</p>
                <p className="text-2xl font-bold text-purple-700">{stats.autoReviewing}</p>
              </div>
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <RefreshCw className="h-5 w-5 text-purple-600 animate-spin" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-orange-600 mb-1">人工审核中</p>
                <p className="text-2xl font-bold text-orange-700">{stats.manualReviewing}</p>
              </div>
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <FileSearch className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-cyan-600 mb-1">抽查审核</p>
                <p className="text-2xl font-bold text-cyan-700">{stats.spotChecking}</p>
              </div>
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Filter className="h-5 w-5 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-600 mb-1">已通过</p>
                <p className="text-2xl font-bold text-green-700">{stats.passed}</p>
              </div>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-red-600 mb-1">已拒绝</p>
                <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
              </div>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 mb-1">今日审核</p>
                <p className="text-2xl font-bold text-amber-700">{stats.todayReviewed}</p>
              </div>
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <History className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主功能区 - 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-1">
          <TabsList className="grid w-full grid-cols-6 gap-1">
            <TabsTrigger 
              value="pending" 
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <FileSearch className="h-4 w-4 mr-2" />
              待审核列表
            </TabsTrigger>
            <TabsTrigger 
              value="scoring"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <Star className="h-4 w-4 mr-2" />
              质量评分
            </TabsTrigger>
            <TabsTrigger 
              value="compare"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <GitCompare className="h-4 w-4 mr-2" />
              版本对比
            </TabsTrigger>
            <TabsTrigger 
              value="mechanism"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <Shield className="h-4 w-4 mr-2" />
              审核机制
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              数据分析
            </TabsTrigger>
            <TabsTrigger 
              value="logs"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              <History className="h-4 w-4 mr-2" />
              操作日志
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="mt-0">
          <ContentReviewList />
        </TabsContent>

        <TabsContent value="scoring" className="mt-0">
          <QualityScoring />
        </TabsContent>

        <TabsContent value="compare" className="mt-0">
          <VersionCompare />
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
