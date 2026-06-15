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
  { id: 'qa', label: '答疑', icon: MessageCircle, emoji: '💬' },
  { id: 'knowledge', label: '讲解', icon: BookOpen, emoji: '📚' },
  { id: 'guide', label: '引导', icon: Compass, emoji: '🧭' },
  { id: 'diagnosis', label: '诊断', icon: Search, emoji: '🔍' },
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
    <div className={`flex flex-col h-full min-h-[600px] bg-gray-50 rounded-xl overflow-hidden border border-gray-200 ${className || ''}`}>
      {/* 顶部：标题 + 课程选择 + Tab 栏 */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        {/* 标题行 */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">AI 导师</h2>
            {selectedCourseId && (
              <Badge variant="secondary" className="text-[10px] ml-1">
                {courses.find((c) => String(c.id) === selectedCourseId)?.title || '未选择课程'}
              </Badge>
            )}
          </div>
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger className="w-[140px] h-7 text-xs">
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

        {/* 水平 Tab 栏 */}
        <div className="px-3 pb-1 flex items-center gap-1">
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.id
            const showWeakAlert =
              (tab.id === 'qa' || tab.id === 'knowledge') && weakPoints.length > 0

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {showWeakAlert && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center leading-none">
                    {weakPoints.length}
                  </span>
                )}
              </button>
            )
          })}

          {/* 快捷操作 */}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={handleQuickQuestion}
            >
              <Zap className="w-3 h-3" />提问
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={handleViewDiagnosis}
            >
              <Activity className="w-3 h-3" />诊断
            </Button>
          </div>
        </div>
      </div>

      {/* 薄弱点提示 */}
      {weakPoints.length > 0 && (
        <div className="mx-3 mt-3">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <p className="text-[11px] text-amber-800">
                发现 {weakPoints.length} 个薄弱点，建议查看学习诊断
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 内容区：全宽 */}
      <div className="flex-1 overflow-auto p-4">
        {renderContent()}
      </div>
    </div>
  )
}
