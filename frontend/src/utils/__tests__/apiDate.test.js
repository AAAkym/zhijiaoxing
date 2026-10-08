import { parseApiDate, formatApiDate, formatApiDateTime } from '../apiDate'

describe('apiDate 后端时间解析', () => {
  test('裸 UTC 字符串按 UTC 解析（本地时区 UTC+8 时前进 8 小时）', () => {
    const date = parseApiDate('2026-10-05T18:33:00')
    expect(date).not.toBeNull()
    // 无论测试机时区如何，绝对时刻必须等于 18:33Z
    expect(date.toISOString()).toBe('2026-10-05T18:33:00.000Z')
  })

  test('已带时区标记的字符串不受影响', () => {
    expect(parseApiDate('2026-10-05T18:33:00Z').toISOString()).toBe('2026-10-05T18:33:00.000Z')
    expect(parseApiDate('2026-10-05T18:33:00+08:00').toISOString()).toBe('2026-10-05T10:33:00.000Z')
  })

  test('微秒精度（isoformat 六位小数）可解析', () => {
    const date = parseApiDate('2026-09-19T13:26:00.997430')
    expect(date.toISOString()).toBe('2026-09-19T13:26:00.997Z')
  })

  test('空值与非法输入返回 null', () => {
    expect(parseApiDate(null)).toBeNull()
    expect(parseApiDate('')).toBeNull()
    expect(parseApiDate('not-a-date')).toBeNull()
    expect(parseApiDate(undefined)).toBeNull()
  })

  test('Date 实例原样通过', () => {
    const now = new Date()
    expect(parseApiDate(now)).toBe(now)
  })

  test('formatApiDate 输出本地日期（UTC+8 下裸 UTC 字符串跨日进位）', () => {
    // 18:33Z 在 UTC+8 是次日 02:33
    expect(formatApiDate('2026-10-05T18:33:00')).toMatch(/^2026\/10\/0[56]$/)
  })

  test('formatApiDateTime 对空值返回 "-"', () => {
    expect(formatApiDateTime(null)).toBe('-')
    expect(formatApiDateTime('')).toBe('-')
  })
})
