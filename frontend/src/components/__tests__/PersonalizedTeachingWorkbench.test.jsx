import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, jest, test } from '@jest/globals'
import PersonalizedTeachingWorkbench from '../PersonalizedTeachingWorkbench'
import { classManagement, courseGeneration, courses, personalizedLearning } from '@/services/api'

jest.mock('@/services/api', () => ({
  courses: { getAll: jest.fn() },
  classManagement: { getClasses: jest.fn(), getClass: jest.fn() },
  courseGeneration: {
    getWorkflows: jest.fn(),
    getWorkflow: jest.fn(),
    suggestWorkflowKnowledgePoints: jest.fn(),
    previewWorkflowPlan: jest.fn(),
    generateWorkflowResources: jest.fn(),
    getGenerationStatus: jest.fn(),
    saveWorkflowDraft: jest.fn(),
    submitWorkflowReview: jest.fn(),
    pauseWorkflow: jest.fn(),
    resumeWorkflow: jest.fn(),
    getWorkflowDeliveries: jest.fn(),
    publishWorkflow: jest.fn(),
  },
  personalizedLearning: {
    pauseTeacherDelivery: jest.fn(),
    resumeTeacherDelivery: jest.fn(),
    analyzeTeacherDelivery: jest.fn(),
    listTeacherDeliveries: jest.fn(),
    bulkChangeDeliveryState: jest.fn(),
    getReminderStatus: jest.fn(),
    bulkRemindDeliveries: jest.fn(),
  },
}))

const workflow = { workflow_id: 'wf_test', state: 'WAITING_APPROVAL' }
const plan = {
  mode: 'general',
  selected_evidence: [{
    id: 'practice_summary', label: '近5次练习平均分62分', source: '练习记录',
    sample_count: 5, confidence: 'high', selected: false, available: true,
  }],
  strategy: {
    mode: 'general', summary: '按照课程主题和通用教学规则制定方案。',
    learning_sequence: ['概念讲解', '分层练习'],
  },
}

const generation = {
  workflow: { ...workflow, state: 'READY_TO_PUBLISH' },
  generation_source_label: '规则保障生成完成',
  agent_progress: {
    overall_progress: 100, stage: 'completed',
    steps: [{ resource_type: 'document', agent_name: 'local_rule_agent', status: 'completed', progress: 100, output_summary: '本地保障生成完成' }],
  },
  stages: [{ key: 'agents', order: 4, name: '各资源智能体并行生成', status: 'completed', summary: '已补齐资源' }],
  resources: { document: { title: '循环讲义', content: 'for循环和range边界。' } },
  review: {
    can_submit: true, summary: '审核通过', round_count: 1,
    rounds: [{
      changes: [], passed: true,
      structure: { passed: true, checks: [{ resource_type: 'document', status: 'passed', issues: [], item_count: 1 }] },
      semantic: { available: false, score: null, passed: true, issues: [], label: '规则审核' },
    }],
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  courses.getAll.mockResolvedValue({ courses: [{ id: 1, title: 'Python程序设计' }] })
  classManagement.getClasses.mockResolvedValue({ classes: [{ id: 2 }] })
  classManagement.getClass.mockResolvedValue({
    id: 2, name: '软件一班', courses: [{ course_id: 1 }],
    students: [{ user_id: 3, student_name: '张同学' }],
  })
  courseGeneration.suggestWorkflowKnowledgePoints.mockResolvedValue({
    source: 'ai_course_context',
    knowledge_points: [{ name: 'for循环', selected: true, source: 'ai_course_context' }, { name: 'range边界', selected: true, source: 'ai_course_context' }],
  })
  courseGeneration.previewWorkflowPlan.mockResolvedValue({ workflow, plan })
  courseGeneration.getWorkflows.mockResolvedValue({ workflows: [] })
  courseGeneration.getWorkflow.mockResolvedValue({ workflow: { ...workflow, plan, events: [] } })
  courseGeneration.generateWorkflowResources.mockResolvedValue(generation)
  courseGeneration.getGenerationStatus.mockRejectedValue({ status: 404 })
  courseGeneration.saveWorkflowDraft.mockResolvedValue({ workflow: { ...workflow, draft_config_id: 8 } })
  courseGeneration.submitWorkflowReview.mockResolvedValue({ workflow: { ...workflow, review_submitted: true } })
  courseGeneration.pauseWorkflow.mockResolvedValue({ workflow: { ...workflow, state: 'PAUSED' }, message: '工作流已暂停' })
  courseGeneration.resumeWorkflow.mockResolvedValue({ workflow, message: '工作流已恢复' })
  courseGeneration.getWorkflowDeliveries.mockResolvedValue({ deliveries: [] })
  courseGeneration.publishWorkflow.mockResolvedValue({
    delivery: { delivery_id: 'dlv_test', title: 'Python循环', status: 'PUBLISHED', progress_percentage: 0 },
    already_published: false,
  })
  personalizedLearning.listTeacherDeliveries.mockResolvedValue({
    deliveries: [], count: 0,
    pagination: { page: 1, pages: 0, total: 0, has_previous: false, has_next: false },
  })
  personalizedLearning.getReminderStatus.mockResolvedValue({
    scheduler: { enabled: false, message: '自动提醒未启用，可使用手动提醒' },
  })
  personalizedLearning.bulkRemindDeliveries.mockResolvedValue({
    requested_count: 0, created_count: 0, skipped_count: 0,
  })
})

