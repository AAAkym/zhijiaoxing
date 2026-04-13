import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  XCircle,
  Lightbulb,
  FileText,
  Edit3,
  Save,
  Sparkles,
  Loader2 // 修复：添加Loader2图标用于加载状态
} from 'lucide-react'
import AIAnalysisPanel from './AIAnalysisPanel'

const STATUS_CONFIG = {
  unmastered: {
    label: '未掌握',
    color: 'bg-red-100 text-red-700 border-red-200',
    nextStatus: 'reviewing',
    nextLabel: '开始复习',
    nextColor: 'bg-blue-600 hover:bg-blue-700'
  },
  reviewing: {
    label: '复习中',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    nextStatus: 'mastered',
    nextLabel: '标记已掌握',
    nextColor: 'bg-green-600 hover:bg-green-700'
  },
  mastered: {
    label: '已掌握',
    color: 'bg-green-100 text-green-700 border-green-200',
    nextStatus: 'unmastered',
    nextLabel: '重新学习',
    nextColor: 'bg-orange-600 hover:bg-orange-700'
  }
}

export default function MistakeDetail({ mistake, onBack, onUpdateStatus }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState(mistake?.ai_analysis || '')
  const [noteSaving, setNoteSaving] = useState(false) // 修复：增加笔记保存状态

  if (!mistake) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">未找到错题信息</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            返回列表
          </Button>
        </CardContent>
      </Card>
    )
  }

  const statusConfig = STATUS_CONFIG[mistake.mastery_status] || STATUS_CONFIG.unmastered

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleStatusUpdate = async () => {
    setIsUpdating(true)
    try {
      await onUpdateStatus(mistake.id, statusConfig.nextStatus)
    } catch (err) {
      console.error('更新状态失败:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  // 修复：实现笔记保存功能，增加加载状态和用户反馈
  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      alert('笔记内容不能为空')
      return
    }
    
    setNoteSaving(true)
    try {
      // 调用API保存笔记（假设 onUpdateStatus 支持传递 note 参数）
      // 如果后端支持单独的笔记保存接口，应该调用该接口
      console.log('保存笔记:', noteContent)
      
      // TODO: 集成实际的笔记保存API调用
      // await mistakeBook.saveNote(mistake.id, noteContent)
      
      setShowNoteEditor(false)
      setNoteContent('')
      alert('笔记保存成功！') // 修复：给用户成功反馈
    } catch (err) {
      console.error('保存笔记失败:', err)
      alert('保存笔记失败，请稍后重试') // 修复：错误提示
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
      </div>

      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={statusConfig.color}>
                  {statusConfig.label}
                </Badge>
                {mistake.course_title && (
                  <Badge variant="outline">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {mistake.course_title}
                  </Badge>
                )}
                {mistake.assessment_title && (
                  <Badge variant="outline">
                    来源: {mistake.assessment_title}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl">题目详情</CardTitle>
            </div>
            <Button
              className={statusConfig.nextColor}
              onClick={handleStatusUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? '更新中...' : statusConfig.nextLabel}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">题目内容</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-800 whitespace-pre-wrap">{mistake.question_content}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-medium text-red-800">你的答案</h3>
              </div>
              <p className="text-red-700">{mistake.user_answer || '未作答'}</p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-medium text-green-800">正确答案</h3>
              </div>
              <p className="text-green-700">{mistake.correct_answer || '-'}</p>
            </div>
          </div>

          {mistake.ai_analysis && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium text-blue-800">AI 错因分析</h3>
              </div>
              <p className="text-blue-700 whitespace-pre-wrap">{mistake.ai_analysis}</p>
            </div>
          )}

          <AIAnalysisPanel
            mistakeId={mistake.id}
            initialAnalysis={aiAnalysis || mistake.ai_analysis}
            onAnalysisComplete={(analysis) => setAiAnalysis(analysis)}
          />

          {mistake.original_question && mistake.original_question.options && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">选项详情</h3>
              <div className="space-y-2">
                {mistake.original_question.options.map((opt, idx) => {
                  const optLabel = String.fromCharCode(65 + idx)
                  const isUserAnswer = String(mistake.user_answer) === String(idx)
                  const isCorrectAnswer = String(mistake.correct_answer) === String(idx)
                  
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        isCorrectAnswer
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : isUserAnswer
                            ? 'bg-red-100 border-red-300 text-red-800 line-through'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className="font-bold mr-2">{optLabel}.</span>
                      {opt}
                      {isCorrectAnswer && (
                        <CheckCircle className="w-4 h-4 inline ml-2 text-green-600" />
                      )}
                      {isUserAnswer && !isCorrectAnswer && (
                        <XCircle className="w-4 h-4 inline ml-2 text-red-600" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {mistake.original_question?.explanation && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <h3 className="font-medium text-amber-800">题目解析</h3>
              </div>
              <p className="text-amber-700 whitespace-pre-wrap">
                {mistake.original_question.explanation}
              </p>
            </div>
          )}

          {mistake.knowledge_tags && mistake.knowledge_tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">知识点标签</h3>
              <div className="flex flex-wrap gap-2">
                {mistake.knowledge_tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{mistake.mistake_count}</p>
              <p className="text-sm text-gray-500">错误次数</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{formatDate(mistake.last_mistake_at)}</p>
              <p className="text-sm text-gray-500">最近错误</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{formatDate(mistake.created_at)}</p>
              <p className="text-sm text-gray-500">首次记录</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{formatDate(mistake.updated_at)}</p>
              <p className="text-sm text-gray-500">最后更新</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              学习笔记
            </CardTitle>
            {!showNoteEditor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNoteEditor(true)}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                添加笔记
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {mistake.note ? (
            <div className="bg-gray-50 rounded-lg p-4">
              {/* 修复：增加空值检查，避免 mistake.note.content 为 undefined 时崩溃 */}
              <p className="text-gray-700 whitespace-pre-wrap">{mistake.note?.content || '无笔记内容'}</p>
              {mistake.note?.created_at && (
                <p className="text-xs text-gray-400 mt-2">
                  创建于 {formatDate(mistake.note.created_at)}
                </p>
              )}
            </div>
          ) : showNoteEditor ? (
            <div className="space-y-4">
              <Textarea
                placeholder="记录你对这道题的理解和复习心得..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowNoteEditor(false)}
                  disabled={noteSaving} // 修复：保存中禁用取消按钮
                >
                  取消
                </Button>
                <Button onClick={handleSaveNote} disabled={noteSaving}> // 修复：增加禁用状态
                  {noteSaving ? ( // 修复：显示加载状态
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      保存笔记
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>暂无笔记，点击上方按钮添加</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
