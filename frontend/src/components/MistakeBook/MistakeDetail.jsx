import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  RefreshCw,
  XCircle,
  Lightbulb,
  FileText,
  Edit3,
  Save,
  Sparkles,
  Loader2,
  AlertTriangle,
  Shield,
  Trash2
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import AIAnalysisPanel from './AIAnalysisPanel'
import ErrorTypeAnalysisPanel from './ErrorTypeAnalysisPanel'
import ProgrammingMistakeDiff from './ProgrammingMistakeDiff'

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

/** 将题目内容（可能是JSON字符串或纯文本）解析为结构化展示 */
function QuestionContentDisplay({ content }) {
  if (!content) return <p className="text-gray-400">暂无题目内容</p>

  // 尝试解析JSON
  let parsed = null
  if (typeof content === 'string') {
    try { parsed = JSON.parse(content) } catch { /* 不是JSON，按纯文本展示 */ }
  } else if (typeof content === 'object') {
    parsed = content
  }

  // 纯文本直接展示
  if (!parsed || typeof parsed !== 'object') {
    return <p className="text-gray-800 whitespace-pre-wrap">{String(content)}</p>
  }

  return (
    <div className="space-y-3">
      {parsed.title && (
        <h4 className="font-semibold text-gray-800">{parsed.title}</h4>
      )}
      {parsed.description && typeof parsed.description === 'string' && (
        <p className="text-gray-700 whitespace-pre-wrap">{parsed.description}</p>
      )}
      {parsed.input_format && (
        <div>
          <span className="text-xs font-medium text-gray-500">输入格式：</span>
          <span className="text-sm text-gray-700 ml-1">{parsed.input_format}</span>
        </div>
      )}
      {parsed.output_format && (
        <div>
          <span className="text-xs font-medium text-gray-500">输出格式：</span>
          <span className="text-sm text-gray-700 ml-1">{parsed.output_format}</span>
        </div>
      )}
      {parsed.constraints && (
        <div>
          <span className="text-xs font-medium text-gray-500">约束条件：</span>
          <span className="text-sm text-gray-700 ml-1">{parsed.constraints}</span>
        </div>
      )}
      {Array.isArray(parsed.samples) && parsed.samples.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-500">样例：</span>
          <div className="mt-1 space-y-2">
            {parsed.samples.map((s, i) => (
              <div key={i} className="bg-white border rounded p-2 text-sm font-mono">
                <div><span className="text-gray-500">输入：</span>{String(s.input ?? s.input_data ?? '')}</div>
                <div><span className="text-gray-500">输出：</span>{String(s.output ?? s.expected_output ?? '')}</div>
                {s.explanation && <div className="text-gray-500 font-sans text-xs mt-1">说明：{s.explanation}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {parsed.question && !parsed.description && (
        <p className="text-gray-700 whitespace-pre-wrap">{parsed.question}</p>
      )}
      {parsed.options && Array.isArray(parsed.options) && (
        <div className="space-y-1">
          {parsed.options.map((opt, i) => (
            <div key={i} className="text-sm text-gray-700">
              <span className="font-medium">{String.fromCharCode(65 + i)}.</span> {typeof opt === 'string' ? opt : JSON.stringify(opt)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function resolveAnswerDisplay(answer, options) {
  if (answer === null || answer === undefined || answer === '') {
    return { display: '未作答', label: null, isResolved: false }
  }

  const answerStr = String(answer).trim()

  if (options && Array.isArray(options) && options.length > 0) {
    const idx = parseInt(answerStr, 10)
    if (!isNaN(idx) && idx >= 0 && idx < options.length) {
      const label = String.fromCharCode(65 + idx)
      const optionText = typeof options[idx] === 'string' ? options[idx] : String(options[idx])
      return {
        display: `${label}. ${optionText}`,
        label,
        optionText,
        index: idx,
        isResolved: true
      }
    }

    const letterMatch = answerStr.match(/^([A-Za-z])/)
    if (letterMatch) {
      const letter = letterMatch[1].toUpperCase()
      const idxFromLetter = letter.charCodeAt(0) - 65
      if (idxFromLetter >= 0 && idxFromLetter < options.length) {
        const optionText = typeof options[idxFromLetter] === 'string' ? options[idxFromLetter] : String(options[idxFromLetter])
        return {
          display: `${letter}. ${optionText}`,
          label: letter,
          optionText,
          index: idxFromLetter,
          isResolved: true
        }
      }
    }
  }

  if (/^[A-Za-z]$/.test(answerStr)) {
    return { display: answerStr.toUpperCase(), label: answerStr.toUpperCase(), isResolved: true }
  }

  return { display: answerStr, label: null, isResolved: false }
}

function DataValidationWarning({ validation }) {
  if (!validation || validation.valid) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <h3 className="font-medium text-amber-800">数据一致性校验</h3>
      </div>
      <div className="space-y-1">
        {validation.issues.map((issue, idx) => (
          <p key={idx} className={`text-sm ${issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
            {issue.severity === 'error' ? '❌' : '⚠️'} {issue.message}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function MistakeDetail({ mistake, onBack, onUpdateStatus, onMistakeChange, onNavigateToTargeted = null, onDelete = null }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState(mistake?.ai_analysis || '')
  const [noteSaving, setNoteSaving] = useState(false)

  const resolvedData = useMemo(() => {
    if (!mistake) return null

    const options = mistake.options || mistake.original_question?.options || null
    const userResolved = mistake.user_answer_display
      ? { display: mistake.user_answer_display, label: mistake.user_answer_label, isResolved: !!mistake.user_answer_label }
      : resolveAnswerDisplay(mistake.user_answer, options)
    const correctResolved = mistake.correct_answer_display
      ? { display: mistake.correct_answer_display, label: mistake.correct_answer_label, isResolved: !!mistake.correct_answer_label }
      : resolveAnswerDisplay(mistake.correct_answer, options)

    return {
      userAnswer: userResolved,
      correctAnswer: correctResolved,
      options,
      questionType: mistake.question_type || mistake.original_question?.type || 'unknown',
      answerType: mistake.answer_type || (options && options.length > 0 ? 'choice' : 'text')
    }
  }, [mistake])

  useEffect(() => {
    if (mistake?.ai_analysis) {
      setAiAnalysis(mistake.ai_analysis)
    }
  }, [mistake?.ai_analysis])

  const handleGenerateTargeted = useCallback(({ knowledgeTags }) => {
    if (onNavigateToTargeted) {
      onNavigateToTargeted({
        mistakeId: mistake?.id,
        courseId: mistake?.course_id,
        courseTitle: mistake?.course_title,
        knowledgeTags: mistake?.knowledge_tags || knowledgeTags || [],
        questionPreview: mistake?.question_content?.slice(0, 50)
      })
    }
  }, [mistake, onNavigateToTargeted])

  const handleAnalysisComplete = useCallback((analysisText) => {
    setAiAnalysis(analysisText)
  }, [])

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

  const handleConfirmDelete = async () => {
    if (!onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(mistake.id)
    } catch (err) {
      console.error('删除错题失败:', err)
      alert('删除失败，请稍后重试')
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      alert('笔记内容不能为空')
      return
    }

    setNoteSaving(true)
    try {
      console.log('保存笔记:', noteContent)
      setShowNoteEditor(false)
      setNoteContent('')
      alert('笔记保存成功！')
    } catch (err) {
      console.error('保存笔记失败:', err)
      alert('保存笔记失败，请稍后重试')
    } finally {
      setNoteSaving(false)
    }
  }

  const displayOptions = resolvedData?.options
  const hasOptions = displayOptions && displayOptions.length > 0

  const isUserAnswerOption = (idx) => {
    if (!mistake) return false
    return String(mistake.user_answer) === String(idx)
  }

  const isCorrectAnswerOption = (idx) => {
    if (!mistake) return false
    return String(mistake.correct_answer) === String(idx)
  }

  const currentAnalysis = aiAnalysis || mistake.ai_analysis

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
                {resolvedData?.questionType && resolvedData.questionType !== 'unknown' && (
                  <Badge variant="outline">
                    {resolvedData.questionType === 'choice' ? '选择题' :
                     resolvedData.questionType === 'fill' ? '填空题' : '简答题'}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl">题目详情</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className={statusConfig.nextColor}
                onClick={handleStatusUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? '更新中...' : statusConfig.nextLabel}
              </Button>
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                  className="gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">题目内容</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <QuestionContentDisplay content={mistake.question_content} />
            </div>
          </div>

          <DataValidationWarning validation={mistake.data_validation} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-medium text-red-800">你的答案</h3>
              </div>
              <p className="text-red-700 font-medium">
                {resolvedData?.userAnswer?.display || '未作答'}
              </p>
              {resolvedData?.userAnswer?.isResolved && (
                <p className="text-xs text-red-500 mt-1">
                  原始值: {mistake.user_answer}
                </p>
              )}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-medium text-green-800">正确答案</h3>
              </div>
              <p className="text-green-700 font-medium">
                {resolvedData?.correctAnswer?.display || '-'}
              </p>
              {resolvedData?.correctAnswer?.isResolved && (
                <p className="text-xs text-green-500 mt-1">
                  原始值: {mistake.correct_answer}
                </p>
              )}
            </div>
          </div>

          {hasOptions && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">选项详情</h3>
              <div className="space-y-2">
                {displayOptions.map((opt, idx) => {
                  const optLabel = String.fromCharCode(65 + idx)
                  const isUserAns = isUserAnswerOption(idx)
                  const isCorrectAns = isCorrectAnswerOption(idx)

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        isCorrectAns
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : isUserAns
                            ? 'bg-red-100 border-red-300 text-red-800 line-through'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}
                    >
                      <span className="font-bold mr-2">{optLabel}.</span>
                      {typeof opt === 'string' ? opt : String(opt)}
                      {isCorrectAns && (
                        <CheckCircle className="w-4 h-4 inline ml-2 text-green-600" />
                      )}
                      {isUserAns && !isCorrectAns && (
                        <XCircle className="w-4 h-4 inline ml-2 text-red-600" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(mistake.original_question?.explanation || mistake.original_question?.analysis) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <h3 className="font-medium text-amber-800">题目解析</h3>
              </div>
              <p className="text-amber-700 whitespace-pre-wrap">
                {mistake.original_question.explanation || mistake.original_question.analysis}
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

      <AIAnalysisPanel
        mistakeId={mistake.id}
        initialAnalysis={currentAnalysis}
        onAnalysisComplete={handleAnalysisComplete}
        onGenerateTargeted={handleGenerateTargeted}
      />

      <ErrorTypeAnalysisPanel
        mistake={{ ...mistake, ai_analysis: currentAnalysis }}
        onUpdated={(next) => {
          if (onMistakeChange) onMistakeChange(next)
        }}
      />

      {(mistake.error_type_auto === 'programming_error' || mistake.error_type_manual === 'programming_error') && (
        <ProgrammingMistakeDiff mistakeId={mistake.id} mistake={mistake} />
      )}

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
                  disabled={noteSaving}
                >
                  取消
                </Button>
                <Button onClick={handleSaveNote} disabled={noteSaving}>
                  {noteSaving ? (
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除错题</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这道错题吗？删除后将无法恢复，相关的分析记录和笔记也将一并删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
