// 同 services/api.js：浏览器产物里 process.env 不会被 Vite 填充，
// 只有 import.meta.env 才能读到 VITE_ 前缀的变量。
//
// 注意：Jest 以 CommonJS 加载本模块，裸写 import.meta 会让整个测试套件
// 在解析阶段就报 "Cannot use 'import.meta' outside a module"（typeof 守卫
// 也救不了，这是解析期语法错误），导致该套测试长期无法运行。
// 这里改用仓库既有的 CJS 安全写法；Vite 构建时会静态替换 import.meta.env，
// 两种运行时都取得到 VITE_API_BASE_URL。
const API_BASE_URL =
  // eslint-disable-next-line no-undef -- 由 Vite / jest.config globals 注入
  (typeof import_meta_env !== 'undefined' && import_meta_env?.VITE_API_BASE_URL) || '/api'

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

    // 不要对整串做 decodeURIComponent：URLSearchParams 的输出已经是编码好的，
    // 再整体解码会把参数值里的 %26 变回 & ，服务端就会把它当成参数分隔符，
    // 参数被错误切分（实测 q=机器学习&category=a%26b 会变成 q=机器学习&category=a&b）。
    // 同文件的 search / searchKnowledge 都没有这一步，这里保持一致。
    return request(`/search/courses?${queryString.toString()}`)
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

  // 语义搜索（BGE 中文 embedding + Qdrant local）：返回知识点 + 相似度分数
  semanticSearch: (query, { top_k = 8, course_id } = {}) => {
    return request('/search/semantic', {
      method: 'POST',
      body: { query, top_k, course_id },
    })
  },

  semanticReindex: (course_id) => {
    return request('/search/semantic/reindex', {
      method: 'POST',
      body: course_id ? { course_id } : {},
    })
  },
}

export default searchApi
