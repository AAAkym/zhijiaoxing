import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  ChevronDown,
  ChevronRight,
  Code,
  Download,
  Copy,
  Check,
  BookOpen,
  Lightbulb,
  GraduationCap,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { aiTutor } from '@/services/api'

const LAYER_CONFIG = [
  {
    key: 'basic',
    label: '基础层',
    emoji: '🟢',
    icon: Lightbulb,
    colorClass: 'border-green-200 bg-green-50/50',
    headerClass: 'text-green-700',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    desc: '日常类比，通俗易懂',
  },
  {
    key: 'advanced',
    label: '进阶层',
    emoji: '🔵',
    icon: BookOpen,
    colorClass: 'border-blue-200 bg-blue-50/50',
    headerClass: 'text-blue-700',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    desc: '定义原理，标准案例',
  },
  {
    key: 'expert',
    label: '专家层',
    emoji: '🟣',
    icon: GraduationCap,
    colorClass: 'border-purple-200 bg-purple-50/50',
    headerClass: 'text-purple-700',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    desc: '理论前沿，深度应用',
  },
]

function getInitialExpanded(mastery) {
  if (mastery >= 60) {
    return { basic: false, advanced: true, expert: false }
  }
  if (mastery < 30) {
    return { basic: true, advanced: false, expert: false }
  }
  return { basic: true, advanced: true, expert: false }
}

