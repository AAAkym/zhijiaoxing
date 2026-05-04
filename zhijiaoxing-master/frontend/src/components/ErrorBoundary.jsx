import React from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

/**
 * 错误边界组件
 * 
 * 用于捕获React组件树中的JavaScript错误，防止整个应用崩溃
 * 特别适用于处理懒加载组件的加载失败情况
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isChunkError: false
    }
  }

  static getDerivedStateFromError(error) {
    // 检查是否是代码分割加载错误
    const isChunkError = error?.message?.includes('Loading chunk') || 
                        error?.message?.includes('Loading CSS chunk') ||
                        error?.name === 'ChunkLoadError'
    
    return { 
      hasError: true, 
      error,
      isChunkError
    }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    
    // 记录错误日志
    console.error('ErrorBoundary caught error:', error, errorInfo)
    
    // 可以在这里上报错误到监控服务
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    // 如果是代码分割错误，尝试重新加载
    if (this.state.isChunkError) {
      window.location.reload()
    } else {
      // 重置错误状态
      this.setState({ 
        hasError: false, 
        error: null, 
        errorInfo: null,
        isChunkError: false
      })
    }
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const { isChunkError, error } = this.state
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden">
            {/* 头部 */}
            <div className={`p-6 ${isChunkError ? 'bg-amber-50' : 'bg-red-50'}`}>
              <div className="flex items-center justify-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isChunkError ? 'bg-amber-100' : 'bg-red-100'
                }`}>
                  <AlertCircle className={`w-8 h-8 ${
                    isChunkError ? 'text-amber-600' : 'text-red-600'
                  }`} />
                </div>
              </div>
              
              <h2 className={`mt-4 text-xl font-bold text-center ${
                isChunkError ? 'text-amber-800' : 'text-red-800'
              }`}>
                {isChunkError ? '页面加载失败' : '应用发生错误'}
              </h2>
              
              <p className={`mt-2 text-center ${
                isChunkError ? 'text-amber-600' : 'text-red-600'
              }`}>
                {isChunkError 
                  ? '网络连接不稳定，页面资源加载失败。请检查网络后重试。'
                  : '组件渲染时出现未捕获的异常。'
                }
              </p>
            </div>
            
            {/* 错误详情（仅在开发环境显示） */}
            {process.env.NODE_ENV === 'development' && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                    查看错误详情
                  </summary>
                  <div className="mt-2 p-3 bg-white rounded border text-xs text-gray-700 overflow-auto max-h-40">
                    <p className="font-mono">{error?.toString()}</p>
                    {this.state.errorInfo && (
                      <pre className="mt-2 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              </div>
            )}
            
            {/* 操作按钮 */}
            <div className="p-6 border-t border-gray-100">
              <div className="flex gap-3">
                <button
                  onClick={this.handleRetry}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {isChunkError ? '刷新页面' : '重试'}
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  <Home className="w-4 h-4" />
                  返回首页
                </button>
              </div>
              
              {isChunkError && (
                <p className="mt-3 text-xs text-gray-500 text-center">
                  提示：如果问题持续存在，请检查网络连接或清除浏览器缓存
                </p>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 懒加载错误边界包装器
 * 
 * 专门用于包装懒加载组件，提供更好的错误处理
 */
export function LazyComponentBoundary({ children, fallback }) {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={fallback || <PageLoading />}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  )
}

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
