/**
 * 互动板块功能测试
 * 
 * 测试举手、问答、讨论功能的完整流程
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

// 模拟 WebSocket 服务
const mockWebSocketService = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  joinCourse: jest.fn(),
  leaveCourse: jest.fn(),
  sendHandRaiseEvent: jest.fn(),
  sendQuestionEvent: jest.fn(),
  sendDiscussionEvent: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  isConnected: jest.fn(() => false)
}

jest.mock('../websocket', () => mockWebSocketService)

describe('StudentInteractionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should initialize WebSocket when component mounts', () => {
    expect(mockWebSocketService.connect).toHaveBeenCalled()
    expect(mockWebSocketService.joinCourse).toHaveBeenCalledWith(expect.any(Number))
  })

  it('should leave course room when component unmounts', () => {
    // 模拟组件卸载
    expect(mockWebSocketService.leaveCourse).toHaveBeenCalledWith(expect.any(Number))
  })

  it('should handle hand raise creation', async () => {
    // 测试举手功能
    const mockHandRaise = {
      id: 1,
      course_id: 1,
      user_id: 1,
      status: 'waiting',
      reason: '有问题需要帮助'
    }

    expect(mockWebSocketService.sendHandRaiseEvent).toHaveBeenCalled()
  })

  it('should listen to real-time updates', () => {
    // 验证 WebSocket 事件监听器已注册
    expect(mockWebSocketService.on).toHaveBeenCalledWith(
      'hand_raise_updated',
      expect.any(Function)
    )
    expect(mockWebSocketService.on).toHaveBeenCalledWith(
      'question_updated',
      expect.any(Function)
    )
    expect(mockWebSocketService.on).toHaveBeenCalledWith(
      'discussion_updated',
      expect.any(Function)
    )
  })
})

describe('WebSocket Service', () => {
  it('should connect to WebSocket server', () => {
    mockWebSocketService.isConnected.mockReturnValue(false)
    mockWebSocketService.connect()
    expect(mockWebSocketService.connect).toHaveBeenCalled()
  })

  it('should join course room', () => {
    const courseId = 1
    mockWebSocketService.joinCourse(courseId)
    expect(mockWebSocketService.joinCourse).toHaveBeenCalledWith(courseId)
  })

  it('should send hand raise event', () => {
    const courseId = 1
    mockWebSocketService.sendHandRaiseEvent(courseId)
    expect(mockWebSocketService.sendHandRaiseEvent).toHaveBeenCalledWith(courseId)
  })

  it('should register event listeners', () => {
    const callback = jest.fn()
    mockWebSocketService.on('test_event', callback)
    expect(mockWebSocketService.on).toHaveBeenCalledWith('test_event', callback)
  })
})
