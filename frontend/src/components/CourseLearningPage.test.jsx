import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertCircle, RefreshCw, ChevronLeft } from 'lucide-react'
import { courses } from '../services/api'

export default function TestCourseLearningPage({ user }) {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  console.log('[Test] 组件初始化')
  console.log('[Test] courseId:', courseId)
  console.log('[Test] user:', user)

  useEffect(() => {
    console.log('[Test] 开始加载课程数据')
    const loadCourse = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const courseRes = await courses.getAll()
        console.log('[Test] 课程列表响应:', courseRes)
        
        const courseData = courseRes.courses?.find(c => c.id === parseInt(courseId))
        console.log('[Test] 找到的课程:', courseData)
        
        if (!courseData) {
          setError('课程不存在')
        } else {
          setCourse(courseData)
        }
      } catch (err) {
        console.error('[Test] 加载失败:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (courseId) {
      loadCourse()
    }
  }, [courseId])

  if (loading) {
    console.log('[Test] 显示加载中')
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280' }}>正在加载...</p>
        </div>
      </div>
    )
  }

  if (error) {
    console.log('[Test] 显示错误:', error)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <AlertCircle style={{ width: '48px', height: '48px', margin: '0 auto 16px', color: '#ef4444' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>加载失败</h2>
          <p style={{ color: '#4b5563', marginBottom: '16px' }}>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <p style={{ color: '#6b7280' }}>课程不存在</p>
      </div>
    )
  }

  console.log('[Test] 渲染成功，课程:', course.title)
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer'
          }}
        >
          <ChevronLeft style={{ width: '16px', height: '16px' }} />
          返回
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '12px' }}>{course.title}</h1>
        <p style={{ color: '#6b7280', marginTop: '4px' }}>教师：{course.teacher_name}</p>
      </div>
      
      <div style={{ maxWidth: '800px', margin: '24px auto', padding: '24px', backgroundColor: '#fff', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px' }}>课程信息</h2>
        <p style={{ color: '#4b5563' }}>课程 ID: {course.id}</p>
        <p style={{ color: '#4b5563' }}>课程名称：{course.title}</p>
        <p style={{ color: '#4b5563' }}>教师：{course.teacher_name}</p>
        <p style={{ color: '#4b5563', marginTop: '16px' }}>
          <strong style={{ color: '#10b981' }}>✓ 页面加载成功！</strong>
        </p>
      </div>
    </div>
  )
}
