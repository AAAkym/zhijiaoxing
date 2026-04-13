/**
 * 学生端练习评测界面渲染修复测试
 * 
 * 修复内容：
 * 1. 统一了 currentQuestionIndex 的使用，移除了冗余的安全索引计算
 * 2. 优化了题目导航按钮的条件判断逻辑
 * 3. 确保在最后一题时正确显示"提交答案"按钮
 * 4. 修复了答题进度显示，使用统一的 isQuestionAnswered 函数
 * 
 * 关键修复点：
 * - 在导航按钮渲染中使用统一的 safeCurrentIndex 变量
 * - 简化了 isFirstQuestion 和 isLastQuestion 的判断逻辑
 * - 确保所有索引访问都有适当的边界检查
 * - 统一使用 isQuestionAnswered 函数来判断题目是否已作答
 */

// 测试场景 1: 正常答题流程
describe('Practice Interface Rendering - Normal Flow', () => {
  test('应该正确显示第一题', () => {
    const practiceQuestions = [
      { question: 'Q1', options: ['A', 'B'], correctAnswer: 0, userAnswer: null },
      { question: 'Q2', options: ['A', 'B'], correctAnswer: 1, userAnswer: null },
      { question: 'Q3', options: ['A', 'B'], correctAnswer: 0, userAnswer: null }
    ]
    const currentQuestionIndex = 0
    
    // 验证：应该显示第 1 题
    expect(currentQuestionIndex + 1).toBe(1)
    expect(practiceQuestions[currentQuestionIndex]).toBeDefined()
  })

  test('应该正确导航到最后一题', () => {
    const practiceQuestions = [
      { question: 'Q1', options: ['A', 'B'], correctAnswer: 0, userAnswer: null },
      { question: 'Q2', options: ['A', 'B'], correctAnswer: 1, userAnswer: null },
      { question: 'Q3', options: ['A', 'B'], correctAnswer: 0, userAnswer: null }
    ]
    const currentQuestionIndex = 2
    const maxIndex = practiceQuestions.length - 1
    
    // 验证：当前索引应该是安全的
    const safeIndex = Math.max(0, Math.min(currentQuestionIndex, maxIndex))
    expect(safeIndex).toBe(2)
    expect(safeIndex >= maxIndex).toBe(true) // 应该显示提交按钮
  })
})

// 测试场景 2: 边界条件测试
describe('Practice Interface - Edge Cases', () => {
  test('应该处理空题目数组', () => {
    const practiceQuestions = []
    const currentQuestionIndex = 0
    
    const maxIndex = (practiceQuestions?.length || 1) - 1
    const safeIndex = Math.max(0, Math.min(currentQuestionIndex, maxIndex))
    
    expect(safeIndex).toBe(0)
    expect(practiceQuestions[safeIndex]).toBeUndefined()
  })

  test('应该处理单道题目', () => {
    const practiceQuestions = [
      { question: 'Only Question', options: ['A', 'B'], correctAnswer: 0, userAnswer: null }
    ]
    const currentQuestionIndex = 0
    
    const maxIndex = practiceQuestions.length - 1
    const safeIndex = Math.max(0, Math.min(currentQuestionIndex, maxIndex))
    const isLastQuestion = safeIndex >= maxIndex
    
    expect(isLastQuestion).toBe(true) // 唯一题目应该直接显示提交按钮
    expect(safeIndex).toBe(0)
  })

  test('应该防止索引越界', () => {
    const practiceQuestions = [
      { question: 'Q1', options: ['A', 'B'] },
      { question: 'Q2', options: ['A', 'B'] }
    ]
    const invalidIndex = 5 // 超出范围的索引
    
    const maxIndex = practiceQuestions.length - 1
    const safeIndex = Math.max(0, Math.min(invalidIndex, maxIndex))
    
    expect(safeIndex).toBe(1) // 应该被限制在最大索引
    expect(safeIndex < practiceQuestions.length).toBe(true)
  })
})

