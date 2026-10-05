// 后端 API 时间字段的统一解析与格式化。
//
// 为什么需要它：后端模型的时间列是 datetime.utcnow()（裸 UTC）+ isoformat()，
// 产物形如 "2026-10-05T18:33:00.997430" —— 没有任何时区标记。
// 浏览器 new Date() 会把这种字符串按**本地时区**解析，对 UTC+8 的用户
// 所有时间都会显示慢 8 小时（日期也经常错一天）。
//
// 约定：本工具只做「无时区标记的字符串按 UTC 解析」这一件事；
// 已带 Z 或 ±hh:mm 的字符串交给原生解析；空值返回 null。
// 修正后端契约（输出带时区）需要人工批准，在此之前前端一律走这里。

const NAIVE_ISO_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/

export function parseApiDate(value) {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!NAIVE_ISO_RE.test(trimmed)) {
    const parsed = new Date(trimmed)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)
  const parsed = new Date(hasTimezone ? trimmed : `${trimmed}Z`)
  return isNaN(parsed.getTime()) ? null : parsed
}

export function formatApiDateTime(value) {
  const date = parseApiDate(value)
  if (!date) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatApiDate(value) {
  const date = parseApiDate(value)
  if (!date) return '-'
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
