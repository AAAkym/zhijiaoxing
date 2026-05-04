import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sparkles,
  RefreshCw,
  FileText,
  BookOpen,
  Target,
  Lightbulb,
  Loader2,
  X,
  Layers,
  Calendar
} from 'lucide-react'
import { notes } from '@/services/api'

export function NoteSummaryPanel({ noteId, onSummaryGenerated }) {
  const [summary, setSummary] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerateSummary = useCallback(async () => {
    if (isGenerating) return

    setIsGenerating(true)
    setError(null)
    setSummary('')

    try {
      const response = await notes.summarizeNoteStream(noteId)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                setSummary(prev => prev + data.content)
              }
              if (data.done && onSummaryGenerated) {
                onSummaryGenerated(summary)
              }
              if (data.error) {
                setError(data.error)
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }

      setIsGenerating(false)
    } catch (err) {
      console.error('Summary generation error:', err)
      setError('摘要生成失败，请稍后重试')
      setIsGenerating(false)
    }
  }, [noteId, isGenerating, onSummaryGenerated, summary])

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI 摘要
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {summary ? '重新生成' : '生成摘要'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}
        {isGenerating && !summary && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
            <p className="text-gray-500">AI 正在生成摘要...</p>
          </div>
        )}
        {summary && (
          <div className="prose prose-sm max-w-none text-gray-700">
            {summary.split('\n').map((line, idx) => (
              <p key={idx} className="mb-2">{line}</p>
            ))}
            {isGenerating && (
              <div className="flex items-center gap-2 text-purple-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在生成...
              </div>
            )}
          </div>
        )}
        {!summary && !isGenerating && !error && (
          <div className="text-center py-6 text-gray-500">
            <Sparkles className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">点击"生成摘要"按钮</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function NotesOrganizePanel({ selectedNotes, onOrganizeComplete }) {
  const [organizedContent, setOrganizedContent] = useState('')
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [error, setError] = useState(null)

  const handleOrganize = useCallback(async () => {
    if (!selectedNotes || selectedNotes.length === 0) return

    setIsOrganizing(true)
    setOrganizedContent('')
    setError(null)
    setShowDialog(true)

    try {
      const noteIds = selectedNotes.map(n => n.id)
      const response = await notes.organizeNotesStream(noteIds)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                setOrganizedContent(prev => prev + data.content)
              }
              if (data.done && onOrganizeComplete) {
                onOrganizeComplete(organizedContent)
              }
              if (data.error) {
                setError(data.error)
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }

      setIsOrganizing(false)
    } catch (err) {
      console.error('Organize error:', err)
      setError('整理失败，请稍后重试')
      setIsOrganizing(false)
    }
  }, [selectedNotes, onOrganizeComplete, organizedContent])

  const renderOrganizedContent = (content) => {
    if (!content) return null

    const sections = content.split(/##\s*/)
    const elements = []

    sections.forEach((section, index) => {
      if (!section.trim()) return

      const lines = section.trim().split('\n')
      const title = lines[0].trim()
      const body = lines.slice(1).join('\n').trim()

      const getIcon = (titleText) => {
        if (titleText.includes('知识框架')) return <Layers className="w-5 h-5 text-blue-500" />
        if (titleText.includes('核心概念')) return <BookOpen className="w-5 h-5 text-green-500" />
        if (titleText.includes('复习要点')) return <Target className="w-5 h-5 text-amber-500" />
        if (titleText.includes('知识盲点')) return <Lightbulb className="w-5 h-5 text-red-500" />
        return <FileText className="w-5 h-5 text-gray-500" />
      }

      const getBgColor = (titleText) => {
        if (titleText.includes('知识框架')) return 'bg-blue-50 border-blue-200'
        if (titleText.includes('核心概念')) return 'bg-green-50 border-green-200'
        if (titleText.includes('复习要点')) return 'bg-amber-50 border-amber-200'
        if (titleText.includes('知识盲点')) return 'bg-red-50 border-red-200'
        return 'bg-gray-50 border-gray-200'
      }

      elements.push(
        <div key={index} className={`rounded-lg border p-4 mb-4 ${getBgColor(title)}`}>
          <div className="flex items-center gap-2 mb-2">
            {getIcon(title)}
            <h4 className="font-semibold text-gray-800">{title}</h4>
          </div>
          <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
            {body}
          </div>
        </div>
      )
    })

    return elements
  }

  return (
    <>
      <Button
        onClick={handleOrganize}
        disabled={!selectedNotes || selectedNotes.length === 0 || isOrganizing}
        className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
      >
        {isOrganizing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            整理中...
          </>
        ) : (
          <>
            <Layers className="w-4 h-4" />
            AI 整理 ({selectedNotes?.length || 0})
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-500" />
              AI 笔记整理
              <Badge variant="secondary" className="ml-2">
                {selectedNotes?.length || 0} 篇笔记
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">
                {error}
              </div>
            )}
            {isOrganizing && !organizedContent && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                <p className="text-gray-500">AI 正在整理 {selectedNotes?.length || 0} 篇笔记...</p>
              </div>
            )}
            {organizedContent && (
              <div className="space-y-2">
                {renderOrganizedContent(organizedContent)}
                {isOrganizing && (
                  <div className="flex items-center gap-2 text-purple-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在生成...
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function WeeklyReportPanel({ onReportGenerated }) {
  const [report, setReport] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [error, setError] = useState(null)
  const [weekInfo, setWeekInfo] = useState({ start: '', end: '' })

  const handleGenerateReport = useCallback(async () => {
    setIsGenerating(true)
    setReport('')
    setError(null)
    setShowDialog(true)

    const today = new Date()
    const weekEnd = today.toISOString().split('T')[0]
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    setWeekInfo({ start: weekStart, end: weekEnd })

    try {
      const response = await notes.generateWeeklyReportStream(weekStart, weekEnd)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                setReport(prev => prev + data.content)
              }
              if (data.done && onReportGenerated) {
                onReportGenerated(report)
              }
              if (data.error) {
                setError(data.error)
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }

      setIsGenerating(false)
    } catch (err) {
      console.error('Report generation error:', err)
      setError('报告生成失败，请稍后重试')
      setIsGenerating(false)
    }
  }, [onReportGenerated, report])

  const renderReportContent = (content) => {
    if (!content) return null

    const sections = content.split(/##\s*/)
    const elements = []

    sections.forEach((section, index) => {
      if (!section.trim()) return

      const lines = section.trim().split('\n')
      const title = lines[0].trim()
      const body = lines.slice(1).join('\n').trim()

      const getIcon = (titleText) => {
        if (titleText.includes('学习概况')) return <Calendar className="w-5 h-5 text-blue-500" />
        if (titleText.includes('知识掌握')) return <BookOpen className="w-5 h-5 text-green-500" />
        if (titleText.includes('错题分析')) return <Target className="w-5 h-5 text-red-500" />
        if (titleText.includes('学习建议')) return <Lightbulb className="w-5 h-5 text-amber-500" />
        if (titleText.includes('小贴士')) return <Sparkles className="w-5 h-5 text-purple-500" />
        return <FileText className="w-5 h-5 text-gray-500" />
      }

      const getBgColor = (titleText) => {
        if (titleText.includes('学习概况')) return 'bg-blue-50 border-blue-200'
        if (titleText.includes('知识掌握')) return 'bg-green-50 border-green-200'
        if (titleText.includes('错题分析')) return 'bg-red-50 border-red-200'
        if (titleText.includes('学习建议')) return 'bg-amber-50 border-amber-200'
        if (titleText.includes('小贴士')) return 'bg-purple-50 border-purple-200'
        return 'bg-gray-50 border-gray-200'
      }

      elements.push(
        <div key={index} className={`rounded-lg border p-4 mb-4 ${getBgColor(title)}`}>
          <div className="flex items-center gap-2 mb-2">
            {getIcon(title)}
            <h4 className="font-semibold text-gray-800">{title}</h4>
          </div>
          <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
            {body}
          </div>
        </div>
      )
    })

    return elements
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleGenerateReport}
        disabled={isGenerating}
        className="gap-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Calendar className="w-4 h-4" />
            周学习报告
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              周学习报告
              <Badge variant="secondary" className="ml-2">
                {weekInfo.start} 至 {weekInfo.end}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">
                {error}
              </div>
            )}
            {isGenerating && !report && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                <p className="text-gray-500">AI 正在生成周学习报告...</p>
              </div>
            )}
            {report && (
              <div className="space-y-2">
                {renderReportContent(report)}
                {isGenerating && (
                  <div className="flex items-center gap-2 text-blue-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在生成...
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default NoteSummaryPanel
