import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Shield, 
  Bot, 
  UserCheck, 
  Shuffle,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  RefreshCw,
  FileSearch,
  Filter,
  ArrowRight
} from 'lucide-react'
import { contentReview } from '@/services/api'

const reviewMechanisms = {
  auto: {
    title: '系统自动审核',
    icon: Bot,
    color: 'purple',
    description: '基于预设规则与AI模型进行初步筛查',
    features: [
      '敏感词检测',
      '内容合规性分析',
      '教育适用性评估',
      'AI模型智能评分'
    ]
  },
  manual: {
    title: '人工审核',
    icon: UserCheck,
    color: 'orange',
    description: '支持审核人员手动复核与标记',
    features: [
      '专业审核员复核',
      '多维度评分',
      '审核意见记录',
      '审核流程追踪'
    ]
  },
  spotCheck: {
    title: '抽查审核',
    icon: Shuffle,
    color: 'cyan',
    description: '实现随机抽查与重点内容二次审核机制',
    features: [
      '随机抽样检查',
      '重点内容标记',
      '二次审核流程',
      '审核质量监控'
    ]
  }
}

export default function ReviewMechanism() {
  const [activeMechanism, setActiveMechanism] = useState('auto')
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [spotSettings, setSpotSettings] = useState({
    sampleRate: 10,
    priorityKeywords: ['重要', '核心', '考试', '评分'],
    recheckThreshold: 80,
    maxRecheckAttempts: 3
  })
  const [workflowConfig, setWorkflowConfig] = useState({
    autoFirst: true,
    manualAfterAuto: true,
    spotCheckEnabled: true,
    spotCheckRate: 10
  })

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const response = await contentReview.getReviewRules()
      if (response.success) {
        setRules(response.data || [])
      }
    } catch (error) {
      console.error('加载审核规则失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  const toggleRule = async (ruleId, enabled) => {
    try {
      await contentReview.updateReviewRule(ruleId, { enabled: !enabled })
      setRules(rules.map(rule => 
        rule.id === ruleId ? { ...rule, enabled: !enabled } : rule
      ))
    } catch (error) {
      console.error('更新规则失败:', error)
    }
  }

  const updateRuleThreshold = async (ruleId, threshold) => {
    const newThreshold = parseInt(threshold) || 0
    setRules(rules.map(rule =>
      rule.id === ruleId ? { ...rule, threshold: newThreshold } : rule
    ))
  }

  const saveRuleThreshold = async (ruleId) => {
    const rule = rules.find(r => r.id === ruleId)
    if (rule) {
      try {
        await contentReview.updateReviewRule(ruleId, { threshold: rule.threshold })
      } catch (error) {
        console.error('保存规则阈值失败:', error)
      }
    }
  }

  const handleSaveRules = async () => {
    setSaving(true)
    try {
      for (const rule of rules) {
        await contentReview.updateReviewRule(rule.id, {
          enabled: rule.enabled,
          threshold: rule.threshold,
        })
      }
    } catch (error) {
      console.error('保存规则配置失败:', error)
    } finally {
      setSaving(false)
    }
  }

  const getColorClasses = (color) => {
    const colors = {
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600' },
      orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-600' },
      cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', icon: 'text-cyan-600' }
    }
    return colors[color] || colors.purple
  }

  const autoRules = rules.filter(r => r.rule_type === 'auto')
  const manualRules = rules.filter(r => r.rule_type === 'manual')
  const spotCheckRules = rules.filter(r => r.rule_type === 'spot_check')

  return (
    <div className="space-y-6">
      {/* 三重审核机制概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(reviewMechanisms).map(([key, mechanism]) => {
          const Icon = mechanism.icon
          const colors = getColorClasses(mechanism.color)

          return (
            <Card 
              key={key}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                activeMechanism === key ? 'ring-2 ring-slate-900' : ''
              }`}
              onClick={() => setActiveMechanism(key)}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-lg ${colors.bg}`}>
                    <Icon className={`h-6 w-6 ${colors.icon}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{mechanism.title}</h3>
                    <p className="text-xs text-gray-500">{mechanism.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {mechanism.features.slice(0, 2).map((feature, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {mechanism.features.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{mechanism.features.length - 2}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 审核流程配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2 text-slate-600" />
            审核流程配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                <span className="font-medium">自动审核</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-orange-600" />
                <span className="font-medium">人工审核</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
              <div className="flex items-center gap-2">
                <Shuffle className="h-5 w-5 text-cyan-600" />
                <span className="font-medium">抽查审核</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">自动审核优先</p>
                <p className="text-xs text-gray-500">所有内容先经过自动审核</p>
              </div>
              <Switch 
                checked={workflowConfig.autoFirst}
                onCheckedChange={(checked) => setWorkflowConfig({...workflowConfig, autoFirst: checked})}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">人工复核</p>
                <p className="text-xs text-gray-500">自动审核后人工复核</p>
              </div>
              <Switch 
                checked={workflowConfig.manualAfterAuto}
                onCheckedChange={(checked) => setWorkflowConfig({...workflowConfig, manualAfterAuto: checked})}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">抽查审核</p>
                <p className="text-xs text-gray-500">启用随机抽查机制</p>
              </div>
              <Switch 
                checked={workflowConfig.spotCheckEnabled}
                onCheckedChange={(checked) => setWorkflowConfig({...workflowConfig, spotCheckEnabled: checked})}
              />
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium mb-2">抽查比例</p>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={workflowConfig.spotCheckRate}
                  onChange={(e) => setWorkflowConfig({
                    ...workflowConfig,
                    spotCheckRate: parseInt(e.target.value) || 0
                  })}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 自动审核规则配置 */}
      {activeMechanism === 'auto' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="h-5 w-5 mr-2 text-purple-600" />
              自动审核规则
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : (
              <div className="space-y-4">
                {autoRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleRule(rule.id, rule.enabled)}
                      />
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-gray-500">{rule.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">阈值:</span>
                      <Input
                        type="number"
                        value={rule.threshold}
                        onChange={(e) => updateRuleThreshold(rule.id, e.target.value)}
                        onBlur={() => saveRuleThreshold(rule.id)}
                        className="w-20"
                        disabled={!rule.enabled}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button className="bg-slate-900 hover:bg-slate-800" onClick={handleSaveRules} disabled={saving}>
                保存规则配置
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 人工审核配置 */}
      {activeMechanism === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserCheck className="h-5 w-5 mr-2 text-orange-600" />
              人工审核配置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">审核员分配策略</label>
                  <Select defaultValue="auto">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">自动分配</SelectItem>
                      <SelectItem value="manual">手动分配</SelectItem>
                      <SelectItem value="round">轮询分配</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">审核时限</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" defaultValue={24} className="w-20" />
                    <span className="text-sm text-gray-500">小时</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">最低审核员级别</label>
                  <Select defaultValue="senior">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">初级审核员</SelectItem>
                      <SelectItem value="senior">高级审核员</SelectItem>
                      <SelectItem value="expert">专家审核员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">审核意见模板</label>
                  <Textarea
                    placeholder="输入审核意见模板..."
                    rows={4}
                    className="mt-1"
                    defaultValue="内容审核通过，符合平台规范。"
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">多人审核</p>
                    <p className="text-xs text-gray-500">重要内容需多人审核</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button className="bg-slate-900 hover:bg-slate-800">
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 抽查审核配置 */}
      {activeMechanism === 'spotCheck' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shuffle className="h-5 w-5 mr-2 text-cyan-600" />
              抽查审核配置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">抽查比例</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      type="number" 
                      value={spotSettings.sampleRate}
                      onChange={(e) => setSpotSettings({
                        ...spotSettings,
                        sampleRate: parseInt(e.target.value) || 0
                      })}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">从已通过内容中随机抽取的比例</p>
                </div>
                <div>
                  <label className="text-sm font-medium">二次审核阈值</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      type="number" 
                      value={spotSettings.recheckThreshold}
                      onChange={(e) => setSpotSettings({
                        ...spotSettings,
                        recheckThreshold: parseInt(e.target.value) || 0
                      })}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">分</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">评分低于此阈值的内容需二次审核</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">重点关键词</label>
                  <Textarea
                    placeholder="输入关键词，用逗号分隔..."
                    rows={3}
                    value={spotSettings.priorityKeywords.join(', ')}
                    onChange={(e) => setSpotSettings({
                      ...spotSettings,
                      priorityKeywords: e.target.value.split(',').map(k => k.trim())
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">包含这些关键词的内容优先抽查</p>
                </div>
                <div>
                  <label className="text-sm font-medium">最大重审次数</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      type="number" 
                      value={spotSettings.maxRecheckAttempts}
                      onChange={(e) => setSpotSettings({
                        ...spotSettings,
                        maxRecheckAttempts: parseInt(e.target.value) || 0
                      })}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">次</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button className="bg-slate-900 hover:bg-slate-800">
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 审核队列状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-slate-600" />
            审核队列状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">自动审核队列</span>
                <Badge className="bg-purple-100 text-purple-700">处理中</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-purple-700">{autoRules.filter(r => r.enabled).length}</p>
                  <p className="text-xs text-purple-600">活跃规则</p>
                </div>
                <Progress value={autoRules.length > 0 ? (autoRules.filter(r => r.enabled).length / autoRules.length) * 100 : 0} className="flex-1" />
              </div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-700">人工审核队列</span>
                <Badge className="bg-orange-100 text-orange-700">等待中</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-orange-700">{manualRules.filter(r => r.enabled).length}</p>
                  <p className="text-xs text-orange-600">活跃规则</p>
                </div>
                <Progress value={manualRules.length > 0 ? (manualRules.filter(r => r.enabled).length / manualRules.length) * 100 : 0} className="flex-1" />
              </div>
            </div>
            <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-cyan-700">抽查审核队列</span>
                <Badge className="bg-cyan-100 text-cyan-700">进行中</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-cyan-700">{spotCheckRules.filter(r => r.enabled).length}</p>
                  <p className="text-xs text-cyan-600">活跃规则</p>
                </div>
                <Progress value={spotCheckRules.length > 0 ? (spotCheckRules.filter(r => r.enabled).length / spotCheckRules.length) * 100 : 0} className="flex-1" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
