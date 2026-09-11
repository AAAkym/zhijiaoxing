import { render, screen } from '@testing-library/react'
import { beforeEach, expect, jest, test } from '@jest/globals'
import WorkflowOperationsDashboard from '../WorkflowOperationsDashboard'
import { workflowMetrics } from '@/services/api'

jest.mock('@/services/api', () => ({
  workflowMetrics: { getDashboard: jest.fn() },
}))

beforeEach(() => {
  jest.clearAllMocks()
  workflowMetrics.getDashboard.mockResolvedValue({
    workflow: {
      generation_total: 42,
      publish_success_rate: 75,
      cycle_completion_rate: 50,
      p95_duration_ms: 1200,
      auto_repair_count: 3,
      degraded_count: 2,
      recovery_count: 1,
    },
    runtime: { permission_denied_count: 4, p95_response_ms: 80, error_count: 0 },
    scheduler: { enabled: false, message: 'Manual reminders remain available' },
  })
})

test('renders real workflow, runtime and scheduler metrics', async () => {
  render(<WorkflowOperationsDashboard />)

  expect(await screen.findByText('42')).toBeInTheDocument()
  expect(screen.getByText('75%')).toBeInTheDocument()
  expect(screen.getByText('Manual reminders remain available')).toBeInTheDocument()
  expect(workflowMetrics.getDashboard).toHaveBeenCalledWith(30)
})
