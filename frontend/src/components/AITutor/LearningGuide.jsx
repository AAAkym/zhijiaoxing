import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  Video,
  FileText,
  PenTool,
  Map,
  Target,
  Clock,
  ChevronRight,
  TrendingUp,
  Calendar,
  Search,
  Loader2,
  AlertCircle,
  Plus,
  Sparkles,
} from 'lucide-react'
import { aiTutor } from '@/services/api'

const TAB_ITEMS = [
  { id: 'resources', label: '资源推荐', emoji: '📖' },
  { id: 'path', label: '学习路径', emoji: '🗺️' },
  { id: 'progress', label: '学习进度', emoji: '📊' },
]

const RESOURCE_TYPES = [
  {
    key: 'textbook',
    label: '教材章节',
    emoji: '📖',
    icon: BookOpen,
    colorClass: 'border-blue-200 bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
    barClass: 'from-blue-400 to-blue-600',
  },
  {
    key: 'video',
    label: '视频教程',
    emoji: '🎬',
    icon: Video,
    colorClass: 'border-purple-200 bg-purple-50',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    dotClass: 'bg-purple-500',
    barClass: 'from-purple-400 to-purple-600',
  },
  {
    key: 'paper',
    label: '学术论文',
    emoji: '📄',
    icon: FileText,
    colorClass: 'border-green-200 bg-green-50',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    dotClass: 'bg-green-500',
    barClass: 'from-green-400 to-green-600',
  },
  {
    key: 'practice',
    label: '练习题',
    emoji: '✏️',
    icon: PenTool,
    colorClass: 'border-orange-200 bg-orange-50',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    dotClass: 'bg-orange-500',
    barClass: 'from-orange-400 to-orange-600',
  },
]

const PRIORITY_CONFIG = {
  high: { label: '高', class: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '中', class: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: '低', class: 'bg-gray-100 text-gray-600 border-gray-200' },
}

