import { useState, useEffect, useCallback, useRef } from 'react'
import { courseGeneration } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const STATUS_LABELS = {
  pending: '等待中',
  saving: '保存中',
  saved: '已保存',
  syncing: '同步中',
  synced: '已同步',
  failed: '失败',
  retrying: '重试中',
}

const STATUS_COLORS = {
  pending: 'text-gray-500',
  saving: 'text-blue-500',
  saved: 'text-blue-600',
  syncing: 'text-yellow-600',
  synced: 'text-green-600',
  failed: 'text-red-600',
  retrying: 'text-orange-500',
}

const STATUS_BG = {
  pending: 'bg-gray-50 border-gray-200',
  saving: 'bg-blue-50 border-blue-200',
  saved: 'bg-blue-50 border-blue-200',
  syncing: 'bg-yellow-50 border-yellow-200',
  synced: 'bg-green-50 border-green-200',
  failed: 'bg-red-50 border-red-200',
  retrying: 'bg-orange-50 border-orange-200',
}

const TYPE_LABELS = {
  document: '文档',
  mindmap: '思维导图',
  project: '代码实操',
  recommendation: '拓展推荐',
  exercise: '练习题',
  media: '教学视频脚本',
}

function StatusIcon({ status }) {
  switch (status) {
    case 'synced':
      return <span className="text-green-500">&#10003;</span>
    case 'failed':
      return <span className="text-red-500">&#10007;</span>
    case 'saving':
    case 'syncing':
    case 'retrying':
      return <span className="animate-spin inline-block">&#9696;</span>
    default:
      return <span className="text-gray-400">&#9679;</span>
  }
}