function TopicSuggestions({ weakPoints, recentTopics, onSelect }) {
  const [expandedIdx, setExpandedIdx] = useState(null)
  const items = []

  if (weakPoints && weakPoints.length > 0) {
    weakPoints.slice(0, 3).forEach((point) => {
      const name = typeof point === 'string' ? point : point.name || point.topic || point.point
      const mistakeCount = typeof point === 'object' ? (point.mistake_count || point.count || 0) : 0
      items.push({ label: `薄弱点: ${name}`, value: name, type: 'weak', mistakeCount, raw: point })
    })
  }

  if (recentTopics && recentTopics.length > 0) {
    recentTopics.slice(0, 3).forEach((topic) => {
      items.push({ label: `最近: ${topic}`, value: topic, type: 'recent' })
    })
  }

  if (items.length === 0) return null

  // 根据错误次数评估掌握程度
  const getMasteryLevel = (count) => {
    if (count >= 5) return { label: '掌握较差', color: 'text-red-600', bg: 'bg-red-50', desc: '该知识点错误次数较多，建议重点突破' }
    if (count >= 2) return { label: '尚需巩固', color: 'text-amber-600', bg: 'bg-amber-50', desc: '该知识点存在理解偏差，建议系统复习' }
    return { label: '基本掌握', color: 'text-green-600', bg: 'bg-green-50', desc: '该知识点偶有失误，建议针对性练习' }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              item.type === 'weak'
                ? expandedIdx === idx
                  ? 'bg-amber-200 text-amber-900 border border-amber-400'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                : expandedIdx === idx
                  ? 'bg-indigo-200 text-indigo-900 border border-indigo-400'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
            }`}
          >
            {item.type === 'weak' ? (
              <AlertCircle className="w-3 h-3" />
            ) : (
              <Search className="w-3 h-3" />
            )}
            {item.label}
            {item.type === 'weak' && item.mistakeCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-semibold">
                {item.mistakeCount}次
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${expandedIdx === idx ? 'rotate-180' : ''}`} />
          </button>
        ))}
      </div>

      {/* 展开的详情面板 */}
      {expandedIdx !== null && items[expandedIdx] && (
        <div className={`rounded-lg border p-3 ${items[expandedIdx].type === 'weak' ? 'border-amber-200 bg-amber-50/50' : 'border-indigo-200 bg-indigo-50/50'}`}>
          {items[expandedIdx].type === 'weak' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{items[expandedIdx].value}</span>
                {(() => {
                  const mastery = getMasteryLevel(items[expandedIdx].mistakeCount)
                  return (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${mastery.bg} ${mastery.color} font-medium`}>
                      {mastery.label}
                    </span>
                  )
                })()}
              </div>
              {(() => {
                const mastery = getMasteryLevel(items[expandedIdx].mistakeCount)
                return <p className="text-xs text-gray-600">{mastery.desc}</p>
              })()}
              <div className="flex items-center gap-3 text-xs text-gray-500 pt-1 border-t border-amber-200/60">
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  错误次数：<span className="font-semibold text-amber-700">{items[expandedIdx].mistakeCount}</span>
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  建议学习路径：基础概念 → 典型例题 → 进阶应用
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    onSelect(items[expandedIdx].value)
                    setExpandedIdx(null)
                  }}
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <GraduationCap className="w-3.5 h-3.5 mr-1" />
                  开始针对性学习
                </Button>
                <span className="text-[11px] text-gray-400">AI 将生成该知识点的分层讲解与练习</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{items[expandedIdx].value}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">最近学习</span>
              </div>
              <p className="text-xs text-gray-600">继续学习该主题，巩固已学内容并探索更深层次的知识点。</p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    onSelect(items[expandedIdx].value)
                    setExpandedIdx(null)
                  }}
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  继续学习
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function parseInlineFormatting(text) {
  const parts = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
    const codeMatch = remaining.match(/`(.+?)`/)

    let earliest = null
    let earliestIndex = Infinity
    let matchType = null
    let matchContent = null

    if (boldMatch && boldMatch.index < earliestIndex) {
      earliestIndex = boldMatch.index
      earliest = boldMatch
      matchType = 'bold'
      matchContent = boldMatch[1]
    }
    if (codeMatch && codeMatch.index < earliestIndex) {
      earliestIndex = codeMatch.index
      earliest = codeMatch
      matchType = 'code'
      matchContent = codeMatch[1]
    }
    if (italicMatch && italicMatch.index < earliestIndex) {
      earliestIndex = italicMatch.index
      earliest = italicMatch
      matchType = 'italic'
      matchContent = italicMatch[1]
    }

    if (!earliest) {
      parts.push(<span key={keyIdx++}>{remaining}</span>)
      break
    }

    if (earliestIndex > 0) {
      parts.push(<span key={keyIdx++}>{remaining.slice(0, earliestIndex)}</span>)
    }

    if (matchType === 'bold') {
      parts.push(<strong key={keyIdx++} className="font-semibold text-gray-900">{matchContent}</strong>)
    } else if (matchType === 'italic') {
      parts.push(<em key={keyIdx++} className="italic text-gray-600">{matchContent}</em>)
    } else if (matchType === 'code') {
      parts.push(
        <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-green-100/60 text-green-800 text-xs font-mono">
          {matchContent}
        </code>
      )
    }

    remaining = remaining.slice(earliestIndex + earliest[0].length)
  }

  return parts.length > 0 ? parts : text
}

function parseDocumentBlocks(text) {
  if (!text || typeof text !== 'string') return []

  const lines = text.split('\n')
  const blocks = []
  let currentList = null
  let listType = null

  function flushList() {
    if (currentList && currentList.length > 0) {
      blocks.push({ type: listType, items: currentList })
      currentList = null
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      flushList()
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] })
      continue
    }

    const boldHeadingMatch = trimmed.match(/^\*\*(.+?)\*\*$/)
    if (boldHeadingMatch && !trimmed.includes('**', 2)) {
      flushList()
      blocks.push({ type: 'heading', level: 3, content: boldHeadingMatch[1] })
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*•]\s+(.+)/)
    if (unorderedMatch) {
      if (listType !== 'unordered') flushList()
      listType = 'unordered'
      if (!currentList) currentList = []
      currentList.push(unorderedMatch[1])
      continue
    }

    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)/)
    if (orderedMatch) {
      if (listType !== 'ordered') flushList()
      listType = 'ordered'
      if (!currentList) currentList = []
      currentList.push(orderedMatch[1])
      continue
    }

    const defMatch = trimmed.match(/^(.{1,30}?)[：:—–]\s*(.+)/)
    if (defMatch) {
      flushList()
      blocks.push({ type: 'definition', term: defMatch[1], description: defMatch[2] })
      continue
    }

    flushList()
    blocks.push({ type: 'paragraph', content: trimmed })
  }

  flushList()
  return blocks
}

function VisualDocumentContent({ content }) {
  const blocks = React.useMemo(() => parseDocumentBlocks(content), [content])

  if (blocks.length === 0) {
    return (
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return (
              <div key={idx} className={
                block.level === 1
                  ? 'text-base font-bold text-green-800 mt-4 mb-2 pb-1 border-b border-green-200'
                  : block.level === 2
                    ? 'text-sm font-bold text-green-700 mt-3 mb-1.5'
                    : 'text-sm font-semibold text-green-600 mt-2 mb-1'
              }>
                {parseInlineFormatting(block.content)}
              </div>
            )
          case 'paragraph':
            return (
              <p key={idx} className="text-sm text-gray-700 leading-relaxed">
                {parseInlineFormatting(block.content)}
              </p>
            )
          case 'unordered':
            return (
              <ul key={idx} className="space-y-1.5 ml-1">
                {block.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                    <span className="leading-relaxed">{parseInlineFormatting(item)}</span>
                  </li>
                ))}
              </ul>
            )
          case 'ordered':
            return (
              <ol key={idx} className="space-y-1.5 ml-1">
                {block.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{parseInlineFormatting(item)}</span>
                  </li>
                ))}
              </ol>
            )
          case 'definition':
            return (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium text-xs">
                  {block.term}
                </span>
                <span className="text-gray-700 leading-relaxed">{parseInlineFormatting(block.description)}</span>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}

function CollapsibleLayer({ config, content, expanded, onToggle }) {
  const Icon = config.icon
  const contentRef = useRef(null)
  const isBasic = config.key === 'basic'

  return (
    <div className={`rounded-lg border ${config.colorClass} overflow-hidden transition-all`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
      >
        <span className="text-lg">{config.emoji}</span>
        <Icon className={`w-4 h-4 ${config.headerClass}`} />
        <span className={`text-sm font-semibold ${config.headerClass}`}>{config.label}</span>
        <Badge variant="outline" className={`text-[10px] ${config.badgeClass}`}>
          {config.desc}
        </Badge>
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? (contentRef.current?.scrollHeight || 2000) : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className={isBasic ? 'px-5 pb-5 pt-2' : 'px-4 pb-4 pt-1'}>
          {isBasic ? (
            <div className="rounded-lg bg-white/80 border border-green-100 p-4 shadow-sm">
              <VisualDocumentContent content={content} />
            </div>
          ) : (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function highlightSyntax(code, language) {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const keywords = [
    'def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif',
    'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'yield',
    'async', 'await', 'lambda', 'pass', 'break', 'continue', 'raise',
    'const', 'let', 'var', 'function', 'new', 'this', 'typeof', 'instanceof',
    'switch', 'case', 'default', 'throw', 'catch', 'interface', 'type',
    'export', 'extends', 'implements', 'static', 'void', 'null', 'undefined',
    'true', 'false', 'None', 'True', 'False', 'self', 'super',
    'public', 'private', 'protected', 'abstract', 'final', 'override',
  ]
  const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g')

  const placeholders = []
  function placeholder(match) {
    const idx = placeholders.length
    placeholders.push(match)
    return `\u0000${idx}\u0000`
  }

  html = html.replace(/(["'`])(?:(?!\1|\\).|\\.)*?\1/g, (m) => {
    return placeholder(`<span style="color:#6a9955">${m}</span>`)
  })

  html = html.replace(/\/\/.*$/gm, (m) => {
    return placeholder(`<span style="color:#6a737d">${m}</span>`)
  })
  html = html.replace(/\/\*[\s\S]*?\*\//g, (m) => {
    return placeholder(`<span style="color:#6a737d">${m}</span>`)
  })
  const isPythonLike = !language || /python|py/i.test(language)
  if (isPythonLike) {
    html = html.replace(/#.*$/gm, (m) => {
      return placeholder(`<span style="color:#6a737d">${m}</span>`)
    })
  }

  html = html.replace(keywordPattern, '<span style="color:#569cd6">$1</span>')

  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#ce9178">$1</span>')

  // eslint-disable-next-line no-control-regex
  html = html.replace(/\u0000(\d+)\u0000/g, (_, idx) => placeholders[parseInt(idx)])

  return html
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const highlighted = highlightSyntax(code, language)

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-medium">{language || 'Code'}</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              已复制
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              复制
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code
          className="text-sm text-gray-200 font-mono leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  )
}

function MermaidDiagram({ code, index }) {
  const containerRef = useRef(null)
  const [mermaidLoaded, setMermaidLoaded] = useState(false)
  const [renderError, setRenderError] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAndRender() {
      try {
        const mermaid = await import('mermaid')
        if (cancelled) return

        mermaid.default.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
        })
        setMermaidLoaded(true)

        if (containerRef.current && code) {
          const id = `mermaid-diagram-${index}-${Date.now()}`
          try {
            const { svg } = await mermaid.default.render(id, code)
            if (!cancelled && containerRef.current) {
              containerRef.current.innerHTML = svg
              setRenderError(false)
            }
          } catch (renderErr) {
            console.error('Mermaid 渲染失败:', renderErr)
            if (!cancelled) setRenderError(true)
          }
        }
      } catch (importErr) {
        console.warn('Mermaid 库加载失败:', importErr)
        if (!cancelled) setMermaidLoaded(false)
      }
    }

    if (code) {
      loadAndRender()
    }

    return () => {
      cancelled = true
    }
  }, [code, index])

  const handleExportSVG = () => {
    if (!containerRef.current) return
    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return

    const svgData = svgEl.outerHTML
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diagram-${index + 1}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPNG = async () => {
    if (!containerRef.current) return
    setExporting(true)

    try {
      const svgEl = containerRef.current.querySelector('svg')
      if (!svgEl) return

      const svgData = new XMLSerializer().serializeToString(svgEl)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = 2
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.scale(scale, scale)
        ctx.drawImage(img, 0, 0)

        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = pngUrl
            a.download = `diagram-${index + 1}.png`
            a.click()
            URL.revokeObjectURL(pngUrl)
          }
          URL.revokeObjectURL(url)
          setExporting(false)
        }, 'image/png')
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        setExporting(false)
      }
      img.src = url
    } catch {
      setExporting(false)
    }
  }

  const showRawCode = !mermaidLoaded || renderError

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">图表 {index + 1}</span>
        </div>
        {!showRawCode && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportSVG}
              className="h-7 text-xs gap-1"
            >
              <Download className="w-3 h-3" />
              导出 SVG
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportPNG}
              disabled={exporting}
              className="h-7 text-xs gap-1"
            >
              <Download className="w-3 h-3" />
              {exporting ? '导出中...' : '导出 PNG'}
            </Button>
          </div>
        )}
      </div>
      {showRawCode ? (
        <div className="p-3">
          <CodeBlock code={code} language="mermaid" />
        </div>
      ) : (
        <div ref={containerRef} className="p-4 flex justify-center overflow-x-auto" />
      )}
    </div>
  )
}

