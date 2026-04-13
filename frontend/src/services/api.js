// 开发环境使用相对路径通过Vite代理，生产环境使用环境变量或相对路径
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// 通用请求函数
async function request(url, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies
    ...options,
  }

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE_URL}${url}`, config)
  
  // 特殊处理401认证失败：返回包含状态码的错误对象，便于调用方区分处理
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({ error: 'Authentication required' }))
    const authError = new Error(errorData.error || 'Authentication required')
    authError.isAuthError = true // 标记为认证错误
    authError.status = 401
    throw authError
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }))
    const requestError = new Error(error.error || 'Request failed')
    requestError.status = response.status
    requestError.errorDetail = error.error // 保留原始错误详情
    throw requestError
  }

  return response.json()
}

// 认证相关API
export const auth = {
  login: (credentials) => request('/login', {
    method: 'POST',
    body: credentials,
  }),
  
  register: (userData) => request('/register', {
    method: 'POST',
    body: userData,
  }),
  
  logout: () => request('/logout', {
    method: 'POST',
  }),
}

// 用户相关API
export const getCurrentUser = () => request('/me')

export const users = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/users${queryString ? `?${queryString}` : ''}`)
  },
  
  create: (userData) => request('/users', {
    method: 'POST',
    body: userData,
  }),
  
  update: (id, userData) => request(`/users/${id}`, {
    method: 'PUT',
    body: userData,
  }),
  
  delete: (id) => request(`/users/${id}`, {
    method: 'DELETE',
  }),
}

// 课程相关API
export const courses = {
  getAll: () => request('/courses'),
  
  create: (courseData) => request('/courses', {
    method: 'POST',
    body: courseData,
  }),
  
  update: (id, courseData) => request(`/courses/${id}`, {
    method: 'PUT',
    body: courseData,
  }),
  
  delete: (id) => request(`/courses/${id}`, {
    method: 'DELETE',
  }),
  
  getContent: (id) => request(`/courses/${id}/content`),
  
  getAssessments: (id) => request(`/courses/${id}/assessments`),

  getAssessmentStats: (id) => request(`/assessments/${id}/stats`),
  
  createAssessment: (courseId, data) => request(`/courses/${courseId}/assessments`, {
    method: 'POST',
    // 确保 questions 字段为数组或可序列化内容，后端会把非字符串转为 JSON
    body: data,
  }),
  
  updateAssessment: (id, data) => request(`/assessments/${id}`, {
    method: 'PUT',
    body: data,
  }),
  
  deleteAssessment: (id) => request(`/assessments/${id}`, {
    method: 'DELETE',
  }),
}

// 内容生成API
export const content = {
  generate: (data) => request('/generate_content', {
    method: 'POST',
    body: data,
  }),
  
  create: (data) => request('/teaching_content', {
    method: 'POST',
    body: data,
  }),
  
  generateAssessment: (data) => request('/generate_assessment', {
    method: 'POST',
    body: data,
  }),
}

