import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClassPersonalizationBatchWorkbench from '../ClassPersonalizationBatchWorkbench'
import { classManagement, courseGeneration, courses } from '@/services/api'

jest.mock('@/services/api', () => ({
  courses: { getAll: jest.fn() },
  classManagement: { getClasses: jest.fn(), getClass: jest.fn() },
  courseGeneration: {
    getClassBatches: jest.fn(), getClassBatch: jest.fn(), getWorkflow: jest.fn(),
    preflightClassBatch: jest.fn(), createClassBatch: jest.fn(),
    refreshClassBatchProfiles: jest.fn(), generateClassBatch: jest.fn(), publishClassBatch: jest.fn(),
  },
}))

const batch = {
  batch_id: 'cb_test', state: 'READY_TO_PUBLISH', topic: 'Python循环',
  student_count: 2, ready_count: 2, generated_count: 2, published_count: 0,
  items: [
    { student_user_id: 3, student_name: '张三', workflow_id: 'wf_zhang', state: 'READY_TO_PUBLISH', review_passed: true, generation_mode: 'spark_ai', resource_types: ['document', 'mindmap'] },
    { student_user_id: 4, student_name: '李四', workflow_id: 'wf_li', state: 'READY_TO_PUBLISH', review_passed: true, generation_mode: 'rule_fallback', resource_types: ['document', 'project'] },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
  courses.getAll.mockResolvedValue({ courses: [{ id: 1, title: 'Python程序设计' }] })
  classManagement.getClasses.mockResolvedValue({ classes: [{ id: 2 }] })
  classManagement.getClass.mockResolvedValue({ id: 2, name: '软件一班', courses: [{ course_id: 1 }], students: [] })
  courseGeneration.getClassBatches.mockResolvedValue({ batches: [batch] })
  courseGeneration.getClassBatch.mockResolvedValue({ batch })
  courseGeneration.getWorkflow.mockResolvedValue({ workflow: {
    workflow_id: 'wf_zhang', payload: { profile_snapshot: { student: { name: '张三' } } },
    generation: { generation_source_label: 'AI生成完成', resources: { document: { title: '张三的循环讲义', content: '视觉化讲解循环边界。' } } },
  } })
  courseGeneration.publishClassBatch.mockResolvedValue({ batch: { ...batch, state: 'PUBLISHED', published_count: 2 }, message: '个性化学习任务已一次性发布给全班' })
})

test('shows per-student generation differences and opens one independent workflow', async () => {
  const user = userEvent.setup()
  render(<ClassPersonalizationBatchWorkbench />)
  expect(await screen.findByText('班级生成总览')).toBeInTheDocument()
  expect(screen.getByText('张三')).toBeInTheDocument()
  expect(screen.getByText('李四')).toBeInTheDocument()
  expect(screen.getByText(/AI生成/)).toBeInTheDocument()
  expect(screen.getByText(/保障模式/)).toBeInTheDocument()
  await user.click(screen.getAllByTitle('查看该学生资源')[0])
  expect(await screen.findByText('张三的循环讲义')).toBeInTheDocument()
  expect(screen.getByText('视觉化讲解循环边界。')).toBeInTheDocument()
})

test('publishes only after the whole batch is ready', async () => {
  const user = userEvent.setup()
  render(<ClassPersonalizationBatchWorkbench />)
  await user.click(await screen.findByRole('button', { name: /一次发布给全班/ }))
  await waitFor(() => expect(courseGeneration.publishClassBatch).toHaveBeenCalledWith('cb_test', expect.objectContaining({
    instructions: expect.any(String),
  })))
  expect(await screen.findByText('个性化学习任务已一次性发布给全班')).toBeInTheDocument()
})
