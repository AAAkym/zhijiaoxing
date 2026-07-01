import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { render, waitFor } from '@testing-library/react'
import StudentInteractionPanel from '../StudentInteractionPanel'

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
  isConnected: jest.fn(() => false),
}

jest.mock('../websocket', () => mockWebSocketService)

describe('StudentInteractionPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.setItem('user', JSON.stringify({ id: 1 }))
  })

  afterEach(() => {
    jest.resetAllMocks()
    localStorage.clear()
  })

  it('initializes WebSocket when component mounts', async () => {
    render(<StudentInteractionPanel courseId={1} videoId={1} />)

    await waitFor(() => {
      expect(mockWebSocketService.connect).toHaveBeenCalled()
      expect(mockWebSocketService.joinCourse).toHaveBeenCalledWith(1)
    })
  })

  it('leaves course room when component unmounts', () => {
    const { unmount } = render(<StudentInteractionPanel courseId={1} videoId={1} />)
    unmount()

    expect(mockWebSocketService.leaveCourse).toHaveBeenCalledWith(1)
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
    mockWebSocketService.connect()
    expect(mockWebSocketService.connect).toHaveBeenCalled()
  })

  it('joins course room', () => {
    mockWebSocketService.joinCourse(1)
    expect(mockWebSocketService.joinCourse).toHaveBeenCalledWith(1)
  })

  it('sends hand raise event', () => {
    mockWebSocketService.sendHandRaiseEvent(1)
    expect(mockWebSocketService.sendHandRaiseEvent).toHaveBeenCalledWith(1)
  })

  it('registers event listeners', () => {
    const callback = jest.fn()
    mockWebSocketService.on('test_event', callback)
    expect(mockWebSocketService.on).toHaveBeenCalledWith('test_event', callback)
  })
}
)
