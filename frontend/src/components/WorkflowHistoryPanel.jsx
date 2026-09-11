import { Clock3, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

const STATE_LABELS = {
  DRAFT: '草稿',
  WAITING_APPROVAL: '等待确认',
  GENERATING: '正在生成',
  READY_TO_PUBLISH: '可以提交',
  NEEDS_ATTENTION: '需要继续处理',
  PAUSED: '已暂停',
}

function formatTime(value) {
  if (!value) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export default function WorkflowHistoryPanel({ workflow }) {
  const events = workflow?.events || []
  if (!workflow) return null
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><History /> 工作流记录</CardTitle>
            <CardDescription>流程已持久化，服务重启后可以继续。</CardDescription>
          </div>
          <Badge variant="secondary">{STATE_LABELS[workflow.state] || workflow.state}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-72">
          <ol className="flex flex-col gap-3">
            {events.length ? events.map((event) => (
              <li key={event.id} className="grid grid-cols-[auto_1fr] gap-3 border-l-2 pl-3">
                <Clock3 className="mt-0.5 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{event.message || event.event_type}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(event.created_at)}</span>
                  </div>
                  {event.from_state !== event.to_state ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {STATE_LABELS[event.from_state] || event.from_state} → {STATE_LABELS[event.to_state] || event.to_state}
                    </p>
                  ) : null}
                </div>
              </li>
            )) : <li className="text-sm text-muted-foreground">暂无状态事件。</li>}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
