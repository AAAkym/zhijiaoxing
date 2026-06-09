import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  FileText,
  Target,
  Clock,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Loader2,
  AlertCircle,
  X,
  BookOpen,
  PenTool,
  Lightbulb,
  CheckCircle2,
  Download,
} from 'lucide-react'
import { aiTutor } from '@/services/api'

const WEAK_THRESHOLD = 60

const BLOOM_DIMENSIONS = [
  { key: 'remember', label: '记忆', color: '#ef4444' },
  { key: 'understand', label: '理解', color: '#f97316' },
  { key: 'apply', label: '应用', color: '#eab308' },
  { key: 'analyze', label: '分析', color: '#22c55e' },
  { key: 'evaluate', label: '评价', color: '#3b82f6' },
  { key: 'create', label: '创造', color: '#8b5cf6' },
]

function getMasteryColor(value) {
  if (value < 40) return 'from-red-400 to-red-500'
  if (value < 60) return 'from-orange-400 to-orange-500'
  if (value < 80) return 'from-yellow-400 to-yellow-500'
  return 'from-green-400 to-green-500'
}

function getMasteryBgColor(value) {
  if (value < 40) return 'bg-red-50 border-red-200'
  if (value < 60) return 'bg-orange-50 border-orange-200'
  if (value < 80) return 'bg-yellow-50 border-yellow-200'
  return 'bg-green-50 border-green-200'
}

function getMasteryTextColor(value) {
  if (value < 40) return 'text-red-700'
  if (value < 60) return 'text-orange-700'
  if (value < 80) return 'text-yellow-700'
  return 'text-green-700'
}

function getBloomBarGradient(value) {
  if (value < 40) return 'from-red-400 to-red-500'
  if (value < 60) return 'from-orange-400 to-yellow-400'
  if (value < 80) return 'from-yellow-400 to-green-400'
  return 'from-green-400 to-emerald-500'
}

