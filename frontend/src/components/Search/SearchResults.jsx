import { useState, useEffect } from 'react'
import {
  Search,
  Star,
  Users,
  Clock,
  BookOpen,
  FileText,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  SearchX,
} from 'lucide-react'
import { searchApi } from '../../services/searchApi'
import './SearchResults.css'

const TYPE_ICONS = {
  courses: BookOpen,
  contents: FileText,
  knowledge: HelpCircle,
}

const TYPE_LABELS = {
  courses: '课程',
  contents: '内容',
  knowledge: '知识库',
}

export function SearchResults({
  query,
  type = 'all',
  filters = {},
  page = 1,
  perPage = 10,
  onResultClick,
  onPageChange,
  onQueryChange,
}) {
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [responseTime, setResponseTime] = useState(0)
  const [relatedSearches, setRelatedSearches] = useState([])

  useEffect(() => {
    if (query) {
      performSearch()
      fetchRelatedSearches()
    }
  }, [query, type, page, perPage, JSON.stringify(filters)])

  const performSearch = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await searchApi.search({
        query,
        indices: type === 'all' ? null : [type],
        filters,
        page,
        per_page: perPage,
        highlight: true,
        fuzzy: true,
      })

      if (data.error) {
        setError(data.error)
        setResults([])
        setTotal(0)
      } else {
        setResults(data.results || [])
        setTotal(data.total || 0)
        setTotalPages(data.total_pages || 0)
        setResponseTime(data.response_time_ms || 0)
      }
    } catch (err) {
      setError(err.message || '搜索失败')
      setResults([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRelatedSearches = async () => {
    try {
      const data = await searchApi.getRelated(query, 6)
      setRelatedSearches(data.related || [])
    } catch (err) {
      console.error('Failed to fetch related searches:', err)
    }
  }

  const handleResultClick = (result) => {
    searchApi.recordClick(query, result._id, result._index)
    onResultClick?.(result)
  }

  const handleRelatedClick = (relatedQuery) => {
    onQueryChange?.(relatedQuery)
  }

  const handlePageChange = (newPage) => {
    onPageChange?.(newPage)
  }

  const renderHighlightedField = (field, highlight) => {
    if (highlight && highlight[field]) {
      return (
        <span
          dangerouslySetInnerHTML={{
            __html: highlight[field].join('...'),
          }}
        />
      )
    }
    return field
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const pages = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    return (
      <div className="pagination">
        <button
          className="pagination-btn"
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={16} />
          上一页
        </button>

        {start > 1 && (
          <>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(1)}
            >
              1
            </button>
            {start > 2 && <span className="pagination-btn">...</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            className={`pagination-btn ${p === page ? 'active' : ''}`}
            onClick={() => handlePageChange(p)}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="pagination-btn">...</span>}
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(totalPages)}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          className="pagination-btn"
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages}
        >
          下一页
          <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  const renderNoResults = () => (
    <div className="no-results">
      <div className="no-results-icon">
        <SearchX size={32} />
      </div>
      <h3 className="no-results-title">未找到相关结果</h3>
      <p className="no-results-text">
        没有找到与 "<strong>{query}</strong>" 相关的内容
      </p>
      <ul className="no-results-suggestions">
        <li>• 检查输入的关键词是否有误</li>
        <li>• 尝试使用其他关键词搜索</li>
        <li>• 使用更通用的关键词</li>
      </ul>
    </div>
  )

  const renderLoading = () => (
    <div className="loading-state">
      <Loader2 className="loading-spinner" />
      <p>正在搜索...</p>
    </div>
  )

  const renderResultItem = (result, index) => {
    const TypeIcon = TYPE_ICONS[result._index] || FileText
    const typeLabel = TYPE_LABELS[result._index] || result._index
    const highlight = result.highlight || {}

    return (
      <div
        key={result._id || index}
        className="result-item"
        onClick={() => handleResultClick(result)}
      >
        <div className="result-content">
          <div className="result-header">
            <h3 className="result-title">
              {highlight.title ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: highlight.title.join(''),
                  }}
                />
              ) : (
                result.title || result.question || '无标题'
              )}
            </h3>
            <span className={`result-type ${result._index}`}>
              <TypeIcon size={14} style={{ marginRight: 4 }} />
              {typeLabel}
            </span>
          </div>

          <p className="result-description">
            {highlight.description ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: highlight.description.join('...'),
                }}
              />
            ) : highlight.content ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: highlight.content.join('...'),
                }}
              />
            ) : highlight.answer ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: highlight.answer.join('...'),
                }}
              />
            ) : (
              result.description || result.content || result.answer || ''
            )}
          </p>

          <div className="result-meta">
            {result.rating !== undefined && (
              <span className="result-meta-item">
                <Star size={14} fill="#f59e0b" color="#f59e0b" />
                {result.rating?.toFixed(1) || '0.0'}
              </span>
            )}
            {result.student_count !== undefined && (
              <span className="result-meta-item">
                <Users size={14} />
                {result.student_count || 0} 学员
              </span>
            )}
            {result.view_count !== undefined && (
              <span className="result-meta-item">
                <Search size={14} />
                {result.view_count || 0} 浏览
              </span>
            )}
            {result.duration && (
              <span className="result-meta-item">
                <Clock size={14} />
                {result.duration} 分钟
              </span>
            )}
            {result.category && (
              <span className="result-meta-item">{result.category}</span>
            )}
          </div>

          {result.tags && result.tags.length > 0 && (
            <div className="result-tags">
              {result.tags.slice(0, 4).map((tag, i) => (
                <span key={i} className="result-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return renderLoading()
  }

  if (error) {
    return (
      <div className="no-results">
        <div className="no-results-icon">
          <SearchX size={32} />
        </div>
        <h3 className="no-results-title">搜索出错</h3>
        <p className="no-results-text">{error}</p>
      </div>
    )
  }

  if (!query) {
    return null
  }

  if (total === 0) {
    return renderNoResults()
  }

  return (
    <div className="search-results-container">
      <div className="search-header">
        <div className="search-info">
          <h2 className="search-query">
            搜索 "<mark>{query}</mark>"
          </h2>
          <div className="search-meta">
            找到 {total} 个结果
            {responseTime > 0 && (
              <span className="search-response-time">
                {' '}
                · {responseTime}ms
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="results-list">
        {results.map((result, index) => renderResultItem(result, index))}
      </div>

      {renderPagination()}

      {relatedSearches.length > 0 && (
        <div className="related-searches">
          <h4 className="related-searches-title">相关搜索</h4>
          <div className="related-searches-list">
            {relatedSearches.map((related, index) => (
              <span
                key={index}
                className="related-search-tag"
                onClick={() => handleRelatedClick(related)}
              >
                {related}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchResults
