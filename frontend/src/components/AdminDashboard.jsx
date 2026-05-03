import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  BookOpen, 
  BarChart3, 
  Settings, 
  Activity,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Shield,
  Sparkles
} from 'lucide-react'
import { admin, auth } from '../services/api'
import UserManagement from './UserManagement'
import CourseManagement from './CourseManagement'
import DataAnalytics from './DataAnalytics'
import SystemSettings from './SystemSettings'
import AIContentReview from './AIContentReview'
import AIAnalysisDashboard from './AIAnalysisDashboard'
import { useNavigate } from 'react-router-dom'

export default function AdminDashboard({ user, onLogout }) {
  const navigate = useNavigate()
  const [currentView, setCurrentView] = useState('overview')
  const [stats, setStats] = useState({
    totalUsers: 0,
    teacherCount: 0,
    studentCount: 0,
    courseCount: 0,
    onlineUsers: 0,
    systemStatus: 'normal',
    pendingReviewCount: 0
  })

  const loadStats = async () => {
    try {
      const response = await admin.getDashboardStats()
      const s = response?.stats || {}
      setStats(prev => ({
        ...prev,
        totalUsers: s.total_users ?? prev.totalUsers,
        teacherCount: s.total_teachers ?? prev.teacherCount,
        studentCount: s.total_students ?? prev.studentCount,
        courseCount: s.total_courses ?? prev.courseCount,
        onlineUsers: s.today_active_users ?? prev.onlineUsers,
        pendingReviewCount: s.pending_review_count ?? prev.pendingReviewCount
      }))
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const menuItems = [
    { id: 'overview', label: '系统概览', icon: BarChart3 },
    { id: 'ai-review', label: 'AI内容审核', icon: Shield },
    { id: 'ai-analysis', label: 'AI智能分析', icon: Sparkles },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'courses', label: '课程管理', icon: BookOpen },
    { id: 'analytics', label: '数据分析', icon: BarChart3 },
    { id: 'settings', label: '系统设置', icon: Settings }
  ]

  const renderContent = () => {
    switch (currentView) {
      case 'ai-review':
        return <AIContentReview />
      case 'ai-analysis':
        return <AIAnalysisDashboard />
      case 'users':
        return <UserManagement />
      case 'courses':
        return <CourseManagement />
      case 'analytics':
        return <DataAnalytics />
      case 'settings':
        return <SystemSettings />
      default:
        return (
          <div className="space-y-6">
            {/* 系统概览标题 */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">系统概览</h2>
              <p className="text-gray-600">管理员管理功能快速入口</p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">总用户数</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                      <p className="text-xs text-gray-500">系统注册用户</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">教师数量</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.teacherCount}</p>
                      <p className="text-xs text-gray-500">活跃教师用户</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">学生数量</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.studentCount}</p>
                      <p className="text-xs text-gray-500">注册学生用户</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">课程总数</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.courseCount}</p>
                      <p className="text-xs text-gray-500">平台课程数量</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Activity className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">在线用户</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.onlineUsers}</p>
                      <p className="text-xs text-gray-500">当前在线</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">系统状态</p>
                      <p className="text-2xl font-bold text-green-600">正常</p>
                      <p className="text-xs text-gray-500">运行稳定</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 快速操作 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
              <p className="text-gray-600 mb-6">常用管理功能快速入口</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-amber-500" onClick={() => setCurrentView('ai-review')}>
                  <CardContent className="p-6 text-center">
                    <Shield className="h-12 w-12 text-amber-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">AI内容审核</h4>
                    <Badge className="mt-2 bg-amber-100 text-amber-700">{stats.pendingReviewCount} 待审核</Badge>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-purple-500" onClick={() => setCurrentView('ai-analysis')}>
                  <CardContent className="p-6 text-center">
                    <Sparkles className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">AI智能分析</h4>
                    <Badge className="mt-2 bg-purple-100 text-purple-700">决策支持</Badge>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('users')}>
                  <CardContent className="p-6 text-center">
                    <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">用户管理</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('courses')}>
                  <CardContent className="p-6 text-center">
                    <BookOpen className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">课程管理</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('analytics')}>
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">数据分析</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView('settings')}>
                  <CardContent className="p-6 text-center">
                    <Settings className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-gray-900">系统设置</h4>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 最近活动和系统警告 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>最近活动</CardTitle>
                  <p className="text-sm text-gray-600">系统最近的操作记录</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-sm text-gray-500">暂无活动记录</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>系统警告</CardTitle>
                  <p className="text-sm text-gray-600">需要关注的系统状态和警告</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-green-600">系统运行正常</h4>
                      <p className="text-sm text-gray-500">暂无需要处理的警告</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">管</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">管理控台</h1>
                  <p className="text-sm text-gray-600">欢迎回来，系统管理员</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-green-600 border-green-600">
                系统正常
              </Badge>
              <Button variant="outline" onClick={async () => {
                try {
                  await auth.logout()
                } catch (err) {
                  console.warn('后台登出请求失败:', err)
                }
                localStorage.removeItem('currentUser')
                if (typeof onLogout === 'function') onLogout()
                navigate('/login')
              }}>
                退出登录
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          {/* 侧边栏 */}
          <div className="w-64 mr-8">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      currentView === item.id
                        ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* 主内容区 */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}



