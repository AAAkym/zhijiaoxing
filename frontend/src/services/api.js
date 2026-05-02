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

export const courseGeneration = {
  getConfigs: () => request('/course-generation/configs'),

  getConfig: (id) => request(`/course-generation/configs/${id}`),

  createConfig: (data) => request('/course-generation/configs', {
    method: 'POST',
    body: data,
  }),

  updateConfig: (id, data) => request(`/course-generation/configs/${id}`, {
    method: 'PUT',
    body: data,
  }),

  generateStep: (configId, step) => request(`/course-generation/configs/${configId}/generate/${step}`, {
    method: 'POST',
  }),

  confirmStep: (configId, step, data = {}) => request(`/course-generation/configs/${configId}/confirm/${step}`, {
    method: 'POST',
    body: data,
  }),

  getVersions: (configId, step) => request(`/course-generation/configs/${configId}/versions/${step}`),

  getVersionDiff: (configId, step, versionA, versionB) =>
    request(`/course-generation/configs/${configId}/versions/${step}/diff?version_a=${versionA}&version_b=${versionB}`),

  rollback: (configId, step, versionNumber) =>
    request(`/course-generation/configs/${configId}/rollback/${step}/${versionNumber}`, {
      method: 'POST',
    }),

  submitReview: (configId) => request(`/course-generation/configs/${configId}/submit-review`, {
    method: 'POST',
  }),

  approveReview: (configId, reviewId, data) => request(`/course-generation/configs/${configId}/approve`, {
    method: 'POST',
    body: { review_id: reviewId, ...data },
  }),

  sharePeerReview: (configId, data) => request(`/course-generation/configs/${configId}/share-peer-review`, {
    method: 'POST',
    body: data,
  }),

  getPeerReviews: (configId) => request(`/course-generation/configs/${configId}/peer-reviews`),

  getPendingReviews: () => request('/course-generation/pending-reviews'),

  finalize: (configId) => request(`/course-generation/configs/${configId}/finalize`, {
    method: 'POST',
  }),

  getSteps: () => request('/course-generation/steps'),
}

export const classManagement = {
  getClasses: () => request('/classes'),

  getClass: (id) => request(`/classes/${id}`),

  createClass: (data) => request('/classes', { method: 'POST', body: data }),

  updateClass: (id, data) => request(`/classes/${id}`, { method: 'PUT', body: data }),

  deleteClass: (id) => request(`/classes/${id}`, { method: 'DELETE' }),

  addStudent: (classId, data) => request(`/classes/${classId}/students`, { method: 'POST', body: data }),

  removeStudent: (classId, studentId) => request(`/classes/${classId}/students/${studentId}`, { method: 'DELETE' }),

  assignCourse: (classId, data) => request(`/classes/${classId}/courses`, { method: 'POST', body: data }),

  removeCourse: (classId, assignmentId) => request(`/classes/${classId}/courses/${assignmentId}`, { method: 'DELETE' }),

  getStats: (classId) => request(`/classes/${classId}/stats`),

  batchAddStudents: (data) => request('/classes/batch-students', { method: 'POST', body: data }),

  getAvailableStudents: () => request('/students/available'),

  addExistingStudent: (classId, data) => request(`/classes/${classId}/students/existing`, { method: 'POST', body: data }),

  getStudentProfile: (classId, userId) => request(`/classes/${classId}/students/${userId}/profile`),

  getClassStudentsProfiles: (classId) => request(`/classes/${classId}/students/profiles`),
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

  videoAssistantChat: (data) => request('/video_assistant', {
    method: 'POST',
    body: data,
  }),

  videoAssistantStream: (data) => {
    const payload = {
      question: data.question || data.message || '',
      video_id: data.video_id || null,
      course_id: data.course_id || null,
      video_timestamp: data.video_timestamp || null,
      topic: data.topic || '',
    }
    return fetch(`${API_BASE_URL}/video_assistant_stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
  },
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

  deleteMistake: (id) => request(`/mistakes/${id}`, {
    method: 'DELETE',
  }),

  batchDelete: (ids) => request('/mistakes/batch-delete', {
    method: 'POST',
    body: { ids },
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

  getErrorAnalysis: (mistakeId) => request(`/mistakes/${mistakeId}/error-analysis`),

  updateErrorAnalysis: (mistakeId, payload) => request(`/mistakes/${mistakeId}/error-analysis`, {
    method: 'PUT',
    body: payload,
  }),

  getKnowledgeGraph: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/mistakes/knowledge-graph${queryString ? `?${queryString}` : ''}`)
  },

  getTargetedPractice: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/mistakes/targeted-practice${queryString ? `?${queryString}` : ''}`)
  },

  submitTargetedFeedback: (payload) => request('/mistakes/targeted-practice/feedback', {
    method: 'POST',
    body: payload,
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

  generateTargetedPractice: (payload) => request('/mistakes/targeted-practice/generate', {
    method: 'POST',
    body: payload,
  }),

  generateTargetedPracticeStream: (payload, signal = null) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    }
    if (signal) {
      options.signal = signal
    }
    return fetch(`${API_BASE_URL}/mistakes/targeted-practice/generate/stream`, options)
  },

  generateAdaptivePlan: (payload) => request('/mistakes/targeted-practice/adaptive-plan', {
    method: 'POST',
    body: payload,
  }),

  submitTargetedFeedback: (payload) => request('/mistakes/targeted-practice/feedback', {
    method: 'POST',
    body: payload,
  }),

  exportMistakes: (payload) => fetch(`${API_BASE_URL}/mistakes/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }),
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

