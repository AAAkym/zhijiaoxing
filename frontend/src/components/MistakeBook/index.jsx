import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BookOpen,
  ListTodo,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Play,
  GraduationCap
} from 'lucide-react'
import { mistakeBook } from '@/services/api'
import MistakeList from './MistakeList'
import MistakeDetail from './MistakeDetail'
import MistakeStats from './MistakeStats'
import MistakeReview from './MistakeReview'

export default function MistakeBook({ myCourses = [] }) {
  const [currentView, setCurrentView] = useState('list')
  const [mistakes, setMistakes] = useState([])
  const [selectedMistake, setSelectedMistake] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [filters, setFilters] = useState({
    course_id: '',
    mastery_status: '',
    page: 1,
    per_page: 10
  })
  
  const [pagination, setPagination] = useState({
    total: 0,
    total_pages: 0
  })

  // 修复：使用 JSON.stringify 序列化 filters 作为依赖，避免对象引用变化导致无限循环
  // 原问题：filters 是对象，每次 setState 创建新引用，导致 useCallback 依赖变化 -> useEffect 无限循环
  const filtersKey = JSON.stringify({ course_id: filters.course_id, mastery_status: filters.mastery_status, page: filters.page, per_page: filters.per_page })

  const fetchMistakes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (filters.course_id) params.course_id = filters.course_id
      if (filters.mastery_status) params.mastery_status = filters.mastery_status
      params.page = filters.page
      params.per_page = filters.per_page
      
      const response = await mistakeBook.getMistakes(params)
      setMistakes(response.mistakes || [])
      setPagination({
        total: response.total || 0,
        total_pages: response.total_pages || 0
      })
    } catch (err) {
      console.error('获取错题列表失败:', err)
      setError('加载错题列表失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [filtersKey]) // 使用序列化后的字符串作为依赖，避免无限循环

  // 修复：fetchStats 也使用序列化依赖，避免不必要的重复请求
  const statsFilterKey = JSON.stringify({ course_id: filters.course_id })

  const fetchStats = useCallback(async () => {
    try {
      const params = {}
      if (filters.course_id) params.course_id = filters.course_id
      const response = await mistakeBook.getStats(params)
      setStats(response)
    } catch (err) {
      console.error('获取错题统计失败:', err)
      // 修复：统计加载失败时不阻断主流程，静默处理即可
    }
  }, [statsFilterKey, filters.course_id])

  useEffect(() => {
    fetchMistakes()
    fetchStats()
  }, [fetchMistakes, fetchStats])

  // 修复：增加错误状态提示，让用户知道详情加载失败
  const [detailError, setDetailError] = useState(null)

  const handleSelectMistake = async (mistake) => {
    setDetailError(null)
    try {
      const response = await mistakeBook.getMistake(mistake.id)
      setSelectedMistake(response.mistake)
      setCurrentView('detail')
    } catch (err) {
      console.error('获取错题详情失败:', err)
      setDetailError('加载错题详情失败，请稍后重试')
      // 可选：使用 toast 或其他方式通知用户
      alert('加载错题详情失败，请检查网络连接后重试')
    }
  }

  const handleUpdateStatus = async (mistakeId, newStatus, noteId = null) => {
    try {
      await mistakeBook.updateStatus(mistakeId, newStatus, noteId)
      fetchMistakes()
      fetchStats()
      if (selectedMistake && selectedMistake.id === mistakeId) {
        setSelectedMistake(prev => ({
          ...prev,
          mastery_status: newStatus
        }))
      }
    } catch (err) {
      console.error('更新状态失败:', err)
      throw err
    }
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedMistake(null)
  }

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1
    }))
  }

  const handleRefresh = () => {
    fetchMistakes()
    fetchStats()
  }

  if (currentView === 'review') {
    return (
      <MistakeReview
        myCourses={myCourses}
        onBack={() => setCurrentView('list')}
      />
    )
  }

  if (currentView === 'detail' && selectedMistake) {
    return (
      <MistakeDetail
        mistake={selectedMistake}
        onBack={handleBackToList}
        onUpdateStatus={handleUpdateStatus}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">错题本</h2>
          <p className="text-gray-600">管理你的错题，针对性复习</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            onClick={() => setCurrentView('review')}
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            开始复习
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-red-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">总错题</p>
                  <p className="text-xl font-bold">{stats.stats?.total_mistakes || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">未掌握</p>
                  <p className="text-xl font-bold">{stats.stats?.by_status?.unmastered || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">复习中</p>
                  <p className="text-xl font-bold">{stats.stats?.by_status?.reviewing || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600">已掌握</p>
                  <p className="text-xl font-bold">{stats.stats?.by_status?.mastered || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list">错题列表</TabsTrigger>
          <TabsTrigger value="stats">统计分析</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="mt-4">
          {error && (
            <Card className="border-red-200 bg-red-50 mb-4">
              <CardContent className="p-4 flex items-center text-red-700">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </CardContent>
            </Card>
          )}
          
          <MistakeList
            mistakes={mistakes}
            loading={loading}
            myCourses={myCourses}
            filters={filters}
            pagination={pagination}
            onSelectMistake={handleSelectMistake}
            onFilterChange={handleFilterChange}
            onUpdateStatus={handleUpdateStatus}
          />
        </TabsContent>
        
        <TabsContent value="stats" className="mt-4">
          <MistakeStats stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
