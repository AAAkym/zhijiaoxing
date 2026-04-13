/**
 * 性能优化的Recharts图表组件
 * 
 * 优化特性：
 * - 数据采样和降维
 * - 懒加载和按需渲染
 * - 动画优化
 * - 防抖和节流
 * - 大数据集优化
 */
import React, { 
  useMemo, 
  useCallback, 
  useRef, 
  useEffect, 
  useState,
  lazy,
  Suspense
} from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine
} from 'recharts'
import { useInView } from 'react-intersection-observer'
import { debounce, throttle } from 'lodash-es'
import './OptimizedChart.css'

// 懒加载图表组件
const LazyLineChart = lazy(() => import('recharts').then(m => ({ default: m.LineChart })))
const LazyAreaChart = lazy(() => import('recharts').then(m => ({ default: m.AreaChart })))
const LazyBarChart = lazy(() => import('recharts').then(m => ({ default: m.BarChart })))

/**
 * 数据采样函数 - 使用LTTB算法（Largest Triangle Three Buckets）
 * 
 * @param {Array} data - 原始数据
 * @param {number} threshold - 采样后的数据点数量
 * @returns {Array} 采样后的数据
 */
export function lttbSample(data, threshold = 1000) {
  if (data.length <= threshold) return data
  
  const sampled = []
  let sampledIndex = 0
  
  // 始终保留第一个点
  sampled[sampledIndex++] = data[0]
  
  const bucketSize = (data.length - 2) / (threshold - 2)
  let a = 0 // 当前桶的点
  
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length)
    
    const avgRangeLength = avgRangeEnd - avgRangeStart
    
    let avgX = 0
    let avgY = 0
    
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += j
      avgY += data[j].value || data[j].y || 0
    }
    
    avgX /= avgRangeLength
    avgY /= avgRangeLength
    
    const rangeOffs = Math.floor((i) * bucketSize) + 1
    const rangeTo = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length)
    
    const pointAX = a
    const pointAY = data[a].value || data[a].y || 0
    
    let maxArea = -1
    let maxIdx = rangeOffs
    
    for (let j = rangeOffs; j < rangeTo; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[j].value || data[j].y || 0) -
        (pointAX - j) * (avgY - pointAY)
      ) * 0.5
      
      if (area > maxArea) {
        maxArea = area
        maxIdx = j
      }
    }
    
    sampled[sampledIndex++] = data[maxIdx]
    a = maxIdx
  }
  
  // 保留最后一个点
  sampled[sampledIndex++] = data[data.length - 1]
  
  return sampled
}

/**
 * 简单的数据采样 - 等间隔采样
 */
export function simpleSample(data, threshold = 1000) {
  if (data.length <= threshold) return data
  
  const sampled = []
  const bucketSize = data.length / threshold
  
  for (let i = 0; i < threshold; i++) {
    const idx = Math.floor(i * bucketSize)
    sampled.push(data[idx])
  }
  
  return sampled
}

/**
 * 数据聚合函数 - 按时间窗口聚合
 */
export function aggregateData(data, timeWindow = '1h') {
  if (!data || data.length === 0) return []
  
  const aggregated = new Map()
  
  data.forEach(item => {
    const timestamp = new Date(item.timestamp || item.x || item.date)
    let key
    
    switch (timeWindow) {
      case '1m':
        key = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours(), timestamp.getMinutes())
        break
      case '1h':
        key = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours())
        break
      case '1d':
        key = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate())
        break
      default:
        key = timestamp
    }
    
    const keyStr = key.toISOString()
    
    if (!aggregated.has(keyStr)) {
      aggregated.set(keyStr, {
        timestamp: key,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        values: []
      })
    }
    
    const bucket = aggregated.get(keyStr)
    const value = item.value || item.y || 0
    
    bucket.count++
    bucket.sum += value
    bucket.min = Math.min(bucket.min, value)
    bucket.max = Math.max(bucket.max, value)
    bucket.values.push(value)
  })
  
  return Array.from(aggregated.values()).map(bucket => ({
    timestamp: bucket.timestamp,
    value: bucket.sum / bucket.count,
    count: bucket.count,
    min: bucket.min,
    max: bucket.max
  }))
}

/**
 * 性能优化的折线图
 */
