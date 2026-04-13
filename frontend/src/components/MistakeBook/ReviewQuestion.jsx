import React, { useState } from 'react'
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

export default function ReviewQuestion({ question, answer, onAnswer, showResult = false }) {
  const [showHint, setShowHint] = useState(false)
  
  if (!question) {
    return null
  }

  const hasOptions = question.options && question.options.length > 0
  
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
                const isSelected = answer === idx
                const optionLabel = String.fromCharCode(65 + idx)
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(idx)}
                    disabled={showResult}
                    className={`w-full p-4 text-left rounded-lg border transition-all ${
                      showResult
                        ? idx === question.correct_answer
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
                    {showResult && idx === question.correct_answer && (
                      <CheckCircle className="w-5 h-5 inline ml-2 text-green-600" />
                    )}
                    {showResult && isSelected && idx !== question.correct_answer && (
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
            // 修复：增加更严格的答案比较，处理 undefined/null/不同类型的情况
            (answer !== undefined && answer !== null && answer !== '') && 
            String(answer) === String(question.correct_answer)
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {/* 修复：安全的答案比较 */}
              {(answer !== undefined && answer !== null && answer !== '') && 
               String(answer) === String(question.correct_answer) ? (
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
                  // 修复：安全的答案比较
                  (answer !== undefined && answer !== null && answer !== '') && 
                  String(answer) === String(question.correct_answer) 
                    ? 'text-green-700' 
                    : 'text-red-700'
                }`}>
                  {hasOptions && typeof answer === 'number'
                    ? `${String.fromCharCode(65 + answer)}. ${question.options[answer] || '未知选项'}`
                    : (answer !== undefined && answer !== null && answer !== '' 
                        ? answer 
                        : '未作答')
                  }
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-500 mb-1">正确答案</p>
                <p className="font-medium text-green-700">
                  {hasOptions && typeof question.correct_answer === 'number'
                    ? `${String.fromCharCode(65 + question.correct_answer)}. ${question.options[question.correct_answer]}`
                    : question.correct_answer || '-'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
