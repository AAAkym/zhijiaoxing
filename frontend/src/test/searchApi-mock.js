import { jest } from '@jest/globals'

// searchApi 的共享 mock 模块。
//
// 为什么需要它（2026-09-22 巡检发现）：
// jest.config.js 里 '^@/(.*)$' -> '<rootDir>/src/$1' 这条 moduleNameMapper 会在
// **mock 解析之前**生效，因此测试里写 vi.mock('@/services/searchApi', factory)
// 时，工厂函数会被整体忽略，模块仍然解析到真实实现。结果是
// searchApi.search 不是 mock 函数，mockResolvedValueOnce 报
// "is not a function"，17 个用例全红 —— 这些套件因此被 testPathIgnorePatterns
// 静默禁用。
//
// 仓库既有的解法是 src/test/api-mock.js：moduleNameMapper 把 '@/services/api'
// 直接指向一个**mock 模块**，测试通过 import 拿到同一份 mock 再配置行为。
// 本文件对 searchApi 采用完全相同的做法，与 api-mock.js 保持同一风格。

const mockFn = (value = {}) => jest.fn(() => Promise.resolve(value))

export const searchApi = {
  search: mockFn({
    results: [],
    total: 0,
    page: 1,
    per_page: 20,
    total_pages: 0,
    response_time_ms: 50,
  }),
  getSuggestions: mockFn({ suggestions: [] }),
  autocomplete: mockFn({ suggestions: [] }),
  getRelated: mockFn({ related: [] }),
  getHotSearches: mockFn({ hot_searches: [] }),
  recordClick: mockFn({ success: true }),
  getHistory: mockFn({ history: [] }),
  clearHistory: mockFn({ success: true }),
  getAnalytics: mockFn({}),
}

export default { searchApi }