function MasteryRadarChart({ knowledgePoints }) {
  if (!knowledgePoints || knowledgePoints.length === 0) return null

  const chartData = knowledgePoints.map((point) => ({
    subject: point.name || point.topic || '未知',
    mastery: point.mastery ?? point.score ?? 0,
    fullMark: 100,
  }))

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <Radar
            name="掌握度"
            dataKey="mastery"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

function KnowledgePointCard({ point, onPractice }) {
  const name = point.name || point.topic || '未知知识点'
  const mastery = point.mastery ?? point.score ?? 0
  const isWeak = mastery < WEAK_THRESHOLD

  return (
    <div className={`rounded-lg border p-3 transition-shadow hover:shadow-sm ${getMasteryBgColor(mastery)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isWeak && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
          <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
        </div>
        <span className={`text-xs font-semibold shrink-0 ml-2 ${getMasteryTextColor(mastery)}`}>
          {mastery}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getMasteryColor(mastery)} transition-all duration-500`}
          style={{ width: `${Math.min(Math.max(mastery, 0), 100)}%` }}
        />
      </div>
      {isWeak && (
        <button
          onClick={() => onPractice?.(name)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <Target className="w-3 h-3" />
          针对练习
        </button>
      )}
    </div>
  )
}

function BloomTaxonomyBars({ bloomScores }) {
  if (!bloomScores || Object.keys(bloomScores).length === 0) return null

  return (
    <div className="space-y-3">
      {BLOOM_DIMENSIONS.map((dim) => {
        const value = bloomScores[dim.key] ?? 0
        return (
          <div key={dim.key} className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 w-10 shrink-0">{dim.label}</span>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${getBloomBarGradient(value)} transition-all duration-500`}
                style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
              />
            </div>
            <span className={`text-xs font-semibold w-10 text-right shrink-0 ${getMasteryTextColor(value)}`}>
              {value}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function DiagnosisReportSection({ reportContent, isStreaming, onGenerate, onExport, loading, exportLoading, hasReport }) {
  const renderFormattedReport = (content) => {
    if (!content) return null

    const lines = content.split('\n')
    const elements = []
    let currentList = []
    let listKey = ''

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${listKey}`} className="space-y-1 mb-2 ml-4">
            {currentList.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                <span className="text-gray-400 mt-1 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )
        currentList = []
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (!trimmed) {
        flushList()
        continue
      }

      if (/^#{1,3}\s/.test(trimmed)) {
        flushList()
        const level = trimmed.match(/^(#{1,3})/)[1].length
        const text = trimmed.replace(/^#{1,3}\s+/, '')
        const headingStyles = {
          1: 'text-base font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-200',
          2: 'text-sm font-bold text-gray-800 mt-3 mb-1.5',
          3: 'text-sm font-semibold text-gray-700 mt-2 mb-1',
        }
        elements.push(
          <div key={`h-${i}`} className={headingStyles[level] || headingStyles[3]}>
            {text}
          </div>
        )
        continue
      }

      if (/^[-*•]\s/.test(trimmed)) {
        const text = trimmed.replace(/^[-*•]\s+/, '')
        currentList.push(text)
        listKey = listKey || `ul-${i}`
        continue
      }

      if (/^\d+[.、)]\s/.test(trimmed)) {
        const text = trimmed.replace(/^\d+[.、)]\s+/, '')
        currentList.push(text)
        listKey = listKey || `ol-${i}`
        continue
      }

      if (/^【.+?】/.test(trimmed)) {
        flushList()
        const match = trimmed.match(/^(【.+?】)(.*)/)
        if (match) {
          elements.push(
            <div key={`tag-${i}`} className="text-sm text-gray-700 mb-1">
              <span className="font-semibold text-indigo-700">{match[1]}</span>
              {match[2]}
            </div>
          )
        }
        continue
      }

      if (/^[一二三四五六七八九十]+[、.]/.test(trimmed)) {
        flushList()
        elements.push(
          <div key={`cn-${i}`} className="text-sm font-bold text-gray-800 mt-3 mb-1">
            {trimmed}
          </div>
        )
        continue
      }

      flushList()
      elements.push(
        <p key={`p-${i}`} className="text-sm text-gray-700 mb-1.5 leading-relaxed">
          {trimmed}
        </p>
      )
    }

    flushList()
    return elements
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700">诊断报告</span>
        </div>
        <div className="flex items-center gap-2">
          {hasReport && (
            <Button
              onClick={onExport}
              disabled={exportLoading}
              size="sm"
              className="h-7 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40"
            >
              {exportLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  导出PDF
                </>
              )}
            </Button>
          )}
          {!hasReport && (
            <Button
              onClick={onGenerate}
              disabled={loading}
              size="sm"
              className="h-7 text-xs gap-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3" />
                  生成诊断报告
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {isStreaming && !reportContent && (
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span className="text-sm text-gray-500">正在生成诊断报告...</span>
        </div>
      )}

      {reportContent && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 animate-fade-in">
          <div className="prose prose-sm max-w-none">
            {renderFormattedReport(reportContent)}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-500 animate-pulse rounded-sm" />
            )}
          </div>
        </div>
      )}

      {!hasReport && !isStreaming && !loading && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">点击上方按钮生成个性化诊断报告</p>
        </div>
      )}
    </div>
  )
}

function ImprovementPlanSection({ weakPoints, planData, onPractice }) {
  if (!planData && (!weakPoints || weakPoints.length === 0)) return null

  const plans = planData?.plans || weakPoints.map((point) => {
    const name = typeof point === 'string' ? point : point.name || point.topic
    const mastery = typeof point === 'object' ? (point.mastery ?? point.score ?? 0) : 0
    const bloomLevels = typeof point === 'object' ? (point.bloom_levels || point.bloom_taxonomy || {}) : {}
    const tags = typeof point === 'object' ? (point.tags || []) : []

    const bloomEntries = Object.entries(bloomLevels).filter(([, v]) => typeof v === 'number')
    const lowestBloom = bloomEntries.length > 0
      ? bloomEntries.sort((a, b) => a[1] - b[1])[0]
      : null

    const questions = []
    if (mastery < 30) {
      questions.push(
        `重新学习${name}的基础概念，完成3道基础概念辨析题`,
        `默写${name}的核心定义和关键特征`,
        `对比${name}与相关概念的异同，完成1组对比分析题`,
      )
    } else if (mastery < 60) {
      questions.push(
        `完成3道${name}的理解应用题`,
        `用自己的话解释${name}的核心原理`,
        `完成1道${name}的综合分析题`,
      )
    } else {
      questions.push(
        `完成2道${name}的进阶应用题`,
        `分析${name}在实际场景中的应用案例`,
      )
    }
    if (lowestBloom) {
      questions.push(`针对布鲁姆"${lowestBloom[0]}"层级(得分${lowestBloom[1]})，完成专项提升练习`)
    }

    const resources = []
    if (tags.length > 0) {
      resources.push({ title: `${tags[0]}专项讲解`, priority: 'high' })
      if (tags.length > 1) {
        resources.push({ title: `${tags[1]}拓展阅读`, priority: 'medium' })
      }
    }
    resources.push({ title: `${name}知识点思维导图`, priority: mastery < 40 ? 'high' : 'medium' })
    resources.push({ title: `${name}常见错误集锦`, priority: 'medium' })

    const methods = []
    if (mastery < 30) {
      methods.push({
        method: `从零开始系统学习${name}：先理解定义→记忆要点→做基础题巩固`,
        time: '3-5天',
      })
    } else if (mastery < 60) {
      methods.push({
        method: `针对${name}薄弱环节重点突破：做错题分析→查漏补缺→强化练习`,
        time: '2-3天',
      })
    } else {
      methods.push({
        method: `巩固${name}并拓展深度：做综合题→总结规律→教别人理解`,
        time: '1-2天',
      })
    }
    if (lowestBloom && lowestBloom[1] < 40) {
      methods.push({
        method: `提升布鲁姆"${lowestBloom[0]}"层级：使用费曼学习法，尝试向他人讲解${name}`,
        time: '2-3天',
      })
    }
    methods.push({
      method: `每日复习${name}核心概念15分钟，连续7天形成长期记忆`,
      time: '7天',
    })

    return {
      knowledge_point: name,
      mastery,
      questions,
      resources,
      methods,
    }
  })

  if (plans.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-gray-700">改进计划</span>
        <Badge variant="outline" className="text-[10px]">{plans.length} 个薄弱点</Badge>
      </div>

      <div className="space-y-4">
        {plans.map((plan, idx) => {
          const pointName = plan.knowledge_point || plan.name || `薄弱点 ${idx + 1}`
          const questions = plan.questions || plan.practice_questions || []
          const resources = plan.resources || plan.recommended_resources || []
          const methods = plan.methods || plan.learning_methods || []
          const mastery = plan.mastery

          return (
            <PlanCard
              key={idx}
              pointName={pointName}
              mastery={mastery}
              questions={questions}
              resources={resources}
              methods={methods}
              onPractice={onPractice}
            />
          )
        })}
      </div>
    </div>
  )
}

function PlanCard({ pointName, mastery, questions, resources, methods, onPractice }) {
  const [expanded, setExpanded] = useState(false)

  const masteryLabel = mastery !== undefined
    ? mastery < 30 ? '严重薄弱' : mastery < 60 ? '需要加强' : mastery < 80 ? '基本掌握' : '掌握良好'
    : ''

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-amber-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">{pointName}</span>
          {masteryLabel && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              mastery < 30 ? 'bg-red-100 text-red-700' : mastery < 60 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {mastery !== undefined ? `${mastery}% ` : ''}{masteryLabel}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-amber-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-amber-500" />
        )}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-amber-200/60 pt-3">
          {questions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <PenTool className="w-3 h-3 text-indigo-500" />
                <span className="text-xs font-semibold text-gray-600">练习题目</span>
              </div>
              <div className="space-y-1.5">
                {questions.slice(0, 5).map((q, qIdx) => (
                  <button
                    key={qIdx}
                    onClick={() => onPractice?.(pointName)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white border border-gray-200
                      text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
                  >
                    <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="truncate">{typeof q === 'string' ? q : q.title || q.question || `练习题 ${qIdx + 1}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {resources.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3 h-3 text-indigo-500" />
                <span className="text-xs font-semibold text-gray-600">推荐资源</span>
              </div>
              <div className="space-y-1.5">
                {resources.slice(0, 5).map((r, rIdx) => {
                  const title = typeof r === 'string' ? r : r.title || r.name || `资源 ${rIdx + 1}`
                  const priority = typeof r === 'object' ? (r.priority || 'medium') : 'medium'
                  const priorityCfg = {
                    high: { label: '高', class: 'bg-red-100 text-red-700' },
                    medium: { label: '中', class: 'bg-amber-100 text-amber-700' },
                    low: { label: '低', class: 'bg-gray-100 text-gray-600' },
                  }
                  const cfg = priorityCfg[priority] || priorityCfg.medium

                  return (
                    <div
                      key={rIdx}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white border border-gray-200"
                    >
                      <span className="text-xs text-gray-700 truncate flex-1">{title}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.class}`}>
                        {cfg.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {methods.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3 h-3 text-indigo-500" />
                <span className="text-xs font-semibold text-gray-600">学习方法建议</span>
              </div>
              <div className="space-y-1.5">
                {methods.map((m, mIdx) => {
                  const method = typeof m === 'string' ? m : m.method || m.description || m.name || ''
                  const time = typeof m === 'object' ? (m.time || m.estimated_time || '') : ''

                  return (
                    <div
                      key={mIdx}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white border border-gray-200"
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                      <span className="text-xs text-gray-700 flex-1">{method}</span>
                      {time && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-[10px] text-gray-400">{time}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ComparisonModal({ data, onClose }) {
  if (!data) return null

  const beforeRaw = data.before || data.previous || {}
  const afterRaw = data.after || data.current || {}
  const adjustments = data.adjustments || data.strategy_adjustments || []
  const beforePoints = Array.isArray(beforeRaw) ? beforeRaw : (beforeRaw.knowledge_points || [])
  const afterPoints = Array.isArray(afterRaw) ? afterRaw : (afterRaw.knowledge_points || [])

  const mergedPoints = beforePoints.map((bp, idx) => {
    const ap = afterPoints[idx] || {}
    const bName = bp.name || bp.topic || `知识点 ${idx + 1}`
    const aName = ap.name || ap.topic || bName
    const bMastery = bp.mastery ?? bp.score ?? 0
    const aMastery = ap.mastery ?? ap.score ?? 0
    const delta = aMastery - bMastery

    return { name: bName || aName, before: bMastery, after: aMastery, delta }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800">诊断效果对比</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {mergedPoints.length > 0 ? (
            <div className="space-y-2.5">
              {mergedPoints.map((point, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">{point.name}</span>
                    <div className="flex items-center gap-1">
                      {point.delta > 0 ? (
                        <ArrowUp className="w-3.5 h-3.5 text-green-500" />
                      ) : point.delta < 0 ? (
                        <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] text-gray-400">—</span>
                      )}
                      <span
                        className={`text-xs font-semibold ${
                          point.delta > 0 ? 'text-green-600' : point.delta < 0 ? 'text-red-600' : 'text-gray-400'
                        }`}
                      >
                        {point.delta > 0 ? '+' : ''}{point.delta}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400">之前</span>
                        <span className="text-[10px] text-gray-500">{point.before}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gray-400"
                          style={{ width: `${Math.min(Math.max(point.before, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400">现在</span>
                        <span className="text-[10px] text-gray-500">{point.after}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${getMasteryColor(point.after)}`}
                          style={{ width: `${Math.min(Math.max(point.after, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">暂无对比数据</p>
            </div>
          )}

          {adjustments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-semibold text-gray-600">策略调整建议</span>
              </div>
              <div className="space-y-1.5">
                {adjustments.map((adj, idx) => (
                  <div key={idx} className="flex items-start gap-2 px-3 py-2 rounded-md bg-indigo-50 border border-indigo-100">
                    <ChevronRight className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
                    <span className="text-xs text-indigo-700 leading-relaxed">
                      {typeof adj === 'string' ? adj : adj.suggestion || adj.description || adj.content || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function LearningDiagnosis({
  courseId,
  onTopicAsked,
  weakPoints,
  recentTopics,
  onFeedback,
  feedbackLoading,
  onWeakPointsUpdate,
}) {
  const [diagnosisData, setDiagnosisData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [reportContent, setReportContent] = useState('')
  const [reportStreaming, setReportStreaming] = useState(false)
  const [hasReport, setHasReport] = useState(false)

  const [planData, setPlanData] = useState(null)
  const [showPlan, setShowPlan] = useState(false)

  const [comparisonData, setComparisonData] = useState(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  const [practiceCount, setPracticeCount] = useState(0)
  const [exportLoading, setExportLoading] = useState(false)

  const abortControllerRef = useRef(null)

  const fetchDiagnosis = useCallback(async () => {
    if (!courseId) {
      setError('请先选择课程')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await aiTutor.getDiagnosis({ course_id: courseId })
      setDiagnosisData(response)

      const knowledgePoints = response.knowledge_points || response.points || []
      const outlinePoints = response.course_outline_points || []
      const allPoints = [...knowledgePoints, ...outlinePoints]
      const weak = allPoints.filter((p) => (p.mastery ?? p.score ?? 0) < WEAK_THRESHOLD)
      if (onWeakPointsUpdate) {
        onWeakPointsUpdate(weak)
      }

      if (response.practice_count !== undefined) {
        setPracticeCount(response.practice_count)
      }

      if (response.improvement_plan || response.plan) {
        setPlanData(response.improvement_plan || response.plan)
      }

      if (response.report) {
        setReportContent(response.report)
        setHasReport(true)
      }
    } catch (err) {
      setError(err.message || '加载诊断数据失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [courseId, onWeakPointsUpdate])

  useEffect(() => {
    fetchDiagnosis()
  }, [fetchDiagnosis])

  const parseSSEStream = useCallback(async (response) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })
    let buffer = ''
    let fullContent = ''

    const parseSSEMessage = (rawMessage) => {
      const lines = rawMessage.split('\n')
      const event = { id: null, event: null, data: null }
      for (const line of lines) {
        if (line.startsWith('id:')) {
          event.id = line.substring(3).trim()
        } else if (line.startsWith('event:')) {
          event.event = line.substring(6).trim()
        } else if (line.startsWith('data:')) {
          const dataStr = line.substring(5).trim()
          try {
            event.data = JSON.parse(dataStr)
          } catch {
            event.data = dataStr
          }
        }
      }
      return event
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            const evt = parseSSEMessage(buffer)
            if (evt.event === 'error') {
              throw new Error(evt.data?.error || evt.data || '生成报告时发生错误')
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || ''

        for (const message of messages) {
          if (!message.trim()) continue
          const evt = parseSSEMessage(message)

          if (evt.event === 'error') {
            throw new Error(evt.data?.error || evt.data || '生成报告时发生错误')
          }

          if (evt.event === 'done') continue

          if (evt.event === 'message' || evt.event === 'config' || evt.event === 'ping') {
            const data = evt.data
            if (data && typeof data === 'object') {
              if (data.content) {
                fullContent += data.content
                setReportContent(fullContent)
              }
              if (data.improvement_plan || data.plan) {
                setPlanData(data.improvement_plan || data.plan)
              }
            } else if (typeof data === 'string' && data && data !== '[DONE]') {
              fullContent += data
              setReportContent(fullContent)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return fullContent
  }, [])

  const handleGenerateReport = useCallback(async () => {
    if (reportStreaming) return

    setReportStreaming(true)
    setReportContent('')
    setHasReport(false)
    setError(null)

    try {
      abortControllerRef.current = new AbortController()

      const response = await aiTutor.diagnosisReportStream({
        course_id: courseId || undefined,
        _signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`请求失败(${response.status}): ${errorText || '服务器错误'}`)
      }

      const result = await parseSSEStream(response)
      setHasReport(true)
      setShowPlan(true)
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('abort') || err.message?.includes('ERR_ABORTED')) {
        return
      }
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        setError('网络连接失败，请检查网络后重试')
        return
      }
      setError(err.message || '生成报告失败，请重试')
    } finally {
      setReportStreaming(false)
      abortControllerRef.current = null
    }
  }, [courseId, reportStreaming, parseSSEStream])

  const handleComparison = useCallback(async () => {
    setComparisonLoading(true)
    setShowComparison(true)

    try {
      const response = await aiTutor.getDiagnosisComparison({ course_id: courseId })
      setComparisonData(response)
    } catch (err) {
      setComparisonData({ before: [], after: [], adjustments: [{ suggestion: '暂无历史对比数据，请完成更多练习后再试' }] })
    } finally {
      setComparisonLoading(false)
    }
  }, [courseId])

  const handlePractice = useCallback((pointName) => {
    if (onTopicAsked) {
      onTopicAsked(pointName)
    }
  }, [onTopicAsked])

  const handleExportReport = useCallback(async () => {
    if (exportLoading) return
    setExportLoading(true)
    try {
      const blob = await aiTutor.exportDiagnosisReport({
        course_id: courseId || undefined,
        report_content: reportContent || undefined,
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diagnosis_report_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || '导出报告失败，请重试')
    } finally {
      setExportLoading(false)
    }
  }, [courseId, reportContent, exportLoading])

  const knowledgePoints = diagnosisData?.knowledge_points || diagnosisData?.points || []
  const outlinePoints = diagnosisData?.course_outline_points || []
  const allKnowledgePoints = [...knowledgePoints, ...outlinePoints]
  const standardDimensions = diagnosisData?.standard_dimensions || []

  const bloomScores = (() => {
    const raw = diagnosisData?.bloom_taxonomy || diagnosisData?.bloom_scores
    if (raw && Object.keys(raw).length > 0) return raw
    const aggregated = {}
    const sources = [...allKnowledgePoints, ...standardDimensions]
    for (const item of sources) {
      const bl = item.bloom_levels || item.bloom_taxonomy || {}
      for (const [key, val] of Object.entries(bl)) {
        if (typeof val === 'number') {
          if (!aggregated[key]) aggregated[key] = { sum: 0, count: 0 }
          aggregated[key].sum += val
          aggregated[key].count += 1
        }
      }
    }
    const result = {}
    for (const [key, { sum, count }] of Object.entries(aggregated)) {
      result[key] = count > 0 ? Math.round(sum / count) : 0
    }
    return result
  })()
  const currentWeakPoints = allKnowledgePoints.filter((p) => (p.mastery ?? p.score ?? 0) < WEAK_THRESHOLD)

  const showPracticeReminder = practiceCount >= 5 && !hasReport

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-700">学习诊断</span>
            {currentWeakPoints.length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5">
                {currentWeakPoints.length} 个薄弱点
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDiagnosis}
            disabled={loading}
            className="h-7 text-xs gap-1"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            刷新
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {loading && !diagnosisData && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm text-gray-500">加载诊断数据...</p>
          </div>
        )}

        {loading && diagnosisData && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            <span className="text-xs text-indigo-700">正在刷新诊断数据...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        {!loading && !error && !diagnosisData && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">学习诊断</h3>
            <p className="text-sm text-gray-400">选择课程后自动加载诊断数据</p>
          </div>
        )}

        {diagnosisData && (
          <div className="animate-fade-in space-y-6">
            {allKnowledgePoints.length === 0 && standardDimensions.length === 0 && Object.keys(bloomScores).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-1">暂无诊断数据</p>
                <p className="text-xs text-gray-400">完成更多练习后，系统将自动生成学习诊断分析</p>
              </div>
            )}

            {showPracticeReminder && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-800">
                  你已完成 {practiceCount} 次练习，建议查看诊断报告了解学习情况
                </span>
              </div>
            )}

            {allKnowledgePoints.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">知识掌握度总览</span>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 mb-3">
                  <MasteryRadarChart knowledgePoints={allKnowledgePoints} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {allKnowledgePoints.map((point, idx) => {
                    const name = point.name || point.topic || `知识点 ${idx + 1}`
                    return (
                      <KnowledgePointCard
                        key={idx}
                        point={point}
                        onPractice={handlePractice}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {standardDimensions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">标准化维度分析</span>
                </div>
                <div className="space-y-2">
                  {standardDimensions.map((dim, idx) => {
                    const mastery = dim.mastery ?? 0
                    return (
                      <div key={idx} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700">{dim.dimension}</span>
                          <span className={`text-xs font-semibold ${getMasteryTextColor(mastery)}`}>
                            {mastery}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${getMasteryColor(mastery)} transition-all duration-500`}
                            style={{ width: `${Math.min(Math.max(mastery, 0), 100)}%` }}
                          />
                        </div>
                        {dim.tags && dim.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {dim.tags.slice(0, 6).map((tag, tIdx) => (
                              <span key={tIdx} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                {tag}
                              </span>
                            ))}
                            {dim.tags.length > 6 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                                +{dim.tags.length - 6}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {Object.keys(bloomScores).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">布鲁姆认知层次评估</span>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <BloomTaxonomyBars bloomScores={bloomScores} />
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <DiagnosisReportSection
                reportContent={reportContent}
                isStreaming={reportStreaming}
                onGenerate={handleGenerateReport}
                onExport={handleExportReport}
                loading={reportStreaming}
                exportLoading={exportLoading}
                hasReport={hasReport}
              />
            </div>

            {showPlan && (
              <div className="border-t border-gray-200 pt-4">
                <ImprovementPlanSection
                  weakPoints={currentWeakPoints}
                  planData={planData}
                  onPractice={handlePractice}
                />
              </div>
            )}

            {hasReport && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-gray-700">效果追踪</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleComparison}
                    disabled={comparisonLoading}
                    className="h-7 text-xs gap-1.5"
                  >
                    {comparisonLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <BarChart3 className="w-3 h-3" />
                    )}
                    查看效果对比
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showComparison && (
        <ComparisonModal
          data={comparisonData}
          onClose={() => {
            setShowComparison(false)
            setComparisonData(null)
          }}
        />
      )}
    </div>
  )
}
