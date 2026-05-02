import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { courses, videos, notes, ai } from '../services/api'
import VideoPlayer from './VideoPlayer'
import StudentInteractionPanel from './StudentInteractionPanel'
import VideoNotesPanel from './StudyNotes/VideoNotesPanel'

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
            {/* AI助手切换按钮 */}
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
              🤖 {showAiSidebar ? '学习工具' : 'AI助手'}
            </button>

            {showAiSidebar ? (
              /* AI学习助手面板 */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 200px)',
                maxHeight: '800px',
              }}>
                <div style={{
                  padding: '16px 16px 12px',
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f8fafc',
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🤖 AI学习助手
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                    基于当前视频内容为你答疑解惑
                  </p>
                </div>

                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  {aiMessages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>🤖</div>
                      <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>AI学习助手</p>
                      <p style={{ fontSize: '12px' }}>观看视频时遇到问题？随时向我提问</p>
                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[
                          '解释一下当前视频的核心概念',
                          '这个知识点有什么应用场景？',
                          '帮我总结视频中的重点内容',
                        ].map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => { setAiInput(suggestion) }}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: '#475569',
                              textAlign: 'left',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = '#e2e8f0' }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = '#f1f5f9' }}
                          >
                            💡 {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiMessages.map((msg, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '85%',
                        padding: '10px 14px',
                        borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        backgroundColor: msg.role === 'user' ? '#3b82f6' : '#f1f5f9',
                        color: msg.role === 'user' ? '#fff' : '#1e293b',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '12px 12px 12px 4px',
                        backgroundColor: '#f1f5f9',
                        color: '#64748b',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          backgroundColor: '#94a3b8',
                          borderRadius: '50%',
                          animation: 'blink 1.4s infinite both',
                        }} />
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          backgroundColor: '#94a3b8',
                          borderRadius: '50%',
                          animation: 'blink 1.4s infinite both 0.2s',
                        }} />
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          backgroundColor: '#94a3b8',
                          borderRadius: '50%',
                          animation: 'blink 1.4s infinite both 0.4s',
                        }} />
                        思考中...
                      </div>
                    </div>
                  )}
                  <div ref={aiMessagesEndRef} />
                </div>

                <div style={{
                  padding: '12px 16px',
                  borderTop: '1px solid #e5e7eb',
                  backgroundColor: '#fff',
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSend() } }}
                      placeholder="输入你的问题..."
                      disabled={aiLoading}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: aiLoading ? '#f8fafc' : '#fff',
                      }}
                    />
                    <button
                      onClick={handleAiSend}
                      disabled={aiLoading || !aiInput.trim()}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: (!aiLoading && aiInput.trim()) ? '#3b82f6' : '#94a3b8',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (!aiLoading && aiInput.trim()) ? 'pointer' : 'not-allowed',
                        fontSize: '13px',
                        fontWeight: 500,
                        transition: 'background-color 0.2s',
                      }}
                    >
                      发送
                    </button>
                  </div>
                  {currentVideo && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 0', textAlign: 'center' }}>
                      📹 当前视频：{currentVideo.title}
                    </p>
                  )}
                </div>
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
    </div>
  )
}
