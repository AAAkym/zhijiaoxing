import { useEffect, useRef } from 'react'
import WordCloudLib from 'wordcloud'

// 知识点词云（丰富化 T1）。
// 为什么自己包一层：react-wordcloud 已 5 年未更新，在 React 19 + Vite 下
// 模块级崩溃；wordcloud（timdream，UMD、零依赖、canvas 渲染）更稳，
// 30 行薄包装即可满足需求。
//
// 容器必须要有确定宽高（canvas 按容器尺寸绘制），由父组件保证。

export default function KnowledgeWordCloud({ words = [], height = 220 }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  const wordsKey = JSON.stringify(words)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const list = JSON.parse(wordsKey)
    if (!canvas || !container || !list.length) return

    let cancelled = false
    // 双帧 + 尺寸校验：面板随父组件数据刷新会重挂载，
    // 刚插入 DOM 时 clientWidth 可能还是 0，此时画必然得到空画布
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        const width = container.clientWidth
        if (width < 100) return
        canvas.width = width
        canvas.height = height

        window.__wcDebug = { called: true, width, words: list.length, fnType: typeof WordCloudLib }
        WordCloudLib(canvas, {
          list: list.map(w => [w.text, w.value]),
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontWeight: 600,
          color: (word, weight, fontSize) => {
            // 错题越多字号越大、颜色越深：从浅到深映射风险等级
            const palette = ['#93c5fd', '#60a5fa', '#3b82f6', '#f59e0b', '#ef4444', '#b91c1c']
            const idx = Math.min(palette.length - 1, Math.floor((fontSize / 46) * palette.length))
            return palette[idx]
          },
          minSize: 10,
          gridSize: 6,
          weightFactor: size => {
            const max = Math.max(...list.map(w => w.value), 1)
            return 12 + (size / max) * 34
          },
          rotateRatio: 0.25,
          shuffle: false,
          backgroundColor: '#ffffff',
          clearCanvas: true,
        })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
    }
    // 依赖用序列化 key：words 每次渲染都是新数组引用，
    // 若直接依赖 words，effect 会被反复触发，clearCanvas 会把
    // 逐帧绘制中的词云不断清掉，表现为永远空白
  }, [wordsKey, height])

  if (!words.length) return null

  return (
    <div ref={containerRef} className="mb-4 rounded-lg border bg-white" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label="知识点错题词云" />
    </div>
  )
}
