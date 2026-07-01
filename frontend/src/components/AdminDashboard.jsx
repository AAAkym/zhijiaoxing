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
  Sparkles,
  Zap,
  Bot
} from 'lucide-react'
import { admin, auth } from '../services/api'
import UserManagement from './UserManagement'
import CourseManagement from './CourseManagement'
import DataAnalytics from './DataAnalytics'
import SystemSettings from './SystemSettings'
import AIContentReview from './AIContentReview'
import AIAnalysisDashboard from './AIAnalysisDashboard'
import TokenUsage from './TokenUsage'
import AgentMonitorCenter from './AgentMonitorCenter'
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
    { id: 'agent-monitor', label: '智能体监控', icon: Bot },
    { id: 'ai-review', label: 'AI内容审核', icon: Shield },
    { id: 'ai-analysis', label: 'AI智能分析', icon: Sparkles },
    { id: 'token-usage', label: 'Token用量', icon: Zap },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'courses', label: '课程管理', icon: BookOpen },
    { id: 'analytics', label: '数据分析', icon: BarChart3 },
    { id: 'settings', label: '系统设置', icon: Settings }
  ]

  const renderContent = () => {
    switch (currentView) {
      case 'agent-monitor':
        return <AgentMonitorCenter />
      case 'ai-review':
        return <AIContentReview />
      case 'ai-analysis':
        return <AIAnalysisDashboard />
      case 'token-usage':
        return <TokenUsage />
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
            <div>
              <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>系统概览</h2>
              <p className="text-[#6b6560]">管理员管理功能快速入口</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="rounded-xl border-[#f0ece7]">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-[#d4a853]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">总用户数</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.totalUsers}</p>
                      <p className="text-xs text-[#9a9590]">系统注册用户</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-[#f0ece7]">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-[#5a9e6f]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">教师数量</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.teacherCount}</p>
                      <p className="text-xs text-[#9a9590]">活跃教师用户</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-[#f0ece7]">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-[#8b6fb0]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">学生数量</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.studentCount}</p>
                      <p className="text-xs text-[#9a9590]">注册学生用户</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-[#f0ece7]">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-[#c47a3a]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">课程总数</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.courseCount}</p>
                      <p className="text-xs text-[#9a9590]">平台课程数量</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-[#f0ece7]">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Activity className="h-8 w-8 text-[#c45a5a]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">在线用户</p>
                      <p className="text-2xl font-bold text-[#2d2a26]">{stats.onlineUsers}</p>
                      <p className="text-xs text-[#9a9590]">当前在线</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-[#f0ece7]">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-[#5a9e6f]" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-[#6b6560]">系统状态</p>
                      <p className="text-2xl font-bold text-[#5a9e6f]">正常</p>
                      <p className="text-xs text-[#9a9590]">运行稳定</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#2d2a26] mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>快速操作</h3>
              <p className="text-[#6b6560] mb-6">常用管理功能快速入口</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-[#d4a853] rounded-xl border-[#f0ece7]" onClick={() => setCurrentView('ai-review')}>
                  <CardContent className="p-6 text-center">
                    <Shield className="h-12 w-12 text-[#d4a853] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">AI内容审核</h4>
                    <Badge className="mt-2 bg-[#d4a85312] text-[#d4a853]">{stats.pendingReviewCount} 待审核</Badge>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-[#8b6fb0] rounded-xl border-[#f0ece7]" onClick={() => setCurrentView('ai-analysis')}>
                  <CardContent className="p-6 text-center">
                    <Sparkles className="h-12 w-12 text-[#8b6fb0] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">AI智能分析</h4>
                    <Badge className="mt-2 bg-[#8b6fb012] text-[#8b6fb0]">决策支持</Badge>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-[#c47a3a] rounded-xl border-[#f0ece7]" onClick={() => setCurrentView('token-usage')}>
                  <CardContent className="p-6 text-center">
                    <Zap className="h-12 w-12 text-[#c47a3a] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">Token用量</h4>
                    <Badge className="mt-2 bg-[#c47a3a12] text-[#c47a3a]">消耗统计</Badge>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl border-[#f0ece7]" onClick={() => setCurrentView('users')}>
                  <CardContent className="p-6 text-center">
                    <Users className="h-12 w-12 text-[#d4a853] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">用户管理</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl border-[#f0ece7]" onClick={() => setCurrentView('courses')}>
                  <CardContent className="p-6 text-center">
                    <BookOpen className="h-12 w-12 text-[#c47a3a] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">课程管理</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl border-[#f0ece7]" onClick={() => setCurrentView('analytics')}>
                  <CardContent className="p-6 text-center">
                    <BarChart3 className="h-12 w-12 text-[#5a9e6f] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">数据分析</h4>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow rounded-xl border-[#f0ece7]" onClick={() => setCurrentView('settings')}>
                  <CardContent className="p-6 text-center">
                    <Settings className="h-12 w-12 text-[#8b6fb0] mx-auto mb-4" />
                    <h4 className="font-semibold text-[#2d2a26]">系统设置</h4>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-xl border-[#f0ece7]">
                <CardHeader>
                  <CardTitle className="text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>最近活动</CardTitle>
                  <p className="text-sm text-[#6b6560]">系统最近的操作记录</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Activity className="h-16 w-16 text-[#e8e4df] mx-auto mb-4" />
                      <p className="text-sm text-[#9a9590]">暂无活动记录</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-[#f0ece7]">
                <CardHeader>
                  <CardTitle className="text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>系统警告</CardTitle>
                  <p className="text-sm text-[#6b6560]">需要关注的系统状态和警告</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <CheckCircle className="h-16 w-16 text-[#5a9e6f] mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-[#5a9e6f]">系统运行正常</h4>
                      <p className="text-sm text-[#9a9590]">暂无需要处理的警告</p>
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
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="bg-white shadow-sm border-b border-[#e8e4df]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#d4a853] rounded-[10px] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="white" opacity="0.9"/>
                    <path d="M6 4V18L12 15L18 18V4" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>智教星</h1>
                  <p className="text-xs text-[#9a9590]">智教星——自适应错题诊疗系统</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-[#5a9e6f] border-[#5a9e6f]">
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
          <div className="w-64 mr-8">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-[10px] text-left transition-colors ${
                      currentView === item.id
                        ? 'bg-[#d4a85312] text-[#d4a853] border-l-4 border-[#d4a853]'
                        : 'text-[#6b6560] hover:bg-[#f5f2ee]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
