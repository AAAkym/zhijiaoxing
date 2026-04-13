/**
 * 路由配置
 * 
 * 使用React.lazy实现路由懒加载
 * 首屏组件常规导入，非首屏组件懒加载
 */
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// 首屏必要组件 - 常规导入
import LandingPage from '../components/LandingPage'
import LoginPage from '../components/LoginPage'

// 错误边界
import ErrorBoundary from '../components/ErrorBoundary'

// 懒加载工具
import { lazyLoadWithRetry, setupPreloadStrategy } from '../utils/lazyLoad'

// ==================== 懒加载组件定义 ====================

// 管理后台
const AdminDashboard = lazyLoadWithRetry(
  () => import('../components/AdminDashboard'),
  { retries: 3, retryDelay: 1000 }
)

const UserManagement = lazyLoadWithRetry(
  () => import('../components/UserManagement'),
  { retries: 3, retryDelay: 1000 }
)

const DataAnalytics = lazyLoadWithRetry(
  () => import('../components/DataAnalytics'),
  { retries: 3, retryDelay: 1000 }
)

const SystemSettings = lazyLoadWithRetry(
  () => import('../components/SystemSettings'),
  { retries: 3, retryDelay: 1000 }
)

// 教师模块
const TeacherDashboard = lazyLoadWithRetry(
  () => import('../components/TeacherDashboard'),
  { retries: 3, retryDelay: 1000 }
)

const CourseManagement = lazyLoadWithRetry(
  () => import('../components/CourseManagement'),
  { retries: 3, retryDelay: 1000 }
)

// 学生模块
const StudentDashboard = lazyLoadWithRetry(
  () => import('../components/StudentDashboard'),
  { retries: 3, retryDelay: 1000 }
)

// ==================== 加载状态组件 ====================

/**
 * 页面加载中组件
 */
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

/**
 * 路由加载错误组件
 */
function RouteErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 bg-amber-50">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-amber-100">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          
          <h2 className="mt-4 text-xl font-bold text-center text-amber-800">
            页面加载失败
          </h2>
          
          <p className="mt-2 text-center text-amber-600">
            网络连接不稳定，页面资源加载失败。请检查网络后重试。
          </p>
        </div>
        
        <div className="p-6 border-t border-gray-100">
          <div className="flex gap-3">
            <button
              onClick={resetErrorBoundary}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              重试
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== 路由守卫组件 ====================

/**
 * 受保护的路由包装器
 */
function ProtectedRoute({ children, allowedRoles, user }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

/**
 * 懒加载路由包装器
 */
function LazyRoute({ component: Component, ...props }) {
  return (
    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
      <Suspense fallback={<PageLoading />}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}

// ==================== 路由配置 ====================

/**
 * 应用路由组件
 */
export function AppRoutes({ user, onLogin, onLogout }) {
  // 设置预加载策略
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname
    setupPreloadStrategy(currentPath)
  }

  return (
    <Routes>
      {/* 公共路由 - 首屏加载 */}
      <Route path="/" element={<LandingPage />} />
      <Route 
        path="/login" 
        element={
          user ? (
            <Navigate to={getDashboardPath(user.role)} replace />
          ) : (
            <LoginPage onLogin={onLogin} />
          )
        } 
      />
      
      {/* 管理后台路由 - 懒加载 */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute user={user} allowedRoles={['admin']}>
            <LazyRoute component={AdminDashboard} user={user} onLogout={onLogout} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/users" 
        element={
          <ProtectedRoute user={user} allowedRoles={['admin']}>
            <LazyRoute component={UserManagement} user={user} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/analytics" 
        element={
          <ProtectedRoute user={user} allowedRoles={['admin']}>
            <LazyRoute component={DataAnalytics} user={user} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/settings" 
        element={
          <ProtectedRoute user={user} allowedRoles={['admin']}>
            <LazyRoute component={SystemSettings} user={user} />
          </ProtectedRoute>
        } 
      />
      
      {/* 教师路由 - 懒加载 */}
      <Route 
        path="/teacher" 
        element={
          <ProtectedRoute user={user} allowedRoles={['teacher']}>
            <LazyRoute component={TeacherDashboard} user={user} onLogout={onLogout} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/teacher/courses" 
        element={
          <ProtectedRoute user={user} allowedRoles={['teacher']}>
            <LazyRoute component={CourseManagement} user={user} />
          </ProtectedRoute>
        } 
      />
      
      {/* 学生路由 - 懒加载 */}
      <Route 
        path="/student" 
        element={
          <ProtectedRoute user={user} allowedRoles={['student']}>
            <LazyRoute component={StudentDashboard} user={user} onLogout={onLogout} />
          </ProtectedRoute>
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
  )
}

/**
 * 获取仪表板路径
 */
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

export default AppRoutes
