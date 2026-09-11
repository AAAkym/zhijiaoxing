import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, jest, test } from '@jest/globals'
import PersonalizationComparisonDemo from '../PersonalizationComparisonDemo'
import { courseGeneration } from '@/services/api'

jest.mock('@/services/api', () => ({
  courseGeneration: {
    previewComparisonDemoPlan: jest.fn(),
    generateComparisonDemo: jest.fn(),
  },
}))

const makeCase = (id, name, evidence, feature, action) => ({
  id,
  name,
  short_name: name.slice(0, 3),
  description: `${name}画像说明`,
  explainability: {
    confidence_score: 75,
    dimensions: [
      { key: 'knowledge_base', label: '知识基础', display_value: 'for循环 60', evidence: [evidence] },
      { key: 'error_patterns', label: '易错模式', display_value: feature, evidence: [evidence] },
      { key: 'learning_pace', label: '学习节奏', display_value: '偏慢', evidence: ['近期练习支持该判断'] },
      { key: 'cognitive_style', label: '认知风格', display_value: '视觉型', evidence: ['画像对话确认'] },
    ],
  },
  strategy: {
    mappings: [{ feature, action, evidence: [evidence], judgement: feature, affected_resources: ['document'] }],
  },
})

const plan = {
  data_notice: '以下为比赛示例画像。',
  cases: [
    makeCase('visual_consolidation', '学生A · 视觉巩固型', '2次编程提交通过率50%', '编程薄弱模式：语法1次', '增加错误代码对照'),
    makeCase('engineering_practice', '学生B · 工程实践型', '5次编程提交通过率80%', '编程薄弱模式：逻辑2次', '增加边界测试项目'),
  ],
  dimension_differences: [{ key: 'error_patterns', label: '易错模式', left: '语法错误', right: '逻辑错误' }],
}

const makeResult = profileCase => ({
  generation_source_label: '本地保障生成完成',
  resources: {
    document: {
      title: `${profileCase.name}讲解文档`,
      sections: [{ title: profileCase.id === 'visual_consolidation' ? '错误代码对照' : '工程边界规则', content: '内容' }],
      profile_adaptation_explanation: `${profileCase.name}适配说明`,
    },
    exercise: { title: '练习', exercises: [] },
    project: { title: '项目', steps: [], acceptance_criteria: [] },
  },
  generation_explanation: {
    causal_chain: profileCase.strategy.mappings.map(item => ({
      evidence: item.evidence,
      judgement: item.judgement,
      generation_action: item.action,
    })),
  },
})

test('previews two evidence-backed strategies before generating complete resources', async () => {
  courseGeneration.previewComparisonDemoPlan.mockResolvedValue(plan)
  courseGeneration.generateComparisonDemo.mockImplementation(({ preset_id }) => {
    const profileCase = plan.cases.find(item => item.id === preset_id)
    return Promise.resolve(makeResult(profileCase))
  })

  render(<PersonalizationComparisonDemo />)

  fireEvent.click(screen.getByRole('button', { name: /生成策略预览/ }))
  expect((await screen.findAllByText('2次编程提交通过率50%')).length).toBeGreaterThan(0)
  expect(screen.getAllByText('5次编程提交通过率80%').length).toBeGreaterThan(0)
  expect(screen.getByText('增加错误代码对照')).toBeInTheDocument()
  expect(screen.getByText('增加边界测试项目')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /生成两套资源/ }))

  await waitFor(() => expect(courseGeneration.generateComparisonDemo).toHaveBeenCalledTimes(2))
  expect(await screen.findByText('错误代码对照')).toBeInTheDocument()
  expect(screen.getByText('工程边界规则')).toBeInTheDocument()
  expect(screen.getAllByText('本地保障生成完成')).toHaveLength(2)
})
