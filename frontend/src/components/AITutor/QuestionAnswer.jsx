import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Send,
  Image,
  X,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  HelpCircle,
  Loader2,
  Bot,
  User,
} from 'lucide-react'
import { aiTutor } from '@/services/api'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_INPUT_LENGTH = 500

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function WeakPointBanner({ weakPoints }) {
  if (!weakPoints || weakPoints.length === 0) return null

  return (
    <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 animate-fade-in">
      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
      <span className="text-sm text-amber-800">
        复习薄弱点:
        {weakPoints.map((point, idx) => (
          <Badge
            key={idx}
            variant="outline"
            className="ml-1.5 text-xs border-amber-300 text-amber-700 bg-amber-100/60"
          >
            {typeof point === 'string' ? point : point.name || point.topic}
          </Badge>
        ))}
      </span>
    </div>
  )
}

function QuickSuggestions({ weakPoints, recentTopics, onSelect }) {
  const suggestions = []

  if (weakPoints && weakPoints.length > 0) {
    weakPoints.slice(0, 2).forEach((point) => {
      const name = typeof point === 'string' ? point : point.name || point.topic
      suggestions.push({ label: `复习: ${name}`, value: `请帮我复习${name}的相关知识` })
    })
  }

  if (recentTopics && recentTopics.length > 0) {
    recentTopics.slice(0, 2).forEach((topic) => {
      suggestions.push({ label: `继续: ${topic}`, value: `关于"${topic}"，我还有疑问` })
    })
  }

  if (suggestions.length === 0) {
    suggestions.push(
      { label: '帮我梳理本章重点', value: '请帮我梳理本章的重点知识' },
      { label: '解释一个难点概念', value: '请帮我解释一个本课程中的难点概念' },
    )
  }

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {suggestions.map((s, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(s.value)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
            bg-indigo-50 text-indigo-700 border border-indigo-200
            hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          {s.label}
        </button>
      ))}
    </div>
  )
}

function OutOfScopeCard() {
  return (
    <div className="mx-2 my-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-700">超出课程范围</p>
          <p className="text-xs text-gray-500 mt-1">
            您的问题似乎超出了当前课程的范围，我暂时无法为您解答。请尝试围绕课程内容提问，我会更好地帮助您！
          </p>
        </div>
      </div>
    </div>
  )
}

function ClarificationOptions({ options, onSelect }) {
  if (!options || options.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2 ml-2">
      {options.map((option, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(option)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-blue-50 text-blue-700 border border-blue-200
            hover:bg-blue-100 hover:border-blue-300 transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          {option}
        </button>
      ))}
    </div>
  )
}

function FeedbackButtons({ interactionId, onFeedback, feedbackLoading }) {
  const [voted, setVoted] = useState(null)

  const handleVote = (rating) => {
    if (voted) return
    setVoted(rating)
    onFeedback(interactionId, rating === 'up' ? 'positive' : 'negative')
  }

  return (
    <div className="flex items-center gap-1 mt-1.5">
      <button
        onClick={() => handleVote('up')}
        disabled={!!voted}
        className={`p-1 rounded transition-colors ${
          voted === 'up'
            ? 'text-green-600 bg-green-50'
            : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
        } ${voted && voted !== 'up' ? 'opacity-40' : ''}`}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={!!voted}
        className={`p-1 rounded transition-colors ${
          voted === 'down'
            ? 'text-red-600 bg-red-50'
            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
        } ${voted && voted !== 'down' ? 'opacity-40' : ''}`}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
      {feedbackLoading && (
        <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-1" />
      )}
    </div>
  )
}

