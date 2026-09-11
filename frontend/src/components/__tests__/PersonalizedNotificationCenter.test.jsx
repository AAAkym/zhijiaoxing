import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, jest, test } from '@jest/globals'
import PersonalizedNotificationCenter from '../PersonalizedNotificationCenter'
import { personalizedLearning } from '@/services/api'

jest.mock('@/services/api', () => ({
  personalizedLearning: {
    getStudentNotifications: jest.fn(),
    markStudentNotificationRead: jest.fn(),
    markAllStudentNotificationsRead: jest.fn(),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  personalizedLearning.getStudentNotifications.mockResolvedValue({
    notifications: [{
      id: 7,
      delivery_id: 'delivery_7',
      notification_type: 'published',
      title: 'Task ready',
      content: 'Start your personalized learning task.',
      is_read: false,
    }],
    unread_count: 1,
  })
  personalizedLearning.markStudentNotificationRead.mockResolvedValue({ notification: { id: 7, is_read: true } })
  personalizedLearning.markAllStudentNotificationsRead.mockResolvedValue({ changed_count: 1 })
})

test('marks a notification as read before opening its task', async () => {
  const user = userEvent.setup()
  const onOpenTask = jest.fn()
  render(<PersonalizedNotificationCenter onOpenTask={onOpenTask} />)

  await user.click(await screen.findByRole('button', { name: /Task ready/ }))

  await waitFor(() => expect(personalizedLearning.markStudentNotificationRead).toHaveBeenCalledWith(7))
  expect(onOpenTask).toHaveBeenCalledWith('delivery_7')
})
