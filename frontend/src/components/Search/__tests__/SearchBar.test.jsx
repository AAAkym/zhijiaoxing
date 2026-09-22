import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../SearchBar'
// searchApi 由 jest.config.js 的 moduleNameMapper 指向共享 mock 模块
// src/test/searchApi-mock.js。**不要**在这里写 vi.mock(...) 工厂：
// moduleNameMapper 先于 mock 解析生效，工厂会被整体忽略（见该文件顶部说明）。
// 直接从 mock 模块 import，然后在 beforeEach 里配置行为。
import { searchApi } from '@/services/searchApi'

// 这些是"热门搜索"用的默认建议。jest.config.js 开了 resetMocks，
// 共享 mock 里 jest.fn(impl) 的实现会在每个用例前被清掉，因此必须在这里重设，
// 否则下拉框永远是空的，相关用例会以"找不到文本"的形式失败。
const DEFAULT_SUGGESTIONS = [
  { text: '数据结构', count: 120 },
  { text: '算法导论', count: 98 },
]

/**
 * 匹配被 <mark> 拆开的高亮文本。
 * 组件会把命中的关键词包进 <mark>，因此 "Python入门" 在 DOM 中形如
 * <mark>Pyt</mark>hon入门，普通的 getByText 无法匹配跨节点文本。
 */
function assertSuggestionText(fullText) {
  return (content, element) => {
    if (!element) return false
    const normalized = (element.textContent || '').replace(/\s+/g, '')
    return normalized === fullText.replace(/\s+/g, '')
  }
}

