import React, { useState, useEffect, useCallback } from 'react'
import { learningPathApi, profileApi, student } from '@/services/api'
import {
  Map, List, Brain, Target, Clock, TrendingUp, BookOpen, Video, FileText,
  Code, Star, ChevronRight, ChevronDown, CheckCircle, Lock, PlayCircle,
  Filter, RefreshCw, Loader2, Sparkles, X, ThumbsUp, ThumbsDown, Eye, AlertTriangle
} from 'lucide-react'

const STATUS_CONFIG = {
  completed: { color: '#10b981', bg: '#ecfdf5', label: '已完成', icon: CheckCircle },
  in_progress: { color: '#3b82f6', bg: '#eff6ff', label: '进行中', icon: PlayCircle },
  available: { color: '#f59e0b', bg: '#fffbeb', label: '可学习', icon: PlayCircle },
  locked: { color: '#9ca3af', bg: '#f3f4f6', label: '未解锁', icon: Lock },
}

const TYPE_CONFIG = {
  content: { icon: FileText, color: '#8b5cf6', label: '讲义' },
  video: { icon: Video, color: '#3b82f6', label: '视频' },
  practice: { icon: Code, color: '#10b981', label: '练习' },
  course: { icon: BookOpen, color: '#f59e0b', label: '课程' },
}

const REC_TYPE_CONFIG = {
  exercise: { icon: Code, color: '#10b981', label: '习题' },
  document: { icon: FileText, color: '#8b5cf6', label: '文档' },
  video: { icon: Video, color: '#3b82f6', label: '视频' },
  project: { icon: Code, color: '#f59e0b', label: '实操' },
}

const PRIORITY_CONFIG = {
  0: { label: 'P0 紧急', color: '#ef4444', bg: '#fef2f2' },
  1: { label: 'P1 重要', color: '#f59e0b', bg: '#fffbeb' },
  2: { label: 'P2 一般', color: '#6b7280', bg: '#f9fafb' },
}