// AI助手API
export const ai = {
  chat: async (data) => {
    // normalize frontend key `message` -> backend expects `question`
    const payload = {
      question: data.message || data.question || '',
      context: data.context || '',
      topic: data.topic || ''
    }
    const res = await request('/ai_chat', {
      method: 'POST',
      body: payload,
    })
    // backend returns { answer: ... }
    return { reply: res.answer }
  },
  
  chatStream: (data) => {
    const payload = {
      question: data.message || data.question || '',
      context: data.context || '',
      topic: data.topic || ''
    }
    return fetch(`${API_BASE_URL}/ai_chat_stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
  },
  
  sseChat: (data) => {
    const payload = {
      question: data.question || data.message || '',
      conversation_id: data.conversationId || data.conversation_id || null,
      context: data.context || '',
      topic: data.topic || '',
      temperature: data.temperature || 0.7,
      max_context_length: data.maxContextLength || data.max_context_length || 10
    }
    return fetch(`${API_BASE_URL}/sse/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(data.lastEventId ? { 'Last-Event-ID': data.lastEventId } : {})
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
  },
  
  sseChatSimple: (data) => {
    const payload = {
      question: data.question || data.message || '',
      context: data.context || '',
      topic: data.topic || ''
    }
    return fetch(`${API_BASE_URL}/sse/chat/simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
  },
  
  evaluatePractice: (data) => request('/evaluate_practice', {
    method: 'POST',
    body: data,
  }),
  
  getPracticeHistory: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/practice_history${queryString ? `?${queryString}` : ''}`)
  },
  
  searchKnowledge: (data) => request('/knowledge_search', {
    method: 'POST',
    body: data,
  }),
}

// 管理员API
export const admin = {
  getDashboardStats: () => request('/dashboard/stats'),
  
  getUserActivity: () => request('/dashboard/user_activity'),
  
  getCourseStats: () => request('/dashboard/course_stats'),
}

// 学生API
export const student = {
  getMyCourses: () => request('/my_courses'),
  
  enrollCourse: (courseId) => request('/enroll_course', {
    method: 'POST',
    body: { course_id: courseId },
  }),
  
  updateProgress: (data) => request('/update_progress', {
    method: 'POST',
    body: data,
  }),
  
  getLearningStats: () => request('/learning_stats'),
  
  getPracticeStats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/practice_stats${queryString ? `?${queryString}` : ''}`)
  },
  
  getLearningProgressChart: () => request('/learning_progress_chart'),
  
  syncPracticeData: (data) => request('/sync_practice_data', {
    method: 'POST',
    body: data,
  }),
  
  getDashboardSummary: () => request('/dashboard_summary'),
  
  validatePracticeData: (data) => request('/validate_practice_data', {
    method: 'POST',
    body: data,
  }),
}

export const studentSettings = {
  getSettings: () => request('/student/settings'),
  
  updateProfile: (data) => request('/student/settings/profile', {
    method: 'PUT',
    body: data,
  }),
  
  uploadAvatar: (avatar) => request('/student/settings/avatar', {
    method: 'POST',
    body: { avatar },
  }),
  
  updateLearningGoal: (learningGoal) => request('/student/settings/learning-goal', {
    method: 'PUT',
    body: { learning_goal: learningGoal },
  }),
  
  updateAIStyle: (aiStyle) => request('/student/settings/ai-style', {
    method: 'PUT',
    body: { ai_style: aiStyle },
  }),
  
  updateAllSettings: (data) => request('/student/settings', {
    method: 'PUT',
    body: data,
  }),
}

// 视频课程API
export const videos = {
  getByCourse: (courseId) => request(`/courses/${courseId}/videos`),
  
  get: (videoId) => request(`/videos/${videoId}`),
  
  getContent: (videoId) => request(`/videos/${videoId}/content`),
  
  create: (courseId, data) => request(`/courses/${courseId}/videos`, {
    method: 'POST',
    body: data,
  }),
  
  update: (videoId, data) => request(`/videos/${videoId}`, {
    method: 'PUT',
    body: data,
  }),
  
  delete: (videoId) => request(`/videos/${videoId}`, {
    method: 'DELETE',
  }),
  
  uploadFile: async (file) => {
    const formData = new FormData()
    formData.append('video', file)
    
    const response = await fetch(`${API_BASE_URL}/upload/video`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }
    
    return response.json()
  },
}

// 互动功能API
export const interaction = {
  // 视频进度
  getVideoProgress: (videoId) => request(`/video_progress/${videoId}`),
  
  updateVideoProgress: (data) => request('/video_progress', {
    method: 'POST',
    body: data,
  }),
  
  // 问答
  getQuestions: (courseId, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/courses/${courseId}/questions${queryString ? `?${queryString}` : ''}`)
  },
  
  getQuestion: (questionId) => request(`/questions/${questionId}`),
  
  createQuestion: (courseId, data) => request(`/courses/${courseId}/questions`, {
    method: 'POST',
    body: data,
  }),
  
  createAnswer: (questionId, data) => request(`/questions/${questionId}/answers`, {
    method: 'POST',
    body: data,
  }),
  
  acceptAnswer: (answerId) => request(`/answers/${answerId}/accept`, {
    method: 'POST',
  }),
  
  // 讨论区
  getDiscussions: (courseId, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/courses/${courseId}/discussions${queryString ? `?${queryString}` : ''}`)
  },
  
  createDiscussion: (courseId, data) => request(`/courses/${courseId}/discussions`, {
    method: 'POST',
    body: data,
  }),
  
  likeDiscussion: (discussionId) => request(`/discussions/${discussionId}/like`, {
    method: 'POST',
  }),
  
  pinDiscussion: (discussionId) => request(`/discussions/${discussionId}/pin`, {
    method: 'POST',
  }),
  
  deleteDiscussion: (discussionId) => request(`/discussions/${discussionId}`, {
    method: 'DELETE',
  }),
  
  // 举手提问
  getHandRaises: (courseId, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/courses/${courseId}/hand_raises${queryString ? `?${queryString}` : ''}`)
  },
  
  createHandRaise: (courseId, data) => request(`/courses/${courseId}/hand_raises`, {
    method: 'POST',
    body: data,
  }),
  
  callHandRaise: (handRaiseId) => request(`/hand_raises/${handRaiseId}/call`, {
    method: 'POST',
  }),
  
  resolveHandRaise: (handRaiseId) => request(`/hand_raises/${handRaiseId}/resolve`, {
    method: 'POST',
  }),
  
  // 笔记
  getNotes: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/notes${queryString ? `?${queryString}` : ''}`)
  },
  
  createNote: (data) => request('/notes', {
    method: 'POST',
    body: data,
  }),
  
  updateNote: (noteId, data) => request(`/notes/${noteId}`, {
    method: 'PUT',
    body: data,
  }),
  
  deleteNote: (noteId) => request(`/notes/${noteId}`, {
    method: 'DELETE',
  }),
  
  generateNote: (data) => request('/notes/generate', {
    method: 'POST',
    body: data,
  }),
  
  // 书签
  getBookmarks: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/bookmarks${queryString ? `?${queryString}` : ''}`)
  },
  
  createBookmark: (data) => request('/bookmarks', {
    method: 'POST',
    body: data,
  }),
  
  deleteBookmark: (bookmarkId) => request(`/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
  }),
  
  // 学习总结
  getCourseSummary: (courseId) => request(`/courses/${courseId}/summary`),
  
  exportCourseSummary: (courseId, format = 'markdown') => request(`/courses/${courseId}/summary/export`, {
    method: 'POST',
    body: { format },
  }),
}

export const conversation = {
  create: (data = {}) => request('/conversations', {
    method: 'POST',
    body: data,
  }),
  
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/conversations${queryString ? `?${queryString}` : ''}`)
  },
  
  get: (conversationId, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/conversations/${conversationId}${queryString ? `?${queryString}` : ''}`)
  },
  
  update: (conversationId, data) => request(`/conversations/${conversationId}`, {
    method: 'PUT',
    body: data,
  }),
  
  delete: (conversationId, hard = false) => request(`/conversations/${conversationId}${hard ? '?hard=true' : ''}`, {
    method: 'DELETE',
  }),
  
  getMessages: (conversationId, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`)
  },
  
  addMessage: (conversationId, data) => request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: data,
  }),
  
  getContext: (conversationId, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/conversations/${conversationId}/context${queryString ? `?${queryString}` : ''}`)
  },
  
  getStats: () => request('/conversations/stats'),
  
  archive: (conversationId) => request(`/conversations/${conversationId}/archive`, {
    method: 'POST',
  }),
  
  batchDelete: (conversationIds, hard = false) => request('/conversations/batch-delete', {
    method: 'POST',
    body: { conversation_ids: conversationIds, hard },
  }),
}

export const mistakeBook = {
  getMistakes: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/mistakes${queryString ? `?${queryString}` : ''}`)
  },
  
  getMistake: (mistakeId) => request(`/mistakes/${mistakeId}`),
  
  updateStatus: (mistakeId, masteryStatus, noteId = null) => request(`/mistakes/${mistakeId}/status`, {
    method: 'PUT',
    body: { mastery_status: masteryStatus, note_id: noteId },
  }),
  
  extractMistakes: (practiceEvaluationId) => request('/mistakes/extract', {
    method: 'POST',
    body: { practice_evaluation_id: practiceEvaluationId },
  }),
  
  getStats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/mistakes/stats${queryString ? `?${queryString}` : ''}`)
  },
  
  startReview: (params = {}) => request('/mistakes/review/start', {
    method: 'POST',
    body: params,
  }),
  
  submitReview: (results) => request('/mistakes/review/submit', {
    method: 'POST',
    body: { results },
  }),
  
  getReviewHistory: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/mistakes/review/history${queryString ? `?${queryString}` : ''}`)
  },
  
  analyzeMistake: (mistakeId) => request(`/mistakes/${mistakeId}/analyze`, {
    method: 'POST',
  }),
  
  analyzeMistakeStream: (mistakeId, signal = null) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }
    if (signal) {
      options.signal = signal
    }
    return fetch(`${API_BASE_URL}/mistakes/${mistakeId}/analyze/stream`, options)
  },
  
  batchAnalyzeMistakes: (mistakeIds) => request('/mistakes/batch-analyze', {
    method: 'POST',
    body: { mistake_ids: mistakeIds },
  }),
  
  batchAnalyzeMistakesStream: (mistakeIds, signal = null) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ mistake_ids: mistakeIds }),
    }
    if (signal) {
      options.signal = signal
    }
    return fetch(`${API_BASE_URL}/mistakes/batch-analyze/stream`, options)
  },
}