function ResourceCard({ resource, typeConfig }) {
  const Icon = typeConfig.icon
  const relevance = resource.relevance ?? resource.score ?? 0

  return (
    <div className={`rounded-lg border ${typeConfig.colorClass} p-3 hover:shadow-sm transition-shadow`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center shrink-0 border border-gray-100">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-800 truncate">{resource.title}</span>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${typeConfig.badgeClass}`}>
              {typeConfig.emoji} {typeConfig.label}
            </Badge>
          </div>

          {resource.description && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2">{resource.description}</p>
          )}

          {typeConfig.key === 'video' && resource.timestamp && (
            <div className="flex items-center gap-1 mb-1.5">
              <Clock className="w-3 h-3 text-purple-500" />
              <span className="text-[11px] text-purple-600">{resource.timestamp}</span>
            </div>
          )}

          {typeConfig.key === 'textbook' && resource.page_range && (
            <div className="flex items-center gap-1 mb-1.5">
              <BookOpen className="w-3 h-3 text-blue-500" />
              <span className="text-[11px] text-blue-600">页码: {resource.page_range}</span>
            </div>
          )}

          {typeConfig.key === 'paper' && resource.abstract && (
            <p className="text-[11px] text-green-600 line-clamp-1 mb-1.5 italic">{resource.abstract}</p>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">相关度</span>
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${typeConfig.barClass} transition-all`}
                style={{ width: `${Math.min(Math.max(relevance, 0), 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-gray-500">{relevance}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PathTimeline({ steps }) {
  if (!steps || steps.length === 0) return null

  return (
    <div className="relative pl-8">
      <div className="absolute left-[13px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-indigo-300 via-purple-300 to-pink-300" />
      {steps.map((step, idx) => {
        const priority = step.priority || 'medium'
        const priorityCfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium

        return (
          <div key={idx} className="relative mb-6 last:mb-0">
            <div className="absolute -left-8 top-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {idx + 1}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3.5 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold text-gray-800">{step.title}</span>
                <Badge variant="outline" className={`text-[10px] ${priorityCfg.class}`}>
                  {priorityCfg.label}优先
                </Badge>
              </div>
              {step.description && (
                <p className="text-xs text-gray-500 mb-2 leading-relaxed">{step.description}</p>
              )}
              {step.knowledge_points && step.knowledge_points.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {step.knowledge_points.map((point, pIdx) => (
                    <Badge key={pIdx} variant="outline" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200">
                      {point}
                    </Badge>
                  ))}
                </div>
              )}
              {step.estimated_time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-[11px] text-gray-400">预计 {step.estimated_time}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProgressBar({ value, className = '' }) {
  const clamped = Math.min(Math.max(value || 0, 0), 100)
  return (
    <div className={`h-2 bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function MiniProgressBar({ value, label }) {
  const clamped = Math.min(Math.max(value || 0, 0), 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-500 w-20 truncate shrink-0" title={label}>{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[11px] text-gray-400 w-8 text-right shrink-0">{clamped}%</span>
    </div>
  )
}

function ResourcesTab({ courseId, onTopicAsked, weakPoints, recentTopics }) {
  const [topic, setTopic] = useState('')
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = useCallback(async (overrideTopic) => {
    const searchTopic = (overrideTopic || topic).trim()
    if (!searchTopic || loading) return

    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const response = await aiTutor.getResources({ topic: searchTopic, course_id: courseId || undefined })
      const rawResources = response.resources || response.data || response || []
      setResources(Array.isArray(rawResources) ? rawResources : [])
      if (onTopicAsked) onTopicAsked(searchTopic)
    } catch (err) {
      setError(err.message || '获取资源失败，请重试')
      setResources([])
    } finally {
      setLoading(false)
    }
  }, [topic, loading, courseId, onTopicAsked])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }, [handleSearch])

  const handleTopicSelect = useCallback((selectedTopic) => {
    setTopic(selectedTopic)
    setTimeout(() => handleSearch(selectedTopic), 0)
  }, [handleSearch])

  const groupedResources = RESOURCE_TYPES.map((typeConfig) => {
    const items = resources.filter((r) => {
      const rType = (r.type || '').toLowerCase()
      return rType === typeConfig.key || rType === typeConfig.label
    })
    return { typeConfig, items }
  }).filter((g) => g.items.length > 0)

  const ungrouped = resources.length > 0 && groupedResources.length === 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入主题搜索学习资源..."
              disabled={loading}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300
                placeholder:text-gray-400 disabled:opacity-50 transition-colors"
            />
          </div>
          <Button
            onClick={() => handleSearch()}
            disabled={!topic.trim() || loading}
            className="shrink-0 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {weakPoints && weakPoints.slice(0, 2).map((point, idx) => {
            const name = typeof point === 'string' ? point : point.name || point.topic
            return (
              <button
                key={`weak-${idx}`}
                onClick={() => handleTopicSelect(name)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                  bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <AlertCircle className="w-3 h-3" />
                {name}
              </button>
            )
          })}
          {recentTopics && recentTopics.slice(0, 2).map((t, idx) => (
            <button
              key={`recent-${idx}`}
              onClick={() => handleTopicSelect(t)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">搜索学习资源</h3>
            <p className="text-sm text-gray-400">输入主题，为你推荐教材、视频、论文和练习</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm text-gray-500">正在搜索资源...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        {hasSearched && !loading && !error && resources.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">未找到相关资源，请尝试其他关键词</p>
          </div>
        )}

        {groupedResources.map(({ typeConfig, items }) => (
          <div key={typeConfig.key} className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-sm">{typeConfig.emoji}</span>
              <span className="text-sm font-semibold text-gray-700">{typeConfig.label}</span>
              <Badge variant="outline" className="text-[10px]">{items.length} 个</Badge>
            </div>
            <div className="space-y-2">
              {items.map((resource, idx) => (
                <ResourceCard key={idx} resource={resource} typeConfig={typeConfig} />
              ))}
            </div>
          </div>
        ))}

        {ungrouped && (
          <div className="space-y-2">
            {resources.map((resource, idx) => {
              const typeKey = (resource.type || 'textbook').toLowerCase()
              const typeConfig = RESOURCE_TYPES.find((t) => t.key === typeKey) || RESOURCE_TYPES[0]
              return <ResourceCard key={idx} resource={resource} typeConfig={typeConfig} />
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function PathTab({ courseId }) {
  const [pathData, setPathData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [customGoals, setCustomGoals] = useState([])
  const [goalInput, setGoalInput] = useState('')
  const [goalPriority, setGoalPriority] = useState('medium')

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = { course_id: courseId || undefined }
      if (customGoals.length > 0) {
        payload.custom_goals = customGoals
      }
      const response = await aiTutor.suggestLearningPath(payload)
      setPathData(response)
    } catch (err) {
      setError(err.message || '生成学习路径失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [courseId, customGoals])

  const handleAddGoal = useCallback(() => {
    const trimmed = goalInput.trim()
    if (!trimmed) return
    setCustomGoals((prev) => [...prev, { goal: trimmed, priority: goalPriority }])
    setGoalInput('')
  }, [goalInput, goalPriority])

  const handleGoalKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddGoal()
    }
  }, [handleAddGoal])

  const handleRemoveGoal = useCallback((idx) => {
    setCustomGoals((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const steps = pathData?.steps || pathData?.path || []

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={handleGoalKeyDown}
              placeholder="添加自定义学习目标..."
              className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300
                placeholder:text-gray-400 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {['high', 'medium', 'low'].map((p) => {
              const cfg = PRIORITY_CONFIG[p]
              return (
                <button
                  key={p}
                  onClick={() => setGoalPriority(p)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    goalPriority === p ? cfg.class : 'border-gray-200 text-gray-400 bg-gray-50'
                  }`}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
          <Button
            onClick={handleAddGoal}
            disabled={!goalInput.trim()}
            size="icon"
            className="shrink-0 rounded-xl h-10 w-10 bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {customGoals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customGoals.map((g, idx) => {
              const cfg = PRIORITY_CONFIG[g.priority] || PRIORITY_CONFIG.medium
              return (
                <Badge key={idx} variant="outline" className={`text-xs gap-1 ${cfg.class}`}>
                  <Target className="w-3 h-3" />
                  {g.goal}
                  <button onClick={() => handleRemoveGoal(idx)} className="ml-0.5 hover:opacity-60">×</button>
                </Badge>
              )
            })}
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              生成学习路径
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!pathData && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
              <Map className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">生成学习路径</h3>
            <p className="text-sm text-gray-400">添加自定义目标，点击生成专属学习路径</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        {pathData && !loading && (
          <div className="animate-fade-in">
            {pathData.title && (
              <div className="flex items-center gap-2 mb-4">
                <Map className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-semibold text-gray-800">{pathData.title}</h3>
              </div>
            )}
            {pathData.description && (
              <p className="text-sm text-gray-500 mb-4">{pathData.description}</p>
            )}
            <PathTimeline steps={steps} />
          </div>
        )}
      </div>
    </div>
  )
}

function LearningCalendar({ activities }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const activityDays = new Set()
  const dayActivities = {}
  if (activities && activities.length > 0) {
    activities.forEach((a) => {
      const dateStr = a.created_at || a.time || a.date
      if (dateStr) {
        const d = new Date(dateStr)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        activityDays.add(key)
        if (!dayActivities[key]) dayActivities[key] = []
        dayActivities[key].push(a)
      }
    })
  }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDay(null)
  }
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDay(null)
  }

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d)
  }

  const selectedDayStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null
  const selectedActivities = selectedDayStr ? (dayActivities[selectedDayStr] || []) : []

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-gray-700">学习日历</span>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-sm">
            ◀
          </button>
          <span className="text-sm font-medium text-gray-700">{year}年 {monthNames[month]}</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-sm">
            ▶
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekDays.map((wd) => (
            <div key={wd} className="text-center text-[10px] text-gray-400 font-medium py-1">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-8" />
            }
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const hasActivity = activityDays.has(dayStr)
            const isToday = dayStr === todayStr
            const isSelected = day === selectedDay

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`h-8 rounded-md text-xs flex flex-col items-center justify-center relative transition-colors ${
                  isSelected
                    ? 'bg-indigo-500 text-white'
                    : isToday
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                {day}
                {hasActivity && (
                  <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                )}
              </button>
            )
          })}
        </div>
        {selectedDay && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-1.5">
              {month + 1}月{selectedDay}日
            </p>
            {selectedActivities.length > 0 ? (
              <div className="space-y-1">
                {selectedActivities.slice(0, 5).map((a, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-[11px] text-gray-600 truncate">
                      {a.description || a.action || a.content || '学习活动'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">当日暂无学习活动</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressTab({ courseId }) {
  const [progressData, setProgressData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchProgress = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await aiTutor.getProgress()
      setProgressData(response)
    } catch (err) {
      setError(err.message || '获取学习进度失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (courseId) {
      fetchProgress()
    }
  }, [courseId, fetchProgress])

  const courses = progressData?.courses || progressData?.course_progress || []
  const activities = progressData?.recent_activities || progressData?.activities || []
  const recommendations = progressData?.recommendations || progressData?.pending_recommendations || []

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-700">学习进度概览</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProgress}
            disabled={loading}
            className="h-7 text-xs gap-1"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
            刷新
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {loading && !progressData && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm text-gray-500">加载学习进度...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        {!loading && !error && !progressData && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">学习进度</h3>
            <p className="text-sm text-gray-400">选择课程后自动加载学习进度数据</p>
          </div>
        )}

        {progressData && !loading && (
          <div className="animate-fade-in space-y-5">
            {courses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">课程进度</span>
                </div>
                <div className="space-y-3">
                  {courses.map((course, idx) => {
                    const progress = course.progress ?? course.completion ?? 0
                    const tags = course.knowledge_tags || course.tags || []

                    return (
                      <div key={idx} className="rounded-lg border border-gray-200 bg-white p-3.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-800">{course.name || course.title}</span>
                          <span className="text-xs font-medium text-indigo-600">{progress}%</span>
                        </div>
                        <ProgressBar value={progress} className="mb-2.5" />
                        {tags.length > 0 && (
                          <div className="space-y-1.5">
                            {tags.slice(0, 5).map((tag, tIdx) => {
                              const tagName = typeof tag === 'string' ? tag : tag.name || tag.tag
                              const tagProgress = typeof tag === 'object' ? (tag.progress ?? tag.mastery ?? 0) : 0
                              return <MiniProgressBar key={tIdx} value={tagProgress} label={tagName} />
                            })}
                            {tags.length > 5 && (
                              <span className="text-[11px] text-gray-400">+{tags.length - 5} 个知识点</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">最近活动</span>
                  <Badge variant="outline" className="text-[10px]">最近 {activities.length} 条</Badge>
                </div>
                <div className="space-y-2">
                  {activities.slice(0, 10).map((activity, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 truncate">{activity.description || activity.action || activity.content}</p>
                      </div>
                      {activity.time && (
                        <span className="text-[10px] text-gray-400 shrink-0">{activity.time}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recommendations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">待办推荐</span>
                  <Badge variant="outline" className="text-[10px]">{recommendations.length} 项</Badge>
                </div>
                <div className="space-y-2">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                      <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{rec.title || rec.description || rec.content}</p>
                        {rec.reason && (
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{rec.reason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <LearningCalendar activities={activities} />

            {progressData && courses.length === 0 && activities.length === 0 && recommendations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <TrendingUp className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">暂无学习进度数据</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LearningGuide({
  courseId,
  onTopicAsked,
  weakPoints,
  recentTopics,
  onFeedback,
  feedbackLoading,
}) {
  const [activeTab, setActiveTab] = useState('resources')

  const renderContent = () => {
    switch (activeTab) {
      case 'resources':
        return (
          <ResourcesTab
            courseId={courseId}
            onTopicAsked={onTopicAsked}
            weakPoints={weakPoints}
            recentTopics={recentTopics}
          />
        )
      case 'path':
        return <PathTab courseId={courseId} />
      case 'progress':
        return <ProgressTab courseId={courseId} />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-0 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-1">
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  isActive
                    ? 'text-indigo-700 bg-indigo-50 border-b-2 border-indigo-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-xs">{tab.emoji}</span>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {renderContent()}
      </div>
    </div>
  )
}