export default function LearningPlanSystem({ user }) {
  const [activeTab, setActiveTab] = useState('path')
  const [paths, setPaths] = useState([])
  const [selectedPath, setSelectedPath] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [expandedNode, setExpandedNode] = useState(null)
  const [expandedRec, setExpandedRec] = useState(null)
  const [filterType, setFilterType] = useState(null)
  const [filterPriority, setFilterPriority] = useState(null)
  const [profile, setProfile] = useState(null)

  const fetchPaths = useCallback(async () => {
    try {
      const result = await learningPathApi.getPaths()
      setPaths(result.paths || [])
      if (result.paths?.length > 0 && !selectedPath) {
        setSelectedPath(result.paths[0])
      }
    } catch (e) {
      console.error('Fetch paths error:', e)
    }
  }, [])

  const fetchRecommendations = useCallback(async () => {
    try {
      let result = await learningPathApi.getRecommendations()
      if (!result.recommendations || result.recommendations.length === 0) {
        result = await learningPathApi.generateRecommendations()
      }
      setRecommendations(result.recommendations || [])
    } catch (e) {
      console.error('Fetch recommendations error:', e)
    }
  }, [])

  const fetchPlans = useCallback(async () => {
    try {
      const result = await learningPathApi.getPlans()
      setPlans(result.plans || [])
    } catch (e) {
      console.error('Fetch plans error:', e)
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    try {
      const result = await profileApi.getProfile()
      setProfile(result.profile)
    } catch (e) {
      console.error('Fetch profile error:', e)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
    fetchPaths()
    fetchRecommendations()
    fetchPlans()
  }, [fetchPaths, fetchRecommendations, fetchPlans, fetchProfile])

  const handleGeneratePath = async (courseId) => {
    setLoading(true)
    try {
      const result = await learningPathApi.generatePath(courseId)
      if (result.path) {
        setSelectedPath(result.path)
        fetchPaths()
      }
    } catch (e) {
      console.error('Generate path error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateNode = async (pathId, nodeId, status) => {
    try {
      const result = await learningPathApi.updateNodeStatus(pathId, nodeId, status)
      if (result.path) {
        setSelectedPath(result.path)
        fetchPaths()
      }
    } catch (e) {
      console.error('Update node error:', e)
    }
  }

  const handleGeneratePlan = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const result = await learningPathApi.generatePlan()
      if (result.plan) {
        setPlans(prev => [result.plan, ...prev])
      } else if (result.error) {
        setErrorMsg(result.error)
      }
    } catch (e) {
      console.error('Generate plan error:', e)
      setErrorMsg(e.message || '生成规划失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteRec = async (recId) => {
    try {
      await learningPathApi.completeRecommendation(recId)
      setRecommendations(prev => prev.filter(r => r.id !== recId))
    } catch (e) {
      console.error('Complete rec error:', e)
    }
  }

  const handleDismissRec = async (recId) => {
    try {
      await learningPathApi.dismissRecommendation(recId)
      setRecommendations(prev => prev.filter(r => r.id !== recId))
    } catch (e) {
      console.error('Dismiss rec error:', e)
    }
  }

  const handleFeedback = async (recId, score) => {
    try {
      await learningPathApi.feedbackRecommendation(recId, score)
    } catch (e) {
      console.error('Feedback error:', e)
    }
  }

  const filteredRecs = recommendations.filter(r => {
    if (filterType && r.resource_type !== filterType) return false
    if (filterPriority !== null && r.priority !== filterPriority) return false
    return true
  })

  const tabs = [
    { key: 'path', label: '学习路径', icon: Map },
    { key: 'recommend', label: '智能推荐', icon: List },
    { key: 'plan', label: 'AI规划', icon: Brain },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
            🎯 学习规划中心
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            基于你的学习画像，为你规划个性化学习路径和资源推荐
          </p>
        </div>

        {profile && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px',
          }}>
            {[
              { label: '认知风格', value: profile.cognitive_style, icon: '🧠' },
              { label: '学习节奏', value: profile.learning_pace, icon: '⏱️' },
              { label: '目标导向', value: profile.goal_orientation, icon: '🎯' },
              { label: '画像完整度', value: `${Math.round((profile.confidence_score || 0) * 100)}%`, icon: '📊' },
            ].map(item => (
              <div key={item.label} style={{
                padding: '12px 16px', backgroundColor: '#fff', borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{item.icon} {item.label}</p>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '4px 0 0' }}>{item.value || '未设置'}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{
          display: 'flex', gap: '4px', marginBottom: '24px', backgroundColor: '#fff',
          padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '10px 16px',
                backgroundColor: activeTab === tab.key ? '#3b82f6' : 'transparent',
                color: activeTab === tab.key ? '#fff' : '#475569',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontSize: '14px', fontWeight: 500, display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <tab.icon style={{ width: '16px', height: '16px' }} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'path' && (
          <PathView
            paths={paths}
            selectedPath={selectedPath}
            setSelectedPath={setSelectedPath}
            onGenerate={handleGeneratePath}
            onUpdateNode={handleUpdateNode}
            expandedNode={expandedNode}
            setExpandedNode={setExpandedNode}
            loading={loading}
          />
        )}

        {activeTab === 'recommend' && (
          <RecommendView
            recommendations={filteredRecs}
            filterType={filterType}
            setFilterType={setFilterType}
            filterPriority={filterPriority}
            setFilterPriority={setFilterPriority}
            onComplete={handleCompleteRec}
            onDismiss={handleDismissRec}
            onFeedback={handleFeedback}
            expandedRec={expandedRec}
            setExpandedRec={setExpandedRec}
            onRefresh={() => { fetchRecommendations() }}
            loading={loading}
          />
        )}

        {activeTab === 'plan' && (
          <PlanView
            plans={plans}
            onGenerate={handleGeneratePlan}
            loading={loading}
            errorMsg={errorMsg}
          />
        )}
      </div>
    </div>
  )
}

function PathView({ paths, selectedPath, setSelectedPath, onGenerate, onUpdateNode, expandedNode, setExpandedNode, loading }) {
  const nodes = selectedPath?.path_data || []
  const currentNodeId = selectedPath?.current_node_id

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {paths.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedPath(p)}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: `2px solid ${selectedPath?.id === p.id ? '#3b82f6' : '#e2e8f0'}`,
              backgroundColor: selectedPath?.id === p.id ? '#eff6ff' : '#fff',
              cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#1e293b',
            }}
          >
            {p.title}
            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
              {Math.round(p.progress_percentage)}%
            </span>
          </button>
        ))}
        <button
          onClick={() => onGenerate(null)}
          disabled={loading}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: '2px dashed #cbd5e1',
            backgroundColor: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          {loading ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ width: '14px', height: '14px' }} />}
          生成综合路径
        </button>
      </div>

      {selectedPath && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>整体进度</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                {selectedPath.completed_nodes}/{selectedPath.total_nodes} 节点
              </span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px', transition: 'width 0.5s',
                background: `linear-gradient(90deg, #3b82f6, #8b5cf6)`,
                width: `${selectedPath.progress_percentage}%`,
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#64748b' }}>
            <span>⏱️ 预计 {selectedPath.estimated_days} 天</span>
          </div>
        </div>
      )}

      {nodes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Map style={{ width: '48px', height: '48px', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '16px', fontWeight: 500 }}>暂无学习路径</p>
          <p style={{ fontSize: '13px' }}>点击"生成综合路径"或选择课程生成个性化路径</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: '24px', top: '0', bottom: '0', width: '3px',
            background: 'linear-gradient(to bottom, #3b82f6, #8b5cf6, #ec4899)', borderRadius: '2px',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '56px' }}>
            {nodes.map((node, index) => {
              const statusCfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.locked
              const typeCfg = TYPE_CONFIG[node.node_type] || TYPE_CONFIG.content
              const isCurrent = node.node_id === currentNodeId
              const isExpanded = expandedNode === node.node_id
              const StatusIcon = statusCfg.icon
              const TypeIcon = typeCfg.icon

              return (
                <div key={node.node_id} style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: '-40px', top: '16px',
                    width: '28px', height: '28px', borderRadius: '50%',
                    backgroundColor: statusCfg.color, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    boxShadow: isCurrent ? `0 0 0 4px ${statusCfg.color}33` : 'none',
                    transition: 'all 0.2s',
                  }}>
                    <StatusIcon style={{ width: '14px', height: '14px', color: '#fff' }} />
                  </div>

                  <div style={{
                    backgroundColor: isCurrent ? '#eff6ff' : '#fff',
                    border: `2px solid ${isCurrent ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: '10px', overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}>
                    <div
                      onClick={() => setExpandedNode(isExpanded ? null : node.node_id)}
                      style={{
                        padding: '14px 16px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '12px',
                      }}
                    >
                      <div style={{
                        padding: '6px', borderRadius: '6px', backgroundColor: `${typeCfg.color}15`,
                      }}>
                        <TypeIcon style={{ width: '18px', height: '18px', color: typeCfg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                            {index + 1}. {node.title}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
                            backgroundColor: statusCfg.bg, color: statusCfg.color,
                          }}>
                            {statusCfg.label}
                          </span>
                          <span style={{
                            padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                            backgroundColor: `${typeCfg.color}15`, color: typeCfg.color,
                          }}>
                            {typeCfg.label}
                          </span>
                        </div>
                        {node.description && (
                          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {node.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>⏱️ {node.estimated_minutes}分</span>
                        {isExpanded ? <ChevronDown style={{ width: '16px', height: '16px', color: '#94a3b8' }} /> : <ChevronRight style={{ width: '16px', height: '16px', color: '#94a3b8' }} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 16px 14px', borderTop: '1px solid #f1f5f9' }}>
                        {node.description && (
                          <p style={{ fontSize: '13px', color: '#475569', margin: '10px 0', lineHeight: '1.6' }}>
                            {node.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px' }}>掌握度</p>
                            <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: '3px',
                                backgroundColor: node.mastery_level >= 0.8 ? '#10b981' : node.mastery_level >= 0.5 ? '#f59e0b' : '#ef4444',
                                width: `${Math.round(node.mastery_level * 100)}%`,
                              }} />
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px' }}>进度</p>
                            <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: '3px', backgroundColor: '#3b82f6',
                                width: `${node.progress_percentage}%`,
                              }} />
                            </div>
                          </div>
                        </div>
                        {node.prerequisites?.length > 0 && (
                          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 8px' }}>
                            📋 前置条件：{node.prerequisites.join(', ')}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {node.status === 'available' && (
                            <button
                              onClick={() => onUpdateNode(selectedPath.id, node.node_id, 'in_progress')}
                              style={{
                                padding: '6px 14px', backgroundColor: '#3b82f6', color: '#fff',
                                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                              }}
                            >
                              开始学习
                            </button>
                          )}
                          {node.status === 'in_progress' && (
                            <button
                              onClick={() => onUpdateNode(selectedPath.id, node.node_id, 'completed')}
                              style={{
                                padding: '6px 14px', backgroundColor: '#10b981', color: '#fff',
                                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                              }}
                            >
                              标记完成
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RecommendView({ recommendations, filterType, setFilterType, filterPriority, setFilterPriority, onComplete, onDismiss, onFeedback, expandedRec, setExpandedRec, onRefresh, loading }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Filter style={{ width: '14px', height: '14px' }} /> 筛选：
        </span>
        {Object.entries(REC_TYPE_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterType(filterType === key ? null : key)}
            style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
              border: `1px solid ${filterType === key ? cfg.color : '#e2e8f0'}`,
              backgroundColor: filterType === key ? `${cfg.color}15` : '#fff',
              color: filterType === key ? cfg.color : '#64748b',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <cfg.icon style={{ width: '12px', height: '12px' }} /> {cfg.label}
          </button>
        ))}
        <span style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />
        {[0, 1, 2].map(p => (
          <button
            key={p}
            onClick={() => setFilterPriority(filterPriority === p ? null : p)}
            style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
              border: `1px solid ${filterPriority === p ? PRIORITY_CONFIG[p].color : '#e2e8f0'}`,
              backgroundColor: filterPriority === p ? PRIORITY_CONFIG[p].bg : '#fff',
              color: filterPriority === p ? PRIORITY_CONFIG[p].color : '#64748b',
              cursor: 'pointer',
            }}
          >
            {PRIORITY_CONFIG[p].label}
          </button>
        ))}
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            marginLeft: 'auto', padding: '6px 12px', borderRadius: '6px',
            border: '1px solid #e2e8f0', backgroundColor: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', color: '#64748b',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          <RefreshCw style={{ width: '12px', height: '12px' }} /> 刷新推荐
        </button>
      </div>

      {recommendations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <List style={{ width: '48px', height: '48px', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '16px', fontWeight: 500 }}>暂无推荐内容</p>
          <p style={{ fontSize: '13px' }}>完成学习画像后即可获取个性化推荐</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recommendations.map(rec => {
            const typeCfg = REC_TYPE_CONFIG[rec.resource_type] || REC_TYPE_CONFIG.document
            const priCfg = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG[2]
            const TypeIcon = typeCfg.icon
            const isExpanded = expandedRec === rec.id
            const reasons = rec.reasons || {}

            return (
              <div key={rec.id} style={{
                backgroundColor: '#fff', borderRadius: '10px',
                border: '1px solid #e2e8f0', overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    padding: '8px', borderRadius: '8px', backgroundColor: `${typeCfg.color}15`, flexShrink: 0,
                  }}>
                    <TypeIcon style={{ width: '20px', height: '20px', color: typeCfg.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        backgroundColor: priCfg.bg, color: priCfg.color,
                      }}>
                        {priCfg.label}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{rec.title}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{rec.description}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>⏱️ {rec.estimated_minutes}分钟</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>📊 难度：{rec.difficulty}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>🤖 {rec.generated_by_agent}</span>
                      {rec.tags?.map((tag, i) => (
                        <span key={i} style={{
                          padding: '1px 6px', borderRadius: '4px', fontSize: '10px',
                          backgroundColor: '#f1f5f9', color: '#64748b',
                        }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => onComplete(rec.id)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
                        backgroundColor: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                      }}
                    >
                      <CheckCircle style={{ width: '12px', height: '12px' }} /> 完成
                    </button>
                    <button
                      onClick={() => setExpandedRec(isExpanded ? null : rec.id)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
                        backgroundColor: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                      }}
                    >
                      <Eye style={{ width: '12px', height: '12px' }} /> 理由
                    </button>
                    <button
                      onClick={() => onDismiss(rec.id)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
                        backgroundColor: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                      }}
                    >
                      <X style={{ width: '12px', height: '12px' }} /> 忽略
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: '14px 16px', backgroundColor: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                  }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: '0 0 10px' }}>
                      📋 推荐理由分析
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {[
                        { key: 'knowledge', label: '知识关联性', icon: '📚', color: '#8b5cf6' },
                        { key: 'progress', label: '进度匹配度', icon: '📈', color: '#3b82f6' },
                        { key: 'ability', label: '能力提升空间', icon: '💪', color: '#10b981' },
                        { key: 'interest', label: '兴趣偏好匹配', icon: '❤️', color: '#f59e0b' },
                      ].map(dim => (
                        <div key={dim.key} style={{
                          padding: '10px', borderRadius: '8px',
                          backgroundColor: reasons[dim.key] ? '#fff' : '#f9fafb',
                          border: `1px solid ${reasons[dim.key] ? `${dim.color}30` : '#e2e8f0'}`,
                        }}>
                          <p style={{ fontSize: '12px', fontWeight: 500, color: dim.color, margin: '0 0 4px' }}>
                            {dim.icon} {dim.label}
                          </p>
                          <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: '1.5' }}>
                            {reasons[dim.key] || '暂无分析'}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>推荐有帮助吗？</span>
                      <button onClick={() => onFeedback(rec.id, 5)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                        <ThumbsUp style={{ width: '14px', height: '14px', color: '#10b981' }} />
                      </button>
                      <button onClick={() => onFeedback(rec.id, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                        <ThumbsDown style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlanView({ plans, onGenerate, loading, errorMsg }) {
  const latestPlan = plans[0]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          AI基于你的学习画像和历史数据，为你生成中长期学习规划
        </p>
        <button
          onClick={onGenerate}
          disabled={loading}
          style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none',
            backgroundColor: '#6366f1', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
          }}
        >
          {loading ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: '16px', height: '16px' }} />}
          {loading ? 'AI分析中...' : '生成AI学习规划'}
        </button>
      </div>

      {errorMsg && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
          backgroundColor: '#fef2f2', border: '1px solid #fecaca',
          color: '#991b1b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <span>{errorMsg}</span>
          <button onClick={() => onGenerate()} style={{
            marginLeft: 'auto', padding: '4px 10px', borderRadius: '4px',
            backgroundColor: '#fee2e2', border: '1px solid #fecaca',
            cursor: 'pointer', fontSize: '12px', color: '#991b1b',
          }}>
            重试
          </button>
        </div>
      )}

      {!latestPlan ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Brain style={{ width: '48px', height: '48px', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '16px', fontWeight: 500 }}>暂无学习规划</p>
          <p style={{ fontSize: '13px' }}>点击"生成AI学习规划"获取个性化规划方案</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {latestPlan.ai_analysis && (
            <div style={{
              padding: '20px', backgroundColor: '#eff6ff', borderRadius: '10px',
              border: '1px solid #bfdbfe',
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e40af', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Brain style={{ width: '18px', height: '18px' }} /> AI综合分析
              </h3>
              <div style={{ fontSize: '14px', color: '#1e3a5f', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {latestPlan.ai_analysis}
              </div>
            </div>
          )}

          {latestPlan.goals?.length > 0 && (
            <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Target style={{ width: '18px', height: '18px', color: '#ef4444' }} /> 阶段性学习目标
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {latestPlan.goals.map((goal, i) => (
                  <div key={i} style={{
                    padding: '14px', borderRadius: '8px',
                    backgroundColor: i === 0 ? '#fef2f2' : i === 1 ? '#fffbeb' : '#f0fdf4',
                    border: `1px solid ${i === 0 ? '#fecaca' : i === 1 ? '#fde68a' : '#bbf7d0'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        backgroundColor: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#10b981',
                        color: '#fff',
                      }}>
                        {goal.phase}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{goal.goal}</span>
                    </div>
                    {goal.measurable && (
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        📊 衡量指标：{goal.measurable}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestPlan.milestones?.length > 0 && (
            <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock style={{ width: '18px', height: '18px', color: '#3b82f6' } } /> 里程碑计划
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {latestPlan.milestones.map((ms, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: '8px',
                    backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        backgroundColor: '#3b82f6', color: '#fff',
                      }}>
                        第 {ms.week} 周
                      </span>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>交付：{ms.deliverable}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {ms.tasks?.map((task, j) => (
                        <span key={j} style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
                          backgroundColor: '#eff6ff', color: '#3b82f6',
                        }}>
                          ✓ {task}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestPlan.recommended_sequence?.length > 0 && (
            <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp style={{ width: '18px', height: '18px', color: '#10b981' }} /> 推荐学习顺序
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {latestPlan.recommended_sequence.map((seq, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '8px',
                    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                  }}>
                    <span style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: '#10b981', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 600, flexShrink: 0,
                    }}>
                      {seq.step}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', margin: 0 }}>{seq.action}</p>
                      {seq.reason && (
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>💡 {seq.reason}</p>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b', flexShrink: 0 }}>
                      ⏱️ {seq.estimated_days}天
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestPlan.ability_expectations && Object.keys(latestPlan.ability_expectations).length > 0 && (
            <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Star style={{ width: '18px', height: '18px', color: '#f59e0b' }} /> 能力提升预期
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {Object.entries(latestPlan.ability_expectations).map(([key, value]) => (
                  <div key={key} style={{
                    padding: '14px', borderRadius: '8px',
                    backgroundColor: '#fffbeb', border: '1px solid #fde68a', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#92400e', margin: '0 0 4px' }}>{key}</p>
                    <p style={{ fontSize: '12px', color: '#78350f', margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestPlan.estimated_completion && (
            <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '13px' }}>
              📅 预计完成时间：{new Date(latestPlan.estimated_completion).toLocaleDateString('zh-CN')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
