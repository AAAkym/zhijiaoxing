import { render, screen } from '@testing-library/react'
import { expect, test } from '@jest/globals'
import ProfileExplainabilityPanel from '../ProfileExplainabilityPanel'
import AgentCollaborationProgress from '../AgentCollaborationProgress'
import GenerationCausalChain from '../GenerationCausalChain'

const explanation = {
  completeness_score: 25,
  confidence_score: 68,
  source_count: 3,
  data_sources: ['画像对话/人工设置', '练习评测', '错题记录'],
  dimensions: [
    {
      key: 'knowledge_base',
      label: '知识基础',
      display_value: '循环 62',
      confidence: 76,
      evidence: ['共完成10次练习，平均分72分', '2次编程提交通过率50%'],
      sample_count: 10,
      data_sources: ['练习评测', '错题记录'],
    },
    {
      key: 'interest_areas',
      label: '兴趣领域',
      display_value: '待积累数据',
      confidence: 0,
      evidence: ['当前证据不足，建议补充数据'],
      sample_count: 0,
      data_sources: [],
    },
  ],
  strategy_suggestions: [],
}

test('separates profile completeness from evidence confidence', () => {
  render(<ProfileExplainabilityPanel explainability={explanation} />)

  expect(screen.getByText('画像完整度')).toBeInTheDocument()
  expect(screen.getByText('证据可信度')).toBeInTheDocument()
  expect(screen.getByText('25%')).toBeInTheDocument()
  expect(screen.getByText('68%')).toBeInTheDocument()
  expect(screen.getAllByText(/证据不足/).length).toBeGreaterThan(0)
  expect(screen.getByText('共完成10次练习，平均分72分')).toBeInTheDocument()
  expect(screen.getByText('2次编程提交通过率50%')).toBeInTheDocument()
})

test('shows six-stage process and per-agent failure details', () => {
  const stages = [
    { key: 'profile', order: 1, name: '读取学生画像', status: 'completed', summary: '画像已验证' },
    { key: 'knowledge', order: 2, name: '检索课程知识库', status: 'skipped', summary: '未启用RAG' },
    { key: 'strategy', order: 3, name: '协调智能体制定策略', status: 'completed' },
    { key: 'agents', order: 4, name: '各资源智能体并行生成', status: 'partial' },
    { key: 'quality', order: 5, name: '一致性和质量检查', status: 'completed' },
    { key: 'package', order: 6, name: '整合个性化资源包', status: 'completed' },
  ]
  const progress = {
    overall_progress: 100,
    stage: 'completed',
    steps: [{
      resource_type: 'media',
      agent_name: 'media_agent',
      task_type: 'generate_video_script',
      status: 'failed',
      progress: 0,
      profile_features: ['认知风格：视觉型'],
      knowledge_summary: '循环结构',
      error_reason: 'Spark 服务暂不可用',
      duration_ms: 1200,
    }],
  }

  render(<AgentCollaborationProgress progress={progress} stages={stages} autoPoll={false} />)

  expect(screen.getByText('1. 读取学生画像')).toBeInTheDocument()
  expect(screen.getByText('2. 检索课程知识库')).toBeInTheDocument()
  expect(screen.getByText('未启用RAG')).toBeInTheDocument()
  expect(screen.getByText('认知风格：视觉型')).toBeInTheDocument()
  expect(screen.getByText('原因：Spark 服务暂不可用')).toBeInTheDocument()
})

test('shows evidence judgement action and concrete resource adaptation', () => {
  render(
    <GenerationCausalChain
      explanation={{
        causal_chain: [{
          evidence: ['2次编程提交中，语法薄弱1次'],
          judgement: '编程薄弱模式：语法1次',
          generation_action: '增加代码纠错示例和分步调试',
          affected_resources: ['document'],
        }],
      }}
      resources={{
        document: {
          profile_adaptation_explanation: '文档增加语法错误对照和逐行调试步骤。',
        },
      }}
    />
  )

  expect(screen.getByText('原始证据')).toBeInTheDocument()
  expect(screen.getByText('2次编程提交中，语法薄弱1次')).toBeInTheDocument()
  expect(screen.getByText('编程薄弱模式：语法1次')).toBeInTheDocument()
  expect(screen.getByText('增加代码纠错示例和分步调试')).toBeInTheDocument()
  expect(screen.getByText('文档增加语法错误对照和逐行调试步骤。')).toBeInTheDocument()
})
