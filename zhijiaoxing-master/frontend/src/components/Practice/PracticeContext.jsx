import React, { createContext, useContext, useReducer, useCallback } from 'react'

const PracticeContext = createContext(null)

const initialState = {
  currentView: 'selector',
  selectedPractice: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  markedQuestions: new Set(),
  startTime: null,
  endTime: null,
  isSubmitting: false,
  result: null,
  filters: {
    subject: 'all',
    chapter: 'all',
    difficulty: 'all',
    type: 'all'
  }
}

function practiceReducer(state, action) {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.payload }
    
    case 'SELECT_PRACTICE': {
      // ========== questions 数据校验：防止无效数据导致下游组件黑屏 ==========
      // 修复根因：PracticeSelector 可能传入 undefined、非数组或含无效元素的 questions
      let validatedQuestions = action.payload.questions

      // 确保是数组类型
      if (!Array.isArray(validatedQuestions)) {
        console.warn(
          `[PracticeContext] SELECT_PRACTICE 收到非数组类型的 questions:`,
          typeof validatedQuestions,
          '已替换为空数组'
        )
        validatedQuestions = []
      }

      // 过滤并修正每道题的数据结构，确保必要字段存在
      validatedQuestions = validatedQuestions
        .map((q, idx) => {
          if (!q || typeof q !== 'object') {
            console.warn(`[PracticeContext] 第 ${idx + 1} 题数据无效（非对象），已跳过`)
            return null
          }
          return {
            id: q.id ?? idx + 1,
            question: q.question || '',
            title: q.title || q.question || '',
            description: q.description || '',
            input_format: q.input_format || '',
            output_format: q.output_format || '',
            constraints: q.constraints || '',
            samples: Array.isArray(q.samples) ? q.samples : [],
            standard_answer: q.standard_answer || '',
            language: q.language || 'python',
            type: q.type || 'essay',
            options: Array.isArray(q.options) ? q.options : [],
            score: typeof q.score === 'number' ? q.score : 10,
            correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : null,
            explanation: q.explanation || ''
          }
        })
        .filter(Boolean) // 移除 null 条目

      if (validatedQuestions.length === 0 && action.payload.questions?.length > 0) {
        console.warn(
          `[PracticeContext] SELECT_PRACTICE: 原始 ${action.payload.questions.length} 题经校验后全部无效`
        )
      }

      console.log(`[PracticeContext] SELECT_PRACTICE: 校验后题目数 ${validatedQuestions.length}`)

      return {
        ...state,
        selectedPractice: action.payload.practice,
        questions: validatedQuestions,
        currentIndex: 0,
        answers: {},
        markedQuestions: new Set(),
        startTime: Date.now(),
        endTime: null,
        result: null,
        currentView: 'practice'
      }
    }
    
    case 'SET_ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.payload.questionId]: action.payload.answer }
      }
    
    case 'SET_CURRENT_INDEX':
      return { ...state, currentIndex: action.payload }
    
    case 'TOGGLE_MARK':
      const newMarked = new Set(state.markedQuestions)
      if (newMarked.has(action.payload)) {
        newMarked.delete(action.payload)
      } else {
        newMarked.add(action.payload)
      }
      return { ...state, markedQuestions: newMarked }
    
    case 'SET_FILTER':
      return { ...state, filters: { ...state.filters, ...action.payload } }
    
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true }
    
    case 'SUBMIT_SUCCESS':
      return { 
        ...state, 
        isSubmitting: false, 
        result: action.payload,
        endTime: Date.now(),
        currentView: 'result'
      }
    
    case 'RESET':
      return { ...initialState }
    
    default:
      return state
  }
}

export function PracticeProvider({ children }) {
  const [state, dispatch] = useReducer(practiceReducer, initialState)

  const selectPractice = useCallback((practice, questions) => {
    dispatch({ type: 'SELECT_PRACTICE', payload: { practice, questions } })
  }, [])

  const setAnswer = useCallback((questionId, answer) => {
    dispatch({ type: 'SET_ANSWER', payload: { questionId, answer } })
  }, [])

  const setCurrentIndex = useCallback((index) => {
    dispatch({ type: 'SET_CURRENT_INDEX', payload: index })
  }, [])

  const toggleMark = useCallback((questionId) => {
    dispatch({ type: 'TOGGLE_MARK', payload: questionId })
  }, [])

  const setFilter = useCallback((filter) => {
    dispatch({ type: 'SET_FILTER', payload: filter })
  }, [])

  const submitPractice = useCallback(async (submitFn) => {
    dispatch({ type: 'SUBMIT_START' })
    try {
      const result = await submitFn()
      dispatch({ type: 'SUBMIT_SUCCESS', payload: result })
      return result
    } catch (error) {
      dispatch({ type: 'SUBMIT_START' })
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const value = {
    ...state,
    selectPractice,
    setAnswer,
    setCurrentIndex,
    toggleMark,
    setFilter,
    submitPractice,
    reset,
    dispatch
  }

  return (
    <PracticeContext.Provider value={value}>
      {children}
    </PracticeContext.Provider>
  )
}

export function usePractice() {
  const context = useContext(PracticeContext)
  if (!context) {
    throw new Error('usePractice must be used within a PracticeProvider')
  }
  return context
}

export default PracticeContext
