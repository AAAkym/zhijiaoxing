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
  Loader2
} from 'lucide-react'
import { mistakeBook } from '@/services/api'

export default function AIAnalysisPanel({
  mistakeId,
  initialAnalysis = null,
  onAnalysisComplete = null,
  showHeader = true,
  compact = false
}) {
  const [analysis, setAnalysis] = useState(initialAnalysis || '')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    if (initialAnalysis) {
      setAnalysis(initialAnalysis)
    }
  }, [initialAnalysis])

  const handleStreamAnalyze = useCallback(async () => {
    if (isAnalyzing) return

    console.log('[AI Analysis] 开始分析错题:', mistakeId)
    setIsAnalyzing(true)
    setError(null)
    setAnalysis('')

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
        } catch (_) {}
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
      let fullAnalysis = '' // 修复：使用局部变量累积完整内容，避免闭包陷阱

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
                fullAnalysis += data.content // 修复：同时更新局部变量
                setAnalysis(prev => prev + data.content)
              }
              if (data.done) {
                console.log('[AI Analysis] 收到完成信号, 完整分析长度:', fullAnalysis.length)
                // 修复：使用局部变量fullAnalysis而非闭包中的analysis状态
                if (onAnalysisComplete) {
                  onAnalysisComplete(data.analysis || fullAnalysis)
                }
              }
              if (data.error) {
                console.error('[AI Analysis] 收到错误信息:', data.error)
                setError(data.error)
              }
            } catch (e) {
              console.error('[AI Analysis] JSON解析错误:', e, '原始数据:', line)
            }
          }
        }
      }

      console.log('[AI Analysis] 分析流程结束')
      setIsAnalyzing(false)
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[AI Analysis] 用户取消分析')
        setError(null)
      } else {
        console.error('[AI Analysis] 分析过程异常:', err)
        const errMsg = err.message || '分析失败，请检查网络连接后重试'
        setError(errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')
          ? '网络连接失败，请检查网络或服务是否正常'
          : errMsg)
      }
      setIsAnalyzing(false)
    }
  }, [mistakeId, isAnalyzing, onAnalysisComplete])

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
        if (titleText.includes('错误原因')) return <AlertCircle className="w-5 h-5 text-red-500" />
        if (titleText.includes('知识点')) return <BookOpen className="w-5 h-5 text-blue-500" />
        if (titleText.includes('学习建议')) return <Lightbulb className="w-5 h-5 text-amber-500" />
        if (titleText.includes('学习路径')) return <Target className="w-5 h-5 text-green-500" />
        return <CheckCircle className="w-5 h-5 text-gray-500" />
      }

      const getBgColor = (titleText) => {
        if (titleText.includes('错误原因')) return 'bg-red-50 border-red-200'
        if (titleText.includes('知识点')) return 'bg-blue-50 border-blue-200'
        if (titleText.includes('学习建议')) return 'bg-amber-50 border-amber-200'
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
      if (trimmedLine.match(/^\d+\./)) {
        return (
          <div key={idx} className="ml-4 mb-1">
            <span className="font-medium text-gray-800">{trimmedLine}</span>
          </div>
        )
      }
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
        return (
          <div key={idx} className="ml-4 mb-1">
            <span className="text-gray-600">• {trimmedLine.slice(1).trim()}</span>
          </div>
        )
      }
      return <div key={idx}>{trimmedLine}</div>
    })
  }

  if (compact && !analysis && !isAnalyzing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleStreamAnalyze}
        disabled={isAnalyzing}
        className="gap-2"
      >
        <Sparkles className="w-4 h-4" />
        AI 分析
      </Button>
    )
  }

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
                onClick={handleStreamAnalyze}
                disabled={isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    {analysis ? '重新分析' : '开始分析'}
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {isAnalyzing && !analysis && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-gray-500">AI 正在分析错题原因...</p>
              <div className="flex gap-1 mt-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}

          {analysis && (
            <div className="space-y-2">
              {renderAnalysisContent(analysis)}
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-blue-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在生成...
                </div>
              )}
            </div>
          )}

          {!analysis && !isAnalyzing && !error && (
            <div className="text-center py-8 text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>点击"开始分析"按钮，AI 将为你分析错题原因</p>
              <p className="text-sm mt-1">分析结果将自动保存</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
