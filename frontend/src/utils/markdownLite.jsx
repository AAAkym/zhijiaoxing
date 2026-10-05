import React from 'react'

// 轻量 Markdown 渲染（零依赖）。
//
// 为什么不用 marked / react-markdown：引入新的第三方依赖需要人工批准（CLAUDE.md 架构冻结），
// 而 AI 导师回复里实际出现的语法只有有限几类（标题、粗体、行内代码、列表、围栏代码块）。
// 本组件与 CourseLearningPage 内联的轻量渲染器同思路，抽为共享工具供多处复用。
//
// 能力边界（刻意保持最小）：
//   - ATX 标题（# ~ ###，兼容 "## 标题 ##" 这种带闭合井号的写法）
//   - **粗体**、`行内代码`
//   - "- " 与 "1. " 列表（相邻行合并为一个列表）
//   - ``` 围栏代码块
//   - 引用（> ）
//   - 其余行按普通段落渲染；流式输出中途的残缺语法按普通文本显示，不会抛错。
//
// 安全性：不使用 dangerouslySetInnerHTML，全部输出 React 元素，文本内容天然转义。

const HEADING_RE = /^(#{1,4})\s*(.+?)\s*#*\s*$/
const BULLET_RE = /^[-*]\s+(.*)$/
const ORDERED_RE = /^\d+[.、]\s+(.*)$/
// 星火模型常把 "####一、xxx" 这样的标题记号当行内分隔符（前后无换行）。
// 连续 2~4 个 # 且紧跟非空白字符时，按行内小节标记处理；"C#" 这类单井号不受影响。
const INLINE_HEADING_RE = /#{2,4}(?=[^#\s])/

function renderInlineText(text, keyPrefix) {
  // 先按行内标题记号切段，再做粗体/行内代码渲染。
  // 消费式扫描：把 "####" 整段吃掉并吞掉紧随的多余 #，避免零宽切分残留孤井号。
  const segments = []
  let rest = text
  let isHeadingSegment = false
  while (rest) {
    const m = rest.match(INLINE_HEADING_RE)
    if (!m) {
      segments.push({ heading: isHeadingSegment, text: rest })
      break
    }
    if (m.index > 0) segments.push({ heading: isHeadingSegment, text: rest.slice(0, m.index) })
    rest = rest.slice(m.index + m[0].length).replace(/^#+/, '')
    isHeadingSegment = true
  }
  return segments.map((segment, k) => {
    const key = `${keyPrefix}-s${k}`
    if (segment.heading) {
      return (
        <strong key={key} className="font-semibold">
          {renderInline(segment.text, key)}
        </strong>
      )
    }
    return <React.Fragment key={key}>{renderInline(segment.text, key)}</React.Fragment>
  })
}

function renderInline(text, keyPrefix) {
  if (!text) return null
  // 按 **粗体** 与 `行内代码` 切分；正则的捕获组保证分隔符留在结果里
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="px-1 py-0.5 mx-0.5 rounded bg-black/10 text-[0.85em] font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <React.Fragment key={key}>{part}</React.Fragment>
  })
}

function parseBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let paragraph = []
  let codeBlock = null

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraph })
      paragraph = []
    }
  }

  for (const line of lines) {
    if (codeBlock !== null) {
      // 围栏代码块内容原样保留，直到遇到闭合 ```
      if (line.trim().startsWith('```')) {
        blocks.push({ type: 'code', lines: codeBlock })
        codeBlock = null
      } else {
        codeBlock.push(line)
      }
      continue
    }
    if (line.trim().startsWith('```')) {
      flushParagraph()
      codeBlock = []
      continue
    }
    if (!line.trim()) {
      flushParagraph()
      continue
    }
    paragraph.push(line)
  }
  if (codeBlock !== null) {
    // 流式输出中代码块尚未闭合，也先渲染出来
    blocks.push({ type: 'code', lines: codeBlock })
  }
  flushParagraph()
  return blocks
}

// 相邻的列表行归为一组，让 <ul>/<ol> 正常成组
function groupListItems(blocks) {
  const grouped = []
  for (const block of blocks) {
    if (block.type !== 'paragraph') {
      grouped.push(block)
      continue
    }
    const items = []
    for (const line of block.lines) {
      const bullet = line.trim().match(BULLET_RE)
      const ordered = line.trim().match(ORDERED_RE)
      if (bullet) items.push({ kind: 'bullet', text: bullet[1] })
      else if (ordered) items.push({ kind: 'ordered', text: ordered[1] })
      else items.push({ kind: 'text', text: line })
    }
    const runs = []
    for (const item of items) {
      const last = runs[runs.length - 1]
      if (item.kind !== 'text' && last && last.kind === item.kind) {
        last.items.push(item.text)
      } else {
        runs.push(
          item.kind === 'text'
            ? { kind: 'text', text: item.text }
            : { kind: item.kind, items: [item.text] },
        )
      }
    }
    for (const run of runs) {
      if (run.kind === 'bullet') grouped.push({ type: 'ul', items: run.items })
      else if (run.kind === 'ordered') grouped.push({ type: 'ol', items: run.items })
      else grouped.push({ type: 'line', text: run.text })
    }
  }
  return grouped
}

export function MarkdownLite({ text, className = '' }) {
  if (!text) return null
  const blocks = groupListItems(parseBlocks(text))
  return (
    <div className={`leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        const key = `block-${i}`
        switch (block.type) {
          case 'code':
            return (
              <pre
                key={key}
                className="my-1.5 px-2.5 py-2 rounded-md bg-gray-900 text-gray-50 text-xs overflow-x-auto whitespace-pre font-mono"
              >
                {block.lines.join('\n')}
              </pre>
            )
          case 'ul':
            return (
              <ul key={key} className="my-1 space-y-0.5 list-disc pl-5">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInlineText(item, `${key}-${j}`)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={key} className="my-1 space-y-0.5 list-decimal pl-5">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInlineText(item, `${key}-${j}`)}</li>
                ))}
              </ol>
            )
          default: {
            const heading = block.text.trim().match(HEADING_RE)
            if (heading) {
              const level = heading[1].length
              const size =
                level <= 1 ? 'text-base font-bold' : level === 2 ? 'text-sm font-bold' : 'text-sm font-semibold'
              return (
                <div key={key} className={`${size} mt-1.5 mb-0.5`}>
                  {renderInlineText(heading[2], key)}
                </div>
              )
            }
            if (block.text.trim().startsWith('> ')) {
              return (
                <div key={key} className="my-1 pl-2.5 border-l-2 border-gray-300 text-gray-600 italic">
                  {renderInlineText(block.text.trim().slice(2), key)}
                </div>
              )
            }
            return <div key={key}>{renderInlineText(block.text, key)}</div>
          }
        }
      })}
    </div>
  )
}

export default MarkdownLite