export function OptimizedLineChart({
  data = [],
  xKey = 'x',
  yKey = 'y',
  width = '100%',
  height = 300,
  maxDataPoints = 500,
  enableSampling = true,
  enableAnimation = true,
  animationDuration = 300,
  strokeWidth = 2,
  color = '#2196f3',
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  showBrush = false,
  onClick,
  className = '',
  lazy = false,
  ...props
}) {
  const chartRef = useRef(null)
  const [isVisible, setIsVisible] = useState(!lazy)
  
  // 使用Intersection Observer实现懒加载
  const { ref: inViewRef, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1
  })
  
  useEffect(() => {
    if (inView && lazy) {
      setIsVisible(true)
    }
  }, [inView, lazy])
  
  // 数据采样
  const processedData = useMemo(() => {
    if (!enableSampling || data.length <= maxDataPoints) return data
    return lttbSample(data, maxDataPoints)
  }, [data, enableSampling, maxDataPoints])
  
  // 防抖的点击处理
  const debouncedClick = useMemo(
    () => debounce(onClick || (() => {}), 100),
    [onClick]
  )
  
  // 优化的动画配置
  const animationConfig = useMemo(() => {
    if (!enableAnimation) return false
    return {
      duration: animationDuration,
      easing: 'ease-out'
    }
  }, [enableAnimation, animationDuration])
  
  if (!isVisible) {
    return (
      <div 
        ref={inViewRef}
        className={`optimized-chart-placeholder ${className}`}
        style={{ width, height }}
      >
        <div className="chart-loading">
          <div className="chart-spinner" />
          <span>图表加载中...</span>
        </div>
      </div>
    )
  }
  
  return (
    <div ref={inViewRef} className={`optimized-chart ${className}`} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={processedData}
          onClick={debouncedClick}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          {...props}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e0e0e0"
              vertical={false}
            />
          )}
          <XAxis 
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
            minTickGap={30}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          {showTooltip && (
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            />
          )}
          {showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={strokeWidth}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            animationDuration={animationConfig.duration || 0}
            animationEasing={animationConfig.easing}
            isAnimationActive={enableAnimation}
          />
          {showBrush && (
            <Brush 
              dataKey={xKey}
              height={30}
              stroke={color}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * 性能优化的面积图
 */
export function OptimizedAreaChart({
  data = [],
  xKey = 'x',
  yKey = 'y',
  width = '100%',
  height = 300,
  maxDataPoints = 500,
  enableSampling = true,
  enableAnimation = true,
  animationDuration = 300,
  color = '#2196f3',
  gradient = true,
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  className = '',
  lazy = false,
  ...props
}) {
  const [isVisible, setIsVisible] = useState(!lazy)
  const { ref: inViewRef, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1
  })
  
  useEffect(() => {
    if (inView && lazy) {
      setIsVisible(true)
    }
  }, [inView, lazy])
  
  const processedData = useMemo(() => {
    if (!enableSampling || data.length <= maxDataPoints) return data
    return lttbSample(data, maxDataPoints)
  }, [data, enableSampling, maxDataPoints])
  
  const gradientId = useMemo(() => `gradient-${Math.random().toString(36).substr(2, 9)}`, [])
  
  if (!isVisible) {
    return (
      <div 
        ref={inViewRef}
        className={`optimized-chart-placeholder ${className}`}
        style={{ width, height }}
      >
        <div className="chart-loading">
          <div className="chart-spinner" />
          <span>图表加载中...</span>
        </div>
      </div>
    )
  }
  
  return (
    <div ref={inViewRef} className={`optimized-chart ${className}`} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          {...props}
        >
          <defs>
            {gradient && (
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            )}
          </defs>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
          )}
          <XAxis 
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
            minTickGap={30}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={color}
            fill={gradient ? `url(#${gradientId})` : color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            animationDuration={enableAnimation ? animationDuration : 0}
            isAnimationActive={enableAnimation}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * 性能优化的柱状图
 */
export function OptimizedBarChart({
  data = [],
  xKey = 'x',
  yKey = 'y',
  width = '100%',
  height = 300,
  maxDataPoints = 100,
  enableAnimation = true,
  animationDuration = 300,
  color = '#2196f3',
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  className = '',
  lazy = false,
  ...props
}) {
  const [isVisible, setIsVisible] = useState(!lazy)
  const { ref: inViewRef, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1
  })
  
  useEffect(() => {
    if (inView && lazy) {
      setIsVisible(true)
    }
  }, [inView, lazy])
  
  // 柱状图数据限制更严格
  const processedData = useMemo(() => {
    if (data.length <= maxDataPoints) return data
    return data.slice(0, maxDataPoints)
  }, [data, maxDataPoints])
  
  if (!isVisible) {
    return (
      <div 
        ref={inViewRef}
        className={`optimized-chart-placeholder ${className}`}
        style={{ width, height }}
      >
        <div className="chart-loading">
          <div className="chart-spinner" />
          <span>图表加载中...</span>
        </div>
      </div>
    )
  }
  
  return (
    <div ref={inViewRef} className={`optimized-chart ${className}`} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          {...props}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
          )}
          <XAxis 
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
            minTickGap={30}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
          <Bar
            dataKey={yKey}
            fill={color}
            radius={[4, 4, 0, 0]}
            animationDuration={enableAnimation ? animationDuration : 0}
            isAnimationActive={enableAnimation}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * 性能优化的饼图
 */
export function OptimizedPieChart({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  width = '100%',
  height = 300,
  colors = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4'],
  enableAnimation = true,
  animationDuration = 300,
  showTooltip = true,
  showLegend = true,
  innerRadius = 0,
  outerRadius = '80%',
  className = '',
  lazy = false,
  ...props
}) {
  const [isVisible, setIsVisible] = useState(!lazy)
  const { ref: inViewRef, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1
  })
  
  useEffect(() => {
    if (inView && lazy) {
      setIsVisible(true)
    }
  }, [inView, lazy])
  
  if (!isVisible) {
    return (
      <div 
        ref={inViewRef}
        className={`optimized-chart-placeholder ${className}`}
        style={{ width, height }}
      >
        <div className="chart-loading">
          <div className="chart-spinner" />
          <span>图表加载中...</span>
        </div>
      </div>
    )
  }
  
  return (
    <div ref={inViewRef} className={`optimized-chart ${className}`} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart {...props}>
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            animationDuration={enableAnimation ? animationDuration : 0}
            isAnimationActive={enableAnimation}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * 大数据图表组件 - 支持海量数据
 */
export function BigDataChart({
  data = [],
  type = 'line',
  timeWindow = '1h',
  maxDataPoints = 1000,
  ...props
}) {
  // 数据聚合
  const aggregatedData = useMemo(() => {
    if (data.length <= maxDataPoints) return data
    return aggregateData(data, timeWindow)
  }, [data, timeWindow, maxDataPoints])
  
  // 根据类型选择图表
  switch (type) {
    case 'line':
      return <OptimizedLineChart data={aggregatedData} {...props} />
    case 'area':
      return <OptimizedAreaChart data={aggregatedData} {...props} />
    case 'bar':
      return <OptimizedBarChart data={aggregatedData} {...props} />
    default:
      return <OptimizedLineChart data={aggregatedData} {...props} />
  }
}

/**
 * 性能监控Hook
 */
export function useChartPerformance() {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    frameRate: 0,
    memoryUsage: 0
  })
  
  const measureRenderTime = useCallback((callback) => {
    const start = performance.now()
    callback()
    const end = performance.now()
    setMetrics(prev => ({ ...prev, renderTime: end - start }))
    return end - start
  }, [])
  
  const measureFrameRate = useCallback(() => {
    let frameCount = 0
    let lastTime = performance.now()
    
    const countFrames = () => {
      frameCount++
      const currentTime = performance.now()
      
      if (currentTime >= lastTime + 1000) {
        setMetrics(prev => ({ ...prev, frameRate: frameCount }))
        frameCount = 0
        lastTime = currentTime
      }
      
      requestAnimationFrame(countFrames)
    }
    
    requestAnimationFrame(countFrames)
  }, [])
  
  useEffect(() => {
    measureFrameRate()
  }, [measureFrameRate])
  
  return { metrics, measureRenderTime }
}

export default {
  OptimizedLineChart,
  OptimizedAreaChart,
  OptimizedBarChart,
  OptimizedPieChart,
  BigDataChart,
  lttbSample,
  simpleSample,
  aggregateData,
  useChartPerformance
}
