import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, jest, test } from '@jest/globals'
import ResourceBasisPanel from '../ResourceBasisPanel'

const sufficiencyBasis = {
  resource_type: 'document',
  resource_label: '讲解文档',
  basis_id: 'basis_document',
  profile_evidence: [
    {
      dimension_key: 'cognitive_style',
      dimension_label: '认知风格',
      judgement: '视觉型',
      confidence: 82,
      low_confidence: false,
      evidence: ['画像对话确认偏好图示讲解'],
      sample_count: 3,
      data_sources: ['profile_dialog'],
      updated_at: '2026-09-01T08:00:00',
    },
    {
      dimension_key: 'knowledge_base',
      dimension_label: '知识基础',
      judgement: '递归薄弱',
      confidence: 41,
      low_confidence: true,
      evidence: ['练习题均分 52 分'],
      sample_count: 2,
      data_sources: ['practice'],
      updated_at: '2026-09-02T08:00:00',
    },
  ],
  mistake_evidence: [
    {
      mistake_id: 91,
      knowledge_point: '递归边界',
      error_type: '边界条件遗漏',
      mistake_count: 3,
      last_mistake_at: '2026-09-03T08:00:00',
      mastery_status: 'unmastered',
      question_excerpt: '计算 factorial(0) 的返回值...',
      user_answer: 'return n * factorial(n - 1)',
      correct_answer: 'return 1',
    },
  ],
  knowledge_evidence: [
    {
      node_id: 77,
      label: '递归边界',
      chapter_title: '第3章 函数与递归',
      is_weak: true,
      mastery: 0.32,
      citation_ids: ['KP77'],
    },
  ],
  next_step: {
    action: '先用 3 道边界条件的短练习补齐证据',
    source: 'learning_cycle',
    learning_sequence: ['边界条件识别', '短练习', '证据复核'],
    remaining_problems: ['边界条件遗漏'],
    prerequisite_chain: ['函数定义', '递归调用'],
  },
  quality: {
    overall_score: 86.5,
    citation_coverage_score: 92,
    verification_status: 'passed',
    dimensions: {
      coverage: { score: 88, label: '覆盖率', basis: '命中目标知识点', suggestion: '保持' },
      difficulty: { score: 84, label: '难度', basis: '按学习节奏估算', suggestion: '保持' },
      factuality: { score: 86, label: '事实性', basis: '引用校验通过', suggestion: '保持' },
      citation_integrity: { score: 90, label: '引用完整性', basis: '引用来源完整', suggestion: '保持' },
    },
  },
  gaps: [],
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('renders profile, mistake, knowledge, next-step and quality evidence for the resource', async () => {
  const user = userEvent.setup()
  render(<ResourceBasisPanel basis={sufficiencyBasis} resourceType="document" />)

  expect(screen.getByRole('region', { name: '生成依据链' })).toBeInTheDocument()
  expect(screen.getByText('视觉型')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /错题来源/ }))
  expect(await screen.findByText(/factorial\(0\)/)).toBeInTheDocument()
  expect(screen.getByText('正确答案：return 1')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /知识图谱位置/ }))
  expect(await screen.findByText('第3章 函数与递归 · 掌握度 32%')).toBeInTheDocument()
  expect(screen.getByText('薄弱知识点')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /接下来学什么/ }))
  expect(await screen.findByText('先用 3 道边界条件的短练习补齐证据')).toBeInTheDocument()
  expect(screen.getByText('2. 短练习')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /质量评分/ }))
  expect(await screen.findByText('综合 86.5/100')).toBeInTheDocument()
})

test('flags low-confidence dimensions instead of presenting them as certain', async () => {
  const user = userEvent.setup()
  render(<ResourceBasisPanel basis={sufficiencyBasis} resourceType="document" />)

  expect(screen.getByText('低可信 41%')).toBeInTheDocument()
  expect(screen.getByText('可信度 82%')).toBeInTheDocument()
  expect(screen.queryByText('可信度 41%')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /质量评分/ }))
  expect(await screen.findByText('覆盖率')).toBeInTheDocument()
  expect(screen.getByText('88/100')).toBeInTheDocument()
})