export const teacher = {
  getDashboardStats: () => request('/teacher/dashboard/stats'),

  getStudentProgressDistribution: () => request('/teacher/analytics/student-progress'),

  getWeeklyActivity: () => request('/teacher/analytics/weekly-activity'),

  getLearningTrend: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/teacher/analytics/learning-trend${queryString ? `?${queryString}` : ''}`)
  },

  getRecentActivities: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/teacher/recent-activities${queryString ? `?${queryString}` : ''}`)
  },
}

export const analytics = {
  getUserGrowth: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/analytics/user-growth${queryString ? `?${queryString}` : ''}`)
  },

  getCourseActivity: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/analytics/course-activity${queryString ? `?${queryString}` : ''}`)
  },

  getLearningProgress: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/analytics/learning-progress${queryString ? `?${queryString}` : ''}`)
  },

  getDailyActivity: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/analytics/daily-activity${queryString ? `?${queryString}` : ''}`)
  },

  getPerformanceMetrics: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/analytics/performance-metrics${queryString ? `?${queryString}` : ''}`)
  },

  getSystemUsage: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return request(`/analytics/system-usage${queryString ? `?${queryString}` : ''}`)
  },
}

export const achievements = {
  getAll: () => request('/achievements'),

  check: () => request('/achievements/check', {
    method: 'POST',
  }),

  getUnlocked: () => request('/achievements/unlocked'),

  getNotifications: () => request('/achievements/notifications'),

  getStats: () => request('/achievements/stats'),
}

export const profileApi = {
  getProfile: () => request('/profile'),

  updateProfile: (data) => request('/profile', { method: 'PUT', body: data }),

  startDialog: () => request('/profile/dialog/start', { method: 'POST' }),

  continueDialog: (data) => request('/profile/dialog/continue', { method: 'POST', body: data }),

  getDialogHistory: () => request('/profile/dialog/history'),

  getDimensions: () => request('/profile/dimensions'),

  syncProfile: (source = 'all') => request('/profile/sync', { method: 'POST', body: { source } }),

  getInsight: () => request('/profile/insight'),

  getStudentProfile: (userId) => request(`/profile/teacher/${userId}`),
}

export const learningPathApi = {
  getPaths: () => request('/learning-path'),

  generatePath: (courseId) => request('/learning-path/generate', { method: 'POST', body: { course_id: courseId } }),

  getPathDetail: (pathId) => request(`/learning-path/${pathId}`),

  updateNodeStatus: (pathId, nodeId, status) => request(`/learning-path/${pathId}/node/${nodeId}`, { method: 'PUT', body: { status } }),

  generatePlan: () => request('/learning-plan/generate', { method: 'POST' }),

  getPlans: () => request('/learning-plans'),

  getRecommendations: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/recommendations${qs ? `?${qs}` : ''}`)
  },

  generateRecommendations: (limit = 20) => request('/recommendations/generate', { method: 'POST', body: { limit } }),

  completeRecommendation: (recId) => request(`/recommendations/${recId}/complete`, { method: 'POST' }),

  dismissRecommendation: (recId) => request(`/recommendations/${recId}/dismiss`, { method: 'POST' }),

  feedbackRecommendation: (recId, score) => request(`/recommendations/${recId}/feedback`, { method: 'POST', body: { score } }),
}
