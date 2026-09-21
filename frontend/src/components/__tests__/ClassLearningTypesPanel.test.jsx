import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, jest, test } from '@jest/globals'
import ClassLearningTypesPanel from '../ClassLearningTypesPanel'
import { classManagement } from '@/services/api'

jest.mock('@/services/api', () => ({
  classManagement: {
    getClassLearningGroups: jest.fn(),
  },
}))

const overview = {
  class_id: 7,
  course_id: 3,
  student_count: 5,
  grouped_count: 3,
  ungrouped_count: 2,
  grouping_method: 'rule_based_dominant_dimension',
  groups: [
    {
      learning_type: '视觉型 · 递归 · 应试导向',
      student_count: 3,
      students: [
        { student_user_id: 11, student_name: '张三' },
        { student_user_id: 12, student_name: '李四' },
        { student_user_id: 13, student_name: '王五' },
      ],
      common_weak_points: [
        {
          knowledge_point: '递归边界',
          student_count: 2,
          average_mastery: 38,
          mistake_count: 4,
          evidence: '2 名学生画像与错题记录',
        },
      ],
      remediation_plan: [
        {
          action: 'remediation_exercise',
          knowledge_point: '递归边界',
          resource_type: '分层练习',
          reason: '组内平均掌握度低于 60',
        },
      ],
    },
    {
      learning_type: '混合型',
      student_count: 2,
      merge_reason: 'less_than_two_students',
      students: [
        { student_user_id: 14, student_name: '赵六' },
        { student_user_id: 15, student_name: '钱七' },
      ],
      common_weak_points: [],
      remediation_plan: [],
    },
  ],
  ungrouped_students: [
    { student_user_id: 16, student_name: '孙八', reason: 'evidence_insufficient', completeness_score: 25, confidence_score: 38 },
  ],
  gaps: [
    { kind: 'missing_mistake_detail', message: '只有聚合错题计数，缺少可追溯的错题明细' },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
  classManagement.getClassLearningGroups.mockResolvedValue(overview)
})

/**
 * 分组卡片在下一次点击前保持展开（用户点击驱动，不受 jest restoreMocks 影响）。
 */
async function assertExpandableRegion(user, header) {
  const trigger = await screen.findByRole('button', header)
  const panelId = trigger.getAttribute('aria-controls')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await user.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const panel = document.getElementById(panelId)
  expect(panel).not.toBeNull()
  return panel
}

async function assertCollapsesWithEscape(user, header) {
  const trigger = await screen.findByRole('button', header)
  trigger.focus()
  expect(trigger).toHaveFocus()
  await user.keyboard('{Escape}')
  const collapsed = await screen.findByRole('button', header)
  expect(collapsed).toHaveAttribute('aria-expanded', 'false')
  expect(collapsed).toHaveFocus()
}

test('loads the class learning groups for the selected class', async () => {
  render(<ClassLearningTypesPanel classId={7} courses={[{ id: 3, title: 'Python 程序设计' }]} />)

  await waitFor(() => expect(classManagement.getClassLearningGroups).toHaveBeenCalledWith(7, undefined))
  expect(await screen.findByText('视觉型 · 递归 · 应试导向')).toBeInTheDocument()
  expect(screen.getByText('混合型')).toBeInTheDocument()
})

test('shows headcounts and requests the chosen course', async () => {
  const user = userEvent.setup()
  render(<ClassLearningTypesPanel classId={7} courses={[{ id: 3, title: 'Python 程序设计' }]} />)

  expect(await screen.findByText(/共 5 名学生/)).toBeInTheDocument()
  expect(screen.getByText(/已分组 3 人/)).toBeInTheDocument()
  expect(screen.getByText(/未分组 2 人/)).toBeInTheDocument()

  await user.click(screen.getByRole('combobox', { name: '选择课程' }))
  await user.click(await screen.findByRole('option', { name: 'Python 程序设计' }))

  await waitFor(() => expect(classManagement.getClassLearningGroups).toHaveBeenLastCalledWith(7, '3'))
})

test('expands a group to reveal members, weak points and remediation', async () => {
  const user = userEvent.setup()
  render(<ClassLearningTypesPanel classId={7} />)
  const header = { name: /视觉型 · 递归 · 应试导向/ }
  const panel = await assertExpandableRegion(user, header)
  expect(within(panel).getByText('张三')).toBeInTheDocument()
  expect(within(panel).getByText('递归边界')).toBeInTheDocument()
  expect(within(panel).getByText(/2 人薄弱 · 平均掌握度 38/)).toBeInTheDocument()
  expect(within(panel).getByText('补救练习')).toBeInTheDocument()
  await assertCollapsesWithEscape(user, header)
})

test('merges small groups and lists students who could not be grouped', async () => {
  const user = userEvent.setup()
  render(<ClassLearningTypesPanel classId={7} />)
  const trigger = await screen.findByRole('button', { name: /混合型/ })
  // 合并原因展示在分组标题上，学生展开前即可看到。
  expect(within(trigger).getByText('人数不足两人，已并入混合型')).toBeInTheDocument()

  const panel = await assertExpandableRegion(user, { name: /混合型/ })
  expect(within(panel).getByText('赵六')).toBeInTheDocument()

  expect(screen.getByText(/孙八 · 完整度 25 · 可信度 38/)).toBeInTheDocument()
  expect(screen.getByText(/建议先补充画像/)).toBeInTheDocument()
})

test('declares data gaps instead of inventing group detail', async () => {
  render(<ClassLearningTypesPanel classId={7} />)

  expect(await screen.findByText(/错题明细缺失/)).toBeInTheDocument()
  expect(await screen.findByText(/只有聚合错题计数/)).toBeInTheDocument()
})

test('degrades to one inline message when grouping is unavailable', async () => {
  classManagement.getClassLearningGroups.mockRejectedValue(new Error('无权查看该班级分组'))
  render(<ClassLearningTypesPanel classId={7} />)

  expect(await screen.findByText('分组暂时不可用')).toBeInTheDocument()
  expect(screen.getByText('无权查看该班级分组')).toBeInTheDocument()
})

test('renders nothing without a selected class', () => {
  const { container } = render(<ClassLearningTypesPanel classId={null} />)
  expect(container).toBeEmptyDOMElement()
  expect(classManagement.getClassLearningGroups).not.toHaveBeenCalled()
})
