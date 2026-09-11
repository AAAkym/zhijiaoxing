import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, jest, test } from '@jest/globals'
import PersonalizedTaskOperations from '../PersonalizedTaskOperations'
import { personalizedLearning } from '@/services/api'

jest.mock('@/services/api', () => ({
  personalizedLearning: {
    listTeacherDeliveries: jest.fn(),
    bulkChangeDeliveryState: jest.fn(),
    getReminderStatus: jest.fn(),
    bulkRemindDeliveries: jest.fn(),
  },
}))

const task = {
  delivery_id: 'dlv_4a', title: '循环强化任务', student_name: '张同学',
  class_name: '软件一班', course_title: 'Python程序设计', status: 'IN_PROGRESS',
  due_status: 'due_soon', due_at: '2026-07-23T20:00:00', progress_percentage: 40,
}

beforeEach(() => {
  jest.clearAllMocks()
  personalizedLearning.listTeacherDeliveries.mockResolvedValue({
    deliveries: [task], count: 1,
    pagination: { page: 1, pages: 1, total: 1, has_previous: false, has_next: false },
  })
  personalizedLearning.bulkChangeDeliveryState.mockResolvedValue({
    requested_count: 1, changed_count: 1, skipped_count: 0,
  })
  personalizedLearning.getReminderStatus.mockResolvedValue({
    scheduler: { enabled: false, message: '自动提醒未启用，可使用手动提醒' },
  })
  personalizedLearning.bulkRemindDeliveries.mockResolvedValue({
    requested_count: 1, created_count: 1, skipped_count: 0,
  })
})

test('teacher searches and batch-pauses selected tasks', async () => {
  const user = userEvent.setup()
  render(<PersonalizedTaskOperations />)

  expect(await screen.findByText('循环强化任务')).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: '搜索任务' }), '张同学')
  await user.click(screen.getByRole('button', { name: '搜索任务' }))
  await waitFor(() => expect(personalizedLearning.listTeacherDeliveries).toHaveBeenLastCalledWith(
    expect.objectContaining({ q: '张同学', page: 1, page_size: 10 })
  ))

  await user.click(screen.getByRole('checkbox', { name: '选择任务 循环强化任务' }))
  await user.click(screen.getByRole('button', { name: /批量暂停/ }))
  await waitFor(() => expect(personalizedLearning.bulkChangeDeliveryState).toHaveBeenCalledWith({
    action: 'pause', delivery_ids: ['dlv_4a'],
  }))
  expect(await screen.findByText('已处理 1 个任务：变更 1 个，跳过 0 个。')).toBeInTheDocument()
})
