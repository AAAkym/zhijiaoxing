import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, TrendingUp, Clock, X, Loader2 } from 'lucide-react'
import { searchApi } from '../../services/searchApi'
import './SearchBar.css'

const SEARCH_TYPES = [
  { value: 'all', label: '全部' },
  { value: 'courses', label: '课程' },
  { value: 'knowledge', label: '知识库' },
  { value: 'contents', label: '内容' },
]

const DEBOUNCE_DELAY = 300

export function SearchBar({
  placeholder = '搜索课程、知识库...',
  onSearch,
  onSelect,
  autoFocus = false,
  showShortcuts = true,
  defaultType = 'all',
}) {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState(defaultType)
  const [suggestions, setSuggestions] = useState([])
  const [hotSearches, setHotSearches] = useState([])
  const [history, setHistory] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    loadHotSearches()
    loadHistory()
  }, [])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !inputRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadHotSearches = async () => {
    try {
      const data = await searchApi.getSuggestions(5)
      setHotSearches(data.suggestions || [])
    } catch (error) {
      console.error('Failed to load hot searches:', error)
    }
  }

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem('searchHistory')
      if (saved) {
        setHistory(JSON.parse(saved).slice(0, 5))
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  const saveToHistory = (searchQuery) => {
    try {
      const newHistory = [
        { query: searchQuery, timestamp: Date.now() },
        ...history.filter((h) => h.query !== searchQuery),
      ].slice(0, 10)
      setHistory(newHistory.slice(0, 5))
      localStorage.setItem('searchHistory', JSON.stringify(newHistory))
    } catch (error) {
      console.error('Failed to save history:', error)
    }
  }

  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 1) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      const data = await searchApi.autocomplete(searchQuery, searchType, 8)
      setSuggestions(data.suggestions || [])
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [searchType])

  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setActiveIndex(-1)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (value.trim()) {
      setIsOpen(true)
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value.trim())
      }, DEBOUNCE_DELAY)
    } else {
      setSuggestions([])
      setIsOpen(true)
    }
  }

  const handleKeyDown = (e) => {
    const totalItems = suggestions.length + hotSearches.length + history.length

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0) {
          handleSelectItem(activeIndex)
        } else if (query.trim()) {
          handleSearch()
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  const handleSelectItem = (index) => {
    let selectedItem = null

    if (index < suggestions.length) {
      selectedItem = suggestions[index]
    } else if (index < suggestions.length + hotSearches.length) {
      selectedItem = hotSearches[index - suggestions.length]
    } else {
      selectedItem = history[index - suggestions.length - hotSearches.length]
    }

    if (selectedItem) {
      const selectedQuery = selectedItem.text || selectedItem.keyword || selectedItem.query
      setQuery(selectedQuery)
      setIsOpen(false)
      saveToHistory(selectedQuery)
      onSelect?.({
        query: selectedQuery,
        type: selectedItem.type || searchType,
        item: selectedItem,
      })
    }
  }

  const handleSearch = () => {
    if (!query.trim()) return

    saveToHistory(query.trim())
    setIsOpen(false)
    onSearch?.({
      query: query.trim(),
      type: searchType,
    })
  }

  const handleFocus = () => {
    setIsOpen(true)
  }

  const clearInput = () => {
    setQuery('')
    setSuggestions([])
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  const handleTypeChange = (e) => {
    setSearchType(e.target.value)
    if (query.trim()) {
      fetchSuggestions(query.trim())
    }
  }

  const renderHighlightedText = (text, highlight) => {
    if (!highlight) return text

    const parts = text.split(new RegExp(`(${highlight})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={i}>{part}</mark>
      ) : (
        part
      )
    )
  }

  const renderDropdown = () => {
    if (!isOpen) return null

    const showHistory = !query && history.length > 0
    const showHotSearches = !query && hotSearches.length > 0
    const showSuggestions = suggestions.length > 0
    const showNoResults = query && !isLoading && !showSuggestions

    return (
      <div className="autocomplete-dropdown" ref={dropdownRef}>
        {isLoading && (
          <div className="loading-indicator">
            <Loader2 className="loading-spinner" />
            <span>搜索中...</span>
          </div>
        )}

        {showSuggestions && (
          <div className="autocomplete-section">
            <div className="autocomplete-section-title">搜索建议</div>
            {suggestions.map((item, index) => (
              <div
                key={`suggestion-${index}`}
                className={`autocomplete-item ${activeIndex === index ? 'active' : ''}`}
                onClick={() => handleSelectItem(index)}
              >
                <span className="autocomplete-item-text">
                  {renderHighlightedText(item.text, query)}
                </span>
                <div className="autocomplete-item-meta">
                  {item.type && (
                    <span className="autocomplete-item-type">{item.type}</span>
                  )}
                  {item.score && (
                    <span className="autocomplete-item-count">
                      {Math.round(item.score)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showNoResults && (
          <div className="no-results">
            未找到 "{query}" 相关结果
          </div>
        )}

        {showHistory && (
          <div className="autocomplete-section">
            <div className="autocomplete-section-title">
              <Clock size={14} style={{ marginRight: 6 }} />
              搜索历史
            </div>
            {history.map((item, index) => (
              <div
                key={`history-${index}`}
                className={`autocomplete-item ${activeIndex === suggestions.length + index ? 'active' : ''}`}
                onClick={() => handleSelectItem(suggestions.length + index)}
              >
                <span className="autocomplete-item-text">{item.query}</span>
              </div>
            ))}
          </div>
        )}

        {showHotSearches && (
          <div className="autocomplete-section">
            <div className="autocomplete-section-title">
              <TrendingUp size={14} style={{ marginRight: 6 }} />
              热门搜索
            </div>
            {hotSearches.map((item, index) => (
              <div
                key={`hot-${index}`}
                className={`autocomplete-item ${activeIndex === suggestions.length + history.length + index ? 'active' : ''}`}
                onClick={() => handleSelectItem(suggestions.length + history.length + index)}
              >
                <span className="autocomplete-item-text">{item.keyword}</span>
                <div className="autocomplete-item-meta">
                  {item.is_trending && (
                    <span className="trending-badge">
                      <TrendingUp size={12} />
                      热门
                    </span>
                  )}
                  <span className="autocomplete-item-count">
                    {item.search_count}次
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <Search className="search-icon" size={20} />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        />
        {query && (
          <button
            onClick={clearInput}
            style={{
              position: 'absolute',
              right: '100px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X size={18} />
          </button>
        )}
        <select
          className="search-type-select"
          value={searchType}
          onChange={handleTypeChange}
        >
          {SEARCH_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {renderDropdown()}

      {showShortcuts && !isOpen && (
        <div className="search-shortcuts">
          <span className="shortcut-tag" onClick={() => setQuery('Python')}>
            Python
          </span>
          <span className="shortcut-tag" onClick={() => setQuery('React')}>
            React
          </span>
          <span className="shortcut-tag" onClick={() => setQuery('机器学习')}>
            机器学习
          </span>
          <span className="shortcut-tag">
            按 <kbd>Enter</kbd> 搜索
          </span>
        </div>
      )}
    </div>
  )
}

export default SearchBar