export default function ContentSaveSyncPanel({
  courseId,
  resources,
  topic,
  onComplete,
  onError,
}) {
  const [saveFormat, setSaveFormat] = useState('both')
  const [packageId, setPackageId] = useState(null)
  const [syncRecords, setSyncRecords] = useState({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [overallStatus, setOverallStatus] = useState('idle')
  const [error, setError] = useState(null)
  const pollRef = useRef(null)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const contentTypes = Object.keys(resources || {}).filter(
    k => resources[k] && ['document', 'mindmap', 'project', 'recommendation', 'exercise', 'media'].includes(k)
  )

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollSyncStatus = useCallback(async (pid) => {
    try {
      const summary = await courseGeneration.getPackageSyncSummary(pid)
      if (!summary) return

      const records = {}
      for (const r of summary.records || []) {
        records[r.content_type] = r
      }
      setSyncRecords(records)

      const allDone = Object.values(records).every(
        r => r.sync_status === 'synced' || r.sync_status === 'failed'
      )

      if (allDone) {
        stopPolling()
        setIsProcessing(false)

        const hasFailure = Object.values(records).some(r => r.sync_status === 'failed')
        setOverallStatus(hasFailure ? 'partial' : 'synced')
        if (onCompleteRef.current) onCompleteRef.current(summary)
      }
    } catch (err) {
      console.error('Poll sync status error:', err)
    }
  }, [stopPolling])

  const startPolling = useCallback((pid) => {
    stopPolling()
    pollRef.current = setInterval(() => pollSyncStatus(pid), 2000)
  }, [pollSyncStatus, stopPolling])

  const handleSaveAndSync = useCallback(async () => {
    if (!courseId || contentTypes.length === 0) return

    setIsProcessing(true)
    setOverallStatus('saving')
    setError(null)
    setSyncRecords({})

    try {
      const result = await courseGeneration.batchSaveAndSync({
        course_id: courseId,
        resources,
        topic,
        save_format: saveFormat,
      })

      const pid = result.package_id
      setPackageId(pid)

      const initialRecords = {}
      if (result.results) {
        for (const r of result.results) {
          if (r.content_type) {
            initialRecords[r.content_type] = r
          }
        }
      }
      setSyncRecords(initialRecords)
      setOverallStatus('syncing')

      startPolling(pid)
    } catch (err) {
      setError(err.message || '保存失败')
      setOverallStatus('failed')
      setIsProcessing(false)
      if (onErrorRef.current) onErrorRef.current(err)
    }
  }, [courseId, resources, topic, saveFormat, contentTypes, startPolling])

  const handleRetry = useCallback(async (recordId, contentType) => {
    try {
      const result = await courseGeneration.retrySync(recordId)
      if (result.error) {
        setSyncRecords(prev => ({
          ...prev,
          [contentType]: { ...prev[contentType], sync_error: result.error },
        }))
        return
      }
      setSyncRecords(prev => ({
        ...prev,
        [contentType]: { ...prev[contentType], sync_status: 'retrying', sync_error: null },
      }))
      if (!pollRef.current && packageId) {
        startPolling(packageId)
      }
    } catch (err) {
      console.error('Retry error:', err)
    }
  }, [packageId, startPolling])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const allSynced = overallStatus === 'synced'
  const hasFailure = overallStatus === 'partial' || overallStatus === 'failed'

  const overallProgress = contentTypes.length > 0
    ? Math.round(
        contentTypes.reduce((sum, ct) => {
          const rec = syncRecords[ct]
          return sum + (rec?.sync_progress || 0)
        }, 0) / contentTypes.length
      )
    : 0

  return (
    <div className="border rounded-lg bg-white">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">保存与同步</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          将生成的内容保存并同步到学生端课程
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-gray-600 shrink-0">保存格式：</span>
          <div className="flex gap-2">
            {[
              { value: 'json', label: 'JSON' },
              { value: 'markdown', label: 'Markdown' },
              { value: 'both', label: 'JSON + Markdown' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => !isProcessing && setSaveFormat(opt.value)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  saveFormat === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">待保存内容</span>
            <span className="text-xs text-gray-400">{contentTypes.length} 项</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {contentTypes.map(ct => (
              <span
                key={ct}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
                  STATUS_BG[syncRecords[ct]?.sync_status || 'pending']
                }`}
              >
                <StatusIcon status={syncRecords[ct]?.sync_status || 'pending'} />
                {TYPE_LABELS[ct] || ct}
              </span>
            ))}
          </div>
        </div>

        {isProcessing && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {overallStatus === 'saving' ? '正在保存...' : '正在同步到学生端...'}
              </span>
              <span className="text-xs font-medium text-blue-600">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-1.5" />
          </div>
        )}

        {contentTypes.map(ct => {
          const rec = syncRecords[ct]
          if (!rec) return null
          return (
            <div
              key={ct}
              className={`p-2.5 rounded border text-xs ${STATUS_BG[rec.sync_status]}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={rec.sync_status} />
                  <span className="font-medium">{TYPE_LABELS[ct] || ct}</span>
                  <span className={STATUS_COLORS[rec.sync_status]}>
                    {STATUS_LABELS[rec.sync_status] || rec.sync_status}
                  </span>
                </div>
                {rec.sync_status === 'failed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => handleRetry(rec.id, ct)}
                    disabled={rec.retry_count >= (rec.max_retries || 3)}
                  >
                    {rec.retry_count >= (rec.max_retries || 3) ? '已达重试上限' : '重试'}
                  </Button>
                )}
              </div>
              {rec.sync_error && (
                <p className="mt-1 text-red-600 break-all">{rec.sync_error}</p>
              )}
              {rec.sync_status === 'synced' && (
                <p className="mt-0.5 text-green-600">
                  已同步到学生端课程 &middot; {rec.synced_at ? new Date(rec.synced_at).toLocaleTimeString() : ''}
                </p>
              )}
              {rec.retry_count > 0 && rec.sync_status !== 'synced' && (
                <p className="mt-0.5 text-gray-400">
                  已重试 {rec.retry_count}/{rec.max_retries || 3} 次
                </p>
              )}
            </div>
          )
        })}

        {error && (
          <div className="p-2.5 rounded border bg-red-50 border-red-200 text-xs text-red-600">
            <p className="font-medium">保存失败</p>
            <p className="mt-0.5 break-all">{error}</p>
          </div>
        )}

        {allSynced && (
          <div className="p-2.5 rounded border bg-green-50 border-green-200 text-xs text-green-700">
            <p className="font-medium">&#10003; 全部内容已保存并同步到学生端</p>
            <p className="mt-0.5 text-green-500">
              学生可在课程页面查看最新内容
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleSaveAndSync}
            disabled={isProcessing || contentTypes.length === 0 || !courseId}
          >
            {isProcessing
              ? overallStatus === 'saving'
                ? '保存中...'
                : '同步中...'
              : '保存并同步到学生端'}
          </Button>
          {hasFailure && !isProcessing && packageId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const failedTypes = contentTypes.filter(
                  ct => syncRecords[ct]?.sync_status === 'failed'
                )
                failedTypes.forEach(ct => {
                  const rec = syncRecords[ct]
                  if (rec) handleRetry(rec.id, ct)
                })
              }}
            >
              重试全部失败项
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
