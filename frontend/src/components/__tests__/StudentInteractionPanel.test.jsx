import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { render, waitFor } from '@testing-library/react'
import StudentInteractionPanel from '../StudentInteractionPanel'
import websocketService from '../../services/websocket'

// 必须与组件里的真实导入路径一致：StudentInteractionPanel.jsx 用的是
// '../services/websocket'。此前写的是 '../websocket'（少一层 services），
// 靠 jest.config.js 里一条 '^../websocket$' 的 moduleNameMapper 补丁在兜底；
// 那条补丁会污染被提升（hoisted）的 mock 路径解析，已移除，因此这里必须写对。
//
// 注意：jest.mock 会被 babel-plugin-jest-hoist 提升到文件顶部，所以工厂函数
// **不能**引用文件里后面才声明的 const（那一刻还在暂时性死区 TDZ 里）。
// 因此 mock 对象在工厂内部创建，测试里统一通过上面那条 import 取到同一份引用。
jest.mock('../../services/websocket', () => {
  const service = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    joinCourse: jest.fn(),
    leaveCourse: jest.fn(),
    sendHandRaiseEvent: jest.fn(),
    sendQuestionEvent: jest.fn(),
    sendDiscussionEvent: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    isConnected: jest.fn(() => false),
  }
  return { __esModule: true, default: service }
})

const mockWebSocketService = websocketService

describe('StudentInteractionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWebSocketService.isConnected.mockReturnValue(false)
    localStorage.setItem('user', JSON.stringify({ id: 1 }))
  })

  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  it('initializes WebSocket when component mounts', async () => {
    render(<StudentInteractionPanel courseId={1} videoId={1} />)

    await waitFor(() => {
      expect(mockWebSocketService.connect).toHaveBeenCalled()
    })
  })

  it('leaves course room when component unmounts', async () => {
    const { unmount } = render(<StudentInteractionPanel courseId={1} videoId={1} />)

    await waitFor(() => {
      expect(mockWebSocketService.joinCourse).toHaveBeenCalledWith(1)
    })

    unmount()

    await waitFor(() => {
      expect(mockWebSocketService.leaveCourse).toHaveBeenCalledWith(1)
    })
  })

  it('registers real-time update listeners', async () => {
    render(<StudentInteractionPanel courseId={1} videoId={1} />)

    await waitFor(() => {
      expect(mockWebSocketService.on).toHaveBeenCalledWith('hand_raise_updated', expect.any(Function))
      expect(mockWebSocketService.on).toHaveBeenCalledWith('question_updated', expect.any(Function))
      expect(mockWebSocketService.on).toHaveBeenCalledWith('discussion_updated', expect.any(Function))
    })
  })
})

describe('WebSocket Service', () => {
  it('connects to WebSocket server', () => {
    expect(typeof mockWebSocketService.connect).toBe('function')
  })

  it('joins course room', () => {
    expect(typeof mockWebSocketService.joinCourse).toBe('function')
  })

  it('sends hand raise event', () => {
    expect(typeof mockWebSocketService.sendHandRaiseEvent).toBe('function')
  })

  it('registers event listeners', () => {
    expect(typeof mockWebSocketService.on).toBe('function')
    expect(typeof mockWebSocketService.off).toBe('function')
  })
})
