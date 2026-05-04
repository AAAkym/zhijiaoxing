import { useState, useEffect, Suspense, lazy } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

// 首屏必要组件 - 常规导入
import LandingPage from './components/LandingPage'
import LoginPage from './components/LoginPage'
import WelcomeGuide from './components/WelcomeGuide'


const AdminDashboard = lazy(() => import('./components/AdminDashboard'))
const TeacherDashboard = lazy(() => import('./components/TeacherDashboard'))
const StudentDashboard = lazy(() => import('./components/StudentDashboard'))
const CourseLearningPage = lazy(() => import('./components/CourseLearningPage'))
const UserManagement = lazy(() => import('./components/UserManagement'))
const CourseManagement = lazy(() => import('./components/CourseManagement'))
const DataAnalytics = lazy(() => import('./components/DataAnalytics'))
const SystemSettings = lazy(() => import('./components/SystemSettings'))


import { getCurrentUser } from './services/api'


function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 text-sm">页面加载中...</p>
      </div>
    </div>
  )
}

// 路由加载错误组件
function RouteErrorFallback({ error, resetError }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4 p-6 bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
          页面加载失败
        </h3>
        <p className="text-sm text-gray-500 text-center mb-4">
          加载页面时发生错误，请检查网络连接后重试
        </p>
        <div className="flex gap-3">
          <button
            onClick={resetError}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}

// 带错误处理的路由包装器
function LazyRoute({ component: Component, ...props }) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState(null)

  if (hasError) {
    return <RouteErrorFallback error={error} resetError={() => {
      setHasError(false)
      setError(null)
    }} />
  }

  return (
    <Component 
      {...props} 
      onError={(err) => {
        setHasError(true)
        setError(err)
      }}
    />
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // 优先尝试验证服务端会话
      try {
        const response = await getCurrentUser()
        if (response && response.user) {
          // 服务端验证成功
          setUser(response.user)
          localStorage.setItem('currentUser', JSON.stringify(response.user))
        } else {
          // 服务端返回异常，清除本地缓存
          localStorage.removeItem('currentUser')
          setUser(null)
        }
      } catch (sessionError) {
        // 服务端会话验证失败，清除本地缓存并登出
        console.warn('服务端会话验证失败，需要重新登录:', sessionError)
        localStorage.removeItem('currentUser')
        setUser(null)
      }
    } catch (error) {
      console.error('认证检查失败:', error)
      localStorage.removeItem('currentUser')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUser')
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* 公共路由 - 首屏加载 */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/welcome" element={<WelcomeGuide />} />
            <Route 
              path="/login" 
              element={
                user ? (
                  <Navigate to={getDashboardPath(user.role)} replace />
                ) : (
                  <LoginPage onLogin={handleLogin} />
                )
              } 
            />
            
            {/* 受保护的路由 - 懒加载 */}
            <Route 
              path="/admin" 
              element={
                user && user.role === 'admin' ? (
                  <LazyRoute component={AdminDashboard} user={user} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                user && user.role === 'admin' ? (
                  <LazyRoute component={UserManagement} user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                user && user.role === 'admin' ? (
                  <LazyRoute component={DataAnalytics} user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/admin/settings" 
              element={
                user && user.role === 'admin' ? (
                  <LazyRoute component={SystemSettings} user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/teacher" 
              element={
                user && user.role === 'teacher' ? (
                  <LazyRoute component={TeacherDashboard} user={user} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/teacher/courses" 
              element={
                user && user.role === 'teacher' ? (
                  <LazyRoute component={CourseManagement} user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/student" 
              element={
                user && user.role === 'student' ? (
                  <LazyRoute component={StudentDashboard} user={user} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              path="/student/course/:courseId" 
              element={
                user && user.role === 'student' ? (
                  <LazyRoute component={CourseLearningPage} user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* 默认重定向 */}
            <Route 
              path="*" 
              element={
                user ? (
                  <Navigate to={getDashboardPath(user.role)} replace />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
          </Routes>
        </Suspense>
      </div>
    </Router>
  )
}

function getDashboardPath(role) {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'teacher':
      return '/teacher'
    case 'student':
      return '/student'
    default:
      return '/'
  }
}

export default App