export const notes = {
  getNotes: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/notes${queryString ? `?${queryString}` : ''}`)
  },
  
  getNote: (noteId) => request(`/notes/${noteId}`),
  
  createNote: (data) => request('/notes', {
    method: 'POST',
    body: data,
  }),
  
  updateNote: (noteId, data) => request(`/notes/${noteId}`, {
    method: 'PUT',
    body: data,
  }),
  
  deleteNote: (noteId) => request(`/notes/${noteId}`, {
    method: 'DELETE',
  }),
  
  searchNotes: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/notes/search${queryString ? `?${queryString}` : ''}`)
  },
  
  addTag: (noteId, tag) => request(`/notes/${noteId}/tags`, {
    method: 'POST',
    body: { tag },
  }),
  
  removeTag: (noteId, tag) => request(`/notes/${noteId}/tags/${encodeURIComponent(tag)}`, {
    method: 'DELETE',
  }),
  
  getAllTags: () => request('/notes/tags'),
  
  getStats: () => request('/notes/stats'),
  
  uploadImage: async (formData) => {
    const token = localStorage.getItem('token')
    const response = await fetch(`${API_BASE_URL}/notes/upload-image`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    })
    if (!response.ok) {
      throw new Error('图片上传失败')
    }
    return response.json()
  },
  
  summarizeNote: (noteId) => request(`/notes/${noteId}/summarize`, {
    method: 'POST',
  }),
  
  summarizeNoteStream: (noteId) => {
    return fetch(`${API_BASE_URL}/notes/${noteId}/summarize/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })
  },
  
  organizeNotes: (noteIds) => request('/notes/organize', {
    method: 'POST',
    body: { note_ids: noteIds },
  }),
  
  organizeNotesStream: (noteIds) => {
    return fetch(`${API_BASE_URL}/notes/organize/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ note_ids: noteIds }),
    })
  },
  
  recommendTags: (title, content) => request('/notes/recommend-tags', {
    method: 'POST',
    body: { title, content },
  }),
  
  generateWeeklyReport: (weekStart, weekEnd) => request('/notes/weekly-report', {
    method: 'POST',
    body: { week_start: weekStart, week_end: weekEnd },
  }),
  
  generateWeeklyReportStream: (weekStart, weekEnd) => {
    return fetch(`${API_BASE_URL}/notes/weekly-report/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ week_start: weekStart, week_end: weekEnd }),
    })
  },
}