function ApplicationCase({ caseItem, index }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs font-bold text-indigo-600">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          {caseItem.scenario && (
            <p className="text-sm font-medium text-gray-800 mb-1.5">{caseItem.scenario}</p>
          )}
          {caseItem.key_points && (
            <div className="space-y-1">
              {Array.isArray(caseItem.key_points) ? (
                caseItem.key_points.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-indigo-400 mt-1.5 text-[8px]">●</span>
                    <span className="text-xs text-gray-600 leading-relaxed">{point}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-600 leading-relaxed">{caseItem.key_points}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function KnowledgeExplainer({
  courseId,
  onTopicAsked,
  weakPoints,
  recentTopics,
  onFeedback,
  feedbackLoading,
}) {
  const [topic, setTopic] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [explanation, setExplanation] = useState(null)
  const [error, setError] = useState(null)
  const [expandedLayers, setExpandedLayers] = useState({ basic: true, advanced: true, expert: false })
  const [interactionId, setInteractionId] = useState(null)

  const abortControllerRef = useRef(null)
  const resultRef = useRef(null)

  const parseSSEEvents = useCallback(async (response) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })
    let buffer = ''
    let fullContent = ''
    let respInteractionId = null

    const parseSSEMessage = (rawMessage) => {
      const lines = rawMessage.split('\n')
      const event = { id: null, event: null, data: null }
      for (const line of lines) {
        if (line.startsWith('id:')) {
          event.id = line.substring(3).trim()
        } else if (line.startsWith('event:')) {
          event.event = line.substring(6).trim()
        } else if (line.startsWith('data:')) {
          const dataStr = line.substring(5).trim()
          try {
            event.data = JSON.parse(dataStr)
          } catch {
            event.data = dataStr
          }
        }
      }
      return event
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            const evt = parseSSEMessage(buffer)
            if (evt.event === 'error') {
              throw new Error(evt.data?.error || evt.data || '知识点讲解时发生错误')
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || ''

        for (const message of messages) {
          if (!message.trim()) continue
          const evt = parseSSEMessage(message)

          if (evt.event === 'error') {
            throw new Error(evt.data?.error || evt.data || '知识点讲解时发生错误')
          }

          if (evt.event === 'done') continue

          if (evt.event === 'message' || evt.event === 'config' || evt.event === 'ping') {
            const data = evt.data
            if (data && typeof data === 'object') {
              if (data.content) {
                fullContent += data.content
                setStreamingContent(fullContent)
              }
              if (data.interaction_id) {
                respInteractionId = data.interaction_id
              }
            } else if (typeof data === 'string' && data && data !== '[DONE]') {
              fullContent += data
              setStreamingContent(fullContent)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return { fullContent, interactionId: respInteractionId }
  }, [])

  const parseExplanationResponse = useCallback((rawContent) => {
    try {
      const parsed = JSON.parse(rawContent)
      return {
        basic: parsed.basic || '',
        advanced: parsed.advanced || '',
        expert: parsed.expert || '',
        code_examples: parsed.code_examples || [],
        mermaid_diagrams: parsed.mermaid_diagrams || [],
        cases: parsed.cases || [],
        mastery: parsed.mastery ?? null,
      }
    } catch {
      return {
        basic: rawContent,
        advanced: '',
        expert: '',
        code_examples: [],
        mermaid_diagrams: [],
        cases: [],
        mastery: null,
      }
    }
  }, [])

  const handleSearch = useCallback(async (overrideTopic) => {
    const searchTopic = (overrideTopic || topic).trim()
    if (!searchTopic || isStreaming) return

    setIsStreaming(true)
    setStreamingContent('')
    setExplanation(null)
    setError(null)
    setInteractionId(null)

    try {
      abortControllerRef.current = new AbortController()

      const response = await aiTutor.explainStream({
        topic: searchTopic,
        course_id: courseId || undefined,
        _signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      const result = await parseSSEEvents(response)
      const parsed = parseExplanationResponse(result.fullContent)

      setExplanation(parsed)
      setInteractionId(result.interactionId)

      const mastery = parsed.mastery
      setExpandedLayers(getInitialExpanded(mastery ?? 40))

      if (onTopicAsked) {
        onTopicAsked(searchTopic)
      }

      resultRef.current = result
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || '获取讲解失败，请重试')
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      abortControllerRef.current = null
    }
  }, [topic, isStreaming, courseId, onTopicAsked, parseSSEEvents, parseExplanationResponse])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }, [handleSearch])

  const handleTopicSelect = useCallback((selectedTopic) => {
    setTopic(selectedTopic)
    setTimeout(() => handleSearch(selectedTopic), 0)
  }, [handleSearch])

  const toggleLayer = useCallback((key) => {
    setExpandedLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const showEmptyState = !explanation && !isStreaming && !error

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入要学习的知识点..."
              disabled={isStreaming}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300
                placeholder:text-gray-400 disabled:opacity-50 transition-colors"
            />
          </div>
          <Button
            onClick={() => handleSearch()}
            disabled={!topic.trim() || isStreaming}
            className="shrink-0 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        <TopicSuggestions
          weakPoints={weakPoints}
          recentTopics={recentTopics}
          onSelect={handleTopicSelect}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {showEmptyState && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">
              输入知识点，获取分层讲解
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              从基础到专家，逐层深入理解每个知识点
            </p>
            {weakPoints && weakPoints.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 font-medium">建议复习的薄弱点:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {weakPoints.slice(0, 4).map((point, idx) => {
                    const name = typeof point === 'string' ? point : point.name || point.topic
                    return (
                      <button
                        key={idx}
                        onClick={() => handleTopicSelect(name)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                          bg-amber-50 text-amber-700 border border-amber-200
                          hover:bg-amber-100 hover:border-amber-300 transition-colors"
                      >
                        <AlertCircle className="w-3 h-3" />
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {isStreaming && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm text-gray-500">正在生成知识点讲解...</p>
            {streamingContent && (
              <div className="mt-4 w-full max-w-lg p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-400 mb-1">实时预览</p>
                <p className="text-sm text-gray-600 line-clamp-4 whitespace-pre-wrap">{streamingContent}</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        {explanation && !isStreaming && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-3">
              {LAYER_CONFIG.map((config) => {
                const content = explanation[config.key]
                if (!content) return null
                return (
                  <CollapsibleLayer
                    key={config.key}
                    config={config}
                    content={content}
                    expanded={expandedLayers[config.key]}
                    onToggle={() => toggleLayer(config.key)}
                  />
                )
              })}
            </div>

            {explanation.code_examples && explanation.code_examples.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <Code className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">代码示例</span>
                  <Badge variant="outline" className="text-[10px]">
                    {explanation.code_examples.length} 个
                  </Badge>
                </div>
                <div className="p-3 space-y-3">
                  {explanation.code_examples.map((example, idx) => (
                    <CodeBlock
                      key={idx}
                      code={typeof example === 'string' ? example : example.code || ''}
                      language={
                        typeof example === 'string'
                          ? 'Code'
                          : example.language || 'Code'
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {explanation.mermaid_diagrams && explanation.mermaid_diagrams.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Code className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">关系图表</span>
                  <Badge variant="outline" className="text-[10px]">
                    {explanation.mermaid_diagrams.length} 个
                  </Badge>
                </div>
                {explanation.mermaid_diagrams.map((diagram, idx) => (
                  <MermaidDiagram
                    key={idx}
                    code={typeof diagram === 'string' ? diagram : diagram.code || ''}
                    index={idx}
                  />
                ))}
              </div>
            )}

            {explanation.cases && explanation.cases.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <Lightbulb className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">应用案例</span>
                  <Badge variant="outline" className="text-[10px]">
                    {explanation.cases.length} 个
                  </Badge>
                </div>
                <div className="p-3 space-y-2">
                  {explanation.cases.map((caseItem, idx) => (
                    <ApplicationCase key={idx} caseItem={caseItem} index={idx} />
                  ))}
                </div>
              </div>
            )}

            {interactionId && onFeedback && (
              <div className="flex items-center gap-2 px-1 pt-1">
                <span className="text-xs text-gray-400">本次讲解有帮助吗？</span>
                <button
                  onClick={() => onFeedback(interactionId, 'positive')}
                  disabled={feedbackLoading && feedbackLoading[`${interactionId}-positive`]}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onFeedback(interactionId, 'negative')}
                  disabled={feedbackLoading && feedbackLoading[`${interactionId}-negative`]}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
