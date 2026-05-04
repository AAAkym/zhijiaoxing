import { searchApi } from '../searchApi'

global.fetch = vi.fn()

describe('searchApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('search', () => {
    test('calls POST /api/search with correct params', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], total: 0 }),
      })
      
      await searchApi.search({
        query: 'Python',
        indices: ['courses'],
        page: 1,
        per_page: 20,
      })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Python'),
        })
      )
    })

    test('returns data on successful response', async () => {
      const mockData = {
        results: [{ _id: '1', title: 'Python Course' }],
        total: 1,
        page: 1,
      }
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
      
      const result = await searchApi.search({ query: 'Python' })
      
      expect(result).toEqual(mockData)
    })

    test('throws error on failed response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Search failed' }),
      })
      
      await expect(searchApi.search({ query: 'test' })).rejects.toThrow('Search failed')
    })
  })

  describe('searchGet', () => {
    test('calls GET /api/search with query params', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      
      await searchApi.searchGet({
        query: 'Python',
        type: 'courses',
        page: 1,
      })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/search\?.*q=Python/),
        expect.any(Object)
      )
    })
  })

  describe('searchCourses', () => {
    test('calls GET /api/search/courses', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      
      await searchApi.searchCourses({ query: 'React' })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/courses'),
        expect.any(Object)
      )
    })

    test('includes all filter params', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      
      await searchApi.searchCourses({
        query: 'React',
        category: '前端',
        difficulty: '中级',
        min_rating: 4.0,
        is_free: true,
      })
      
      const url = fetch.mock.calls[0][0]
      expect(url).toContain('q=React')
      expect(url).toContain('category=前端')
      expect(url).toContain('difficulty=中级')
      expect(url).toContain('min_rating=4')
      expect(url).toContain('is_free=true')
    })
  })

  describe('searchKnowledge', () => {
    test('calls GET /api/search/knowledge', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      
      await searchApi.searchKnowledge({ query: 'Vue' })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/knowledge'),
        expect.any(Object)
      )
    })
  })

  describe('searchContents', () => {
    test('calls GET /api/search/contents', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      
      await searchApi.searchContents({ query: 'test', course_id: '123' })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/contents'),
        expect.any(Object)
      )
    })
  })

  describe('advancedSearch', () => {
    test('calls POST /api/search/advanced', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      
      await searchApi.advancedSearch({
        query: 'Python',
        must_have: ['教程'],
        must_not_have: ['付费'],
      })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/advanced'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  describe('autocomplete', () => {
    test('calls GET /api/search/autocomplete', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      })
      
      await searchApi.autocomplete('Pyt', null, 10)
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/search\/autocomplete\?.*prefix=Pyt/),
        expect.any(Object)
      )
    })

    test('includes index param when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      })
      
      await searchApi.autocomplete('Pyt', 'courses', 10)
      
      const url = fetch.mock.calls[0][0]
      expect(url).toContain('index=courses')
    })
  })

  describe('getSuggestions', () => {
    test('calls GET /api/search/suggestions', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      })
      
      await searchApi.getSuggestions(10)
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/suggestions?size=10'),
        expect.any(Object)
      )
    })
  })

  describe('getRecommendations', () => {
    test('calls GET /api/search/recommendations', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ recommendations: [] }),
      })
      
      await searchApi.getRecommendations(10)
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/recommendations'),
        expect.any(Object)
      )
    })
  })

  describe('getRelated', () => {
    test('calls GET /api/search/related', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ related: [] }),
      })
      
      await searchApi.getRelated('Python', 10)
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/search\/related\?.*q=Python/),
        expect.any(Object)
      )
    })
  })

  describe('recordClick', () => {
    test('calls POST /api/search/click', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      
      await searchApi.recordClick('Python', 'course-1', 'courses')
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/click'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Python'),
        })
      )
    })
  })

  describe('getAnalytics', () => {
    test('calls GET /api/search/analytics', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ total_searches: 100 }),
      })
      
      await searchApi.getAnalytics(7)
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/analytics?days=7'),
        expect.any(Object)
      )
    })
  })

  describe('getHistory', () => {
    test('calls GET /api/search/history', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ history: [] }),
      })
      
      await searchApi.getHistory(20)
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/history?size=20'),
        expect.any(Object)
      )
    })
  })

  describe('clearHistory', () => {
    test('calls POST /api/search/history/clear', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      
      await searchApi.clearHistory()
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/history/clear'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  describe('error handling', () => {
    test('throws error with message from response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Custom error message' }),
      })
      
      await expect(searchApi.search({ query: 'test' })).rejects.toThrow('Custom error message')
    })

    test('throws generic error when no message in response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })
      
      await expect(searchApi.search({ query: 'test' })).rejects.toThrow('Request failed')
    })
  })
})
