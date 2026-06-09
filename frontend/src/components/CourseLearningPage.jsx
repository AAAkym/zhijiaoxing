import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { courses, videos, notes, ai, courseGeneration } from '../services/api'
import VideoPlayer from './VideoPlayer'
import StudentInteractionPanel from './StudentInteractionPanel'
import VideoNotesPanel from './StudyNotes/VideoNotesPanel'
import { AITutorPanel } from '@/components/AITutor'
import InteractiveMindMap from './ui/InteractiveMindMap'
import CodePlayground from './ui/CodePlayground'

export default function CourseLearningPage({ user }) {
  const { courseId } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [videoList, setVideoList] = useState([])
  const [currentVideo, setCurrentVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // 视频笔记状态
  const [videoNotes, setVideoNotes] = useState([])
  const [currentTimestamp, setCurrentTimestamp] = useState(0)
  const [showNotesPanel, setShowNotesPanel] = useState(true)
  const videoPlayerRef = useRef(null)
  
  // 讲义内容状态
  const [teachingContents, setTeachingContents] = useState([])
  const [currentContent, setCurrentContent] = useState(null)
  const [activeTab, setActiveTab] = useState('video') // 'video' | 'content'
  const [contentSearchQuery, setContentSearchQuery] = useState('')
  const [contentNotes, setContentNotes] = useState({})
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [currentNoteContent, setCurrentNoteContent] = useState('')
  const [newContentBadge, setNewContentBadge] = useState(false)
  const [videoContent, setVideoContent] = useState(null)

  const [showAiSidebar, setShowAiSidebar] = useState(false)
  const [aiMessages, setAiMessages] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiMessagesEndRef = useRef(null)

  const [courseResources, setCourseResources] = useState(null)
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [activeResourceModal, setActiveResourceModal] = useState(null)
  const [selectedResourceItem, setSelectedResourceItem] = useState(null)

  const [mindmapExpanded, setMindmapExpanded] = useState(false)
  const [mindmapData, setMindmapData] = useState(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadCourseData = async () => {
      console.log('[CourseLearningPage] 开始加载，courseId:', courseId)

      try {
        setLoading(true)
        setError(null)

        // 获取课程信息
        const courseRes = await courses.getAll()
        console.log('[CourseLearningPage] 课程列表:', courseRes)

        const courseData = courseRes.courses?.find(c => c.id === parseInt(courseId))

        if (!courseData) {
          if (mounted) {
            setError('课程不存在')
            setLoading(false)
          }
          return
        }

        if (mounted) {
          setCourse(courseData)
        }

        // 获取视频列表
        try {
          const videosRes = await videos.getByCourse(courseId)
          console.log('[CourseLearningPage] 视频列表:', videosRes)

          if (mounted && videosRes.videos?.length > 0) {
            setVideoList(videosRes.videos)
            setCurrentVideo(videosRes.videos[0])
          }
        } catch (e) {
          console.warn('[CourseLearningPage] 获取视频失败:', e.message)
        }

        // 获取讲义内容
        try {
          const contentRes = await courses.getContent(courseId)
          console.log('[CourseLearningPage] 讲义内容:', contentRes)

          if (mounted && contentRes.contents?.length > 0) {
            setTeachingContents(contentRes.contents)
            // 检查是否有新生成的内容（最近24小时内）
            const recentContent = contentRes.contents.find(c => {
              const createdAt = new Date(c.created_at)
              const now = new Date()
              const hoursDiff = (now - createdAt) / (1000 * 60 * 60)
              return hoursDiff < 24
            })
            if (recentContent) {
              setNewContentBadge(true)
            }
          }
        } catch (e) {
          console.warn('[CourseLearningPage] 获取讲义失败:', e.message)
        }

        if (mounted) {
          setLoading(false)
        }
      } catch (err) {
        console.error('[CourseLearningPage] 加载失败:', err)
        if (mounted) {
          setError(err.message || '加载失败')
          setLoading(false)
        }
      }
    }

    if (courseId) {
      loadCourseData()
    }

    return () => {
      mounted = false
    }
  }, [courseId])

  // 当切换视频时，加载该视频关联的讲义
  useEffect(() => {
    const loadVideoContent = async () => {
      if (!currentVideo?.id) {
        setVideoContent(null)
        return
      }
      
      try {
        const res = await videos.getContent(currentVideo.id)
        if (res.contents && res.contents.length > 0) {
          setVideoContent(res.contents[0])
        } else {
          setVideoContent(null)
        }
      } catch (e) {
        console.warn('[CourseLearningPage] 获取视频讲义失败:', e.message)
        setVideoContent(null)
      }
    }
    
    loadVideoContent()
  }, [currentVideo?.id])

  // 加载当前视频的笔记
  const loadVideoNotes = useCallback(async () => {
    if (!currentVideo?.id) {
      setVideoNotes([])
      return
    }
    
    try {
      const response = await notes.getNotes({
        video_id: currentVideo.id,
        per_page: 100
      })
      setVideoNotes(response.notes || [])
    } catch (e) {
      console.warn('[CourseLearningPage] 获取视频笔记失败:', e.message)
      setVideoNotes([])
    }
  }, [currentVideo?.id])

  useEffect(() => {
    loadVideoNotes()
  }, [loadVideoNotes])

  useEffect(() => {
    if (!courseId) return
    const loadResources = async () => {
      setResourcesLoading(true)
      try {
        const res = await courseGeneration.getCourseResources(courseId)
        setCourseResources(res)
      } catch (e) {
        console.warn('加载课程资源失败:', e.message)
        setCourseResources(null)
      } finally {
        setResourcesLoading(false)
      }
    }
    loadResources()
  }, [courseId])

  useEffect(() => {
    if (!currentVideo || !mindmapExpanded) return
    setMindmapLoading(true)
    try {
      if (courseResources?.resources?.mindmap?.items) {
        const items = courseResources.resources.mindmap.items
        const matched = items.find(item => {
          if (currentVideo.chapter_id && item.chapter_id === currentVideo.chapter_id) return true
          const videoTitle = (currentVideo.title || '').toLowerCase()
          const chapterTitle = (item.chapter_title || '').toLowerCase()
          return videoTitle.includes(chapterTitle) || chapterTitle.includes(videoTitle)
        })
        if (matched?.data) {
          let mindmapRoot = matched.data
          if (mindmapRoot.root) {
            setMindmapData({ data: mindmapRoot })
          } else if (mindmapRoot.mindmap?.root) {
            setMindmapData({ data: mindmapRoot.mindmap })
          } else {
            setMindmapData(matched)
          }
        } else if (items.length > 0) {
          const first = items[0]
          if (first?.data) {
            let mindmapRoot = first.data
            if (mindmapRoot.root) {
              setMindmapData({ data: mindmapRoot })
            } else if (mindmapRoot.mindmap?.root) {
              setMindmapData({ data: mindmapRoot.mindmap })
            } else {
              setMindmapData(first)
            }
          } else {
            setMindmapData(first)
          }
        } else {
          setMindmapData(null)
        }
      } else {
        setMindmapData(null)
      }
    } catch (e) {
      console.warn('加载思维导图数据失败:', e.message)
      setMindmapData(null)
    } finally {
      setMindmapLoading(false)
    }
  }, [currentVideo, mindmapExpanded, courseResources])

  // 处理视频时间更新
  const handleTimeUpdate = useCallback((time) => {
    setCurrentTimestamp(time)
  }, [])

  // 处理跳转到视频指定时间
  const handleSeekToTime = useCallback((time) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(time)
    }
  }, [])

  // 获取笔记标记点
  const noteMarkers = videoNotes
    .filter(note => note.video_timestamp !== null && note.video_timestamp !== undefined)
    .map(note => ({
      timestamp: note.video_timestamp,
      title: note.title,
      id: note.id
    }))

  const handleAiSend = useCallback(async () => {
    if (!aiInput.trim() || aiLoading) return
    const question = aiInput.trim()
    setAiInput('')
    setAiMessages(prev => [...prev, { role: 'user', content: question }])
    setAiLoading(true)

    try {
      const result = await ai.videoAssistantChat({
        question,
        video_id: currentVideo?.id,
        course_id: parseInt(courseId),
        video_timestamp: currentTimestamp,
      })
      setAiMessages(prev => [...prev, { role: 'assistant', content: result.answer }])
    } catch (err) {
      console.error('AI assistant error:', err)
      setAiMessages(prev => [...prev, { role: 'assistant', content: '抱歉，AI助手暂时无法回答，请稍后再试。' }])
    } finally {
      setAiLoading(false)
    }
  }, [aiInput, aiLoading, currentVideo?.id, courseId, currentTimestamp])

  useEffect(() => {
    if (aiMessagesEndRef.current) {
      aiMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [aiMessages])

  // 加载状态
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 16px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#374151', fontSize: '16px' }}>正在加载课程...</p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '32px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ color: '#ef4444', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>加载失败</p>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      </div>
    )
  }

  // 课程不存在
  if (!course) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6'
      }}>
        <p style={{ color: '#6b7280' }}>课程不存在</p>
      </div>
    )
  }

  // 主页面渲染
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
      `}</style>

      {/* 顶部导航栏 */}
      <div style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            backgroundColor: '#f3f4f6',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#374151',
            fontSize: '14px'
          }}
        >
          ← 返回
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '12px 0 4px 0', color: '#111827' }}>
          {course.title}
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>教师：{course.teacher_name || '未知'}</p>
      </div>

      {/* 主内容区 */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {/* 标签页切换 */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '24px',
          backgroundColor: '#fff',
          padding: '8px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={() => setActiveTab('video')}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: activeTab === 'video' ? '#3b82f6' : 'transparent',
              color: activeTab === 'video' ? '#fff' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            📹 视频学习
          </button>
          <button
            onClick={() => setActiveTab('content')}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: activeTab === 'content' ? '#3b82f6' : 'transparent',
              color: activeTab === 'content' ? '#fff' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 500,
              transition: 'all 0.2s',
              position: 'relative'
            }}
          >
            📚 课程讲义
            {newContentBadge && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '8px',
                height: '8px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }} />
            )}
            {teachingContents.length > 0 && (
              <span style={{
                marginLeft: '8px',
                padding: '2px 8px',
                backgroundColor: activeTab === 'content' ? 'rgba(255,255,255,0.3)' : '#dbeafe',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                {teachingContents.length}
              </span>
            )}
          </button>
        </div>

        {/* 根据标签页显示不同内容 */}
        {activeTab === 'video' ? (
          <div style={{ display: 'flex', gap: '24px', position: 'relative' }}>
            {/* 左侧：视频区域 */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 视频播放器 */}
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px' }}>
              {currentVideo ? (
                <div>
                  <VideoPlayer
                    ref={videoPlayerRef}
                    videoUrl={currentVideo.video_url}
                    title={currentVideo.title}
                    onTimeUpdate={handleTimeUpdate}
                    noteMarkers={noteMarkers}
                    onSeekToNote={handleSeekToTime}
                  />
                  <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: '16px', marginBottom: '8px' }}>
                    {currentVideo.title}
                  </h2>
                  {currentVideo.description && (
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>{currentVideo.description}</p>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '48px',
                  textAlign: 'center',
                  color: '#9ca3af'
                }}>
                  暂无视频内容
                </div>
              )}
            </div>

            {/* 视频关联讲义 */}
            {videoContent && (
              <div style={{ 
                backgroundColor: '#fffbeb', 
                padding: '20px', 
                borderRadius: '8px',
                border: '2px solid #fbbf24'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '12px' 
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#92400e', margin: 0 }}>
                    📖 本节讲义
                  </h3>
                  {videoContent.generated_by_llm && (
                    <span style={{ 
                      padding: '2px 8px', 
                      backgroundColor: '#fef3c7', 
                      color: '#92400e',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      🤖 AI生成
                    </span>
                  )}
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  lineHeight: '1.8', 
                  color: '#78350f',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap'
                }}>
                  {videoContent.content}
                </div>
              </div>
            )}

            {currentVideo && (
              <div style={{
                backgroundColor: '#fff',
                padding: '20px',
                borderRadius: '8px',
                border: '2px solid #8b5cf6',
                overflow: 'hidden'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#6d28d9', margin: 0 }}>
                      🧠 知识点思维导图
                    </h3>
                    {course && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: '#f5f3ff',
                        color: '#7c3aed',
                        border: '1px solid #ddd6fe',
                        fontWeight: 500,
                      }}>
                        {course.title}
                      </span>
                    )}
                    {currentVideo && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        fontWeight: 500,
                      }}>
                        {currentVideo.title}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setMindmapExpanded(!mindmapExpanded)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: mindmapExpanded ? '#f5f3ff' : '#8b5cf6',
                      color: mindmapExpanded ? '#6d28d9' : '#fff',
                      border: '1px solid #8b5cf6',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {mindmapExpanded ? '折叠' : '展开'}
                  </button>
                </div>
                <div style={{
                  maxHeight: mindmapExpanded ? '400px' : '0',
                  opacity: mindmapExpanded ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease',
                  marginTop: mindmapExpanded ? '16px' : '0'
                }}>
                  {mindmapLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
                      加载中...
                    </div>
                  ) : mindmapData?.data ? (
                    <div style={{ height: '350px' }}>
                      <InteractiveMindMap data={mindmapData.data} height={350} />
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
                      暂无思维导图数据，请教师在内容生成中创建
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 课程目录 */}
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>课程目录</h3>
              {videoList.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>暂无视频</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {videoList.map((video, index) => (
                    <button
                      key={video.id}
                      onClick={() => setCurrentVideo(video)}
                      style={{
                        padding: '12px',
                        textAlign: 'left',
                        backgroundColor: currentVideo?.id === video.id ? '#eff6ff' : '#f9fafb',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                        {index + 1}. {video.title}
                      </p>
                      {video.duration && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                          {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：互动面板和笔记面板 */}
          <div style={{
            width: '400px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            height: 'fit-content',
            maxHeight: 'calc(100vh - 200px)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* AI助教切换按钮 */}
            <button
              onClick={() => setShowAiSidebar(!showAiSidebar)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 10,
                padding: '6px 12px',
                backgroundColor: showAiSidebar ? '#6366f1' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
              }}
            >
              🎓 {showAiSidebar ? '学习工具' : 'AI助教'}
            </button>

            {showAiSidebar ? (
              /* AI助教面板 */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 200px)',
                maxHeight: '800px',
              }}>
                <AITutorPanel
                  courseId={parseInt(courseId)}
                  videoId={currentVideo?.id}
                  className="h-full"
                />
              </div>
            ) : (
              <>
                {/* 视频笔记面板 */}
                {currentVideo && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    <VideoNotesPanel
                      courseId={parseInt(courseId)}
                      courseTitle={course?.title}
                      videoId={currentVideo?.id}
                      videoTitle={currentVideo?.title}
                      currentTimestamp={currentTimestamp}
                      onSeekTo={handleSeekToTime}
                      isExpanded={showNotesPanel}
                      onToggleExpand={() => setShowNotesPanel(!showNotesPanel)}
                    />
                  </div>
                )}
                
                {/* 课堂互动 */}
                <div style={{
                  padding: '24px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  flex: 1,
                  overflowY: 'auto'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    课堂互动
                  </h3>
                  <StudentInteractionPanel
                    courseId={parseInt(courseId)}
                    videoId={currentVideo?.id}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        ) : (
          /* 讲义内容标签页 */
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
            {/* 左侧：讲义目录 */}
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '20px', 
              borderRadius: '8px',
              height: 'fit-content',
              position: 'sticky',
              top: '24px'
            }}>
              {/* 学习资源区域 */}
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🎯 学习资源
                </h3>
                {resourcesLoading ? (
                  <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '12px' }}>加载中...</div>
                ) : courseResources?.resources ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { key: 'document', icon: '📄', label: '讲解文档' },
                      { key: 'mindmap', icon: '🧠', label: '思维导图' },
                      { key: 'recommendation', icon: '📚', label: '拓展阅读' },
                      { key: 'project', icon: '💻', label: '代码实操' },
                    ].map(rt => {
                      const res = courseResources.resources[rt.key]
                      const available = res?.available
                      const count = res?.count || 0
                      return (
                        <button
                          key={rt.key}
                          onClick={() => {
                            if (!available) return
                            setActiveResourceModal(rt.key)
                            setSelectedResourceItem(null)
                          }}
                          style={{
                            padding: '10px 8px',
                            border: available ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
                            borderRadius: '8px',
                            backgroundColor: available ? '#fff' : '#f8fafc',
                            cursor: available ? 'pointer' : 'default',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { if (available) e.currentTarget.style.boxShadow = '0 2px 8px rgba(14,165,233,0.2)' }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
                        >
                          <div style={{ fontSize: '20px', marginBottom: '4px' }}>{rt.icon}</div>
                          <div style={{ fontSize: '11px', fontWeight: 500, color: available ? '#0369a1' : '#94a3b8' }}>{rt.label}</div>
                          {available ? (
                            <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>{count}项可用</div>
                          ) : (
                            <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '2px' }}>暂无资源</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '12px' }}>暂无学习资源</div>
                )}
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
                📑 讲义目录
              </h3>
              
              {/* 搜索框 */}
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="搜索讲义..."
                  value={contentSearchQuery}
                  onChange={(e) => setContentSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* 讲义列表 */}
              {teachingContents.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '32px 16px', 
                  color: '#9ca3af',
                  fontSize: '14px'
                }}>
                  <p style={{ marginBottom: '8px' }}>📚 暂无讲义内容</p>
                  <p style={{ fontSize: '12px' }}>教师尚未发布讲义</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {teachingContents
                    .filter(content => 
                      content.title?.toLowerCase().includes(contentSearchQuery.toLowerCase()) ||
                      content.content?.toLowerCase().includes(contentSearchQuery.toLowerCase())
                    )
                    .map((content, index) => {
                      const isNew = new Date() - new Date(content.created_at) < 24 * 60 * 60 * 1000
                      return (
                        <button
                          key={content.id}
                          onClick={() => setCurrentContent(content)}
                          style={{
                            padding: '12px',
                            textAlign: 'left',
                            backgroundColor: currentContent?.id === content.id ? '#eff6ff' : '#f9fafb',
                            border: `2px solid ${currentContent?.id === content.id ? '#3b82f6' : 'transparent'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
                              {index + 1}. {content.title}
                            </span>
                            {isNew && (
                              <span style={{
                                padding: '2px 6px',
                                backgroundColor: '#ef4444',
                                color: '#fff',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600
                              }}>
                                NEW
                              </span>
                            )}
                          </div>
                          <p style={{ 
                            margin: '4px 0 0 0', 
                            fontSize: '12px', 
                            color: '#9ca3af' 
                          }}>
                            {new Date(content.created_at).toLocaleDateString('zh-CN')}
                          </p>
                        </button>
                      )
                    })}
                </div>
              )}
            </div>

            {/* 右侧：讲义内容展示 */}
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '32px', 
              borderRadius: '8px',
              minHeight: '600px'
            }}>
              {currentContent ? (
                <div>
                  {/* 讲义标题 */}
                  <div style={{ 
                    borderBottom: '2px solid #e5e7eb', 
                    paddingBottom: '16px',
                    marginBottom: '24px'
                  }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                      {currentContent.title}
                    </h2>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                      <span>📅 {new Date(currentContent.created_at).toLocaleString('zh-CN')}</span>
                      {currentContent.generated_by_llm && (
                        <span style={{ 
                          padding: '2px 8px', 
                          backgroundColor: '#dbeafe', 
                          color: '#1e40af',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          🤖 AI生成
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 工具栏 */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    marginBottom: '24px',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px'
                  }}>
                    <button
                      onClick={() => {
                        setCurrentNoteContent(contentNotes[currentContent.id] || '')
                        setShowNoteEditor(true)
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📝 添加笔记
                    </button>
                    <button
                      onClick={() => {
                        if (currentContent.content) {
                          navigator.clipboard.writeText(currentContent.content)
                          alert('内容已复制到剪贴板')
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📋 复制内容
                    </button>
                    <button
                      onClick={() => {
                        const printWindow = window.open('', '_blank')
                        printWindow.document.write(`
                          <html>
                            <head><title>${currentContent.title}</title></head>
                            <body style="font-family: sans-serif; padding: 40px; line-height: 1.8;">
                              <h1>${currentContent.title}</h1>
                              <div style="white-space: pre-wrap;">${currentContent.content}</div>
                            </body>
                          </html>
                        `)
                        printWindow.document.close()
                        printWindow.print()
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#8b5cf6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      🖨️ 打印讲义
                    </button>
                  </div>

                  {/* 笔记编辑器 */}
                  {showNoteEditor && (
                    <div style={{
                      marginBottom: '24px',
                      padding: '16px',
                      backgroundColor: '#fffbeb',
                      border: '2px solid #fbbf24',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>📝 我的笔记</h4>
                        <button
                          onClick={() => setShowNoteEditor(false)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '20px'
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <textarea
                        value={currentNoteContent}
                        onChange={(e) => setCurrentNoteContent(e.target.value)}
                        placeholder="在这里记录你的学习笔记..."
                        style={{
                          width: '100%',
                          minHeight: '120px',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setContentNotes(prev => ({
                              ...prev,
                              [currentContent.id]: currentNoteContent
                            }))
                            setShowNoteEditor(false)
                            alert('笔记已保存')
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#f59e0b',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          保存笔记
                        </button>
                        <button
                          onClick={() => setShowNoteEditor(false)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#9ca3af',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 已保存的笔记 */}
                  {contentNotes[currentContent.id] && !showNoteEditor && (
                    <div style={{
                      marginBottom: '24px',
                      padding: '16px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: '8px'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#166534' }}>
                        📝 我的笔记
                      </h4>
                      <p style={{ margin: 0, fontSize: '14px', color: '#15803d', whiteSpace: 'pre-wrap' }}>
                        {contentNotes[currentContent.id]}
                      </p>
                    </div>
                  )}

                  {/* 讲义正文 */}
                  <div style={{
                    fontSize: '16px',
                    lineHeight: '1.8',
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                  }}>
                    {currentContent.content}
                  </div>
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '500px',
                  color: '#9ca3af'
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>📚</div>
                  <p style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>选择一份讲义开始学习</p>
                  <p style={{ fontSize: '14px' }}>从左侧目录中选择要查看的讲义内容</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 资源弹窗 */}
      {activeResourceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => { setActiveResourceModal(null); setSelectedResourceItem(null) }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              width: activeResourceModal === 'mindmap' ? '90vw' : activeResourceModal === 'project' ? '90vw' : '700px',
              maxWidth: '1200px',
              maxHeight: '85vh',
              overflow: 'auto',
              padding: '0',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              backgroundColor: '#fff',
              zIndex: 1,
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                {{
                  document: '📄 核心概念讲解文档',
                  mindmap: '🧠 知识点思维导图',
                  recommendation: '📚 拓展阅读材料',
                  project: '💻 代码实操案例',
                }[activeResourceModal]}
              </h2>
              <button
                onClick={() => { setActiveResourceModal(null); setSelectedResourceItem(null) }}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>

            {/* 弹窗内容 */}
            <div style={{ padding: '24px' }}>
              {activeResourceModal === 'document' && courseResources?.resources?.document && (
                <div>
                  {!selectedResourceItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {courseResources.resources.document.items.map((item, idx) => (
                        <button
                          key={`doc_${item.id}_${idx}`}
                          onClick={() => setSelectedResourceItem(item)}
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                          <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{item.title}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{item.chapter_title}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => setSelectedResourceItem(null)}
                        style={{ marginBottom: '12px', padding: '4px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}
                      >
                        ← 返回列表
                      </button>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{selectedResourceItem.title}</h3>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>{selectedResourceItem.chapter_title}</p>

                      {/* 难度和重要性标签 */}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                        {selectedResourceItem.difficulty_level && (
                          <span style={{ padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '11px' }}>
                            {selectedResourceItem.difficulty_level === 'beginner' ? '入门' : selectedResourceItem.difficulty_level === 'intermediate' ? '中级' : selectedResourceItem.difficulty_level === 'advanced' ? '高级' : selectedResourceItem.difficulty_level}
                          </span>
                        )}
                        {selectedResourceItem.importance && (
                          <span style={{ padding: '2px 8px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px' }}>
                            {selectedResourceItem.importance === 'core' ? '核心' : '补充'}
                          </span>
                        )}
                      </div>

                      {/* 定义 */}
                      {selectedResourceItem.definition && (
                        <div style={{ padding: '12px 16px', backgroundColor: '#eff6ff', borderRadius: '8px', fontSize: '14px', lineHeight: '1.8', color: '#1e40af', marginBottom: '12px', borderLeft: '3px solid #3b82f6' }}>
                          <strong>定义：</strong>{selectedResourceItem.definition}
                        </div>
                      )}

                      {/* 详细内容 */}
                      {selectedResourceItem.content && (
                        <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', fontSize: '14px', lineHeight: '1.8', color: '#374151', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                          {selectedResourceItem.content}
                        </div>
                      )}

                      {/* 代码示例 */}
                      {selectedResourceItem.examples && (() => {
                        let examples = selectedResourceItem.examples
                        if (typeof examples === 'string') { try { examples = JSON.parse(examples) } catch { examples = [] } }
                        if (!Array.isArray(examples) || examples.length === 0) return null
                        return (
                          <div style={{ marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>代码示例</h4>
                            {examples.map((ex, i) => (
                              <div key={i} style={{ marginBottom: '8px' }}>
                                {ex.title && <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{ex.title}</div>}
                                <pre style={{ padding: '12px', backgroundColor: '#1e293b', color: '#e2e8f0', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', overflowX: 'auto', margin: 0 }}>
                                  <code>{ex.code || ''}</code>
                                </pre>
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                      {/* 相关概念 */}
                      {selectedResourceItem.related_concepts && (() => {
                        let concepts = selectedResourceItem.related_concepts
                        if (typeof concepts === 'string') { try { concepts = JSON.parse(concepts) } catch { concepts = [] } }
                        if (!Array.isArray(concepts) || concepts.length === 0) return null
                        return (
                          <div style={{ marginBottom: '12px' }}>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>相关概念：</span>
                            {concepts.map((c, i) => (
                              <span key={i} style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#f3f4f6', borderRadius: '4px', fontSize: '12px', color: '#4b5563', marginRight: '4px', marginBottom: '4px' }}>{c}</span>
                            ))}
                          </div>
                        )
                      })()}

                      {/* 标签 */}
                      {selectedResourceItem.tags && (() => {
                        let tags = selectedResourceItem.tags
                        if (typeof tags === 'string') { try { tags = JSON.parse(tags) } catch { tags = [] } }
                        if (!Array.isArray(tags) || tags.length === 0) return null
                        return (
                          <div>
                            {tags.map((t, i) => (
                              <span key={i} style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '4px', fontSize: '11px', marginRight: '4px', marginBottom: '4px' }}>#{t}</span>
                            ))}
                          </div>
                        )
                      })()}

                      {/* 子知识点 */}
                      {selectedResourceItem.children && selectedResourceItem.children.length > 0 && (
                        <div style={{ marginTop: '16px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>子知识点</h4>
                          {selectedResourceItem.children.map((child, i) => (
                            <div key={i} style={{ padding: '10px 12px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '6px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{child.title || child.name}</div>
                              {child.definition && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{child.definition}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeResourceModal === 'mindmap' && courseResources?.resources?.mindmap && (
                <div>
                  {!selectedResourceItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {courseResources.resources.mindmap.items.map((item, idx) => (
                        <button
                          key={`mm_${item.id}_${idx}`}
                          onClick={() => setSelectedResourceItem(item)}
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                          <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{item.title}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{item.chapter_title}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => setSelectedResourceItem(null)}
                        style={{ marginBottom: '12px', padding: '4px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}
                      >
                        ← 返回列表
                      </button>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>{selectedResourceItem.title}</h3>
                      {selectedResourceItem.data ? (
                        <InteractiveMindMap data={selectedResourceItem.data} height={500} />
                      ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>暂无思维导图数据</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeResourceModal === 'recommendation' && courseResources?.resources?.recommendation && (
                <div>
                  {courseResources.resources.recommendation.items.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {courseResources.resources.recommendation.items.map((item, idx) => {
                        const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }
                        const priorityLabels = { high: '重要', medium: '一般', low: '可选' }
                        const priority = item.priority || 'medium'
                        return (
                          <div
                            key={`rec_${item.id}_${idx}`}
                            style={{
                              padding: '16px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              backgroundColor: '#fff',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{item.title}</div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {item.priority && (
                                  <span style={{ padding: '2px 8px', backgroundColor: priorityColors[priority] + '18', color: priorityColors[priority], borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                    {priorityLabels[priority] || priority}
                                  </span>
                                )}
                                {(item.case_type || item.category) && (
                                  <span style={{ padding: '2px 8px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px' }}>
                                    {item.category || item.case_type}
                                  </span>
                                )}
                              </div>
                            </div>
                            {item.background && (
                              <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.6', marginBottom: '8px' }}>
                                {item.background.length > 200 ? item.background.slice(0, 200) + '...' : item.background}
                              </div>
                            )}
                            {item.key_points && item.key_points.length > 0 && (
                              <div style={{ marginBottom: '8px' }}>
                                {item.key_points.slice(0, 4).map((kp, i) => (
                                  <div key={i} style={{ fontSize: '12px', color: '#374151', paddingLeft: '12px', position: 'relative', lineHeight: '1.8' }}>
                                    <span style={{ position: 'absolute', left: 0, color: '#6366f1' }}>•</span>
                                    {typeof kp === 'string' ? kp : kp.title || kp.content || JSON.stringify(kp)}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9ca3af', flexWrap: 'wrap' }}>
                              {item.chapter_title && <span>📖 {item.chapter_title}</span>}
                              {item.author && <span>✍️ {item.author}</span>}
                              {item.difficulty && <span>📊 {item.difficulty}</span>}
                              {item.source_url && (
                                <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                                  🔗 查看资源
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>暂无拓展阅读资源</div>
                  )}
                </div>
              )}

              {activeResourceModal === 'project' && courseResources?.resources?.project && (
                <div>
                  {!selectedResourceItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {courseResources.resources.project.items.map((item, idx) => (
                        <button
                          key={`proj_${item.id}_${idx}`}
                          onClick={() => setSelectedResourceItem(item)}
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{item.title}</div>
                            <span style={{ padding: '2px 8px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '11px' }}>
                              {item.language || 'Python'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{item.chapter_title}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => setSelectedResourceItem(null)}
                        style={{ marginBottom: '12px', padding: '4px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}
                      >
                        ← 返回列表
                      </button>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{selectedResourceItem.title}</h3>
                      {selectedResourceItem.content && (
                        <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', color: '#374151', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                          {selectedResourceItem.content}
                        </div>
                      )}
                      <CodePlayground
                        initialCode={selectedResourceItem.code_template || `# ${selectedResourceItem.title}\n# 请根据题目要求编写代码\n`}
                        language={selectedResourceItem.language || 'python'}
                        height="400px"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