test('restores a persisted workflow from its full detail', async () => {
  const user = userEvent.setup()
  const saved = {
    ...workflow,
    topic: '上次的Python循环',
    course_id: 1,
    class_id: 2,
    student_user_id: 3,
    payload: { knowledge_points: ['for循环'], resource_types: ['document'] },
  }
  courseGeneration.getWorkflows.mockResolvedValue({ workflows: [saved] })
  courseGeneration.getWorkflow.mockResolvedValue({
    workflow: {
      ...saved,
      plan,
      events: [{ id: 1, event_type: 'plan_created', message: '方案已保存', created_at: '2026-07-23T10:00:00' }],
    },
  })

  render(<PersonalizedTeachingWorkbench />)
  await user.click(await screen.findByRole('button', { name: '继续' }))

  await waitFor(() => expect(courseGeneration.getWorkflow).toHaveBeenCalledWith('wf_test'))
  expect(await screen.findByDisplayValue('上次的Python循环')).toBeInTheDocument()
  expect(screen.getByText('方案已保存')).toBeInTheDocument()
})

// 这个用例的耗时预算是显式放宽的，原因是它本身就是一个长链路集成测试：
// 要依次完成「选课程 → 选班级 → 选学生 → 拆分知识点 → 读取证据制定方案 →
// 确认方案生成资源」六步交互，每步都走 userEvent（内部含 act + 真实计时器），
// 再叠加十余处 findBy*/waitFor 的等待。它实测稳定落在 9~11 秒区间，
// 恰好压在 jest.config.js 的全局 testTimeout=10000 上，于是随机超时。
//
// 这不属于产品缺陷，也不是陈旧断言，而是**测试自身的运行预算问题**：
// 断言内容（"写操作只在显式动作后发生"）完全是正确且重要的，
// 只是给它 10 秒不够。因此这里单点放宽，而不是改动全局 testTimeout ——
// 全局放宽会让真正卡死的用例也一起变慢，掩盖问题。
test('runs the real first-stage workflow and writes only after explicit action', async () => {
  const user = userEvent.setup()
  render(<PersonalizedTeachingWorkbench />)

  const title = await screen.findByText('个性化教学')
  expect(title.closest('[translate="no"]')).not.toBeNull()
  await user.click(screen.getByRole('combobox', { name: '选择课程' }))
  await user.click(await screen.findByRole('option', { name: 'Python程序设计' }))

  await user.click(screen.getByRole('combobox', { name: '选择班级' }))
  await user.click(await screen.findByRole('option', { name: '软件一班' }))

  await user.click(screen.getByRole('combobox', { name: '选择学生' }))
  await user.click(await screen.findByRole('option', { name: '张同学' }))

  fireEvent.change(screen.getByPlaceholderText('例如：Python循环结构'), { target: { value: 'Python循环' } })
  await user.click(screen.getByRole('button', { name: /AI拆分知识点/ }))
  expect(await screen.findByText('range边界')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /读取证据并制定方案/ }))
  expect(await screen.findByText('通用方案')).toBeInTheDocument()
  expect(screen.getByText('近5次练习平均分62分')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /确认方案并生成资源/ }))
  expect(await screen.findByText('ReviewAgent 审核')).toBeInTheDocument()
  expect(screen.getByText('本次多 Agent 执行记录')).toBeInTheDocument()
  expect(screen.getByText('已补齐资源')).toBeInTheDocument()
  expect(screen.getByText('循环讲义')).toBeInTheDocument()
  expect(await screen.findByText('发布与学习闭环')).toBeInTheDocument()
  expect(courseGeneration.saveWorkflowDraft).not.toHaveBeenCalled()
  expect(courseGeneration.submitWorkflowReview).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: /保存为草稿/ }))
  await waitFor(() => expect(courseGeneration.saveWorkflowDraft).toHaveBeenCalledWith('wf_test'))
  await user.click(screen.getByRole('button', { name: /提交AI审核/ }))
  await waitFor(() => expect(courseGeneration.submitWorkflowReview).toHaveBeenCalledWith('wf_test'))
}, 30000)

test('publishes an automatically reviewed resource package to the selected student', async () => {
  const user = userEvent.setup()
  courseGeneration.getWorkflows.mockResolvedValue({ workflows: [{
    ...generation.workflow,
    topic: 'Python循环', course_id: 1, class_id: 2, student_user_id: 3,
    payload: { knowledge_points: ['for循环'], resource_types: ['document'] },
    plan,
    generation,
  }] })
  courseGeneration.getWorkflow.mockResolvedValue({ workflow: {
    ...generation.workflow,
    topic: 'Python循环', course_id: 1, class_id: 2, student_user_id: 3,
    payload: { knowledge_points: ['for循环'], resource_types: ['document'] },
    plan,
    generation,
  } })

  render(<PersonalizedTeachingWorkbench />)
  await user.click(await screen.findByRole('button', { name: '继续' }))
  await user.click(await screen.findByRole('button', { name: /发布给当前学生/ }))

  await waitFor(() => expect(courseGeneration.publishWorkflow).toHaveBeenCalledWith('wf_test', expect.objectContaining({
    title: 'Python循环',
  })))
  expect(await screen.findByText('任务已发布给当前学生。')).toBeInTheDocument()
  expect(screen.getByText('dlv_test')).toBeInTheDocument()
})
