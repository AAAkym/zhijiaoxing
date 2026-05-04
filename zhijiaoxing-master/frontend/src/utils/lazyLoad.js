/**
 * 懒加载工具函数
 * 
 * 提供路由懒加载的辅助功能
 */
import { lazy } from 'react'

/**
 * 延迟加载组件
 * 
 * @param {Function} importFunc - 动态导入函数
 * @param {Object} options - 配置选项
 * @param {number} options.delay - 最小延迟时间（毫秒），用于展示加载状态
 * @returns {React.LazyExoticComponent} 懒加载组件
 */
export function lazyLoad(importFunc, options = {}) {
  const { delay = 0 } = options

  return lazy(async () => {
    // 如果有延迟要求，同时执行导入和延迟
    if (delay > 0) {
      const [module] = await Promise.all([
        importFunc(),
        new Promise(resolve => setTimeout(resolve, delay))
      ])
      return module
    }

    // 直接导入
    return importFunc()
  })
}

/**
 * 带重试机制的懒加载
 * 
 * 当组件加载失败时自动重试
 * 
 * @param {Function} importFunc - 动态导入函数
 * @param {Object} options - 配置选项
 * @param {number} options.retries - 重试次数（默认3次）
 * @param {number} options.retryDelay - 重试延迟（默认1000ms）
 * @returns {React.LazyExoticComponent} 懒加载组件
 */
export function lazyLoadWithRetry(importFunc, options = {}) {
  const { retries = 3, retryDelay = 1000 } = options

  const loadComponent = async (remainingRetries) => {
    try {
      const module = await importFunc()
      return module
    } catch (error) {
      // 检查是否是代码分割加载错误
      const isChunkError = error?.message?.includes('Loading chunk') || 
                          error?.name === 'ChunkLoadError'

      if (isChunkError && remainingRetries > 0) {
        console.warn(`组件加载失败，${remainingRetries}秒后重试...`)
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return loadComponent(remainingRetries - 1)
      }

      // 重试次数用尽，抛出错误
      throw error
    }
  }

  return lazy(() => loadComponent(retries))
}

/**
 * 预加载组件
 * 
 * 用于预加载可能会访问的组件
 * 
 * @param {Function} importFunc - 动态导入函数
 */
export function preloadComponent(importFunc) {
  // 使用 requestIdleCallback 在浏览器空闲时预加载
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      importFunc()
    })
  } else {
    // 降级方案：使用 setTimeout
    setTimeout(() => {
      importFunc()
    }, 2000)
  }
}

/**
 * 路由组件懒加载配置
 */
export const lazyRoutes = {
  // 管理后台
  AdminDashboard: lazyLoadWithRetry(
    () => import('../components/AdminDashboard'),
    { retries: 3, retryDelay: 1000 }
  ),
  
  // 用户管理
  UserManagement: lazyLoadWithRetry(
    () => import('../components/UserManagement'),
    { retries: 3, retryDelay: 1000 }
  ),
  
  // 数据分析
  DataAnalytics: lazyLoadWithRetry(
    () => import('../components/DataAnalytics'),
    { retries: 3, retryDelay: 1000 }
  ),
  
  // 系统设置
  SystemSettings: lazyLoadWithRetry(
    () => import('../components/SystemSettings'),
    { retries: 3, retryDelay: 1000 }
  ),
  
  // 教师仪表板
  TeacherDashboard: lazyLoadWithRetry(
    () => import('../components/TeacherDashboard'),
    { retries: 3, retryDelay: 1000 }
  ),
  
  // 课程管理
  CourseManagement: lazyLoadWithRetry(
    () => import('../components/CourseManagement'),
    { retries: 3, retryDelay: 1000 }
  ),
  
  // 学生仪表板
  StudentDashboard: lazyLoadWithRetry(
    () => import('../components/StudentDashboard'),
    { retries: 3, retryDelay: 1000 }
  ),
}

/**
 * 预加载策略
 * 
 * 根据当前页面预加载可能需要的组件
 */
export function setupPreloadStrategy(currentRoute) {
  // 根据当前路由预加载相关页面
  const preloadMap = {
    '/admin': [
      () => import('../components/UserManagement'),
      () => import('../components/DataAnalytics'),
    ],
    '/teacher': [
      () => import('../components/CourseManagement'),
    ],
    '/student': [
      // 学生页面可能需要的组件
    ],
  }

  const componentsToPreload = preloadMap[currentRoute] || []
  
  // 延迟预加载，避免影响当前页面加载
  componentsToPreload.forEach(importFunc => {
    preloadComponent(importFunc)
  })
}

/**
 * 加载进度追踪器
 */
class LoadProgressTracker {
  constructor() {
    this.loadedChunks = new Set()
    this.failedChunks = new Set()
    this.listeners = []
  }

  onChunkLoaded(chunkName) {
    this.loadedChunks.add(chunkName)
    this.notifyListeners('loaded', chunkName)
  }

  onChunkFailed(chunkName, error) {
    this.failedChunks.add(chunkName)
    this.notifyListeners('failed', chunkName, error)
  }

  addListener(listener) {
    this.listeners.push(listener)
  }

  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  notifyListeners(event, chunkName, error = null) {
    this.listeners.forEach(listener => {
      try {
        listener(event, chunkName, error)
      } catch (e) {
        console.error('Progress listener error:', e)
      }
    })
  }

  getStats() {
    return {
      loaded: this.loadedChunks.size,
      failed: this.failedChunks.size,
      loadedChunks: Array.from(this.loadedChunks),
      failedChunks: Array.from(this.failedChunks),
    }
  }
}

// 全局进度追踪器实例
export const loadProgress = new LoadProgressTracker()

/**
 * 监控懒加载性能
 */
export function monitorLazyLoadPerformance() {
  if (typeof window !== 'undefined' && window.performance) {
    // 监听资源加载
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource' && entry.name.includes('chunk')) {
          console.log(`Chunk loaded: ${entry.name}, Duration: ${entry.duration}ms`)
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['resource'] })
    } catch (e) {
      console.warn('PerformanceObserver not supported')
    }
  }
}

// 自动启动性能监控
if (typeof window !== 'undefined') {
  monitorLazyLoadPerformance()
}