describe('SearchBar', () => {
  const mockOnSearch = vi.fn()
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    searchApi.getSuggestions.mockResolvedValue({ suggestions: DEFAULT_SUGGESTIONS })
    searchApi.autocomplete.mockResolvedValue({ suggestions: [] })
  })

  // 组件对输入做了 300ms 防抖，但**卸载时没有清掉这个定时器**（已登记为 BUG-E，
  // 本轮只记录不修）。后果是：上一个用例结束时挂起的定时器会在下一个用例里触发，
  // 向上一个（已卸载的）组件发起请求，污染下一个用例的 mock 调用记录 ——
  // 表现为"明明只输入了一次，却被调用两次"。
  //
  // 这里在用例收尾时先把挂起的防抖窗口等过去，让定时器在本用例内自行消耗掉，
  // 从而保证用例之间互不干扰。这是测试侧的正确隔离手段，不是掩盖问题：
  // 真正的缺陷（缺 cleanup）已单独登记。
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    // 二次让出：确保 lint/React 的微任务队列也排空，避免残留任务跨用例。
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  test('renders search input with placeholder', () => {
    render(<SearchBar placeholder="Search courses..." />)
    
    expect(screen.getByPlaceholderText('Search courses...')).toBeInTheDocument()
  })

  test('renders search type selector', () => {
    render(<SearchBar />)
    
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('all')
  })

  test('allows typing in search input', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'Python')
    
    expect(input).toHaveValue('Python')
  })

  test('shows dropdown on focus', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    await waitFor(() => {
      expect(screen.getByText('热门搜索')).toBeInTheDocument()
    })
  })

  test('calls onSearch when Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'Python{enter}')
    
    expect(mockOnSearch).toHaveBeenCalledWith({
      query: 'Python',
      type: 'all',
    })
  })

  test('shows autocomplete suggestions', async () => {
    searchApi.autocomplete.mockResolvedValueOnce({
      suggestions: [
        { text: 'Python入门', type: 'courses', score: 10 },
        { text: 'Python进阶', type: 'courses', score: 8 },
      ],
    })
    
    const user = userEvent.setup()
    render(<SearchBar />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'Pyt')

    // 组件对输入做了 300ms 防抖（DEBOUNCE_DELAY）。不能只依赖 waitFor：
    // userEvent 自带的计时器会让防抖回调在 waitFor 的轮询窗口内不触发，
    // 表现为"等待超时但函数其实是对的"。
    //
    // 这里先让出一次事件循环（让 React 把输入引发的状态更新刷完），
    // 再显式等过防抖窗口，最后才断言。顺序不能颠倒，否则定时器还没被挂上。
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 700))

    // 注意：组件用 renderHighlightedText 把命中的关键字包进 <mark>，所以
    // "Python入门" 在 DOM 里是 <mark>Pyt</mark>hon入门 —— 两个节点。
    // getByText('Python入门') 永远匹配不到（这正是这批用例长期被静默排除的原因之一）。
    // 用自定义匹配器跨节点比较规范化后的文本。
    expect(await screen.findByText(assertSuggestionText('Python入门'))).toBeInTheDocument()
  })

  test('shows hot searches when input is empty', async () => {
    searchApi.getSuggestions.mockResolvedValueOnce({
      suggestions: [
        { keyword: 'Python', search_count: 100, is_trending: true },
        { keyword: 'React', search_count: 80, is_trending: false },
      ],
    })
    
    const user = userEvent.setup()
    render(<SearchBar />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    await waitFor(() => {
      expect(screen.getByText('Python')).toBeInTheDocument()
      expect(screen.getByText('React')).toBeInTheDocument()
    })
  })

  test('clears input when X button is clicked', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'Python')
    
    const clearButton = screen.getByRole('button', { name: '' })
    await user.click(clearButton)
    
    expect(input).toHaveValue('')
  })

  test('changes search type', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'courses')
    
    expect(select).toHaveValue('courses')
  })

  test('handles keyboard navigation', async () => {
    searchApi.autocomplete.mockResolvedValueOnce({
      suggestions: [
        { text: 'Python入门', type: 'courses', score: 10 },
        { text: 'Python进阶', type: 'courses', score: 8 },
      ],
    })
    
    const user = userEvent.setup()
    render(<SearchBar onSelect={mockOnSelect} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'Pyt')

    // 等过 300ms 防抖窗口，让建议真正渲染出来再走键盘操作。
    // （不能只用 waitFor：userEvent 的计时器会让防抖回调在轮询窗口内不触发。）
    await new Promise((resolve) => setTimeout(resolve, 700))
    // 同上：建议文本被 <mark> 高亮拆成多个节点，需要用跨节点匹配器。
    expect(await screen.findByText(assertSuggestionText('Python入门'))).toBeInTheDocument()

    await user.type(input, '{arrowdown}')
    await user.type(input, '{enter}')
    
    expect(mockOnSelect).toHaveBeenCalled()
  })

  test('closes dropdown on Escape', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    await waitFor(() => {
      expect(screen.getByText('热门搜索')).toBeInTheDocument()
    })
    
    await user.type(input, '{escape}')
    
    await waitFor(() => {
      expect(screen.queryByText('热门搜索')).not.toBeInTheDocument()
    })
  })

  test('saves search to history', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'Python{enter}')

    // 写入历史发生在 handleSearch 里，且在防抖回调之前/之后都可能排队，
    // 因此这里等待写入真正落盘，而不是立刻读取 localStorage。
    await waitFor(() => {
      const savedHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]')
      expect(savedHistory.some(h => h.query === 'Python')).toBe(true)
    })
  })

  test('shows loading state', async () => {
    searchApi.autocomplete.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve({ suggestions: [] }), 100))
    )
    
    const user = userEvent.setup()
    render(<SearchBar />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'Pyt')
    
    await waitFor(() => {
      expect(screen.getByText('搜索中...')).toBeInTheDocument()
    })
  })

  test('handles empty query', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, '{enter}')
    
    expect(mockOnSearch).not.toHaveBeenCalled()
  })

  test('shows shortcuts when enabled', () => {
    render(<SearchBar showShortcuts={true} />)
    
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
  })

  test('hides shortcuts when dropdown is open', async () => {
    const user = userEvent.setup()
    render(<SearchBar showShortcuts={true} />)
    
    const input = screen.getByRole('textbox')
    await user.click(input)
    
    await waitFor(() => {
      expect(screen.queryByText('按')).not.toBeInTheDocument()
    })
  })

  test('clicking shortcut sets query', async () => {
    const user = userEvent.setup()
    render(<SearchBar showShortcuts={true} />)
    
    const shortcut = screen.getByText('Python')
    await user.click(shortcut)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('Python')
  })
})
