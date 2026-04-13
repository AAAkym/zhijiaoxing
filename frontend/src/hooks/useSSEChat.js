import { useState, useCallback, useRef, useEffect } from 'react'
import { conversation } from '../services/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
const STORAGE_KEY_PREFIX = 'chat_conversation_'

const SSEConnectionState = {
  IDLE: 'idle',           // 空闲状态，未建立连接
  CONNECTING: 'connecting',
  OPEN: 'open',
  CLOSED: 'closed',
  ERROR: 'error'
}

const NetworkState = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown'
}

const SSEEventType = {
  CONFIG: 'config',
  START: 'start',
  MESSAGE: 'message',
  COMPLETE: 'complete',
  DONE: 'done',
  ERROR: 'error',
  PING: 'ping'
}

export function useSSEChat(options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    connectionTimeout = 30000, // 30秒连接超时
    onMessage,
    onError,
    onComplete,
    onStart
  } = options

  const [connectionState, setConnectionState] = useState(SSEConnectionState.IDLE)
  const [networkState, setNetworkState] = useState(() => {
    // 初始化时检测网络状态
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine ? NetworkState.ONLINE : NetworkState.OFFLINE
    }
    return NetworkState.UNKNOWN
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedContent, setStreamedContent] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [error, setError] = useState(null)
  const [thinkingMessage, setThinkingMessage] = useState('')
  const [lastEventId, setLastEventId] = useState(null)

  const abortControllerRef = useRef(null)
  const retryCountRef = useRef(0)
  const readerRef = useRef(null)
  const isStreamingRef = useRef(false)
  // 使用 ref 保存最终的流式内容，避免闭包问题
  const finalStreamedContentRef = useRef('')

  // 更新 ref
  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      console.log('网络已连接')
      setNetworkState(NetworkState.ONLINE)
    }

    const handleOffline = () => {
      console.log('网络已断开')
      setNetworkState(NetworkState.OFFLINE)
      // 网络断开时停止流式传输
      if (isStreamingRef.current) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        if (readerRef.current) {
          readerRef.current.cancel()
        }
        setIsStreaming(false)
        setConnectionState(SSEConnectionState.ERROR)
        setError('网络连接已断开')
        setThinkingMessage('')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 检测网络可用性
  const checkNetworkAvailability = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine
    }
    // 如果无法检测，假设网络可用
    return true
  }, [])

  const parseSSEMessage = (rawMessage) => {
    const lines = rawMessage.split('\n')
    const event = {
      id: null,
      event: null,
      data: null,
      retry: null
    }

    for (const line of lines) {
      if (line.startsWith('id:')) {
        event.id = line.substring(3).trim()
      } else if (line.startsWith('event:')) {
        event.event = line.substring(6).trim()
      } else if (line.startsWith('data:')) {
        const dataStr = line.substring(5).trim()
        try {
          // JSON解析会自动处理UTF-8编码的字符串
          event.data = JSON.parse(dataStr)
        } catch (parseError) {
          // 如果JSON解析失败，保留原始字符串
          // 这可能是纯文本内容，直接使用
          event.data = dataStr
        }
      } else if (line.startsWith('retry:')) {
        event.retry = parseInt(line.substring(6).trim(), 10)
      }
    }

    return event
  }

  const handleSSEEvent = useCallback((event) => {
    if (event.id) {
      setLastEventId(event.id)
    }

    switch (event.event) {
      case SSEEventType.START:
        setThinkingMessage('')
        if (event.data?.type === 'start') {
          onStart?.(event.data)
        }
        break

      case SSEEventType.MESSAGE:
        if (event.data) {
          const data = event.data
          
          if (data.type === 'thinking') {
            setThinkingMessage(data.message || '')
          } else if (data.type === 'content') {
            setThinkingMessage('')
            setStreamedContent(prev => {
              const newContent = prev + (data.content || '')
              // 同步更新 ref，确保回调可以访问最新内容
              finalStreamedContentRef.current = newContent
              return newContent
            })
          } else if (data.type === 'conversation') {
            setConversationId(data.conversation_id)
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`${STORAGE_KEY_PREFIX}current`, data.conversation_id)
            }
          } else if (data.type === 'complete') {
            // 使用 ref 中的内容，避免闭包问题
            onComplete?.({ ...data, finalContent: finalStreamedContentRef.current })
          } else {
            onMessage?.(data)
          }
        }
        break

      case SSEEventType.COMPLETE:
        setIsStreaming(false)
        setThinkingMessage('')
        onComplete?.({ ...event.data, finalContent: finalStreamedContentRef.current })
        break

      case SSEEventType.DONE:
        setIsStreaming(false)
        setThinkingMessage('')
        if (finalStreamedContentRef.current) {
          onComplete?.({ finalContent: finalStreamedContentRef.current })
        }
        break

      case SSEEventType.ERROR:
        setIsStreaming(false)
        setError(event.data?.error || 'Unknown error')
        onError?.(event.data?.error || 'Unknown error')
        break

      case SSEEventType.PING:
        break

      default:
        if (event.data && typeof event.data === 'object') {
          onMessage?.(event.data)
        }
    }
  }, [onMessage, onError, onComplete, onStart])

  const processStreamRef = useRef(null)

  processStreamRef.current = async (reader) => {
    // 明确指定UTF-8编码，添加错误处理
    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          if (buffer.trim()) {
            const event = parseSSEMessage(buffer)
            handleSSEEvent(event)
          }
          break
        }

        // 使用UTF-8解码，stream: true表示这是流式数据的一部分
        try {
          buffer += decoder.decode(value, { stream: true })
        } catch (decodeError) {
          console.error('解码错误:', decodeError)
          // 尝试使用备用解码方式
          try {
            buffer += new TextDecoder('utf-8').decode(value)
          } catch (fallbackError) {
            console.error('备用解码失败:', fallbackError)
            continue
          }
        }
        
        // SSE消息以双换行符分隔
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || ''

        for (const message of messages) {
          if (message.trim()) {
            try {
              const event = parseSSEMessage(message)
              handleSSEEvent(event)
            } catch (parseError) {
              console.error('SSE消息解析错误:', parseError, message)
            }
          }
        }
      }
    } catch (error) {
      console.error('流处理错误:', error)
      throw error
    }
  }

  const sendMessage = useCallback(async (params) => {
    const {
      question,
      conversationId: existingConversationId,
      context = '',
      topic = '',
      temperature = 0.7,
      maxContextLength = 10
    } = params

    if (!question) {
      setError('问题不能为空')
      return
    }

    // 检查网络连接
    if (!checkNetworkAvailability()) {
      setError('网络未连接，请检查网络设置')
      setConnectionState(SSEConnectionState.ERROR)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    
    // 创建超时控制器
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        setError('连接超时，请检查网络后重试')
        setConnectionState(SSEConnectionState.ERROR)
        setIsStreaming(false)
      }
    }, connectionTimeout)
    
    setConnectionState(SSEConnectionState.CONNECTING)
    setIsStreaming(true)
    setError(null)
    setStreamedContent('')
    // 重置 ref，准备接收新的流式内容
    finalStreamedContentRef.current = ''
    setThinkingMessage('正在连接...')

    const requestBody = {
      question,
      conversation_id: existingConversationId || conversationId,
      context,
      topic,
      temperature,
      max_context_length: maxContextLength
    }

    const headers = {
      'Content-Type': 'application/json'
    }

    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId
    }

    try {
      const response = await fetch(`${API_BASE_URL}/sse/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        credentials: 'include',
        signal: abortControllerRef.current.signal
      })

      // 清除超时定时器
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorMsg = response.status === 503 
          ? '服务暂时不可用，请稍后重试' 
          : `请求失败 (${response.status})`
        throw new Error(errorMsg)
      }

      setConnectionState(SSEConnectionState.OPEN)
      retryCountRef.current = 0

      readerRef.current = response.body.getReader()
      await processStreamRef.current(readerRef.current)

      setConnectionState(SSEConnectionState.IDLE)

    } catch (err) {
      clearTimeout(timeoutId)
      
      if (err.name === 'AbortError') {
        setConnectionState(SSEConnectionState.IDLE)
        return
      }

      console.error('SSE connection error:', err)
      
      // 区分网络错误和其他错误
      const isNetworkError = err.message.includes('Failed to fetch') || 
                            err.message.includes('NetworkError') ||
                            err.message.includes('网络') ||
                            !checkNetworkAvailability()
      
      if (isNetworkError) {
        setError('网络连接失败，请检查网络设置')
        setConnectionState(SSEConnectionState.ERROR)
      } else {
        setError(err.message)
        setConnectionState(SSEConnectionState.ERROR)
      }
      
      // 智能重试：只在非网络断开的情况下重试
      if (retryCountRef.current < maxRetries && checkNetworkAvailability()) {
        retryCountRef.current++
        setThinkingMessage(`连接中断，正在重试 (${retryCountRef.current}/${maxRetries})...`)
        
        await new Promise(resolve => setTimeout(resolve, retryDelay * retryCountRef.current))
        
        return sendMessage(params)
      }
      
      onError?.(err.message)
      setIsStreaming(false)
    }
  }, [conversationId, lastEventId, maxRetries, retryDelay, connectionTimeout, onError, checkNetworkAvailability])

  const sendSimpleMessage = useCallback(async (params) => {
    const { question, context = '', topic = '' } = params

    if (!question) {
      setError('问题不能为空')
      return
    }

    // 检查网络连接
    if (!checkNetworkAvailability()) {
      setError('网络未连接，请检查网络设置')
      setConnectionState(SSEConnectionState.ERROR)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    
    // 创建超时控制器
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        setError('连接超时，请检查网络后重试')
        setConnectionState(SSEConnectionState.ERROR)
        setIsStreaming(false)
      }
    }, connectionTimeout)
    
    setConnectionState(SSEConnectionState.CONNECTING)
    setIsStreaming(true)
    setError(null)
    setStreamedContent('')
    // 重置 ref，准备接收新的流式内容
    finalStreamedContentRef.current = ''
    setThinkingMessage('正在连接...')

    const requestBody = { question, context, topic }

    try {
      const response = await fetch(`${API_BASE_URL}/sse/chat/simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        credentials: 'include',
        signal: abortControllerRef.current.signal
      })

      // 清除超时定时器
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorMsg = response.status === 503 
          ? '服务暂时不可用，请稍后重试' 
          : `请求失败 (${response.status})`
        throw new Error(errorMsg)
      }

      setConnectionState(SSEConnectionState.OPEN)

      readerRef.current = response.body.getReader()
      await processStreamRef.current(readerRef.current)

      setConnectionState(SSEConnectionState.IDLE)

    } catch (err) {
      clearTimeout(timeoutId)
      
      if (err.name === 'AbortError') {
        setConnectionState(SSEConnectionState.IDLE)
        return
      }

      console.error('SSE connection error:', err)
      
      // 区分网络错误和其他错误
      const isNetworkError = err.message.includes('Failed to fetch') || 
                            err.message.includes('NetworkError') ||
                            err.message.includes('网络') ||
                            !checkNetworkAvailability()
      
      if (isNetworkError) {
        setError('网络连接失败，请检查网络设置')
      } else {
        setError(err.message)
      }
      
      setConnectionState(SSEConnectionState.ERROR)
      setIsStreaming(false)
    }
  }, [connectionTimeout, checkNetworkAvailability])

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (readerRef.current) {
      readerRef.current.cancel()
    }
    setIsStreaming(false)
    setConnectionState(SSEConnectionState.IDLE)
    setThinkingMessage('')
  }, [])

  const resetState = useCallback(() => {
    setStreamedContent('')
    setError(null)
    setThinkingMessage('')
    setConversationId(null)
    setLastEventId(null)
  }, [])

  const loadConversationHistory = useCallback(async (convId) => {
    if (!convId) return []
    
    try {
      const result = await conversation.getMessages(convId, { limit: 100 })
      if (result.success && result.data?.messages) {
        return result.data.messages.map(msg => ({
          id: msg.id,
          message_id: msg.message_id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at,
          metadata: msg.metadata
        }))
      }
      return []
    } catch (err) {
      console.error('加载对话历史失败:', err)
      return []
    }
  }, [])

  const getLatestConversation = useCallback(async () => {
    try {
      const result = await conversation.getAll({ status: 'active', limit: 1 })
      if (result.success && result.data?.conversations?.length > 0) {
        return result.data.conversations[0]
      }
      return null
    } catch (err) {
      console.error('获取最新会话失败:', err)
      return null
    }
  }, [])

  const loadAndRestoreConversation = useCallback(async (convId) => {
    if (!convId) {
      const latestConv = await getLatestConversation()
      if (latestConv) {
        convId = latestConv.conversation_id
      }
    }
    
    if (!convId) return { messages: [], conversationId: null }
    
    const messages = await loadConversationHistory(convId)
    setConversationId(convId)
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}current`, convId)
    }
    
    return { messages, conversationId: convId }
  }, [loadConversationHistory, getLatestConversation])

  const clearStoredConversation = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}current`)
    }
    setConversationId(null)
  }, [])

  const getStoredConversationId = useCallback(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`${STORAGE_KEY_PREFIX}current`)
    }
    return null
  }, [])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    connectionState,
    networkState,
    isStreaming,
    streamedContent,
    conversationId,
    error,
    thinkingMessage,
    lastEventId,
    sendMessage,
    sendSimpleMessage,
    stopStreaming,
    resetState,
    setConversationId,
    loadConversationHistory,
    getLatestConversation,
    loadAndRestoreConversation,
    clearStoredConversation,
    getStoredConversationId
  }
}

export { SSEConnectionState, SSEEventType, NetworkState }
export default useSSEChat
