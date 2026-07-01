const API_BASE_URL = (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) || '/api'

async function request(url, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    ...options,
  }

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE_URL}${url}`, config)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}

export const searchApi = {
  search: (params) => {
    const {
      query,
      indices,
      filters,
      page = 1,
      per_page = 20,
      highlight = true,
      fuzzy = true,
    } = params

    return request('/search', {
      method: 'POST',
      body: {
        query,
        indices,
        filters,
        page,
        per_page,
        highlight,
        fuzzy,
      },
    })
  },

  searchGet: (params) => {
    const queryString = new URLSearchParams()
    
    if (params.query) queryString.set('q', params.query)
    if (params.type) queryString.set('type', params.type)
    if (params.page) queryString.set('page', params.page)
    if (params.per_page) queryString.set('per_page', params.per_page)
    if (params.highlight !== undefined) queryString.set('highlight', params.highlight)
    if (params.fuzzy !== undefined) queryString.set('fuzzy', params.fuzzy)
    if (params.category) queryString.set('category', params.category)
    if (params.difficulty) queryString.set('difficulty', params.difficulty)
    if (params.min_rating) queryString.set('min_rating', params.min_rating)

    return request(`/search?${queryString.toString()}`)
  },

  searchCourses: (params) => {
    const queryString = new URLSearchParams()
    
    if (params.query) queryString.set('q', params.query)
    if (params.category) queryString.set('category', params.category)
    if (params.difficulty) queryString.set('difficulty', params.difficulty)
    if (params.min_rating) queryString.set('min_rating', params.min_rating)
    if (params.is_free !== undefined) queryString.set('is_free', params.is_free)
    if (params.page) queryString.set('page', params.page)
    if (params.per_page) queryString.set('per_page', params.per_page)

    return request(`/search/courses?${decodeURIComponent(queryString.toString())}`)
  },

  searchKnowledge: (params) => {
    const queryString = new URLSearchParams()
    
    if (params.query) queryString.set('q', params.query)
    if (params.category) queryString.set('category', params.category)
    if (params.knowledge_type) queryString.set('knowledge_type', params.knowledge_type)
    if (params.page) queryString.set('page', params.page)
    if (params.per_page) queryString.set('per_page', params.per_page)

    return request(`/search/knowledge?${queryString.toString()}`)
  },

  searchContents: (params) => {
    const queryString = new URLSearchParams()
    
    if (params.query) queryString.set('q', params.query)
    if (params.course_id) queryString.set('course_id', params.course_id)
    if (params.content_type) queryString.set('content_type', params.content_type)
    if (params.page) queryString.set('page', params.page)
    if (params.per_page) queryString.set('per_page', params.per_page)

    return request(`/search/contents?${queryString.toString()}`)
  },

  advancedSearch: (params) => {
    return request('/search/advanced', {
      method: 'POST',
      body: params,
    })
  },

  autocomplete: (prefix, index = null, size = 10) => {
    const queryString = new URLSearchParams()
    queryString.set('prefix', prefix)
    if (index) queryString.set('index', index)
    queryString.set('size', size)

    return request(`/search/autocomplete?${queryString.toString()}`)
  },

  getSuggestions: (size = 10) => {
    return request(`/search/suggestions?size=${size}`)
  },

  getRecommendations: (size = 10) => {
    return request(`/search/recommendations?size=${size}`)
  },

  getRelated: (query, size = 10) => {
    const queryString = new URLSearchParams()
    queryString.set('q', query)
    queryString.set('size', size)

    return request(`/search/related?${queryString.toString()}`)
  },

  recordClick: (query, resultId, resultType) => {
    return request('/search/click', {
      method: 'POST',
      body: {
        query,
        result_id: resultId,
        result_type: resultType,
      },
    })
  },

  getAnalytics: (days = 7) => {
    return request(`/search/analytics?days=${days}`)
  },

  getHistory: (size = 20) => {
    return request(`/search/history?size=${size}`)
  },

  clearHistory: () => {
    return request('/search/history/clear', {
      method: 'POST',
    })
  },
}

export default searchApi
