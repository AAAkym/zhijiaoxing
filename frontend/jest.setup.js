import React from 'react'
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'util'

global.React = React
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.vi = jest

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// 真实可用的 localStorage / sessionStorage 替身。
//
// 原先这里是一个"哑"桩：getItem 永远返回 null、setItem 直接丢弃。
// 后果是任何断言"写进去的东西读得出来"的测试都**永远不可能通过**，
// 而那些用例正是被 jest.config.js 的 testPathIgnorePatterns 静默排除的那批。
// 用内存实现替换后，组件写入的历史记录、偏好等都能被测试真实观察到。
const createStorageStub = () => {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
}

Object.defineProperty(window, 'localStorage', {
  value: createStorageStub(),
  writable: true,
})

Object.defineProperty(window, 'sessionStorage', {
  value: createStorageStub(),
  writable: true,
})

Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
})

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
  })
)

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver
window.ResizeObserver = MockResizeObserver

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

Object.defineProperties(Element.prototype, {
  hasPointerCapture: { value: jest.fn(() => false) },
  setPointerCapture: { value: jest.fn() },
  releasePointerCapture: { value: jest.fn() },
  scrollIntoView: { value: jest.fn() },
})

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
  useParams: () => ({}),
}))

// lucide-react 的图标替身。
//
// 这里**故意不逐个列出图标名**：原先是一份约 90 个图标的白名单，任何组件用到
// 名单之外的图标（例如 Download）都会解构出 undefined，React 抛
// "Element type is invalid ... but got: undefined"，而失败信息完全指不到根因。
// 改用 Proxy 兜底：任何被访问的图标名都返回一个可渲染的占位组件，
// 同时保留几个有 data-testid 的常用图标，方便既有测试按 testid 查询。
const ICON_TESTIDS = {
  Search: "search-icon",
  User: "user-icon",
  Menu: "menu-icon",
  X: "x-icon",
  Loader2: "loader-icon",
  ChevronLeft: "chevron-left-icon",
  ChevronRight: "chevron-right-icon",
  Star: "star-icon",
  Clock: "clock-icon",
  TrendingUp: "trending-up-icon",
  SearchX: "search-x-icon",
}

jest.mock('lucide-react', () => {
  const makeIcon = (name) => {
    const Icon = (props) => <svg data-testid={ICON_TESTIDS[name] || 'icon-' + name} {...props} />
    Icon.displayName = name
    return Icon
  }

  const cache = new Map()
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined
        // 兼容 '__esModule' 之类的探测，交给默认行为处理。
        if (prop === '__esModule') return true
        if (prop === 'default') return undefined
        if (!cache.has(prop)) cache.set(prop, makeIcon(prop))
        return cache.get(prop)
      },
    }
  )
})

const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// wordcloud（timdream）依赖真实 canvas 2d 上下文，jsdom 中不存在；
// 测试里以替身渲染词文本，便于断言（替身默认可用，R2-DEF-004 教训）。
jest.mock('wordcloud', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: jest.fn(() => null),
  }
})

// @excalidraw/excalidraw 是 ESM 大依赖且强依赖真实 DOM/canvas，jsdom 跑不了；
// 以替身渲染占位 div，保证白板 tab 渲染路径可测（默认可用原则）。
jest.mock('@excalidraw/excalidraw', () => {
  const React = require('react')
  return {
    __esModule: true,
    Excalidraw: jest.fn((props) => {
      if (props && typeof props.excalidrawAPI === 'function') props.excalidrawAPI({ updateScene: jest.fn() })
      return React.createElement('div', { 'data-testid': 'excalidraw-stub' })
    }),
  }
})
