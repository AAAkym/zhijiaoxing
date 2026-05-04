import { useState, useRef, useEffect, useCallback } from 'react'
import { useSSEChat, SSEConnectionState, NetworkState } from '../hooks/useSSEChat'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { 
  Send, 
  Square, 
  RotateCcw, 
  MessageCircle, 
  Bot, 
  User, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wifi,
  WifiOff
} from 'lucide-react'
import './AIChatPanel.css'

const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
}

function MessageBubble({ message, isStreaming = false }) {
  const isUser = message.role === MessageRole.USER
  const isSystem = message.role === MessageRole.SYSTEM
  
  return (
    <div className={`message-bubble ${isUser ? 'user-message' : isSystem ? 'system-message' : 'assistant-message'}`}>
      <div className="message-avatar">
        {isUser ? (
          <User className="h-5 w-5" />
        ) : isSystem ? (
          <AlertCircle className="h-5 w-5" />
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-role">
            {isUser ? '你' : isSystem ? '系统' : 'AI助手'}
          </span>
          {message.timestamp && (
            <span className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="message-text">
          {message.content}
          {isStreaming && <span className="streaming-cursor">▊</span>}
        </div>
      </div>
    </div>
  )
}

function ThinkingIndicator({ message }) {
  return (
    <div className="thinking-indicator">
      <div className="thinking-icon">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      <div className="thinking-content">
        <span className="thinking-label">AI 思考中</span>
        <span className="thinking-message">{message || '正在分析您的问题...'}</span>
      </div>
    </div>
  )
}

function ConnectionStatus({ connectionState, networkState }) {
  // 首先检查网络状态
  if (networkState === NetworkState.OFFLINE) {
    return (
      <div className="connection-status status-offline">
        <WifiOff className="h-3 w-3" />
        <span>网络未连接</span>
      </div>
    )
  }

  // 然后检查连接状态
  const getStatusConfig = () => {
    switch (connectionState) {
      case SSEConnectionState.IDLE:
        return { icon: CheckCircle2, text: '就绪', className: 'status-idle', animate: false }
      case SSEConnectionState.CONNECTING:
        return { icon: Loader2, text: '连接中...', className: 'status-connecting', animate: true }
      case SSEConnectionState.OPEN:
        return { icon: Wifi, text: '已连接', className: 'status-connected', animate: false }
      case SSEConnectionState.CLOSED:
        return { icon: WifiOff, text: '连接已关闭', className: 'status-closed', animate: false }
      case SSEConnectionState.ERROR:
        return { icon: AlertCircle, text: '连接错误', className: 'status-error', animate: false }
      default:
        return { icon: WifiOff, text: '未知', className: 'status-unknown', animate: false }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div className={`connection-status ${config.className}`}>
      <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} />
      <span>{config.text}</span>
    </div>
  )
}

export function AIChatPanel({
  title = 'AI学习助手',
  placeholder = '输入你的问题...',
  topic = '',
  context = '',
  onConversationChange,
  initialConversationId = null,
  showConnectionStatus = true,
  className = '',
  autoRestoreOnMount = true
}) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState(null)
  const [isRestoring, setIsRestoring] = useState(false)
  
  const messagesRef = useRef([])
  
  const scrollAreaRef = useRef(null)
  const inputRef = useRef(null)
  
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const {
    connectionState,
    networkState,
    isStreaming,
    streamedContent,
    conversationId,
    error,
    thinkingMessage,
    sendMessage,
    stopStreaming,
    resetState,
    setConversationId,
    loadAndRestoreConversation,
    clearStoredConversation,
    getStoredConversationId
  } = useSSEChat({
    maxRetries: 3,
    retryDelay: 1000,
    onComplete: (data) => {
      const finalContent = data?.finalContent || ''
      if (finalContent && finalContent.trim()) {
        setMessages(prev => {
          const exists = prev.some(m => 
            m.role === MessageRole.ASSISTANT && 
            m.content === finalContent
          )
          if (exists) {
            return prev
          }
          const newMessages = [...prev, {
            id: Date.now(),
            role: MessageRole.ASSISTANT,
            content: finalContent,
            timestamp: new Date().toISOString(),
            metadata: data
          }]
          messagesRef.current = newMessages
          return newMessages
        })
        setCurrentStreamingMessage(null)
      }
    },
    onError: (errorMsg) => {
      setMessages(prev => {
        const newMessages = [...prev, {
          id: Date.now(),
          role: MessageRole.SYSTEM,
          content: `发生错误: ${errorMsg}`,
          timestamp: new Date().toISOString()
        }]
        messagesRef.current = newMessages
        return newMessages
      })
    }
  })

  useEffect(() => {
    if (!isStreaming && streamedContent && streamedContent.trim()) {
      const hasAssistantMessage = messagesRef.current.some(m => 
        m.role === MessageRole.ASSISTANT && 
        m.content === streamedContent
      )
      if (!hasAssistantMessage) {
        setMessages(prev => {
          const exists = prev.some(m => 
            m.role === MessageRole.ASSISTANT && 
            m.content === streamedContent
          )
          if (exists) {
            return prev
          }
          const newMessages = [...prev, {
            id: Date.now(),
            role: MessageRole.ASSISTANT,
            content: streamedContent,
            timestamp: new Date().toISOString()
          }]
          messagesRef.current = newMessages
          return newMessages
        })
      }
    }
  }, [isStreaming, streamedContent])

  useEffect(() => {
    const restoreConversation = async () => {
      if (!autoRestoreOnMount) return
      
      setIsRestoring(true)
      try {
        const storedConvId = initialConversationId || getStoredConversationId()
        const result = await loadAndRestoreConversation(storedConvId)
        
        if (result.messages && result.messages.length > 0) {
          setMessages(result.messages)
          messagesRef.current = result.messages
        }
      } catch (err) {
        console.error('恢复对话失败:', err)
      } finally {
        setIsRestoring(false)
      }
    }
    
    restoreConversation()
  }, [initialConversationId, autoRestoreOnMount, loadAndRestoreConversation, getStoredConversationId])

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages, streamedContent, thinkingMessage])

  useEffect(() => {
    if (conversationId && onConversationChange) {
      onConversationChange(conversationId)
    }
  }, [conversationId, onConversationChange])

  const handleSendMessage = useCallback(async () => {
    const question = inputValue.trim()
    if (!question || isStreaming) return

    const userMessage = {
      id: Date.now(),
      role: MessageRole.USER,
      content: question,
      timestamp: new Date().toISOString()
    }
    
    // 确保使用函数式更新，保留历史消息
    setMessages(prev => {
      const newMessages = [...prev, userMessage]
      messagesRef.current = newMessages
      return newMessages
    })
    setInputValue('')
    setCurrentStreamingMessage({ role: MessageRole.ASSISTANT, content: '' })

    await sendMessage({
      question,
      conversationId,
      context,
      topic
    })
  }, [inputValue, isStreaming, sendMessage, conversationId, context, topic])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleStopStreaming = useCallback(() => {
    stopStreaming()
    // 使用当前的 streamedContent 状态，此时还没有被清空
    if (streamedContent) {
      setMessages(prev => {
        const newMessages = [...prev, {
          id: Date.now(),
          role: MessageRole.ASSISTANT,
          content: streamedContent + ' [已停止]',
          timestamp: new Date().toISOString()
        }]
        messagesRef.current = newMessages
        return newMessages
      })
    }
    setCurrentStreamingMessage(null)
  }, [stopStreaming, streamedContent])

  const handleReset = useCallback(() => {
    resetState()
    setMessages([])
    messagesRef.current = []
    setCurrentStreamingMessage(null)
    setInputValue('')
    clearStoredConversation()
  }, [resetState, clearStoredConversation])

  // 重试最后一次消息
  const handleRetry = useCallback(() => {
    if (messagesRef.current.length > 0) {
      const lastUserMessage = [...messagesRef.current].reverse().find(m => m.role === MessageRole.USER)
      if (lastUserMessage) {
        // 移除错误消息和最后的AI消息
        setMessages(prev => {
          const newMessages = prev.filter(m => 
            m.role !== MessageRole.SYSTEM && 
            !(m.role === MessageRole.ASSISTANT && m.content.includes('[已停止]'))
          )
          messagesRef.current = newMessages
          return newMessages
        })
        
        // 重试发送
        setInputValue(lastUserMessage.content)
        setTimeout(() => {
          handleSendMessage()
        }, 100)
      }
    }
  }, [handleSendMessage])

  return (
    <Card className={`ai-chat-panel ${className}`}>
      <CardHeader className="chat-header">
        <div className="header-left">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {title}
          </CardTitle>
          {conversationId && (
            <Badge variant="secondary" className="conversation-badge">
              会话: {conversationId.slice(0, 8)}...
            </Badge>
          )}
        </div>
        <div className="header-right">
          {showConnectionStatus && (
            <ConnectionStatus 
              connectionState={connectionState} 
              networkState={networkState} 
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isStreaming}
            title="重置对话"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="chat-content">
        <ScrollArea className="messages-area" ref={scrollAreaRef}>
          {isRestoring && (
            <div className="empty-state">
              <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">
                正在恢复对话历史...
              </p>
            </div>
          )}
          
          {!isRestoring && messages.length === 0 && !isStreaming && (
            <div className="empty-state">
              <Bot className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                你好！我是AI学习助手，有什么可以帮助你的吗？
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {isStreaming && thinkingMessage && (
            <ThinkingIndicator message={thinkingMessage} />
          )}
          
          {isStreaming && streamedContent && (
            <MessageBubble 
              message={{
                role: MessageRole.ASSISTANT,
                content: streamedContent
              }}
              isStreaming={true}
            />
          )}
          
          {error && !isStreaming && (
            <div className="error-message-container">
              <div className="error-message">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
              {networkState !== NetworkState.OFFLINE && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="retry-button"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  重试
                </Button>
              )}
            </div>
          )}
        </ScrollArea>
        
        <Separator />
        
        <div className="input-area">
          <div className="input-wrapper">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isStreaming}
              className="message-input"
            />
            {isStreaming ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={handleStopStreaming}
                title="停止生成"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isStreaming}
                title="发送消息"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="input-hints">
            <span className="hint-text">按 Enter 发送，Shift + Enter 换行</span>
            {isStreaming && (
              <Badge variant="outline" className="streaming-badge">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                正在生成...
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AIChatPanel
