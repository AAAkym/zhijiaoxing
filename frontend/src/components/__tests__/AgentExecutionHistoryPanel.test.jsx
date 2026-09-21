import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, jest, test } from '@jest/globals'
import AgentExecutionHistoryPanel from '../AgentExecutionHistoryPanel'
import { resourceGeneration } from '@/services/api'

jest.mock('@/services/api', () => ({
  resourceGeneration: { getAgentExecutionHistory: jest.fn() },
}))

function stage(stageKey, stageLabel, ownerLabel, hasEvidence, evidenceRequired = true, matched = []) {
  return {
    stage: stageKey,
    stage_label: stageLabel,
    owner_agent: null,
    owner_label: ownerLabel,
    evidence_required: evidenceRequired,
    evidence_note: '',
    matched_agents: matched,
    has_evidence: hasEvidence,
  }
}

function historyPayload(overrides = {}) {
  return {
    window_days: 30,
    generated_at: '2026-09-22T01:00:00',
    filter: { agent_name: null },
    totals: { records: 167, success: 166, failed: 1, unknown_status: 0, avg_duration_ms: 2400 },
    agents: [
      {
        agent_name: 'coordinator',
        agent_label: '协调智能体',
        total: 96,
        success: 96,
        failed: 0,
        success_rate: 1,
        avg_duration_ms: 800,
        last_executed_at: '2026-09-22T00:50:00',
        task_types: ['generate_resource_package'],
      },
      {
        agent_name: 'media_agent',
        agent_label: '视频脚本智能体',
        total: 11,
        success: 10,
        failed: 1,
        success_rate: 0.91,
        avg_duration_ms: 68000,
        last_executed_at: '2026-09-21T22:10:00',
        task_types: [],
      },
    ],
    pipeline: {
      coverage_rate: 0.75,
      stages_with_evidence: ['profile', 'knowledge', 'strategy'],
      stages_without_evidence: ['agents'],
      stages: [
        stage('profile', '读取学生画像', '协调智能体', true, true, ['coordinator']),
        stage('knowledge', '检索课程知识库', '协调智能体', true, true, ['coordinator']),
        stage('strategy', '协调智能体制定策略', '协调智能体', true, true, ['coordinator']),
        stage('agents', '各资源智能体并行生成', '多个专业智能体', false, true),
        stage('quality', '一致性和质量检查', '协调智能体', false, false),
        stage('package', '整合个性化资源包', '协调智能体', false, false),
      ],
    },
    recent: [],
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  resourceGeneration.getAgentExecutionHistory.mockResolvedValue(historyPayload())
})

test('renders persisted execution totals and per-agent rows', async () => {
  render(<AgentExecutionHistoryPanel />)

  expect(await screen.findByText('167')).toBeInTheDocument()
  expect(screen.getByText('166')).toBeInTheDocument()
  // "协调智能体" 会同时出现在流水线阶段行与智能体表格行里，因此按表格单元格取。
  const rows = screen.getAllByRole('row')
  expect(rows.some((row) => row.textContent.includes('协调智能体'))).toBe(true)
  expect(rows.some((row) => row.textContent.includes('视频脚本智能体'))).toBe(true)
  // 68 秒必须按秒展示，而不是 68000。
  expect(screen.getByText('68.0 s')).toBeInTheDocument()
  expect(resourceGeneration.getAgentExecutionHistory).toHaveBeenCalledWith(30)
})

test('declares pipeline stages that have no execution evidence', async () => {
  render(<AgentExecutionHistoryPanel />)

  // 关键诚实性断言：没有证据的阶段必须显式点名，不能被当成"已正常运行"。
  const warning = await screen.findByText(/没有\*\*对应的执行记录/)
  expect(warning).toBeInTheDocument()
  expect(warning.textContent).toContain('各资源智能体并行生成')
  expect(screen.getByText('有证据 3 / 必需要有证据的 4 个阶段')).toBeInTheDocument()
  // 纯计算阶段必须标注"不单独产生执行记录"，避免被误读成缺口。
  expect(screen.getAllByText('不单独产生执行记录')).toHaveLength(2)
})

test('switches the statistics window and refetches', async () => {
  const user = userEvent.setup()
  render(<AgentExecutionHistoryPanel />)

  await screen.findByText('167')
  await user.click(screen.getByRole('button', { name: '近 7 天' }))

  expect(resourceGeneration.getAgentExecutionHistory).toHaveBeenLastCalledWith(7)
})

test('states plainly that an empty window proves nothing', async () => {
  resourceGeneration.getAgentExecutionHistory.mockResolvedValue(historyPayload({
    totals: { records: 0, success: 0, failed: 0, unknown_status: 0, avg_duration_ms: null },
    agents: [],
    pipeline: {
      coverage_rate: 0,
      stages_with_evidence: [],
      stages_without_evidence: ['profile', 'knowledge', 'strategy', 'agents'],
      stages: [stage('profile', '读取学生画像', '协调智能体', false, true)],
    },
    recent: [],
  }))

  render(<AgentExecutionHistoryPanel />)

  const empty = await screen.findByText(/没有任何智能体执行记录/)
  // 空态必须同时说清"不是故障"和"也不代表正常"，不能只给一句安慰。
  expect(empty.textContent).toContain('也不代表流水线正常')
})

test('degrades to one inline alert when history is unavailable', async () => {
  resourceGeneration.getAgentExecutionHistory.mockRejectedValue(new Error('history_unavailable'))

  render(<AgentExecutionHistoryPanel />)

  expect(await screen.findByText('执行历史暂时不可用')).toBeInTheDocument()
  expect(screen.getByText('history_unavailable')).toBeInTheDocument()
})

test('lists failed executions with their error message', async () => {
  resourceGeneration.getAgentExecutionHistory.mockResolvedValue(historyPayload({
    recent: [
      {
        id: 1,
        agent_name: 'media_agent',
        task_type: 'generate_video_script',
        status: 'failed',
        duration_ms: 120,
        error_message: 'Spark 超时',
        created_at: '2026-09-22T00:10:00',
      },
    ],
  }))

  render(<AgentExecutionHistoryPanel />)

  await screen.findByText('167')
  expect(screen.getByText(/最近 1 条执行明细/)).toBeInTheDocument()
  expect(screen.getByText('Spark 超时')).toBeInTheDocument()
})
