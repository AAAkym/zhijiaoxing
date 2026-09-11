import { cleanup, render, screen } from '@testing-library/react'
import WorkflowResourcePreview from '../WorkflowResourcePreview'

const resources = {
  document: {
    citation_coverage_score: 82,
    citations: [{ source_id: 'S1', title: '课程大纲', location: '第1章', excerpt: '这段引用不应成为讲义正文。' }],
    title: 'Python 循环讲义',
    summary: '从生活中的重复任务理解循环。',
    sections: [{ title: 'for 循环', key_points: ['range 的结束值不包含在结果中'], content: 'for 循环适合遍历已知序列。' }],
    profile_adaptation_explanation: '根据学生的边界错误，增加结束值对照。',
  },
  layered_exercise: {
    title: '循环分层练习',
    levels: {
      basic: { label: '基础巩固', exercises: [{ id: 'q1', type: '选择题', question: 'range(3) 会产生几个数？', options: ['2个', '3个'], answer: '3个' }] },
      advanced: { label: '综合挑战', exercises: [{ id: 'q2', question: '编写九九乘法表。', hint: '使用嵌套循环' }] },
    },
  },
  media: { title: '循环视频', scenes: [{ scene_id: 1, stage: '讲解', duration_seconds: 30, narration: '先观察重复动作。', visual_description: '逐行高亮代码' }] },
  ppt: { title: '循环课件', slides: [{ title: '学习目标', bullets: ['理解 for 循环', '掌握 range'] }] },
  project: { title: '成绩统计器', description: '用循环统计成绩。', steps: ['读取成绩', '计算平均分'], acceptance_criteria: ['正确处理空列表'] },
  recommendation: { title: '学习推荐', resources: [{ title: '循环动画演示', type: '交互资源', reason: '适合视觉学习' }] },
}

test('renders document content instead of raw metadata JSON', () => {
  render(<WorkflowResourcePreview resources={resources} sourceLabel="AI生成" />)
  expect(screen.getByText('Python 循环讲义')).toBeInTheDocument()
  expect(screen.getByText('for 循环适合遍历已知序列。')).toBeInTheDocument()
  expect(screen.getByText('查看生成依据（1 条）')).toBeInTheDocument()
  expect(screen.queryByText(/"citation_coverage_score"/)).not.toBeInTheDocument()
  expect(document.querySelector('[data-resource-format="document"]')).toBeInTheDocument()
})

test('renders every resource type with its teaching-specific structure', () => {
  render(<WorkflowResourcePreview resources={{ layered_exercise: resources.layered_exercise }} sourceLabel="AI生成" />)
  expect(document.body).toHaveTextContent('range(3) 会产生几个数？')
  expect(document.querySelector('[data-resource-format="layered-exercise"]')).toBeInTheDocument()

  cleanup()
  render(<WorkflowResourcePreview resources={{ media: resources.media }} sourceLabel="AI生成" />)
  expect(screen.getByText('先观察重复动作。')).toBeInTheDocument()

  cleanup()
  render(<WorkflowResourcePreview resources={{ ppt: resources.ppt }} sourceLabel="AI生成" />)
  expect(screen.getByText('理解 for 循环')).toBeInTheDocument()

  cleanup()
  render(<WorkflowResourcePreview resources={{ project: resources.project }} sourceLabel="AI生成" />)
  expect(screen.getByText(/读取成绩/)).toBeInTheDocument()

  cleanup()
  render(<WorkflowResourcePreview resources={{ recommendation: resources.recommendation }} sourceLabel="AI生成" />)
  expect(document.body).toHaveTextContent('循环动画演示')
})

test('parses legacy JSON-string resources without exposing JSON syntax', () => {
  const legacy = JSON.stringify({ title: '旧讲义', content: '这是旧工作流保存的正文。', citations: [{ source_id: 'S2', title: '教材' }] })
  render(<WorkflowResourcePreview resources={{ document: legacy }} sourceLabel="历史结果" />)
  expect(screen.getByText('这是旧工作流保存的正文。')).toBeInTheDocument()
  expect(screen.queryByText(/"citations"/)).not.toBeInTheDocument()
})
