/**
 * 虚拟滚动列表组件
 * 
 * 高性能大数据列表渲染，只渲染可视区域内的列表项
 * 支持动态高度、滚动位置记忆、平滑滚动等功能
 */
import React, { 
  useRef, 
  useState, 
  useEffect, 
  useCallback, 
  useMemo,
  forwardRef,
  useImperativeHandle
} from 'react'
import PropTypes from 'prop-types'
import './VirtualList.css'

/**
 * 默认列表项高度
 */
const DEFAULT_ITEM_HEIGHT = 50

/**
 * 缓冲区大小（可视区域外额外渲染的项数）
 */
const BUFFER_SIZE = 5

/**
 * 虚拟滚动列表组件
 */
const VirtualList = forwardRef(({
  data = [],
  renderItem,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  dynamicHeight = false,
  height = 400,
  width = '100%',
  className = '',
  itemClassName = '',
  onScroll,
  onReachEnd,
  onReachStart,
  loading = false,
  loadingComponent,
  error = null,
  errorComponent,
  onRetry,
  scrollToIndex,
  scrollToIndexOptions = { behavior: 'smooth' },
  preserveScrollPosition = false,
  overscan = BUFFER_SIZE,
  onItemsRendered,
  idKey = 'id',
  ...restProps
}, ref) => {
  // 容器引用
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  
  // 滚动位置引用
  const scrollTopRef = useRef(0)
  const lastScrollTopRef = useRef(0)
  
  // 列表项高度缓存
  const itemHeightsRef = useRef(new Map())
  const itemElementsRef = useRef(new Map())
  
  // 状态
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 })
  const [totalHeight, setTotalHeight] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef(null)
  
  /**
   * 获取列表项高度
   */
  const getItemHeight = useCallback((index) => {
    if (dynamicHeight) {
      return itemHeightsRef.current.get(index) || itemHeight
    }
    return itemHeight
  }, [dynamicHeight, itemHeight])
  
  /**
   * 计算列表项的累计高度
   */
  const getItemOffset = useCallback((index) => {
    let offset = 0
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i)
    }
    return offset
  }, [getItemHeight])
  
  /**
   * 计算总高度
   */
  const calculateTotalHeight = useCallback(() => {
    let total = 0
    for (let i = 0; i < data.length; i++) {
      total += getItemHeight(i)
    }
    return total
  }, [data.length, getItemHeight])
  
  /**
   * 更新总高度
   */
  useEffect(() => {
    const newTotalHeight = calculateTotalHeight()
    setTotalHeight(newTotalHeight)
  }, [calculateTotalHeight])
  
  /**
   * 计算可视范围
   */
  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current
    if (!container) return { start: 0, end: 0 }
    
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    
    let start = 0
    let offset = 0
    
    // 二分查找起始位置
    let left = 0
    let right = data.length - 1
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midOffset = getItemOffset(mid)
      
      if (midOffset < scrollTop) {
        start = mid
        left = mid + 1
      } else {
        right = mid - 1
      }
    }
    
    // 找到实际的起始位置（考虑overscan）
    start = Math.max(0, start - overscan)
    
    // 计算结束位置
    let end = start
    offset = getItemOffset(start)
    
    while (end < data.length && offset < scrollTop + containerHeight + overscan * itemHeight) {
      offset += getItemHeight(end)
      end++
    }
    
    end = Math.min(data.length, end + overscan)
    
    return { start, end }
  }, [data.length, getItemHeight, getItemOffset, overscan, itemHeight])
  
  /**
   * 处理滚动事件
   */
  const handleScroll = useCallback((event) => {
    const container = containerRef.current
    if (!container) return
    
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    
    scrollTopRef.current = scrollTop
    
    // 更新可视范围
    const newRange = calculateVisibleRange()
    setVisibleRange(newRange)
    
    // 触发滚动回调
    if (onScroll) {
      onScroll({
        scrollTop,
        scrollHeight,
        clientHeight,
        scrollDirection: scrollTop > lastScrollTopRef.current ? 'down' : 'up'
      })
    }
    
    // 检测是否到达底部
    if (onReachEnd && scrollTop + clientHeight >= scrollHeight - 50) {
      onReachEnd()
    }
    
    // 检测是否到达顶部
    if (onReachStart && scrollTop <= 50) {
      onReachStart()
    }
    
    lastScrollTopRef.current = scrollTop
    
    // 设置滚动状态
    if (!isScrolling) {
      setIsScrolling(true)
    }
    
    // 清除之前的timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    // 滚动结束后重置状态
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 150)
    
    // 通知列表项已渲染
    if (onItemsRendered) {
      onItemsRendered(newRange)
    }
  }, [calculateVisibleRange, onScroll, onReachEnd, onReachStart, isScrolling, onItemsRendered])
  
  /**
   * 监听滚动事件
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    
    // 初始计算可视范围
    const initialRange = calculateVisibleRange()
    setVisibleRange(initialRange)
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [handleScroll, calculateVisibleRange])
  
  /**
   * 监听数据变化，更新可视范围
   */
  useEffect(() => {
    const newRange = calculateVisibleRange()
    setVisibleRange(newRange)
  }, [data, calculateVisibleRange])
  
  /**
   * 监听动态高度变化
   */
  useEffect(() => {
    if (!dynamicHeight) return
    
    // 测量所有可见项的高度
    itemElementsRef.current.forEach((element, index) => {
      if (element && visibleRange.start <= index && index < visibleRange.end) {
        const height = element.getBoundingClientRect().height
        if (height > 0) {
          itemHeightsRef.current.set(index, height)
        }
      }
    })
    
    // 重新计算总高度
    const newTotalHeight = calculateTotalHeight()
    setTotalHeight(newTotalHeight)
  }, [visibleRange, dynamicHeight, calculateTotalHeight])
  
  /**
   * 滚动到指定索引
   */
  const scrollToIndex = useCallback((index, options = scrollToIndexOptions) => {
    const container = containerRef.current
    if (!container || index < 0 || index >= data.length) return
    
    const offset = getItemOffset(index)
    const itemH = getItemHeight(index)
    const containerHeight = container.clientHeight
    
    let scrollTo = offset
    
    // 如果选项指定了居中对齐
    if (options.align === 'center') {
      scrollTo = offset - containerHeight / 2 + itemH / 2
    } else if (options.align === 'end') {
      scrollTo = offset - containerHeight + itemH
    }
    
    container.scrollTo({
      top: Math.max(0, scrollTo),
      behavior: options.behavior || 'smooth'
    })
  }, [data.length, getItemHeight, getItemOffset, scrollToIndexOptions])
  
  /**
   * 滚动到指定偏移位置
   */
  const scrollTo = useCallback((offset, behavior = 'smooth') => {
    const container = containerRef.current
    if (!container) return
    
    container.scrollTo({
      top: offset,
      behavior
    })
  }, [])
  
  /**
   * 获取当前滚动位置
   */
  const getScrollPosition = useCallback(() => {
    return scrollTopRef.current
  }, [])
  
  /**
   * 暴露方法给父组件
   */
  useImperativeHandle(ref, () => ({
    scrollToIndex,
    scrollTo,
    getScrollPosition,
    container: containerRef.current
  }))
  
  /**
   * 监听scrollToIndex属性变化
   */
  useEffect(() => {
    if (typeof scrollToIndex === 'number') {
      scrollToIndex(scrollToIndex)
    }
  }, [scrollToIndex, scrollToIndex])
  
  /**
   * 保存和恢复滚动位置
   */
  useEffect(() => {
    if (!preserveScrollPosition) return
    
    const container = containerRef.current
    if (!container) return
    
    // 保存滚动位置
    const handleBeforeUnload = () => {
      sessionStorage.setItem('virtualListScrollPosition', String(container.scrollTop))
    }
    
    // 恢复滚动位置
    const savedPosition = sessionStorage.getItem('virtualListScrollPosition')
    if (savedPosition) {
      container.scrollTop = parseInt(savedPosition, 10)
      sessionStorage.removeItem('virtualListScrollPosition')
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [preserveScrollPosition])
  
  /**
   * 渲染列表项
   */
  const renderItems = useMemo(() => {
    const items = []
    
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      const item = data[i]
      if (!item) continue
      
      const offset = getItemOffset(i)
      const key = item[idKey] || i
      
      items.push(
        <div
          key={key}
          ref={(el) => {
            if (el) {
              itemElementsRef.current.set(i, el)
            }
          }}
          className={`virtual-list-item ${itemClassName} ${isScrolling ? 'scrolling' : ''}`}
          style={{
            position: 'absolute',
            top: offset,
            left: 0,
            right: 0,
            minHeight: dynamicHeight ? undefined : itemHeight
          }}
          data-index={i}
        >
          {renderItem(item, i)}
        </div>
      )
    }
    
    return items
  }, [visibleRange, data, renderItem, itemClassName, isScrolling, getItemOffset, itemHeight, dynamicHeight, idKey])
  
  /**
   * 渲染加载状态
   */
  const renderLoading = () => {
    if (!loading) return null
    
    if (loadingComponent) {
      return loadingComponent
    }
    
    return (
      <div className="virtual-list-loading">
        <div className="virtual-list-spinner" />
        <span>加载中...</span>
      </div>
    )
  }
  
  /**
   * 渲染错误状态
   */
  const renderError = () => {
    if (!error) return null
    
    if (errorComponent) {
      return errorComponent
    }
    
    return (
      <div className="virtual-list-error">
        <div className="virtual-list-error-icon">⚠️</div>
        <div className="virtual-list-error-message">{error}</div>
        {onRetry && (
          <button className="virtual-list-retry-btn" onClick={onRetry}>
            重试
          </button>
        )}
      </div>
    )
  }
  
  return (
    <div
      ref={containerRef}
      className={`virtual-list-container ${className}`}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative'
      }}
      {...restProps}
    >
      <div
        ref={contentRef}
        className="virtual-list-content"
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {renderItems}
      </div>
      
      {renderLoading()}
      {renderError()}
    </div>
  )
})

