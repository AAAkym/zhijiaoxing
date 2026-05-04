import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  Target,
  RefreshCw,
  ArrowLeft,
  TrendingUp,
  BookOpen
} from 'lucide-react'

import { mistakeBook } from '@/services/api'

export default function ReviewResult({ results, questions, answers, onRetry, onBack }) {
  if (!results) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">没有复习结果</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            返回错题本
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { summary, updated_mistakes, still_need_review, mastered_in_session } = results

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 80) return 'text-green-600'
    if (accuracy >= 60) return 'text-blue-600'
    if (accuracy >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getAccuracyMessage = (accuracy) => {
    if (accuracy >= 80) return '太棒了！继续保持！'
    if (accuracy >= 60) return '不错，再接再厉！'
    if (accuracy >= 40) return '还需要多加练习'
    return '加油，多多复习吧！'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回错题本
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">复习结果</h2>
        </div>
        <Button onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          再来一次
        </Button>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getAccuracyColor(summary.accuracy)}`}>
                {summary.accuracy}%
              </div>
              <p className="text-gray-600 mt-2">正确率</p>
              <p className="text-sm text-gray-500 mt-1">
                {getAccuracyMessage(summary.accuracy)}
              </p>
            </div>
            
            <div className="w-px h-24 bg-gray-200" />
            
            <div className="grid grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800">{summary.total}</div>
                <p className="text-sm text-gray-600">总题数</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{summary.correct}</div>
                <p className="text-sm text-gray-600">答对</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{summary.incorrect}</div>
                <p className="text-sm text-gray-600">答错</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-green-600" />
              本次掌握 ({mastered_in_session.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mastered_in_session.length > 0 ? (
              <div className="space-y-3">
                {mastered_in_session.map((mistake, idx) => (
                  <div
                    key={mistake.id}
                    className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 line-clamp-2">
                        {mistake.question_content}
                      </p>
                      {mistake.course_title && (
                        <p className="text-xs text-green-600 mt-1">
                          {mistake.course_title}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      已掌握
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Trophy className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>本次没有新掌握的题目</p>
                <p className="text-sm">继续加油！</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                需要继续加强 ({still_need_review.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {still_need_review.length > 0 ? (
              <div className="space-y-3">
                {still_need_review.map((mistake, idx) => (
                  <div
                    key={mistake.id}
                    className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200"
                  >
                    <XCircle className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-orange-800 line-clamp-2">
                        {mistake.question_content}
                      </p>
                      {mistake.course_title && (
                        <p className="text-xs text-orange-600 mt-1">
                          {mistake.course_title}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        mistake.mastery_status === 'reviewing'
                          ? 'text-blue-600 border-blue-200'
                          : 'text-red-600 border-red-200'
                      }
                    >
                      {mistake.mastery_status === 'reviewing' ? '复习中' : '未掌握'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>太棒了！所有题目都已掌握</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            复习建议
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summary.accuracy < 60 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>建议：</strong>这些题目还需要重点复习。建议每天花10-15分钟专门复习这些错题，直到正确率达到80%以上。
                </p>
              </div>
            )}
            {summary.accuracy >= 60 && summary.accuracy < 80 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">
                  <strong>建议：</strong>进步不错！继续保持每天复习的习惯，争取下次正确率达到80%以上。
                </p>
              </div>
            )}
            {summary.accuracy >= 80 && still_need_review.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>建议：</strong>表现很好！继续巩固剩余的{still_need_review.length}道题目，保持每天复习一次的频率。
                </p>
              </div>
            )}
            {summary.accuracy >= 80 && still_need_review.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>恭喜！</strong>本次复习的所有题目都已掌握！建议每周复习一次巩固记忆。
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
