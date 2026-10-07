import React, { lazy, Suspense, useRef, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import websocketService from '../services/websocket'
import '@excalidraw/excalidraw/index.css'

// 丰富化 T7：Excalidraw 体积大（压缩后 ~1MB 级），React.lazy 拆出独立 chunk，
// 仅在打开白板 tab 时加载；测试环境由 jest.setup.js 替身接管（默认可用原则）。
const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then((m) => ({ default: m.Excalidraw }))
)

export default function WhiteboardPanel({ courseId }) {
  const apiRef = useRef(null)
  const lastSentRef = useRef('')
  const lastFireRef = useRef(0)
  const pendingRef = useRef(null)
  const timerRef = useRef(null)

  // 对端画布更新：后端转发时带 course_id/sender_id；include_self=False 已挡掉
  // 发送端回声，这里再用 lastSent 指纹防御一次（跨面板重复订阅等边缘情况）。
  useEffect(() => {
    if (!courseId) return undefined
    const handleRemote = (data) => {
      if (!data || data.course_id !== courseId || !Array.isArray(data.elements)) return
      const fingerprint = JSON.stringify(data.elements)
      if (fingerprint === lastSentRef.current) return
      apiRef.current?.updateScene({ elements: data.elements })
    }
    websocketService.on('whiteboard_updated', handleRemote)
    return () => websocketService.off('whiteboard_updated', handleRemote)
  }, [courseId])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // 节流 500ms（前沿+尾沿）：拖动绘图高频触发 onChange，尾沿保证最后
  // 一笔不丢；无实际变化时按指纹跳过，避免无意义推送。
  const handleChange = useCallback((elements) => {
    if (!courseId) return
    pendingRef.current = elements
    const fire = () => {
      const els = pendingRef.current
      pendingRef.current = null
      if (!els) return
      const fingerprint = JSON.stringify(els)
      if (fingerprint === lastSentRef.current) return
      lastSentRef.current = fingerprint
      lastFireRef.current = Date.now()
      websocketService.sendWhiteboardSync(courseId, els)
    }
    const elapsed = Date.now() - lastFireRef.current
    if (elapsed >= 500) {
      fire()
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        fire()
      }, 500 - elapsed)
    }
  }, [courseId])

  if (!courseId) {
    return <p className="text-sm text-gray-400 text-center py-8">选择课程后启用实时白板</p>
  }

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />白板加载中…
          </div>
        }
      >
        <Excalidraw
          excalidrawAPI={(api) => { apiRef.current = api }}
          onChange={handleChange}
        />
      </Suspense>
    </div>
  )
}