function MessageBubble({ message, onFeedback, feedbackLoading, onClarification }) {
  const isUser = message.role === 'user'

  if (message.isOutOfScope) {
    return (
      <div className="flex justify-start mb-3 animate-fade-in">
        <div className="max-w-[80%]">
          <div className="flex items-center gap-1.5 mb-1">
            <Bot className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">AI 导师</span>
          </div>
          <OutOfScopeCard />
          {message.interactionId && (
            <FeedbackButtons
              interactionId={message.interactionId}
              onFeedback={onFeedback}
              feedbackLoading={feedbackLoading}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 animate-fade-in`}>
      <div className={`max-w-[80%] ${isUser ? '' : ''}`}>
        <div className={`flex items-center gap-1.5 mb-1 ${isUser ? 'justify-end' : ''}`}>
          {isUser ? (
            <>
              <span className="text-xs text-gray-500">你</span>
              <User className="w-4 h-4 text-blue-500" />
            </>
          ) : (
            <>
              <Bot className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">AI 导师</span>
            </>
          )}
        </div>

        {isUser ? (
          <div className="bg-blue-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          <div className="bg-gray-100 text-gray-800 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-500 animate-pulse rounded-sm" />
            )}
          </div>
        )}

        {message.imagePreview && isUser && (
          <div className="mt-1.5 flex justify-end">
            <img
              src={message.imagePreview}
              alt="上传的图片"
              className="max-w-[200px] max-h-[150px] rounded-lg border border-blue-300 object-cover"
            />
          </div>
        )}

        {!isUser && message.interactionId && !message.isStreaming && (
          <FeedbackButtons
            interactionId={message.interactionId}
            onFeedback={onFeedback}
            feedbackLoading={feedbackLoading}
          />
        )}

        {!isUser && message.clarificationOptions && !message.isStreaming && (
          <ClarificationOptions
            options={message.clarificationOptions}
            onSelect={onClarification}
          />
        )}
      </div>
    </div>
  )
}

export default function QuestionAnswer({
  courseId,
  onTopicAsked,
  weakPoints,
  recentTopics,
  onFeedback,
  feedbackLoading,
}) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState(null)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const abortControllerRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputValue])

  const handleImageSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('仅支持 JPG/PNG 格式的图片')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError('图片大小不能超过 10MB')
      return
    }

    try {
      const base64 = await fileToBase64(file)
      setImageFile(base64)
      setImagePreview(URL.createObjectURL(file))
      setError(null)
    } catch {
      setError('图片读取失败，请重试')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleRemoveImage = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImageFile(null)
    setImagePreview(null)
  }, [imagePreview])

  const parseSSEEvents = useCallback(async (response, assistantMsgId) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })
    let buffer = ''
    let fullContent = ''
    let interactionId = null
    let isOutOfScope = false
    let clarificationOptions = null
    let knowledgeTags = null

    const parseSSEMessage = (rawMessage) => {
      const lines = rawMessage.split('\n')
      const event = { id: null, event: null, data: null }
      for (const line of lines) {
        if (line.startsWith('id:')) {
          event.id = line.substring(3).trim()
        } else if (line.startsWith('event:')) {
          event.event = line.substring(6).trim()
        } else if (line.startsWith('data:')) {
          const dataStr = line.substring(5).trim()
          try {
            event.data = JSON.parse(dataStr)
          } catch {
            event.data = dataStr
          }
        }
      }
      return event
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            const evt = parseSSEMessage(buffer)
            if (evt.event === 'error') {
              throw new Error(evt.data?.error || evt.data || '回答问题时发生错误')
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || ''

        for (const message of messages) {
          if (!message.trim()) continue
          const evt = parseSSEMessage(message)

          if (evt.event === 'error') {
            throw new Error(evt.data?.error || evt.data || '回答问题时发生错误')
          }

          if (evt.event === 'done') continue

          if (evt.event === 'message' || evt.event === 'config' || evt.event === 'ping') {
            const data = evt.data
            if (data && typeof data === 'object') {
              if (data.content) {
                fullContent += data.content
                setStreamingContent(fullContent)
              }
              if (data.interaction_id) {
                interactionId = data.interaction_id
              }
              if (data.is_out_of_scope === true) {
                isOutOfScope = true
              }
              if (data.clarification_options && Array.isArray(data.clarification_options)) {
                clarificationOptions = data.clarification_options
              }
              if (data.knowledge_tags) {
                knowledgeTags = data.knowledge_tags
              }
            } else if (typeof data === 'string' && data && data !== '[DONE]') {
              fullContent += data
              setStreamingContent(fullContent)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return { fullContent, interactionId, isOutOfScope, clarificationOptions, knowledgeTags }
  }, [])

  const handleSend = useCallback(async (overrideText) => {
    const text = (overrideText || inputValue).trim()
    if (!text || isStreaming) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      imagePreview: imagePreview || null,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    handleRemoveImage()
    setIsStreaming(true)
    setStreamingContent('')
    setError(null)

    const assistantMsgId = Date.now() + 1

    try {
      abortControllerRef.current = new AbortController()

      const payload = {
        question: text,
        course_id: courseId || undefined,
      }

      if (imageFile) {
        payload.image = imageFile
      }

      const response = await aiTutor.answerStream({
        ...payload,
        _signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      const result = await parseSSEEvents(response, assistantMsgId)

      const assistantMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: result.fullContent,
        interactionId: result.interactionId,
        isOutOfScope: result.isOutOfScope,
        clarificationOptions: result.clarificationOptions,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (result.knowledgeTags && onTopicAsked) {
        if (Array.isArray(result.knowledgeTags)) {
          result.knowledgeTags.forEach((tag) => onTopicAsked(tag))
        } else {
          onTopicAsked(result.knowledgeTags)
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || '发送失败，请重试')
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      abortControllerRef.current = null
    }
  }, [inputValue, isStreaming, imageFile, imagePreview, courseId, onTopicAsked, parseSSEEvents, handleRemoveImage])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleClarification = useCallback((option) => {
    handleSend(option)
  }, [handleSend])

  const handleQuickSelect = useCallback((text) => {
    handleSend(text)
  }, [handleSend])

  const showEmptyState = messages.length === 0 && !isStreaming

  return (
    <div className="flex flex-col h-full">
      <WeakPointBanner weakPoints={weakPoints} />

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {showEmptyState && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <HelpCircle className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">
              有什么不懂的？随时问我
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              输入问题或点击下方建议快速开始
            </p>
            <QuickSuggestions
              weakPoints={weakPoints}
              recentTopics={recentTopics}
              onSelect={handleQuickSelect}
            />
          </div>
        )}

        {!showEmptyState && (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onFeedback={onFeedback}
                feedbackLoading={feedbackLoading}
                onClarification={handleClarification}
              />
            ))}

            {isStreaming && streamingContent && (
              <MessageBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  isStreaming: true,
                }}
              />
            )}

            {isStreaming && !streamingContent && (
              <div className="flex justify-start mb-3 animate-fade-in">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-2xl rounded-tl-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">正在思考...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 mx-2 mb-2 rounded-lg bg-red-50 border border-red-200 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {!showEmptyState && (
        <QuickSuggestions
          weakPoints={weakPoints}
          recentTopics={recentTopics}
          onSelect={handleQuickSelect}
        />
      )}

      <div className="border-t border-gray-200 bg-white px-4 py-3">
        {imagePreview && (
          <div className="mb-2 inline-flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <img
              src={imagePreview}
              alt="预览"
              className="w-16 h-16 object-cover rounded"
            />
            <button
              onClick={handleRemoveImage}
              className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              <X className="w-3 h-3 text-gray-600" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleImageSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="上传图片 (JPG/PNG, ≤10MB)"
          >
            <Image className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            disabled={isStreaming}
            maxLength={MAX_INPUT_LENGTH}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300
              placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          />

          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={(!inputValue.trim() && !imageFile) || isStreaming}
            className="shrink-0 rounded-xl h-10 w-10 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[11px] text-gray-400">
            Enter 发送 · Shift+Enter 换行
          </span>
          <span className="text-[11px] text-gray-400">
            {inputValue.length}/{MAX_INPUT_LENGTH}
          </span>
        </div>
      </div>
    </div>
  )
}
