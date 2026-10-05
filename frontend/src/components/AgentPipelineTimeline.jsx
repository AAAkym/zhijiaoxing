import { useMemo } from 'react'
import { Users, Timer, Layers } from 'lucide-react'
import { formatApiDateTime } from '@/utils/apiDate'

// 多智能体协作流水线时间线（G2-01）。
//
// 数据来源：/agents/history 的 recent 持久化执行记录（agent_execution_logs）。
// 思想仿自 LangGraph Studio / Langfuse trace 的"一次运行为一组、按智能体分行、
// 按耗时画条"的甘特式呈现，用项目自身的 Tailwind 语言重写，零新依赖。
//
// 诚实边界：时间线只画真实落库的执行记录（起点 created_at、时长 duration_ms），
// 结束时刻由二者推得；不做任何"补间/估算"的假条。

const BATCH_GAP_MS = 5 * 60 * 1000 // 相邻记录间隔超过 5 分钟视为不同协作批次
const MAX_BATCHES = 2 // 默认只展开最近两个批次，避免长列表淹没重点
const MIN_TIMELINE_MS = 1000 // 时间轴下限，防止单条亚秒记录把比例尺挤爆

function formatClock(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${rest}s`
}

function shortClock(iso) {
  const d = formatApiDateTime(iso)
  // formatApiDateTime 形如 "2026/10/6 03:31:24"，时间线刻度只取时分秒
  const match = /(\d{1,2}:\d{2}:\d{2})/.exec(d)
  return match ? match[1] : d
}

/** 把按时间倒序的记录聚类为协作批次（正序返回，最新的批次排在最后）。 */
export function clusterBatches(records) {
  const ordered = [...records]
    .filter(r => r && r.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const batches = []
  for (const record of ordered) {
    const start = new Date(record.created_at).getTime()
    const last = batches[batches.length - 1]
    if (!last || start - last.end > BATCH_GAP_MS) {
      batches.push({ start, end: start, records: [record] })
    } else {
      last.end = Math.max(last.end, start + (record.duration_ms || 0))
      last.records.push(record)
    }
  }
  return batches
}

// 前端对生成状态的轮询心跳（如 get_generation_status）会以 0ms 记录落库，
// 画在耗时时间线上是一排无意义的噪点条；过滤后必须在卡片上注明排除数量。
const HEARTBEAT_THRESHOLD_MS = 100

function isHeartbeat(record) {
  return (record.duration_ms || 0) < HEARTBEAT_THRESHOLD_MS
}

function BatchCard({ batch, agentLabels, index }) {
  const windowMs = Math.max(batch.end - batch.start, MIN_TIMELINE_MS)
  const agentNames = useMemo(() => {
    const seen = []
    for (const record of batch.records) {
      if (!seen.includes(record.agent_name)) seen.push(record.agent_name)
    }
    return seen
  }, [batch])
  const totalMs = batch.records.reduce((sum, r) => sum + (r.duration_ms || 0), 0)
  const failed = batch.records.filter(r => r.status !== 'success').length

  return (
    <div className="rounded-lg border bg-white/60 p-3" data-testid="pipeline-batch">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Layers className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
          协作批次 · {formatApiDateTime(new Date(batch.start).toISOString())}
          {index === 0 ? <span className="text-xs font-normal text-muted-foreground">（最近一次）</span> : null}
        </p>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {agentNames.length} 个智能体
          </span>
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" aria-hidden="true" />
            累计耗时 {formatClock(totalMs)}
          </span>
          {failed ? <span className="font-medium text-destructive">{failed} 条失败</span> : null}
        </p>
      </div>

      <div className="min-w-[560px] space-y-1 overflow-x-auto">
        {/* 时间轴刻度 */}
        <div className="flex pl-[136px] text-[10px] text-muted-foreground">
          <span className="w-0">{shortClock(new Date(batch.start).toISOString())}</span>
          <span className="flex-1 text-center">{formatClock(windowMs)}</span>
          <span className="w-0">{shortClock(new Date(batch.end).toISOString())}</span>
        </div>
        {agentNames.map((name) => {
          const rows = batch.records.filter(r => r.agent_name === name)
          return (
            <div key={name} className="flex items-center gap-2" data-testid="pipeline-lane">
              <div className="w-[128px] shrink-0 truncate text-right text-xs">
                <span className="font-medium">{agentLabels[name] || name}</span>
              </div>
              <div className="relative h-5 flex-1 rounded bg-muted/40">
                {rows.map((record) => {
                  const start = new Date(record.created_at).getTime()
                  const duration = Math.max(record.duration_ms || MIN_TIMELINE_MS, 200)
                  const left = ((start - batch.start) / windowMs) * 100
                  const width = Math.min((duration / windowMs) * 100, 100 - left)
                  const ok = record.status === 'success'
                  return (
                    <div
                      key={record.id}
                      title={`${agentLabels[name] || name} · ${record.task_type || '未标注任务'} · ${formatClock(record.duration_ms)} · ${ok ? '成功' : '失败'}`}
                      aria-label={`${agentLabels[name] || name} ${record.task_type || ''} ${formatClock(record.duration_ms)} ${ok ? '成功' : '失败'}`}
                      className={`absolute top-0.5 h-4 rounded-sm ${ok ? 'bg-emerald-500/80' : 'bg-red-500/80'}`}
                      style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                    />
                  )
                })}
              </div>
              <div className="w-[64px] shrink-0 text-right text-[10px] text-muted-foreground">
                {formatClock(rows.reduce((s, r) => s + (r.duration_ms || 0), 0))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 协作流水线时间线：把最近的执行记录按"协作批次"聚类，甘特式呈现
 * 各智能体在一次生成中的参与时段与耗时。
 */
export default function AgentPipelineTimeline({ recent = [], agentLabels = {} }) {
  const { batches, heartbeatCount } = useMemo(() => {
    const work = recent.filter(r => !isHeartbeat(r))
    return {
      batches: clusterBatches(work),
      heartbeatCount: recent.length - work.length,
    }
  }, [recent])
  if (!batches.length) return null
  const shown = batches.slice(-MAX_BATCHES).reverse() // 最新的在最上面

  return (
    <div className="space-y-3" data-testid="agent-pipeline-timeline">
      <div>
        <p className="text-sm font-medium">协作流水线时间线</p>
        <p className="text-xs text-muted-foreground">
          把持久化执行记录按时间聚类为「协作批次」：每一行是一个智能体，条形长度对应该次执行的真实耗时。
          这是 agent_execution_logs 里的真实记录，不是示意动画。
          {heartbeatCount > 0
            ? ` 已排除 ${heartbeatCount} 条耗时可忽略的状态轮询记录（<${HEARTBEAT_THRESHOLD_MS}ms）。`
            : ''}
        </p>
      </div>
      {shown.map((batch, i) => (
        <BatchCard key={batch.start} batch={batch} agentLabels={agentLabels} index={i} />
      ))}
      {batches.length > shown.length ? (
        <p className="text-xs text-muted-foreground">
          还有更早的 {batches.length - shown.length} 个批次未展开，可在下方执行明细里查看。
        </p>
      ) : null}
    </div>
  )
}