VirtualList.displayName = 'VirtualList'

VirtualList.propTypes = {
  /** 列表数据 */
  data: PropTypes.array.isRequired,
  /** 渲染列表项的函数 */
  renderItem: PropTypes.func.isRequired,
  /** 列表项高度（固定高度时） */
  itemHeight: PropTypes.number,
  /** 是否启用动态高度 */
  dynamicHeight: PropTypes.bool,
  /** 容器高度 */
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** 容器宽度 */
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** 容器类名 */
  className: PropTypes.string,
  /** 列表项类名 */
  itemClassName: PropTypes.string,
  /** 滚动回调 */
  onScroll: PropTypes.func,
  /** 到达底部回调 */
  onReachEnd: PropTypes.func,
  /** 到达顶部回调 */
  onReachStart: PropTypes.func,
  /** 是否加载中 */
  loading: PropTypes.bool,
  /** 自定义加载组件 */
  loadingComponent: PropTypes.node,
  /** 错误信息 */
  error: PropTypes.string,
  /** 自定义错误组件 */
  errorComponent: PropTypes.node,
  /** 重试回调 */
  onRetry: PropTypes.func,
  /** 滚动到指定索引 */
  scrollToIndex: PropTypes.number,
  /** 滚动选项 */
  scrollToIndexOptions: PropTypes.object,
  /** 是否保留滚动位置 */
  preserveScrollPosition: PropTypes.bool,
  /** 缓冲区大小 */
  overscan: PropTypes.number,
  /** 列表项渲染回调 */
  onItemsRendered: PropTypes.func,
  /** 数据项唯一标识键 */
  idKey: PropTypes.string
}

VirtualList.defaultProps = {
  itemHeight: DEFAULT_ITEM_HEIGHT,
  dynamicHeight: false,
  height: 400,
  width: '100%',
  className: '',
  itemClassName: '',
  loading: false,
  error: null,
  preserveScrollPosition: false,
  overscan: BUFFER_SIZE,
  idKey: 'id'
}

export default VirtualList
