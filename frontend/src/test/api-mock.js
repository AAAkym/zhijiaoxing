import { jest } from '@jest/globals'

const mockFn = (value = {}) => jest.fn(() => Promise.resolve(value))

export const courses = {
  getAll: mockFn({ courses: [] }),
  create: mockFn(),
  update: mockFn(),
  delete: mockFn(),
  getContent: mockFn(),
  getAssessments: mockFn(),
  getAssessmentStats: mockFn(),
  createAssessment: mockFn(),
  updateAssessment: mockFn(),
  deleteAssessment: mockFn(),
}

export const mistakeBook = {
  getMistakes: mockFn({ mistakes: [], total: 0 }),
  getMistake: mockFn(),
  updateStatus: mockFn(),
  deleteMistake: mockFn(),
  batchDelete: mockFn(),
  extractMistakes: mockFn(),
  getStats: mockFn({ stats: {}, recent_mistakes: [] }),
  startReview: mockFn(),
  submitReview: mockFn(),
  getReviewHistory: mockFn(),
  analyzeMistake: mockFn(),
  getErrorAnalysis: mockFn(),
  updateErrorAnalysis: mockFn(),
  getKnowledgeGraph: mockFn(),
  getTargetedPractice: mockFn(),
  submitTargetedFeedback: mockFn(),
  getProgrammingMistakeDetail: mockFn(),
}

export const notes = {
  getNotes: mockFn({ notes: [], total: 0 }),
  getNote: mockFn(),
  createNote: mockFn(),
  updateNote: mockFn(),
  deleteNote: mockFn(),
  searchNotes: mockFn(),
  addTag: mockFn(),
  removeTag: mockFn(),
  getAllTags: mockFn({ tags: [] }),
  getStats: mockFn(),
  uploadImage: mockFn(),
  summarizeNote: mockFn(),
  summarizeNoteStream: mockFn(),
  organizeNotes: mockFn(),
  organizeNotesStream: mockFn(),
}

export const auth = {}
export const content = {}
export const courseGeneration = {}
export const teacher = {}
export const student = {}
export const admin = {}
export const interactions = {}
export const interaction = {
  getHandRaises: mockFn({ hand_raises: [] }),
  getQuestions: mockFn({ questions: [] }),
  getDiscussions: mockFn({ discussions: [] }),
  createHandRaise: mockFn(),
  createQuestion: mockFn(),
  createDiscussion: mockFn(),
}
export const aiAnalysis = {}
export const achievements = {}
export const systemSettings = {}
export const tokenUsage = {}
export const knowledgeGraph = {}

export default {
  courses,
  mistakeBook,
  notes,
}