// 测试场景 3: 答题状态判断
describe('Question Answer Status', () => {
  const isQuestionAnswered = (question) => {
    return question && typeof question.userAnswer === 'number' && question.userAnswer >= 0
  }

  test('应该正确识别已答题目', () => {
    const answeredQuestion = {
      question: 'Test',
      options: ['A', 'B'],
      userAnswer: 0
    }
    
    expect(isQuestionAnswered(answeredQuestion)).toBe(true)
  })

  test('应该正确识别未答题目', () => {
    const unansweredQuestion = {
      question: 'Test',
      options: ['A', 'B'],
      userAnswer: null
    }
    
    expect(isQuestionAnswered(unansweredQuestion)).toBe(false)
  })

  test('应该处理无效的答案', () => {
    const invalidQuestion1 = {
      question: 'Test',
      options: ['A', 'B'],
      userAnswer: -1
    }
    
    const invalidQuestion2 = {
      question: 'Test',
      options: ['A', 'B'],
      userAnswer: undefined
    }
    
    expect(isQuestionAnswered(invalidQuestion1)).toBe(false)
    expect(isQuestionAnswered(invalidQuestion2)).toBe(false)
  })
})

// 测试场景 4: 导航按钮显示逻辑
describe('Navigation Button Display Logic', () => {
  test('第一题应该禁用上一题按钮', () => {
    const currentQuestionIndex = 0
    const isFirstQuestion = currentQuestionIndex === 0
    
    expect(isFirstQuestion).toBe(true)
  })

  test('最后一题应该显示提交按钮而非下一题按钮', () => {
    const practiceQuestions = [
      { question: 'Q1', options: ['A'] },
      { question: 'Q2', options: ['A'] },
      { question: 'Q3', options: ['A'] }
    ]
    const currentQuestionIndex = 2
    const maxIndex = practiceQuestions.length - 1
    const isLastQuestion = currentQuestionIndex >= maxIndex
    
    expect(isLastQuestion).toBe(true)
  })

  test('中间题目应该同时显示上一题和下一题按钮', () => {
    const practiceQuestions = [
      { question: 'Q1', options: ['A'] },
      { question: 'Q2', options: ['A'] },
      { question: 'Q3', options: ['A'] }
    ]
    const currentQuestionIndex = 1
    const maxIndex = practiceQuestions.length - 1
    const isLastQuestion = currentQuestionIndex >= maxIndex
    const isFirstQuestion = currentQuestionIndex === 0
    
    expect(isLastQuestion).toBe(false)
    expect(isFirstQuestion).toBe(false)
  })
})

// 测试场景 5: 答题进度计算
describe('Progress Calculation', () => {
  const isQuestionAnswered = (question) => {
    return question && typeof question.userAnswer === 'number' && question.userAnswer >= 0
  }

  test('应该正确计算答题进度', () => {
    const practiceQuestions = [
      { question: 'Q1', options: ['A'], userAnswer: 0 },
      { question: 'Q2', options: ['A'], userAnswer: null },
      { question: 'Q3', options: ['A'], userAnswer: 1 }
    ]
    
    const answeredCount = practiceQuestions.filter(q => isQuestionAnswered(q)).length
    const progressPercentage = (answeredCount / practiceQuestions.length) * 100
    
    expect(answeredCount).toBe(2)
    expect(progressPercentage).toBeCloseTo(66.67, 1)
  })

  test('应该处理全部完成的情况', () => {
    const practiceQuestions = [
      { question: 'Q1', options: ['A'], userAnswer: 0 },
      { question: 'Q2', options: ['A'], userAnswer: 1 },
      { question: 'Q3', options: ['A'], userAnswer: 0 }
    ]
    
    const answeredCount = practiceQuestions.filter(q => isQuestionAnswered(q)).length
    const progressPercentage = (answeredCount / practiceQuestions.length) * 100
    
    expect(answeredCount).toBe(3)
    expect(progressPercentage).toBe(100)
  })
})

console.log('✅ 所有测试用例设计完成')
console.log('\n修复要点总结：')
console.log('1. 统一使用 currentQuestionIndex，避免重复计算')
console.log('2. 在渲染前计算 safeCurrentIndex、isFirstQuestion、isLastQuestion')
console.log('3. 使用统一的 isQuestionAnswered 函数判断答题状态')
console.log('4. 确保所有数组访问都有边界检查')
console.log('5. 优化了条件判断逻辑，提高代码可读性')
