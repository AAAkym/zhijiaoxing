import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import CodeEditor from '@/components/ui/CodeEditor'
import {
  Code, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Cpu, Zap, FileCode, GitCompare, Lightbulb, Play
} from 'lucide-react'
import { mistakeBook } from '@/services/api'

function ScoreCard({ label, score, maxScore, color }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return (
    <div className="text-center p-3 rounded-lg bg-gray-50">
      <p className="text-lg font-bold" style={{ color }}>{score}</p>
      <p className="text-xs text-gray-500">{label}</p>
      <Progress value={pct} className="h-1.5 mt-1" />
    </div>
  )
}

function DiffLine({ item, showLineNumbers }) {
  const lineClass = {
    equal: 'bg-gray-50 text-gray-700',
    replace: 'bg-amber-50 text-amber-800 border-l-2 border-amber-400',
    delete: 'bg-red-50 text-red-700 border-l-2 border-red-400 line-through',
    insert: 'bg-green-50 text-green-700 border-l-2 border-green-400',
  }[item.type] || 'bg-gray-50'

  const prefix = {
    equal: ' ',
    replace: '~',
    delete: '-',
    insert: '+',
  }[item.type] || ' '

  return (
    <div className={`flex font-mono text-sm ${lineClass}`}>
      {showLineNumbers && (
        <span className="w-10 text-right pr-2 text-gray-400 select-none shrink-0">
          {item.line_num || ''}
        </span>
      )}
      <span className="w-5 text-center select-none shrink-0 font-bold">{prefix}</span>
      <span className="flex-1 whitespace-pre-wrap break-all">{item.user_line || item.standard_line}</span>
    </div>
  )
}

function CodeDiffView({ codeDiff }) {
  if (!codeDiff || codeDiff.length === 0) {
    return <p className="text-sm text-gray-400">暂无逐行对比数据</p>
  }

  const userLines = codeDiff.filter(d => d.type !== 'insert')
  const standardLines = codeDiff.filter(d => d.type !== 'delete')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-red-700">你的代码</span>
        </div>
        <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
          <div className="max-h-96 overflow-y-auto">
            {userLines.map((item, idx) => (
              <DiffLine key={idx} item={{ ...item, displayLine: item.user_line }} showLineNumbers />
            ))}
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold text-green-700">参考解答</span>
        </div>
        <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
          <div className="max-h-96 overflow-y-auto">
            {standardLines.map((item, idx) => (
              <DiffLine key={idx} item={{ ...item, displayLine: item.standard_line }} showLineNumbers />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProgrammingMistakeDiff({ mistakeId, mistake }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAIFeedback, setShowAIFeedback] = useState(false)

  useEffect(() => {
    if (mistake?.programming_detail) {
      setDetail(mistake.programming_detail)
      return
    }
    if (!mistakeId) return
    setLoading(true)
    mistakeBook.getProgrammingMistakeDetail(mistakeId)
      .then(data => setDetail(data?.programming_detail))
      .catch(err => console.error('Load programming detail error:', err))
      .finally(() => setLoading(false))
  }, [mistakeId, mistake])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Cpu className="w-8 h-8 mx-auto mb-2 text-gray-400 animate-pulse" />
          <p className="text-sm text-gray-500">加载编程错题详情...</p>
        </CardContent>
      </Card>
    )
  }

  if (!detail) {
    return null
  }

  const prog = detail
  const scorePct = prog.max_score > 0 ? Math.round((prog.score / prog.max_score) * 100) : 0

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Code className="w-5 h-5 text-purple-600" />
            编程题详细对比
          </CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{prog.language?.toUpperCase() || 'CODE'}</Badge>
            <Badge className={scorePct >= 90 ? 'bg-green-100 text-green-700' : scorePct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
              {prog.score}/{prog.max_score} 分
            </Badge>
            <Badge variant="outline" className={prog.status === 'passed' ? 'text-green-600' : 'text-red-600'}>
              {prog.status === 'passed' ? '通过' : '需改进'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <ScoreCard label="编译" score={prog.compile_result?.score ?? '-'} maxScore={15} color="#3B82F6" />
            <ScoreCard label="IO匹配" score={prog.io_match_result?.score ?? '-'} maxScore={35} color="#10B981" />
            <ScoreCard label="语法" score={prog.syntax_result?.score ?? '-'} maxScore={15} color="#8B5CF6" />
            <ScoreCard label="逻辑" score={prog.logic_result?.score ?? '-'} maxScore={25} color="#F59E0B" />
            <ScoreCard label="效率" score={prog.efficiency_result?.score ?? '-'} maxScore={10} color="#EC4899" />
            <ScoreCard label="总分" score={prog.score ?? 0} maxScore={prog.max_score ?? 100} color="#1E293B" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-blue-600" />
            代码逐行对比
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prog.code_diff && prog.code_diff.length > 0 ? (
            <CodeDiffView codeDiff={prog.code_diff} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">你的代码</span>
                </div>
                <pre className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap max-h-80">
                  {prog.user_code || '无代码'}
                </pre>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-700">参考解答</span>
                </div>
                <pre className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap max-h-80">
                  {prog.standard_code || '无参考'}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {prog.ai_feedback && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                AI深度分析
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAIFeedback(!showAIFeedback)}>
                {showAIFeedback ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          {showAIFeedback && (
            <CardContent className="space-y-4">
              {prog.ai_feedback.error_analysis && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 mb-1">错误分析</p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{prog.ai_feedback.error_analysis}</p>
                </div>
              )}
              {prog.ai_feedback.code_quality && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-800 mb-1">代码质量</p>
                  <p className="text-sm text-blue-700 whitespace-pre-wrap">{prog.ai_feedback.code_quality}</p>
                </div>
              )}
              {prog.ai_feedback.optimization_suggestions && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-purple-800 mb-1">优化建议</p>
                  <p className="text-sm text-purple-700 whitespace-pre-wrap">{prog.ai_feedback.optimization_suggestions}</p>
                </div>
              )}
              {prog.ai_feedback.best_practices && (
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800 mb-1">最佳实践</p>
                  <p className="text-sm text-green-700 whitespace-pre-wrap">{prog.ai_feedback.best_practices}</p>
                </div>
              )}
              {prog.ai_feedback.learning_points && (
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800 mb-1">学习要点</p>
                  <p className="text-sm text-amber-700 whitespace-pre-wrap">{prog.ai_feedback.learning_points}</p>
                </div>
              )}
              {prog.ai_feedback.step_by_step_fix && (
                <div className="bg-cyan-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-cyan-800 mb-1">逐步修复</p>
                  <p className="text-sm text-cyan-700 whitespace-pre-wrap">{prog.ai_feedback.step_by_step_fix}</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
