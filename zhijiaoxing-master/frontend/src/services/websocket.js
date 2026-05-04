/**
 * WebSocket 实时通信服务
 * 
 * 基于 Socket.IO 客户端实现师生实时互动
 * 支持举手、问答、讨论的实时推送
 */

import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'

class WebSocketService {
  constructor() {
    this.socket = null
    this.connected = false
    this.listeners = {}
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect() {
    if (this.socket && this.connected) {
      console.log('WebSocket already connected')
      return
    }

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts,
        withCredentials: true
      })

      this.socket.on('connect', () => {
        console.log('WebSocket connected')
        this.connected = true
        this.reconnectAttempts = 0
        this.emit('connect')
      })

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        this.connected = false
        this.emit('disconnect', reason)
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        this.emit('error', error)
      })

      // 加入课程房间的确认
      this.socket.on('joined_course', (data) => {
        console.log('Joined course room:', data)
        this.emit('joined_course', data)
      })

      // 举手更新事件
      this.socket.on('hand_raise_updated', (data) => {
        console.log('Hand raise updated:', data)
        this.emit('hand_raise_updated', data)
      })

      // 问答更新事件
      this.socket.on('question_updated', (data) => {
        console.log('Question updated:', data)
        this.emit('question_updated', data)
      })

      // 讨论更新事件
      this.socket.on('discussion_updated', (data) => {
        console.log('Discussion updated:', data)
        this.emit('discussion_updated', data)
      })

      // 错误事件
      this.socket.on('error', (data) => {
        console.error('WebSocket error:', data)
        this.emit('error', data)
      })

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.emit('error', error)
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      console.log('WebSocket disconnected')
    }
  }

  /**
   * 加入课程房间
   */
  joinCourse(courseId) {
    if (!this.socket || !this.connected) {
      if (this.socket) {
        this.socket.once('connect', () => {
          this.socket.emit('join_course', { course_id: courseId })
        })
      }
      return
    }

    this.socket.emit('join_course', { course_id: courseId })
  }

  /**
   * 离开课程房间
   */
  leaveCourse(courseId) {
    if (!this.socket) {
      return
    }

    console.log('Leaving course room:', courseId)
    this.socket.emit('leave_course', { course_id: courseId })
  }

  /**
   * 发送举手事件
   */
  sendHandRaiseEvent(courseId) {
    if (!this.socket || !this.connected) {
      console.error('WebSocket not connected')
      return
    }

    this.socket.emit('hand_raise_event', { course_id: courseId })
  }

  /**
   * 发送问答事件
   */
  sendQuestionEvent(courseId, questionId, eventType = 'created') {
    if (!this.socket || !this.connected) {
      console.error('WebSocket not connected')
      return
    }

    this.socket.emit('question_event', {
      course_id: courseId,
      question_id: questionId,
      event_type: eventType
    })
  }

  /**
   * 发送讨论事件
   */
  sendDiscussionEvent(courseId, discussionId, eventType = 'created') {
    if (!this.socket || !this.connected) {
      console.error('WebSocket not connected')
      return
    }

    this.socket.emit('discussion_event', {
      course_id: courseId,
      discussion_id: discussionId,
      event_type: eventType
    })
  }

  /**
   * 注册事件监听器
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (!this.listeners[event]) {
      return
    }

    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    } else {
      delete this.listeners[event]
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (!this.listeners[event]) {
      return
    }

    this.listeners[event].forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in WebSocket listener for ${event}:`, error)
      }
    })
  }

  /**
   * 获取连接状态
   */
  isConnected() {
    return this.connected && this.socket !== null
  }
}

// 创建单例实例
const websocketService = new WebSocketService()

export default websocketService
