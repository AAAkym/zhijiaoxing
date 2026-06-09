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
    this.connectionAttempted = false
  }

  connect() {
    if (this.socket && this.connected) {
      return
    }
    if (this.connectionAttempted && this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }

    this.connectionAttempted = true

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelayMax: 10000,
        timeout: 10000,
        withCredentials: true,
      })

      this.socket.on('connect', () => {
        this.connected = true
        this.reconnectAttempts = 0
        this.emit('connect')
      })

      this.socket.on('disconnect', (reason) => {
        this.connected = false
        this.emit('disconnect', reason)
      })

      this.socket.on('connect_error', (error) => {
        this.reconnectAttempts++
        if (this.reconnectAttempts <= 2) {
          console.warn(`WebSocket connection attempt ${this.reconnectAttempts} failed, will retry...`)
        }
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.warn('WebSocket max reconnection attempts reached, giving up')
          this.emit('connection_failed', { reason: 'max_retries_exceeded' })
        }
        this.emit('error', error)
      })

      this.socket.on('reconnect_failed', () => {
        this.emit('connection_failed', { reason: 'reconnect_failed' })
      })

      this.socket.on('joined_course', (data) => {
        this.emit('joined_course', data)
      })

      this.socket.on('hand_raise_updated', (data) => {
        this.emit('hand_raise_updated', data)
      })

      this.socket.on('question_updated', (data) => {
        this.emit('question_updated', data)
      })

      this.socket.on('discussion_updated', (data) => {
        this.emit('discussion_updated', data)
      })

      this.socket.on('error', (data) => {
        this.emit('error', data)
      })

    } catch (error) {
      console.warn('Failed to create WebSocket connection:', error.message)
      this.emit('error', error)
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      this.connectionAttempted = false
      this.reconnectAttempts = 0
    }
  }

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

  leaveCourse(courseId) {
    if (!this.socket) return
    this.socket.emit('leave_course', { course_id: courseId })
  }

  sendHandRaiseEvent(courseId) {
    if (!this.socket || !this.connected) return
    this.socket.emit('hand_raise_event', { course_id: courseId })
  }

  sendQuestionEvent(courseId, questionId, eventType = 'created') {
    if (!this.socket || !this.connected) return
    this.socket.emit('question_event', { course_id: courseId, question_id: questionId, event_type: eventType })
  }

  sendDiscussionEvent(courseId, discussionId, eventType = 'created') {
    if (!this.socket || !this.connected) return
    this.socket.emit('discussion_event', { course_id: courseId, discussion_id: discussionId, event_type: eventType })
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  off(event, callback) {
    if (!this.listeners[event]) return
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    } else {
      delete this.listeners[event]
    }
  }

  emit(event, data) {
    if (!this.listeners[event]) return
    this.listeners[event].forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.warn(`WebSocket listener error for ${event}:`, error.message)
      }
    })
  }

  isConnected() {
    return this.connected && this.socket !== null
  }
}

const websocketService = new WebSocketService()
export default websocketService
