import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { personalizedLearning } from '@/services/api'

const TYPE_LABELS = {
  published: '新任务', due_soon: '即将截止', overdue: '已逾期', paused: '已暂停',
  resumed: '已恢复', manual_reminder: '教师提醒', next_cycle_ready: '下一轮已就绪',
}

export default function PersonalizedNotificationCenter({ onOpenTask }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await personalizedLearning.getStudentNotifications({ page: 1, page_size: 8 })
      setNotifications(response.notifications || [])
      setUnreadCount(response.unread_count || 0)
    } catch (loadError) {
      setError(`通知暂时无法读取：${loadError.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openNotification = async (item) => {
    if (!item.is_read) {
      try {
        await personalizedLearning.markStudentNotificationRead(item.id)
        setNotifications((current) => current.map((value) => value.id === item.id ? { ...value, is_read: true } : value))
        setUnreadCount((current) => Math.max(0, current - 1))
      } catch (markError) {
        setError(`通知状态未能更新：${markError.message}`)
      }
    }
    if (typeof onOpenTask === 'function') onOpenTask(item.delivery_id)
  }

  const markAllRead = async () => {
    try {
      await personalizedLearning.markAllStudentNotificationsRead()
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
      setUnreadCount(0)
    } catch (markError) {
      setError(`暂时无法全部标为已读：${markError.message}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><Clock /> 任务通知</CardTitle><CardDescription>发布、截止、暂停、恢复和下一轮学习状态。</CardDescription></div>
          <div className="flex items-center gap-2"><Badge variant={unreadCount ? 'default' : 'outline'}>{unreadCount} 条未读</Badge><Button variant="outline" size="icon" title="刷新通知" onClick={load}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>通知服务提示</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        {loading ? <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" />正在读取通知</div> : null}
        {!loading && !notifications.length ? <p className="py-6 text-center text-sm text-muted-foreground">目前没有任务通知</p> : null}
        {!loading ? notifications.map((item) => (
          <button key={item.id} type="button" className="flex w-full items-start gap-3 border-b py-3 text-left last:border-b-0" onClick={() => openNotification(item)}>
            <CheckCircle2 className={item.is_read ? 'mt-0.5 text-muted-foreground' : 'mt-0.5 text-primary'} />
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{item.title}</span><Badge variant="outline">{TYPE_LABELS[item.notification_type] || item.notification_type}</Badge></span><span className="mt-1 block text-sm text-muted-foreground">{item.content}</span></span>
          </button>
        )) : null}
        {unreadCount ? <div className="flex justify-end"><Button variant="outline" onClick={markAllRead}>全部标为已读</Button></div> : null}
      </CardContent>
    </Card>
  )
}
