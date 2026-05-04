import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Star, 
  Shield, 
  BookOpen, 
  Target, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Award,
  Settings,
  Zap,
  RefreshCw
} from 'lucide-react'

const mockScoringData = [
  {
    id: 1,
    title: 'Python函数基础教程',
    contentType: 'tutorial',
    autoScore: {
      total: 85,
      compliance: 92,
      educational: 88,
      accuracy: 75
    },
    manualScore: null,
    finalScore: 85,
    status: 'pending_manual',
    reviewer: null,
    createdAt: '2025-03-27 10:30'
  },
  {
    id: 2,
    title: '数据结构练习题解答',
    contentType: 'exercise',
    autoScore: {
      total: 92,
      compliance: 95,
      educational: 90,
      accuracy: 91
    },
    manualScore: {
      total: 94,
      compliance: 96,
      educational: 92,
      accuracy: 94
    },
    finalScore: 93,
    status: 'completed',
    reviewer: '管理员A',
    createdAt: '2025-03-27 09:15'
  },
  {
    id: 3,
    title: '机器学习概念解释',
    contentType: 'explanation',
    autoScore: {
      total: 78,
      compliance: 85,
      educational: 72,
      accuracy: 77
    },
    manualScore: null,
    finalScore: 78,
    status: 'auto_only',
    reviewer: null,
    createdAt: '2025-03-27 08:45'
  }
]

const scoringRules = {
  compliance: {
    label: '内容合规性',
    description: '评估内容是否符合平台规范和法律法规',
    weight: 35,
    criteria: [
      '无违法违规内容',
      '无敏感词汇',
      '无广告推广',
      '符合平台内容政策'
    ]
  },
  educational: {
    label: '教育适用性',
    description: '评估内容的教育价值和适用程度',
    weight: 35,
    criteria: [
      '内容难度适中',
      '逻辑清晰易懂',
      '有实际教学价值',
      '符合学习目标'
    ]
  },
  accuracy: {
    label: '内容准确性',
    description: '评估内容的准确性和可靠性',
    weight: 30,
    criteria: [
      '知识点准确无误',
      '示例恰当',
      '引用来源可靠',
      '无误导性信息'
    ]
  }
}

