import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageCircle,
  BookOpen,
  Compass,
  Search,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  AlertTriangle,
  Zap,
  Activity,
  Sparkles,
} from 'lucide-react'
import { student, aiTutor } from '@/services/api'
import QuestionAnswer from './QuestionAnswer'
import KnowledgeExplainer from './KnowledgeExplainer'
import LearningGuide from './LearningGuide'
import LearningDiagnosis from './LearningDiagnosis'

const TAB_ITEMS = [
  { id: 'qa', label: '答疑解惑', icon: MessageCircle, emoji: '💬' },
  { id: 'knowledge', label: '知识讲解', icon: BookOpen, emoji: '📚' },
  { id: 'guide', label: '学习引导', icon: Compass, emoji: '🧭' },
  { id: 'diagnosis', label: '学习诊断', icon: Search, emoji: '🔍' },
]

const MAX_RECENT_TOPICS = 20

export default function AITutorPanel({ courseId: courseIdProp, videoId, className }) {
  const [activeTab, setActiveTab] = useState('qa')
  const [selectedCourseId, setSelectedCourseId] = useState(courseIdProp ? String(courseIdProp) : '')
  const [courses, setCourses] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [recentTopics, setRecentTopics] = useState([])
  const [weakPoints, setWeakPoints] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState({})

  const fetchCourses = useCallback(async () => {
    setCoursesLoading(true)
    try {
      const response = await student.getMyCourses()
      const coursesData = response.courses || []
      setCourses(coursesData)
      if (coursesData.length > 0 && !selectedCourseId) {
        setSelectedCourseId(String(coursesData[0].id))
      }
    } catch (err) {
      console.error('加载课程列表失败:', err)
    } finally {
      setCoursesLoading(false)
    }
  }, [selectedCourseId])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  useEffect(() => {
    if (courseIdProp) {
      setSelectedCourseId(String(courseIdProp))
    }
  }, [courseIdProp])

  const handleTopicAsked = useCallback((topic) => {
    setRecentTopics((prev) => {
      const filtered = prev.filter((t) => t !== topic)
      const updated = [topic, ...filtered]
      return updated.slice(0, MAX_RECENT_TOPICS)
    })
  }, [])

  const handleWeakPointsUpdate = useCallback((points) => {
    setWeakPoints(points)
  }, [])

  const handleFeedback = useCallback(async (responseId, feedbackType) => {
    const key = `${responseId}-${feedbackType}`
    setFeedbackLoading((prev) => ({ ...prev, [key]: true }))
    try {
      await aiTutor.submitFeedback({
        response_id: responseId,
        feedback_type: feedbackType,
        course_id: selectedCourseId || undefined,
      })
    } catch (err) {
      console.error('提交反馈失败:', err)
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [key]: false }))
    }
  }, [selectedCourseId])

  const handleQuickQuestion = useCallback(() => {
    setActiveTab('qa')
  }, [])

  const handleViewDiagnosis = useCallback(() => {
    setActiveTab('diagnosis')
  }, [])

  const handleRecommendResources = useCallback(() => {
    setActiveTab('guide')
  }, [])

  const sharedProps = {
    courseId: selectedCourseId,
    onTopicAsked: handleTopicAsked,
    weakPoints,
    recentTopics,
    onFeedback: handleFeedback,
    feedbackLoading,
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'qa':
        return <QuestionAnswer {...sharedProps} />
      case 'knowledge':
        return <KnowledgeExplainer {...sharedProps} />
      case 'guide':
        return <LearningGuide {...sharedProps} />
      case 'diagnosis':
        return (
          <LearningDiagnosis
            {...sharedProps}
            onWeakPointsUpdate={handleWeakPointsUpdate}
          />
        )
      default:
        return <QuestionAnswer {...sharedProps} />
    }
  }

  return (
    <div className={`flex h-full min-h-[600px] bg-gray-50 rounded-xl overflow-hidden border border-gray-200 ${className || ''}`}>
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-gray-900">AI 导师</h2>
          </div>

          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder={coursesLoading ? '加载中...' : '选择课程'} />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={String(course.id)}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const showWeakAlert =
              (tab.id === 'qa' || tab.id === 'knowledge') && weakPoints.length > 0

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-base">{tab.emoji}</span>
                <span className="flex-1 text-left">{tab.label}</span>
                {showWeakAlert && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-[20px] flex items-center justify-center text-[10px] px-1"
                  >
                    {weakPoints.length}
                  </Badge>
                )}
                {isActive && <ChevronRight className="w-4 h-4 text-indigo-400" />}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-2">
          {weakPoints.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-800">
                      发现 {weakPoints.length} 个薄弱点
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      建议查看学习诊断
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={handleQuickQuestion}
            >
              <Zap className="w-3.5 h-3.5" />
              快速提问
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={handleViewDiagnosis}
            >
              <Activity className="w-3.5 h-3.5" />
              查看诊断
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={handleRecommendResources}
            >
              <BookOpen className="w-3.5 h-3.5" />
              推荐资源
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(() => {
              const currentTab = TAB_ITEMS.find((t) => t.id === activeTab)
              return (
                <>
                  <span className="text-lg">{currentTab?.emoji}</span>
                  <h3 className="text-base font-semibold text-gray-900">
                    {currentTab?.label}
                  </h3>
                </>
              )
            })()}
            {selectedCourseId && (
              <Badge variant="secondary" className="text-xs">
                {courses.find((c) => String(c.id) === selectedCourseId)?.title || '未选择课程'}
              </Badge>
            )}
          </div>

          {recentTopics.length > 0 && (activeTab === 'qa' || activeTab === 'knowledge') && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">最近话题:</span>
              <div className="flex gap-1 flex-wrap">
                {recentTopics.slice(0, 3).map((topic, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] max-w-[120px] truncate">
                    {topic}
                  </Badge>
                ))}
                {recentTopics.length > 3 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{recentTopics.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
