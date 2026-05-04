import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle,
  XCircle,
  Lightbulb,
  Clock,
  AlertTriangle,
  BookOpen,
  Eye,
  EyeOff
} from 'lucide-react'

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

function safeAnswerCompare(answer, correctAnswer, options) {
  if (answer === null || answer === undefined || answer === '') return false
  if (correctAnswer === null || correctAnswer === undefined) return false

  if (options && Array.isArray(options) && options.length > 0) {
    const userNum = Number(answer)
    const correctNum = Number(correctAnswer)
    if (!isNaN(userNum) && !isNaN(correctNum)) {
      return userNum === correctNum
    }
  }

  return String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()
}

export default function ReviewQuestion({ question, answer, onAnswer, showResult = false }) {
  const [showHint, setShowHint] = useState(false)

  const hasOptions = question?.options && question.options.length > 0
  const correctAnswer = question?.correct_answer

  const resolvedUserAnswer = useMemo(() => {
    return resolveAnswerDisplay(answer, question?.options)
  }, [answer, question?.options])

  const resolvedCorrectAnswer = useMemo(() => {
    return resolveAnswerDisplay(correctAnswer, question?.options)
  }, [correctAnswer, question?.options])

  if (!question) {
    return null
  }

  const handleOptionClick = (index) => {
    if (!showResult) {
      onAnswer(index)
    }
  }

  const handleTextChange = (text) => {
    if (!showResult) {
      onAnswer(text)
    }
  }

  const getStatusBadge = () => {
    switch (question.mastery_status) {
      case 'unmastered':
        return <Badge className="bg-red-100 text-red-700 border-red-200">未掌握</Badge>
      case 'reviewing':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">复习中</Badge>
      case 'mastered':
        return <Badge className="bg-green-100 text-green-700 border-green-200">已掌握</Badge>
      default:
        return null
    }
  }

  const isCorrectOption = (idx) => {
    return safeAnswerCompare(idx, correctAnswer, question.options)
  }

  const isUserSelectedOption = (idx) => {
    if (answer === null || answer === undefined) return false
    return Number(answer) === idx || String(answer) === String(idx)
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {question.course_title && (
              <Badge variant="outline">
                <BookOpen className="w-3 h-3 mr-1" />
                {question.course_title}
              </Badge>
            )}
            {question.mistake_count > 1 && (
              <Badge variant="outline" className="text-orange-600 border-orange-200">
                错误 {question.mistake_count} 次
              </Badge>
            )}
          </div>
          {question.knowledge_tags && question.knowledge_tags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHint(!showHint)}
            >
              {showHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showHint ? '隐藏提示' : '显示提示'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-gray-800 whitespace-pre-wrap">{question.question_content}</p>
        </div>

        {showHint && question.knowledge_tags && question.knowledge_tags.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-amber-600" />
              <span className="font-medium text-amber-800">知识点提示</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {question.knowledge_tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-amber-700">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {hasOptions ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">选择答案：</p>
            <div className="space-y-2">
              {question.options.map((option, idx) => {
                const isSelected = isUserSelectedOption(idx)
                const isCorrect = isCorrectOption(idx)
                const optionLabel = String.fromCharCode(65 + idx)

                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(idx)}
                    disabled={showResult}
                    className={`w-full p-4 text-left rounded-lg border transition-all ${
                      showResult
                        ? isCorrect
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : isSelected
                            ? 'bg-red-100 border-red-300 text-red-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        : isSelected
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="font-bold mr-3">{optionLabel}.</span>
                    <span>{option}</span>
                    {showResult && isCorrect && (
                      <CheckCircle className="w-5 h-5 inline ml-2 text-green-600" />
                    )}
                    {showResult && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 inline ml-2 text-red-600" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">输入答案：</p>
            <Textarea
              value={answer || ''}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="在此输入你的答案..."
              rows={4}
              disabled={showResult}
              className="resize-none"
            />
          </div>
        )}

        {showResult && (
          <div className={`rounded-lg p-4 ${
            safeAnswerCompare(answer, correctAnswer, question.options)
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {safeAnswerCompare(answer, correctAnswer, question.options) ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">正确！</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-800">
                    {answer === undefined || answer === null || answer === '' ? '未作答' : '错误'}
                  </span>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-500 mb-1">你的答案</p>
                <p className={`font-medium ${
                  safeAnswerCompare(answer, correctAnswer, question.options)
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}>
                  {resolvedUserAnswer.display}
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-500 mb-1">正确答案</p>
                <p className="font-medium text-green-700">
                  {resolvedCorrectAnswer.display}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
