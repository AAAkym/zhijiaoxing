import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  User, MessageCircle, Radar, ChevronRight, Loader2,
  CheckCircle, BookOpen, Brain, Target, Clock, Sparkles
} from 'lucide-react'
import { profileApi } from '@/services/api'

const DIMENSION_ICONS = {
  knowledge_base: BookOpen,
  cognitive_style: Brain,
  error_patterns: Target,
  learning_pace: Clock,
  interest_areas: Sparkles,
  goal_orientation: Target,
}

const DIMENSION_COLORS = {
  knowledge_base: '#3B82F6',
  cognitive_style: '#8B5CF6',
  error_patterns: '#EF4444',
  learning_pace: '#F59E0B',
  interest_areas: '#10B981',
  goal_orientation: '#EC4899',
}

const STYLE_LABELS = {
  visual: '视觉型', auditory: '听觉型', kinesthetic: '动觉型',
  reading: '阅读型', mixed: '混合型',
}
const PACE_LABELS = {
  fast: '快速型', moderate: '适中型', slow: '深度型', adaptive: '灵活型',
}
const GOAL_LABELS = {
  exam: '应试导向', career: '职业发展', hobby: '兴趣驱动', research: '学术研究',
}

export default function ProfileBuilder() {
  const [profile, setProfile] = useState(null)
  const [dialogSession, setDialogSession] = useState(null)
  const [dialogState, setDialogState] = useState(null)
  const [messages, setMessages] = useState([])
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('dashboard')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  const fetchProfile = useCallback(async () => {
    try {
      const result = await profileApi.getProfile()
      setProfile(result.profile)
    } catch (err) {
      console.error('Fetch profile error:', err)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const handleStartDialog = async () => {
    setLoading(true)
    try {
      const result = await profileApi.startDialog()
      setDialogSession(result.session)
      setDialogState(result.dialog)
      setMessages([
        { role: 'assistant', content: result.dialog.greeting },
        { role: 'assistant', content: result.dialog.question },
      ])
      setView('dialog')
    } catch (err) {
      console.error('Start dialog error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!userInput.trim() || !dialogSession) return
    const answer = userInput.trim()
    setUserInput('')
    setMessages(prev => [...prev, { role: 'user', content: answer }])
    setLoading(true)

    try {
      const result = await profileApi.continueDialog({
        session_id: dialogSession.id,
        answer,
      })
      setDialogSession(result.session)
      setDialogState(result.dialog)

      if (result.dialog.type === 'dialog_continue') {
        const feedback = result.dialog.feedback || ''
        const question = result.dialog.question
        const newMsgs = []
        if (feedback) newMsgs.push({ role: 'assistant', content: feedback })
        newMsgs.push({ role: 'assistant', content: question })
        setMessages(prev => [...prev, ...newMsgs])
      } else if (result.dialog.type === 'dialog_complete') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.dialog.message,
        }])
        await fetchProfile()
      }
    } catch (err) {
      console.error('Continue dialog error:', err)
      setMessages(prev => [...prev, {
        role: 'assistant', content: '抱歉，处理出现了问题，请重试。'
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const renderRadarChart = () => {
    if (!profile) return null
    const dimensions = [
      { key: 'knowledge_base', label: '知识基础', value: profile.knowledge_base && Object.keys(profile.knowledge_base).length > 0 ? 80 : 20 },
      { key: 'cognitive_style', label: '认知风格', value: profile.cognitive_style && profile.cognitive_style !== 'mixed' ? 75 : 30 },
      { key: 'error_patterns', label: '易错模式', value: profile.error_patterns && profile.error_patterns.length > 0 ? 70 : 15 },
      { key: 'learning_pace', label: '学习节奏', value: profile.learning_pace && profile.learning_pace !== 'moderate' ? 70 : 30 },
      { key: 'interest_areas', label: '兴趣领域', value: profile.interest_areas && profile.interest_areas.length > 0 ? 75 : 20 },
      { key: 'goal_orientation', label: '目标导向', value: profile.goal_orientation && profile.goal_orientation !== 'exam' ? 70 : 30 },
    ]

    const centerX = 120, centerY = 120, radius = 90
    const angleStep = (2 * Math.PI) / dimensions.length

    const points = dimensions.map((dim, i) => {
      const angle = angleStep * i - Math.PI / 2
      const r = (dim.value / 100) * radius
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        label: dim.label,
        value: dim.value,
        angle,
      }
    })

    const axisPoints = dimensions.map((_, i) => {
      const angle = angleStep * i - Math.PI / 2
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      }
    })

    const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ')

    return (
      <svg viewBox="0 0 240 240" className="w-full max-w-[280px] mx-auto">
        {[0.25, 0.5, 0.75, 1].map((scale, idx) => (
          <polygon
            key={idx}
            points={dimensions.map((_, i) => {
              const angle = angleStep * i - Math.PI / 2
              const x = centerX + radius * scale * Math.cos(angle)
              const y = centerY + radius * scale * Math.sin(angle)
              return `${x},${y}`
            }).join(' ')}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        ))}
        {axisPoints.map((p, i) => (
          <line key={i} x1={centerX} y1={centerY} x2={p.x} y2={p.y} stroke="#D1D5DB" strokeWidth="1" />
        ))}
        <polygon
          points={polygonPoints}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="#3B82F6"
          strokeWidth="2"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={DIMENSION_COLORS[dimensions[i].key]} />
        ))}
        {axisPoints.map((p, i) => (
          <text
            key={i}
            x={centerX + (radius + 18) * Math.cos(dimensions.length > 0 ? angleStep * i - Math.PI / 2 : 0)}
            y={centerY + (radius + 18) * Math.sin(dimensions.length > 0 ? angleStep * i - Math.PI / 2 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] fill-gray-600"
          >
            {dimensions[i].label}
          </text>
        ))}
      </svg>
    )
  }

  const renderDimensionCards = () => {
    if (!profile) return null
    const dims = [
      {
        key: 'knowledge_base', label: '知识基础', icon: BookOpen, color: '#3B82F6',
        value: profile.knowledge_base && Object.keys(profile.knowledge_base).length > 0
          ? Object.entries(profile.knowledge_base).map(([k, v]) => `${k}:${v}`).join(', ')
          : '未设置',
        filled: profile.knowledge_base && Object.keys(profile.knowledge_base).length > 0,
      },
      {
        key: 'cognitive_style', label: '认知风格', icon: Brain, color: '#8B5CF6',
        value: STYLE_LABELS[profile.cognitive_style] || profile.cognitive_style || '未设置',
        filled: profile.cognitive_style && profile.cognitive_style !== 'mixed',
      },
      {
        key: 'error_patterns', label: '易错模式', icon: Target, color: '#EF4444',
        value: profile.error_patterns && profile.error_patterns.length > 0
          ? profile.error_patterns.map(e => e.error_type).join(', ')
          : '未设置',
        filled: profile.error_patterns && profile.error_patterns.length > 0,
      },
      {
        key: 'learning_pace', label: '学习节奏', icon: Clock, color: '#F59E0B',
        value: PACE_LABELS[profile.learning_pace] || profile.learning_pace || '未设置',
        filled: profile.learning_pace && profile.learning_pace !== 'moderate',
      },
      {
        key: 'interest_areas', label: '兴趣领域', icon: Sparkles, color: '#10B981',
        value: profile.interest_areas && profile.interest_areas.length > 0
          ? profile.interest_areas.map(a => a.area).join(', ')
          : '未设置',
        filled: profile.interest_areas && profile.interest_areas.length > 0,
      },
      {
        key: 'goal_orientation', label: '目标导向', icon: Target, color: '#EC4899',
        value: GOAL_LABELS[profile.goal_orientation] || profile.goal_orientation || '未设置',
        filled: profile.goal_orientation && profile.goal_orientation !== 'exam',
      },
    ]

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {dims.map(dim => {
          const Icon = dim.icon
          return (
            <Card key={dim.key} className={`border-l-4 ${dim.filled ? 'border-l-green-400' : 'border-l-gray-300'}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" style={{ color: dim.color }} />
                  <span className="text-xs font-medium text-gray-600">{dim.label}</span>
                  {dim.filled && <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />}
                </div>
                <p className="text-sm font-medium truncate" title={dim.value}>{dim.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-6 h-6" />学习画像
          </h2>
          <p className="text-gray-600">通过对话构建你的专属学习画像，获取个性化学习方案</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'dashboard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('dashboard')}
          >
            <Radar className="w-4 h-4 mr-1" />画像看板
          </Button>
          <Button
            variant={view === 'dialog' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (!dialogSession) handleStartDialog()
              else setView('dialog')
            }}
          >
            <MessageCircle className="w-4 h-4 mr-1" />对话构建
          </Button>
        </div>
      </div>

      {view === 'dashboard' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
              <CardContent className="p-4">
                <p className="text-blue-100 text-xs">画像完整度</p>
                <p className="text-2xl font-bold">{Math.round((profile?.confidence_score || 0) * 100)}%</p>
                <Progress value={(profile?.confidence_score || 0) * 100} className="mt-2 bg-blue-400 h-1.5" />
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-violet-500 text-white">
              <CardContent className="p-4">
                <p className="text-purple-100 text-xs">已填充维度</p>
                <p className="text-2xl font-bold">{profile ? Math.round((profile.confidence_score || 0) * 8) : 0}/8</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
              <CardContent className="p-4">
                <p className="text-green-100 text-xs">更新来源</p>
                <p className="text-2xl font-bold">{profile?.update_source === 'dialog' ? '对话' : profile?.update_source === 'auto' ? '自动' : '手动'}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">画像雷达图</CardTitle></CardHeader>
              <CardContent>{renderRadarChart()}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">维度详情</CardTitle></CardHeader>
              <CardContent>{renderDimensionCards()}</CardContent>
            </Card>
          </div>

          <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
            <CardContent className="py-8 text-center">
              <MessageCircle className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-3">通过对话快速完善你的学习画像</p>
              <Button onClick={handleStartDialog} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                开始对话构建
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {view === 'dialog' && (
        <Card className="flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />画像构建对话
              </CardTitle>
              {dialogState && (
                <Badge variant="outline">
                  {dialogState.current_round}/{dialogState.total_rounds} 轮
                </Badge>
              )}
            </div>
            {dialogState && (
              <Progress
                value={((dialogState.current_round || 0) / (dialogState.total_rounds || 6)) * 100}
                className="h-1.5 mt-2"
              />
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的回答..."
                disabled={loading || dialogState?.type === 'dialog_complete'}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!userInput.trim() || loading || dialogState?.type === 'dialog_complete'}
              >
                发送
              </Button>
            </div>
            {dialogState?.type === 'dialog_complete' && (
              <div className="mt-2 text-center">
                <Button variant="outline" size="sm" onClick={() => { setView('dashboard'); fetchProfile() }}>
                  <CheckCircle className="w-4 h-4 mr-1" />查看画像
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
