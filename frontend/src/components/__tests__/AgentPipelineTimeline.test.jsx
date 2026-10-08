import { render, screen } from '@testing-library/react'
import AgentPipelineTimeline, { clusterBatches } from '../AgentPipelineTimeline'

const T0 = '2026-09-01T08:00:00' // 裸 UTC 串（与后端 isoformat 一致）

function rec(id, agentName, offsetSec, durationMs, taskType = 'personalized_package') {
  const d = new Date(new Date(T0 + 'Z').getTime() + offsetSec * 1000)
  // 模拟后端返回的裸 UTC isoformat（无时区标记）
  return {
    id,
    agent_name: agentName,
    task_type: taskType,
    status: 'success',
    duration_ms: durationMs,
    created_at: d.toISOString().replace('Z', '').slice(0, 19),
  }
}

describe('clusterBatches 批次聚类', () => {
  test('相邻 5 分钟内的记录归为同一批次，超间隔切分', () => {
    const records = [
      rec(1, 'coordinator', 0, 2000),
      rec(2, 'document_agent', 10, 30000),
      // 距上一条 10 分钟 → 新批次
      rec(3, 'coordinator', 10 * 60, 2000),
    ]
    const batches = clusterBatches(records)
    expect(batches).toHaveLength(2)
    expect(batches[0].records).toHaveLength(2)
    expect(batches[1].records).toHaveLength(1)
    // 批次终点应包含记录时长：末条记录 start=10s、时长 30s → end = 40s
    expect(batches[0].end - batches[0].start).toBe(40000)
  })

  test('乱序输入也能正确聚类', () => {
    const records = [rec(2, 'document_agent', 10, 1000), rec(1, 'coordinator', 0, 1000)]
    const batches = clusterBatches(records)
    expect(batches).toHaveLength(1)
    expect(batches[0].records.map(r => r.id)).toEqual([1, 2])
  })

  test('空输入返回空数组', () => {
    expect(clusterBatches([])).toHaveLength(0)
  })
})

describe('AgentPipelineTimeline 渲染', () => {
  const records = [
    rec(1, 'coordinator', 0, 2000),
    rec(2, 'document_agent', 5, 30000),
    rec(3, 'exercise_agent', 8, 20000),
  ]
  const labels = { coordinator: '协调智能体', document_agent: '文档智能体', exercise_agent: '习题智能体' }

  test('渲染泳道与耗时条，泳道名用可读标签', () => {
    render(<AgentPipelineTimeline recent={records} agentLabels={labels} />)
    expect(screen.getByTestId('agent-pipeline-timeline')).toBeInTheDocument()
    expect(screen.getByText('协调智能体')).toBeInTheDocument()
    expect(screen.getByText('文档智能体')).toBeInTheDocument()
    expect(screen.getByText('习题智能体')).toBeInTheDocument()
    // 三个批次泳道（同一批次内三个 agent）
    expect(screen.getAllByTestId('pipeline-lane')).toHaveLength(3)
    // 累计耗时 52s 出现在批次头部
    expect(screen.getByText(/累计耗时/)).toBeInTheDocument()
  })

  test('空记录不渲染任何内容', () => {
    const { container } = render(<AgentPipelineTimeline recent={[]} agentLabels={{}} />)
    expect(container.querySelector('[data-testid="agent-pipeline-timeline"]')).toBeNull()
  })

  test('失败记录标注失败数', () => {
    const failed = [{ ...rec(9, 'media_agent', 0, 5000), status: 'error' }]
    render(<AgentPipelineTimeline recent={failed} agentLabels={{ media_agent: '媒体智能体' }} />)
    expect(screen.getByText(/1 条失败/)).toBeInTheDocument()
  })
})
