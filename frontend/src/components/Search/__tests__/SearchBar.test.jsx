import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../SearchBar'
import { searchApi } from '../../../services/searchApi'

vi.mock('../../../services/searchApi', () => ({
  searchApi: {
    getSuggestions: vi.fn(() => Promise.resolve({ suggestions: [] })),
    autocomplete: vi.fn(() => Promise.resolve({ suggestions: [] })),
  },
}))

describe('SearchBar', () => {
  const mockOnSearch = vi.fn()
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
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
    
    await waitFor(() => {
      expect(screen.getByText('Python入门')).toBeInTheDocument()
    })
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
    
    await waitFor(() => {
      expect(screen.getByText('Python入门')).toBeInTheDocument()
    })
    
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
    
    const savedHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]')
    expect(savedHistory.some(h => h.query === 'Python')).toBe(true)
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
