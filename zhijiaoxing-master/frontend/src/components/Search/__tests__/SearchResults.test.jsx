import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchResults } from '../SearchResults'
import { searchApi } from '../../../services/searchApi'

vi.mock('../../../services/searchApi', () => ({
  searchApi: {
    search: vi.fn(() => Promise.resolve({
      results: [],
      total: 0,
      page: 1,
      per_page: 20,
      total_pages: 0,
      response_time_ms: 50,
    })),
    getRelated: vi.fn(() => Promise.resolve({ related: [] })),
    recordClick: vi.fn(() => Promise.resolve({ success: true })),
  },
}))

describe('SearchResults', () => {
  const mockOnResultClick = vi.fn()
  const mockOnPageChange = vi.fn()
  const mockOnQueryChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders nothing when no query', () => {
    const { container } = render(<SearchResults query="" />)
    
    expect(container.firstChild).toBeNull()
  })

  test('shows loading state', () => {
    searchApi.search.mockImplementationOnce(() => new Promise(() => {}))
    
    render(<SearchResults query="Python" />)
    
    expect(screen.getByText('正在搜索...')).toBeInTheDocument()
  })

  test('displays search results', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [
        {
          _id: '1',
          _score: 10,
          _index: 'courses',
          title: 'Python入门教程',
          description: '适合零基础学习者',
          category: '编程',
          rating: 4.8,
          student_count: 1000,
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 45,
    })
    
    render(<SearchResults query="Python" />)
    
    await waitFor(() => {
      expect(screen.getByText('Python入门教程')).toBeInTheDocument()
    })
    
    expect(screen.getByText('适合零基础学习者')).toBeInTheDocument()
    expect(screen.getByText('找到 1 个结果')).toBeInTheDocument()
  })

  test('displays highlighted results', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [
        {
          _id: '1',
          _score: 10,
          _index: 'courses',
          title: 'Python入门教程',
          highlight: {
            title: ['<mark class="highlight">Python</mark>入门教程'],
          },
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 45,
    })
    
    render(<SearchResults query="Python" />)
    
    await waitFor(() => {
      const highlightedElement = document.querySelector('mark.highlight')
      expect(highlightedElement).toBeInTheDocument()
    })
  })

  test('shows no results message', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [],
      total: 0,
      page: 1,
      per_page: 20,
      total_pages: 0,
      response_time_ms: 30,
    })
    
    render(<SearchResults query="nonexistent" />)
    
    await waitFor(() => {
      expect(screen.getByText('未找到相关结果')).toBeInTheDocument()
    })
    
    expect(screen.getByText(/没有找到与/)).toBeInTheDocument()
  })

  test('displays pagination when multiple pages', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: Array(20).fill({ _id: '1', _index: 'courses', title: 'Course' }),
      total: 100,
      page: 1,
      per_page: 20,
      total_pages: 5,
      response_time_ms: 50,
    })
    
    render(<SearchResults query="test" page={1} onPageChange={mockOnPageChange} />)
    
    await waitFor(() => {
      expect(screen.getByText('下一页')).toBeInTheDocument()
    })
  })

  test('calls onPageChange when pagination clicked', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: Array(20).fill({ _id: '1', _index: 'courses', title: 'Course' }),
      total: 100,
      page: 2,
      per_page: 20,
      total_pages: 5,
      response_time_ms: 50,
    })
    
    const user = userEvent.setup()
    render(<SearchResults query="test" page={2} onPageChange={mockOnPageChange} />)
    
    await waitFor(() => {
      expect(screen.getByText('上一页')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('上一页'))
    
    expect(mockOnPageChange).toHaveBeenCalledWith(1)
  })

  test('calls onResultClick when result clicked', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [
        {
          _id: 'course-1',
          _score: 10,
          _index: 'courses',
          title: 'Python Course',
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 50,
    })
    
    const user = userEvent.setup()
    render(<SearchResults query="Python" onResultClick={mockOnResultClick} />)
    
    await waitFor(() => {
      expect(screen.getByText('Python Course')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Python Course'))
    
    expect(mockOnResultClick).toHaveBeenCalled()
    expect(searchApi.recordClick).toHaveBeenCalledWith('Python', 'course-1', 'courses')
  })

  test('displays related searches', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [{ _id: '1', _index: 'courses', title: 'Course' }],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 50,
    })
    
    searchApi.getRelated.mockResolvedValueOnce({
      related: ['Django', 'Flask', 'FastAPI'],
    })
    
    render(<SearchResults query="Python" onQueryChange={mockOnQueryChange} />)
    
    await waitFor(() => {
      expect(screen.getByText('相关搜索')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Django')).toBeInTheDocument()
    expect(screen.getByText('Flask')).toBeInTheDocument()
  })

  test('clicking related search changes query', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [{ _id: '1', _index: 'courses', title: 'Course' }],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 50,
    })
    
    searchApi.getRelated.mockResolvedValueOnce({
      related: ['Django'],
    })
    
    const user = userEvent.setup()
    render(<SearchResults query="Python" onQueryChange={mockOnQueryChange} />)
    
    await waitFor(() => {
      expect(screen.getByText('Django')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Django'))
    
    expect(mockOnQueryChange).toHaveBeenCalledWith('Django')
  })

  test('displays response time', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [{ _id: '1', _index: 'courses', title: 'Course' }],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 45,
    })
    
    render(<SearchResults query="test" />)
    
    await waitFor(() => {
      expect(screen.getByText(/45ms/)).toBeInTheDocument()
    })
  })

  test('displays course type badge', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [
        {
          _id: '1',
          _index: 'courses',
          title: 'Course',
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 50,
    })
    
    render(<SearchResults query="test" />)
    
    await waitFor(() => {
      expect(screen.getByText('课程')).toBeInTheDocument()
    })
  })

  test('displays knowledge type badge', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [
        {
          _id: '1',
          _index: 'knowledge',
          title: 'Knowledge',
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 50,
    })
    
    render(<SearchResults query="test" />)
    
    await waitFor(() => {
      expect(screen.getByText('知识库')).toBeInTheDocument()
    })
  })

  test('displays tags', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [
        {
          _id: '1',
          _index: 'courses',
          title: 'Course',
          tags: ['Python', '入门', '编程'],
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
      response_time_ms: 50,
    })
    
    render(<SearchResults query="test" />)
    
    await waitFor(() => {
      expect(screen.getByText('Python')).toBeInTheDocument()
      expect(screen.getByText('入门')).toBeInTheDocument()
    })
  })

  test('handles search error', async () => {
    searchApi.search.mockRejectedValueOnce(new Error('Network error'))
    
    render(<SearchResults query="test" />)
    
    await waitFor(() => {
      expect(screen.getByText('搜索出错')).toBeInTheDocument()
    })
  })

  test('disables previous button on first page', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: Array(20).fill({ _id: '1', _index: 'courses', title: 'Course' }),
      total: 100,
      page: 1,
      per_page: 20,
      total_pages: 5,
      response_time_ms: 50,
    })
    
    render(<SearchResults query="test" page={1} />)
    
    await waitFor(() => {
      expect(screen.getByText('上一页')).toBeDisabled()
    })
  })

  test('disables next button on last page', async () => {
    searchApi.search.mockResolvedValueOnce({
      results: [{ _id: '1', _index: 'courses', title: 'Course' }],
      total: 21,
      page: 2,
      per_page: 20,
      total_pages: 2,
      response_time_ms: 50,
    })
    
    render(<SearchResults query="test" page={2} />)
    
    await waitFor(() => {
      expect(screen.getByText('下一页')).toBeDisabled()
    })
  })
})