test('never shows citation coverage for media or ppt resources', async () => {
  const user = userEvent.setup()
  render(<ResourceBasisPanel basis={sufficiencyBasis} resourceType="media" />)

  await user.click(screen.getByRole('button', { name: /质量评分/ }))
  expect(await screen.findByText(/不附加知识库引用/)).toBeInTheDocument()
  expect(screen.queryByText(/引用覆盖率 92/)).not.toBeInTheDocument()
})

test('shows citation coverage and verification status for citable resources', async () => {
  const user = userEvent.setup()
  render(<ResourceBasisPanel basis={sufficiencyBasis} resourceType="document" />)

  await user.click(screen.getByRole('button', { name: /质量评分/ }))
  expect(await screen.findByText('引用覆盖率 92 · 核验状态 passed')).toBeInTheDocument()
  expect(screen.queryByText(/不附加知识库引用/)).not.toBeInTheDocument()
})

test('states insufficiency with the existing fallback wording rather than inventing evidence', async () => {
  const user = userEvent.setup()
  const basis = {
    ...sufficiencyBasis,
    profile_evidence: [
      {
        dimension_key: 'knowledge_base',
        dimension_label: '知识基础',
        judgement: '待积累数据',
        confidence: 0,
        low_confidence: true,
        evidence: ['当前证据不足，建议通过画像对话或更多学习活动补充数据'],
        sample_count: 0,
        data_sources: [],
        updated_at: null,
      },
    ],
    mistake_evidence: [],
    knowledge_evidence: [],
    next_step: { action: null, source: null, learning_sequence: [], remaining_problems: [], prerequisite_chain: [] },
    quality: { overall_score: null, citation_coverage_score: null, verification_status: null, dimensions: {} },
    gaps: [
      { kind: 'missing_mistake_detail', message: '只有聚合错题计数，缺少可追溯的错题明细' },
      { kind: 'missing_learning_cycle', message: '尚无下一轮学习策略' },
    ],
  }
  render(<ResourceBasisPanel basis={basis} resourceType="document" />)

  expect(screen.getByText('当前证据不足，建议通过画像对话或更多学习活动补充数据')).toBeInTheDocument()
  expect(screen.getByText(/错题明细缺失/)).toBeInTheDocument()
  expect(screen.getByText(/尚无下一轮策略/)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /错题来源/ }))
  expect(await screen.findByText('本轮未关联到具体错题记录。')).toBeInTheDocument()
})

test('degrades to a single line when the basis API fails, without hiding the resource', () => {
  render(<ResourceBasisPanel basis={null} resourceType="document" error={new Error('basis_unavailable')} />)

  expect(screen.getByText('依据信息暂时不可用')).toBeInTheDocument()
  expect(screen.getByText(/资源正文仍可正常阅读/)).toBeInTheDocument()
})

test('jumps to the knowledge graph through the provided callback', async () => {
  const user = userEvent.setup()
  const onOpenKnowledgeGraph = jest.fn()
  render(
    <ResourceBasisPanel
      basis={sufficiencyBasis}
      resourceType="document"
      onOpenKnowledgeGraph={onOpenKnowledgeGraph}
    />
  )

  await user.click(screen.getByRole('button', { name: /知识图谱位置/ }))
  await user.click(await screen.findByRole('button', { name: /在知识图谱中查看/ }))
  expect(onOpenKnowledgeGraph).toHaveBeenCalledWith(
    expect.objectContaining({ label: '递归边界', node_id: 77 })
  )
})

test('collapses a section with the Escape key and returns focus to its trigger', async () => {
  const user = userEvent.setup()
  render(<ResourceBasisPanel basis={sufficiencyBasis} resourceType="document" />)

  const trigger = screen.getByRole('button', { name: /画像依据/ })
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('region', { name: /画像依据/ })).toBeInTheDocument()

  await user.click(trigger)
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))

  await user.click(trigger)
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
  trigger.focus()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  expect(trigger).toHaveFocus()
})
