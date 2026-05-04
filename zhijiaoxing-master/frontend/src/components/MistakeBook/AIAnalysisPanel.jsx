import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Lightbulb,
  Target,
  Loader2,
  WifiOff,
  Search,
  BarChart3,
  FileText,
  RotateCcw,
  Shield
} from 'lucide-react'
import { mistakeBook } from '@/services/api'

const MAX_RETRIES = 2
const RETRY_DELAYS = [1500, 3000]
const MIN_ANALYSIS_DISPLAY_MS = 1500

export default function AIAnalysisPanel({
  mistakeId,
  initialAnalysis = null,
  onAnalysisComplete = null,
  showHeader = true,
  compact = false,
  onGenerateTargeted = null
}) {
  const [analysis, setAnalysis] = useState(initialAnalysis || '')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const [analysisNotice, setAnalysisNotice] = useState(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const abortControllerRef = useRef(null)
  const partialAnalysisRef = useRef('')
  const fullAnalysisRef = useRef(initialAnalysis || '')
  const streamStartTimeRef = useRef(null)
  const minDisplayTimerRef = useRef(null)
  const analysisCompletedRef = useRef(!!initialAnalysis)
  const mountRef = useRef(false)
  const autoTriggerTimerRef = useRef(null)
  const autoTriggeredMistakeRef = useRef(null)

  useEffect(() => {
    if (initialAnalysis) {
      setAnalysis(initialAnalysis)
      partialAnalysisRef.current = initialAnalysis
      fullAnalysisRef.current = initialAnalysis
      analysisCompletedRef.current = true
    }
  }, [initialAnalysis])

  useEffect(() => {
    if (analysis) {
      fullAnalysisRef.current = analysis
    }
  }, [analysis])

  useEffect(() => {
    mountRef.current = true
    return () => {
      mountRef.current = false
      if (autoTriggerTimerRef.current) {
        clearTimeout(autoTriggerTimerRef.current)
      }
      if (minDisplayTimerRef.current) {
        clearTimeout(minDisplayTimerRef.current)
      }
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    autoTriggeredMistakeRef.current = null
  }, [mistakeId])

  const handleStreamAnalyze = useCallback(async (isRetry = false) => {
    if (isAnalyzing) return

    console.log('[AI Analysis] 开始分析错题:', mistakeId, isRetry ? '(重试)' : '')
    setIsAnalyzing(true)
    setError(null)
    setAnalysisNotice(null)
    setShowCompletionAnimation(false)

    if (minDisplayTimerRef.current) {
      clearTimeout(minDisplayTimerRef.current)
      minDisplayTimerRef.current = null
    }

    if (!isRetry) {
      setAnalysis('')
      partialAnalysisRef.current = ''
    }

    streamStartTimeRef.current = Date.now()
    abortControllerRef.current = new AbortController()

    try {
      console.log('[AI Analysis] 发送流式分析请求...')
      const response = await mistakeBook.analyzeMistakeStream(
        mistakeId,
        abortControllerRef.current.signal
      )

      console.log('[AI Analysis] 响应状态:', response.status, response.statusText)

      if (!response.ok) {
        let errorMsg = '分析请求失败'
        if (response.status === 401) {
          errorMsg = '登录已过期，请重新登录'
        } else if (response.status === 404) {
          errorMsg = '错题记录不存在'
        } else if (response.status >= 500) {
          errorMsg = '服务器内部错误，请稍后重试'
        }
        try {
          const errData = await response.json()
          if (errData.error) errorMsg = errData.error
        } catch { /* ignore */ }
        console.error('[AI Analysis] 请求失败:', errorMsg)
        setError(errorMsg)
        setIsAnalyzing(false)
        return
      }

      if (!response.body) {
        console.error('[AI Analysis] 无法获取响应流')
        setError('无法获取响应流，请检查网络连接')
        setIsAnalyzing(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullAnalysis = ''
      let receivedDoneSignal = false

      console.log('[AI Analysis] 开始读取流式数据...')

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[AI Analysis] 流式数据读取完成, 总长度:', fullAnalysis.length)
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                fullAnalysis += data.content
                partialAnalysisRef.current = fullAnalysis
                setAnalysis(fullAnalysis)
              }
              if (data.replace) {
                fullAnalysis = data.replace
                fullAnalysisRef.current = data.replace
                partialAnalysisRef.current = data.replace
                setAnalysis(data.replace)
              }
              if (data.meta) {
                console.log('[AI Analysis] 服务端提示:', data.meta)
                setAnalysisNotice(data.meta)
              }
              if (data.done) {
                receivedDoneSignal = true
                console.log('[AI Analysis] 收到完成信号, 完整分析长度:', fullAnalysis.length)
                fullAnalysisRef.current = fullAnalysis
                setAnalysis(fullAnalysis)
                analysisCompletedRef.current = true
                setShowCompletionAnimation(true)
                setRetryCount(0)
                if (onAnalysisComplete) {
                  onAnalysisComplete(data.analysis || fullAnalysis)
                }
              }
              if (data.error) {
                console.error('[AI Analysis] 收到错误信息:', data.error)
                setError(data.error)
              }
            } catch (e) {
              console.error('[AI Analysis] JSON解析错误:', e)
            }
          }
        }
      }

      if (!receivedDoneSignal && fullAnalysis.trim()) {
        console.warn('[AI Analysis] 未收到 done 信号，使用已接收内容作为最终结果')
        fullAnalysisRef.current = fullAnalysis
        setAnalysis(fullAnalysis)
        analysisCompletedRef.current = true
        setAnalysisNotice('分析已部分完成：连接中断前的内容已为你保留。')
        if (onAnalysisComplete) onAnalysisComplete(fullAnalysis)
      }

      console.log('[AI Analysis] 分析流程结束')
      const elapsed = Date.now() - (streamStartTimeRef.current || Date.now())
      const remainingTime = Math.max(0, MIN_ANALYSIS_DISPLAY_MS - elapsed)
      if (remainingTime > 0) {
        minDisplayTimerRef.current = setTimeout(() => {
          setIsAnalyzing(false)
          setShowCompletionAnimation(false)
        }, remainingTime)
      } else {
        setIsAnalyzing(false)
        setShowCompletionAnimation(false)
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        console.log('[AI Analysis] 请求被主动中止')
        if (partialAnalysisRef.current) {
          setAnalysis(partialAnalysisRef.current)
          setAnalysisNotice('分析被中断：已展示中断前生成的内容。')
        }
        setError(null)
        setIsAnalyzing(false)
        return
      }

      console.error('[AI Analysis] 分析过程异常:', err)
      let errMsg = err.message || '分析失败，请检查网络连接后重试'
      const isNetworkError = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('ERR_ABORTED') || errMsg.includes('abort')

      if (isNetworkError) {
        if (partialAnalysisRef.current) {
          setAnalysis(partialAnalysisRef.current)
          setAnalysisNotice('网络中断：已展示中断前生成的内容，可点击"重新分析"获取完整版本。')
          errMsg = '网络连接中断，点击"重新分析"可重新获取完整分析'
        } else {
          errMsg = '网络连接失败，请检查网络或服务是否正常'
        }
      } else if (errMsg.includes('timeout')) {
        errMsg = '分析超时，请稍后重试'
      }

      setError(errMsg)
      setIsAnalyzing(false)
    }
  }, [mistakeId, isAnalyzing, onAnalysisComplete])

  const handleRetry = useCallback(() => {
    const nextRetry = retryCount + 1
    if (nextRetry <= MAX_RETRIES) {
      setRetryCount(nextRetry)
      const delay = RETRY_DELAYS[nextRetry - 1] || 3000
      console.log(`[AI Analysis] 准备自动重试 (${nextRetry}/${MAX_RETRIES})，延迟 ${delay}ms...`)
      setTimeout(() => {
        if (mountRef.current) {
          handleStreamAnalyze(true)
        }
      }, delay)
    } else {
      console.warn('[AI Analysis] 已达最大重试次数')
    }
  }, [retryCount, handleStreamAnalyze])

  useEffect(() => {
    if (error && retryCount < MAX_RETRIES && !partialAnalysisRef.current) {
      handleRetry()
    }
  }, [error, retryCount, handleRetry])

  useEffect(() => {
    if (!mistakeId || initialAnalysis || analysis || analysisCompletedRef.current || !mountRef.current || autoTriggeredMistakeRef.current === mistakeId) {
      return
    }
    if (autoTriggerTimerRef.current) {
      clearTimeout(autoTriggerTimerRef.current)
    }
    autoTriggerTimerRef.current = setTimeout(() => {
      if (mountRef.current && !analysisCompletedRef.current && !analysis && !initialAnalysis && !isAnalyzing) {
        console.log('[AI Analysis] 检测到未分析的错题，自动触发分析')
        autoTriggeredMistakeRef.current = mistakeId
        handleStreamAnalyze()
      }
    }, 300)
    return () => {
      if (autoTriggerTimerRef.current) {
        clearTimeout(autoTriggerTimerRef.current)
        autoTriggerTimerRef.current = null
      }
    }
  }, [mistakeId, initialAnalysis, analysis, handleStreamAnalyze, isAnalyzing])

  const renderAnalysisContent = (content) => {
    if (!content) return null

    const sections = content.split(/##\s*/)
    const elements = []

    sections.forEach((section, index) => {
      if (!section.trim()) return

      const lines = section.trim().split('\n')
      const title = lines[0].trim()
      const body = lines.slice(1).join('\n').trim()

      const getIcon = (titleText) => {
        if (titleText.includes('错因结论') || titleText.includes('错误原因') || titleText.includes('根本原因')) return <AlertCircle className="w-5 h-5 text-red-500" />
        if (titleText.includes('知识点掌握情况') || titleText.includes('知识点')) return <BookOpen className="w-5 h-5 text-blue-500" />
        if (titleText.includes('解题思路偏差') || titleText.includes('解题思路')) return <Search className="w-5 h-5 text-purple-500" />
        if (titleText.includes('计算失误类型') || titleText.includes('计算失误')) return <BarChart3 className="w-5 h-5 text-orange-500" />
        if (titleText.includes('概念理解错误') || titleText.includes('概念理解')) return <FileText className="w-5 h-5 text-rose-500" />
        if (titleText.includes('改进建议') || titleText.includes('学习建议')) return <Lightbulb className="w-5 h-5 text-amber-500" />
        if (titleText.includes('错误现象')) return <AlertCircle className="w-5 h-5 text-orange-500" />
        if (titleText.includes('影响范围')) return <BarChart3 className="w-5 h-5 text-purple-500" />
        if (titleText.includes('技术证据')) return <FileText className="w-5 h-5 text-blue-500" />
        if (titleText.includes('学习路径')) return <Target className="w-5 h-5 text-green-500" />
        return <CheckCircle className="w-5 h-5 text-gray-500" />
      }

      const getBgColor = (titleText) => {
        if (titleText.includes('错因结论') || titleText.includes('错误原因') || titleText.includes('根本原因')) return 'bg-red-50 border-red-200'
        if (titleText.includes('知识点掌握情况') || titleText.includes('知识点')) return 'bg-blue-50 border-blue-200'
        if (titleText.includes('解题思路偏差') || titleText.includes('解题思路')) return 'bg-purple-50 border-purple-200'
        if (titleText.includes('计算失误类型') || titleText.includes('计算失误')) return 'bg-orange-50 border-orange-200'
        if (titleText.includes('概念理解错误') || titleText.includes('概念理解')) return 'bg-rose-50 border-rose-200'
        if (titleText.includes('改进建议') || titleText.includes('学习建议')) return 'bg-amber-50 border-amber-200'
        if (titleText.includes('错误现象')) return 'bg-orange-50 border-orange-200'
        if (titleText.includes('影响范围')) return 'bg-purple-50 border-purple-200'
        if (titleText.includes('技术证据')) return 'bg-blue-50 border-blue-200'
        if (titleText.includes('学习路径')) return 'bg-green-50 border-green-200'
        return 'bg-gray-50 border-gray-200'
      }

      elements.push(
        <div key={index} className={`rounded-lg border p-4 mb-4 ${getBgColor(title)}`}>
          <div className="flex items-center gap-2 mb-2">
            {getIcon(title)}
            <h4 className="font-semibold text-gray-800">{title}</h4>
          </div>
          <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
            {formatBody(body)}
          </div>
        </div>
      )
    })

    return elements
  }

  const formatBody = (body) => {
    const lines = body.split('\n')
    return lines.map((line, idx) => {
      const trimmedLine = line.trim()
      if (!trimmedLine) return <div key={idx} className="h-2" />
      if (trimmedLine.match(/^\d+\./)) {
        return (
          <div key={idx} className="ml-4 mb-1">
            <span className="font-medium text-gray-800">{trimmedLine}</span>
          </div>
        )
      }
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
        return (
          <div key={idx} className="ml-4 mb-1 flex items-start gap-1">
            <span className="text-gray-400 mt-1">•</span>
            <span className="text-gray-600">{trimmedLine.slice(1).trim()}</span>
          </div>
        )
      }
      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        return (
          <div key={idx} className="font-semibold text-gray-800 mt-2 mb-1">
            {trimmedLine.replace(/\*\*/g, '')}
          </div>
        )
      }
      return <div key={idx} className="text-gray-700">{trimmedLine}</div>
    })
  }

  const extractKnowledgeTags = useCallback((analysisText) => {
    if (!analysisText) return []
    const patterns = [
      /##\s*知识点[：:\s]*([\s\S]*?)(?=##|$)/,
      /涉及知识点[：:\s]*([\s\S]*?)(?=\n\n|\n(?=#)|$)/,
      /知识点[：:\s]*([^\n]+)/
    ]
    for (const pattern of patterns) {
      const match = analysisText.match(pattern)
      if (match && match[1]) {
        return match[1]
          .split(/[,，、;；/]/)
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0 && tag.length < 50)
      }
    }
    return []
  }, [])

  if (compact && !analysis && !isAnalyzing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleStreamAnalyze()}
        disabled={isAnalyzing}
        className="gap-2"
      >
        <Sparkles className="w-4 h-4" />
        AI 分析
      </Button>
    )
  }

  const isNetworkError = error && (
    error.includes('连接中断') ||
    error.includes('网络连接') ||
    error.includes('Failed to fetch') ||
    error.includes('ERR_ABORTED')
  )
  const canRetry = error && retryCount < MAX_RETRIES

  return (
    <Card className="border-blue-200">
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              AI 错因分析
            </CardTitle>
            <div className="flex items-center gap-2">
              {analysis && !isAnalyzing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRetryCount(0)
                  handleStreamAnalyze()
                }}
                disabled={isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    分析中...
                  </>
                ) : analysis ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    重新分析
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    开始分析
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      )}

      {(isExpanded || !showHeader) && (
        <CardContent>
          {error && (
            <div className={`border rounded-lg p-4 mb-4 flex items-start gap-3 ${
              isNetworkError
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {isNetworkError ? (
                <WifiOff className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                {isNetworkError && (
                  <p className="text-xs mt-1 opacity-75">
                    可能的原因：后端服务未启动、Spark API 连接中断、或代理超时
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRetryCount(0)
                      handleStreamAnalyze()
                    }}
                    className="gap-1 text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    重新分析
                  </Button>
                  {canRetry && (
                    <span className="text-xs opacity-60 self-center">
                      剩余重试次数: {MAX_RETRIES - retryCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {analysisNotice && !error && (
            <div className="border rounded-lg p-3 mb-4 flex items-start gap-2 bg-blue-50 border-blue-200 text-blue-700">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{analysisNotice}</p>
            </div>
          )}

          {isAnalyzing && !analysis && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-gray-500">AI 正在分析错题原因...</p>
              <p className="text-xs text-gray-400 mt-1">分析结果将自动保存</p>
              <div className="flex gap-1 mt-3">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}

          {analysis && (
            <div className="space-y-2">
              {renderAnalysisContent(analysis)}
              {isAnalyzing && !showCompletionAnimation && (
                <div className="flex items-center gap-2 text-blue-500 text-sm p-3 bg-blue-50 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在生成... (已接收 {analysis.length} 字符)
                </div>
              )}
              {showCompletionAnimation && (
                <div className="flex items-center gap-2 text-green-600 text-sm p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-4 h-4" />
                  分析完成！结果已自动保存
                </div>
              )}
              {!isAnalyzing && analysis && onGenerateTargeted && (
                <Button
                  onClick={() => onGenerateTargeted({ mistakeId, analysis, knowledgeTags: extractKnowledgeTags(analysis) })}
                  className="w-full mt-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  size="sm"
                >
                  <Target className="w-4 h-4 mr-2" />
                  基于此错因生成靶向练习
                </Button>
              )}
            </div>
          )}

          {!analysis && !isAnalyzing && !error && (
            <div className="text-center py-8 text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              {analysisCompletedRef.current ? (
                <>
                  <p>分析未返回内容，可能服务未配置</p>
                  <p className="text-sm mt-1">请检查后端 AI 服务是否正常运行</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-2"
                    onClick={() => {
                      setRetryCount(0)
                      handleStreamAnalyze()
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新尝试
                  </Button>
                </>
              ) : (
                <>
                  <p>点击"开始分析"按钮，AI 将为你分析错题原因</p>
                  <p className="text-sm mt-1">分析结果将自动保存</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