export default function QualityScoring() {
  const [scoringData, setScoringData] = useState(mockScoringData)
  const [selectedItem, setSelectedItem] = useState(null)
  const [scoringDialog, setScoringDialog] = useState(false)
  const [manualScores, setManualScores] = useState({
    compliance: 85,
    educational: 85,
    accuracy: 85
  })
  const [reviewComment, setReviewComment] = useState('')
  const [scoringMode, setScoringMode] = useState('auto')

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-blue-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBadge = (score) => {
    if (score >= 90) return { label: '优秀', color: 'bg-green-100 text-green-700' }
    if (score >= 70) return { label: '良好', color: 'bg-blue-100 text-blue-700' }
    if (score >= 50) return { label: '合格', color: 'bg-amber-100 text-amber-700' }
    return { label: '不合格', color: 'bg-red-100 text-red-700' }
  }

  const calculateTotalScore = (scores) => {
    return Math.round(
      scores.compliance * scoringRules.compliance.weight / 100 +
      scores.educational * scoringRules.educational.weight / 100 +
      scores.accuracy * scoringRules.accuracy.weight / 100
    )
  }

  const handleManualScore = (dimension, value) => {
    const newScores = { ...manualScores, [dimension]: value[0] }
    setManualScores(newScores)
  }

  const submitManualScore = () => {
    console.log('提交手动评分:', selectedItem, manualScores, reviewComment)
    setScoringDialog(false)
    setSelectedItem(null)
    setReviewComment('')
  }

  const openScoringDialog = (item) => {
    setSelectedItem(item)
    setManualScores({
      compliance: item.autoScore.compliance,
      educational: item.autoScore.educational,
      accuracy: item.autoScore.accuracy
    })
    setScoringDialog(true)
  }

  return (
    <div className="space-y-6">
      {/* 评分规则说明 */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Settings className="h-5 w-5 mr-2 text-slate-600" />
            评分维度说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(scoringRules).map(([key, rule]) => (
              <Card key={key} className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {key === 'compliance' && <Shield className="h-5 w-5 text-blue-600" />}
                      {key === 'educational' && <BookOpen className="h-5 w-5 text-green-600" />}
                      {key === 'accuracy' && <Target className="h-5 w-5 text-purple-600" />}
                      <span className="font-medium">{rule.label}</span>
                    </div>
                    <Badge variant="outline">权重 {rule.weight}%</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{rule.description}</p>
                  <div className="space-y-1">
                    {rule.criteria.map((criterion, idx) => (
                      <div key={idx} className="flex items-center text-xs text-gray-600">
                        <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                        {criterion}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 评分模式切换 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">评分模式:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <Button
                  variant={scoringMode === 'auto' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setScoringMode('auto')}
                  className={scoringMode === 'auto' ? 'bg-slate-900 text-white' : ''}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  自动评分
                </Button>
                <Button
                  variant={scoringMode === 'manual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setScoringMode('manual')}
                  className={scoringMode === 'manual' ? 'bg-slate-900 text-white' : ''}
                >
                  <Star className="h-4 w-4 mr-1" />
                  手动评分
                </Button>
                <Button
                  variant={scoringMode === 'hybrid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setScoringMode('hybrid')}
                  className={scoringMode === 'hybrid' ? 'bg-slate-900 text-white' : ''}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  混合评分
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                自动评分权重: 60%
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                手动评分权重: 40%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 评分列表 */}
      <div className="space-y-4">
        {scoringData.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    <Badge className={
                      item.status === 'completed' ? 'bg-green-100 text-green-700' :
                      item.status === 'pending_manual' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {item.status === 'completed' && '已评分'}
                      {item.status === 'pending_manual' && '待人工评分'}
                      {item.status === 'auto_only' && '仅自动评分'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    ID: #{item.id} · 创建时间: {item.createdAt}
                    {item.reviewer && ` · 评分人: ${item.reviewer}`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">最终评分</span>
                    <span className={`text-3xl font-bold ${getScoreColor(item.finalScore)}`}>
                      {item.finalScore}
                    </span>
                    <Badge className={getScoreBadge(item.finalScore).color}>
                      {getScoreBadge(item.finalScore).label}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* 评分维度展示 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* 合规性评分 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">合规性</span>
                    </div>
                    <span className={`font-bold ${getScoreColor(item.autoScore.compliance)}`}>
                      {item.autoScore.compliance}
                      {item.manualScore && (
                        <span className="text-gray-400 text-xs ml-1">
                          / {item.manualScore.compliance}
                        </span>
                      )}
                    </span>
                  </div>
                  <Progress value={item.autoScore.compliance} className="h-2" />
                </div>

                {/* 教育适用性评分 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">教育适用性</span>
                    </div>
                    <span className={`font-bold ${getScoreColor(item.autoScore.educational)}`}>
                      {item.autoScore.educational}
                      {item.manualScore && (
                        <span className="text-gray-400 text-xs ml-1">
                          / {item.manualScore.educational}
                        </span>
                      )}
                    </span>
                  </div>
                  <Progress value={item.autoScore.educational} className="h-2" />
                </div>

                {/* 准确性评分 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">准确性</span>
                    </div>
                    <span className={`font-bold ${getScoreColor(item.autoScore.accuracy)}`}>
                      {item.autoScore.accuracy}
                      {item.manualScore && (
                        <span className="text-gray-400 text-xs ml-1">
                          / {item.manualScore.accuracy}
                        </span>
                      )}
                    </span>
                  </div>
                  <Progress value={item.autoScore.accuracy} className="h-2" />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2">
                {item.status !== 'completed' && (
                  <Button 
                    size="sm"
                    onClick={() => openScoringDialog(item)}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    <Star className="h-4 w-4 mr-1" />
                    手动评分
                  </Button>
                )}
                <Button variant="outline" size="sm">
                  查看详情
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 手动评分弹窗 */}
      <Dialog open={scoringDialog} onOpenChange={setScoringDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Star className="h-5 w-5 mr-2 text-amber-500" />
              手动评分
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 合规性评分 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">内容合规性</span>
                  <Badge variant="outline" className="text-xs">权重 35%</Badge>
                </div>
                <span className={`text-xl font-bold ${getScoreColor(manualScores.compliance)}`}>
                  {manualScores.compliance}
                </span>
              </div>
              <Slider
                value={[manualScores.compliance]}
                onValueChange={(value) => handleManualScore('compliance', value)}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>不合格 (0-49)</span>
                <span>合格 (50-69)</span>
                <span>良好 (70-89)</span>
                <span>优秀 (90-100)</span>
              </div>
            </div>

            {/* 教育适用性评分 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-green-600" />
                  <span className="font-medium">教育适用性</span>
                  <Badge variant="outline" className="text-xs">权重 35%</Badge>
                </div>
                <span className={`text-xl font-bold ${getScoreColor(manualScores.educational)}`}>
                  {manualScores.educational}
                </span>
              </div>
              <Slider
                value={[manualScores.educational]}
                onValueChange={(value) => handleManualScore('educational', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* 准确性评分 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  <span className="font-medium">内容准确性</span>
                  <Badge variant="outline" className="text-xs">权重 30%</Badge>
                </div>
                <span className={`text-xl font-bold ${getScoreColor(manualScores.accuracy)}`}>
                  {manualScores.accuracy}
                </span>
              </div>
              <Slider
                value={[manualScores.accuracy]}
                onValueChange={(value) => handleManualScore('accuracy', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* 总分预览 */}
            <Card className="bg-slate-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">综合评分预览</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${getScoreColor(calculateTotalScore(manualScores))}`}>
                      {calculateTotalScore(manualScores)}
                    </span>
                    <Badge className={getScoreBadge(calculateTotalScore(manualScores)).color}>
                      {getScoreBadge(calculateTotalScore(manualScores)).label}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 评分意见 */}
            <div>
              <label className="text-sm font-medium">评分意见</label>
              <Textarea
                placeholder="请输入评分意见和改进建议..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScoringDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={submitManualScore}
              className="bg-slate-900 hover:bg-slate-800"
            >
              提交评分
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
