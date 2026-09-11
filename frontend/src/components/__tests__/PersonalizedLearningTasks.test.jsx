import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, jest, test } from '@jest/globals'
import PersonalizedLearningTasks from '../PersonalizedLearningTasks'
import { personalizedLearning } from '@/services/api'

jest.mock('@/services/api', () => ({
  personalizedLearning: {
    getStudentDeliveries: jest.fn(),
    getStudentDelivery: jest.fn(),
    startStudentDelivery: jest.fn(),
    completeStudentResource: jest.fn(),
    submitStudentAssessment: jest.fn(),
    getStudentNotifications: jest.fn(),
    markStudentNotificationRead: jest.fn(),
    markAllStudentNotificationsRead: jest.fn(),
  },
}))

const baseDelivery = {
  delivery_id: 'dlv_student', title: '循环个性化任务', instructions: '按顺序学习',
  status: 'PUBLISHED', progress_percentage: 0, events: [], cycles: [],
  resources: {
    document: { resource_type: 'document', content: { title: '循环讲义', content: '理解for循环。' } },
  },
  completion_rules: {
    assessment_id: 42,
    assessment_title: '循环个性化任务·本轮检测',
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  personalizedLearning.getStudentDeliveries.mockResolvedValue({
    deliveries: [baseDelivery],
    pagination: { page: 1, pages: 1, total: 1, has_previous: false, has_next: false },
  })
  personalizedLearning.getStudentDelivery.mockResolvedValue({ delivery: baseDelivery })
  personalizedLearning.startStudentDelivery.mockResolvedValue({ delivery: { ...baseDelivery, status: 'IN_PROGRESS' } })
  personalizedLearning.completeStudentResource.mockResolvedValue({ delivery: {
    ...baseDelivery, status: 'WAITING_ASSESSMENT', progress_percentage: 100,
    events: [{ event_type: 'resource_completed', resource_key: 'document' }],
  } })
  personalizedLearning.submitStudentAssessment.mockResolvedValue({ cycle: {
    confidence_score: 0,
    evidence: { assessment_source_count: 0, assessment_sample_count: 0 },
    feedback: { summary: '本轮证据不足，暂不判断是否掌握', evidence: ['已完成1项学习资源'] },
    next_strategy: { action: '先安排短检测补充证据', learning_sequence: ['短检测', '证据复核'] },
  } })
  personalizedLearning.getStudentNotifications.mockResolvedValue({
    notifications: [], unread_count: 0,
    pagination: { page: 1, pages: 0, total: 0 },
  })
  personalizedLearning.markStudentNotificationRead.mockResolvedValue({ notification: { is_read: true } })
  personalizedLearning.markAllStudentNotificationsRead.mockResolvedValue({ changed_count: 0 })
})

test('student searches tasks with server-side filters', async () => {
  const user = userEvent.setup()
  render(<PersonalizedLearningTasks />)

  await screen.findByRole('button', { name: '查看任务' })
  await user.type(screen.getByRole('textbox', { name: '搜索学习任务' }), '循环')
  await user.click(screen.getByRole('button', { name: '搜索学习任务' }))

  await waitFor(() => expect(personalizedLearning.getStudentDeliveries).toHaveBeenLastCalledWith(
    expect.objectContaining({ q: '循环', page: 1, page_size: 10 })
  ))
})

test('student starts, completes resources and receives an evidence-aware next strategy', async () => {
  const user = userEvent.setup()
  render(<PersonalizedLearningTasks />)

  await user.click(await screen.findByRole('button', { name: '查看任务' }))
  expect(await screen.findByText('循环讲义')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /开始本轮学习/ }))
  await user.click(await screen.findByRole('button', { name: /完成这项资源/ }))
  await user.click(await screen.findByRole('button', { name: /分析本轮学习效果/ }))

  await waitFor(() => expect(personalizedLearning.completeStudentResource).toHaveBeenCalledWith(
    'dlv_student', expect.objectContaining({ resource_key: 'document', idempotency_key: expect.any(String) })
  ))
  expect(await screen.findByText('本轮证据不足，暂不判断是否掌握')).toBeInTheDocument()
  expect(screen.getByText('先安排短检测补充证据')).toBeInTheDocument()
  expect(screen.getByText('证据可信度 0%')).toBeInTheDocument()
})

test('opens the assessment bound to the current delivery', async () => {
  const user = userEvent.setup()
  const onOpenAssessment = jest.fn()
  render(<PersonalizedLearningTasks onOpenAssessment={onOpenAssessment} />)

  await user.click(await screen.findByRole('button', { name: '查看任务' }))
  await user.click(screen.getByRole('button', { name: /开始本轮学习/ }))
  await user.click(await screen.findByRole('button', { name: /完成这项资源/ }))

  expect(await screen.findByText(/编号 #42/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '打开本轮检测' }))
  expect(onOpenAssessment).toHaveBeenCalledWith(42)
})
