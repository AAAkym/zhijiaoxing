export function resolveAnswerDisplay(answer, options) {
  if (answer === null || answer === undefined || answer === '') {
    return { display: '未作答', label: null, optionText: null, index: null, isResolved: false }
  }

  if (options && Array.isArray(options) && options.length > 0) {
    const idx = parseInt(answer, 10)
    if (!isNaN(idx) && idx >= 0 && idx < options.length) {
      const label = String.fromCharCode(65 + idx)
      const optionText = typeof options[idx] === 'string' ? options[idx] : String(options[idx])
      return {
        display: `${label}. ${optionText}`,
        label,
        optionText,
        index: idx,
        isResolved: true
      }
    }
  }

  return { display: String(answer), label: null, optionText: null, index: null, isResolved: false }
}

export function safeAnswerCompare(answer, correctAnswer, options) {
  if (answer === null || answer === undefined || answer === '') return false
  if (correctAnswer === null || correctAnswer === undefined) return false

  if (options && Array.isArray(options) && options.length > 0) {
    const userNum = Number(answer)
    const correctNum = Number(correctAnswer)
    if (!isNaN(userNum) && !isNaN(correctNum)) {
      return userNum === correctNum
    }
  }

  return String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()
}

export function validateMistakeData(mistake) {
  const issues = []

  if (!mistake) {
    return { valid: false, issues: [{ type: 'missing_data', severity: 'error', message: '错题数据缺失' }] }
  }

  const options = mistake.options || mistake.original_question?.options || null
  const questionType = mistake.question_type || mistake.original_question?.type || 'unknown'

  if (questionType === 'choice' && options && Array.isArray(options)) {
    const userAnswer = mistake.user_answer
    const correctAnswer = mistake.correct_answer

    if (userAnswer !== null && userAnswer !== undefined && userAnswer !== '') {
      const userIdx = parseInt(userAnswer, 10)
      if (isNaN(userIdx)) {
        issues.push({
          type: 'user_answer_format_mismatch',
          severity: 'warning',
          message: `选择题的用户答案格式异常: "${userAnswer}"，期望为数字索引`
        })
      } else if (userIdx < 0 || userIdx >= options.length) {
        issues.push({
          type: 'user_answer_out_of_range',
          severity: 'error',
          message: `用户答案索引(${userIdx})超出选项范围(0-${options.length - 1})`
        })
      }
    }

    if (correctAnswer !== null && correctAnswer !== undefined && correctAnswer !== '') {
      const correctIdx = parseInt(correctAnswer, 10)
      if (isNaN(correctIdx)) {
        issues.push({
          type: 'correct_answer_format_mismatch',
          severity: 'warning',
          message: `选择题的正确答案格式异常: "${correctAnswer}"，期望为数字索引`
        })
      } else if (correctIdx < 0 || correctIdx >= options.length) {
        issues.push({
          type: 'correct_answer_out_of_range',
          severity: 'error',
          message: `正确答案索引(${correctIdx})超出选项范围(0-${options.length - 1})`
        })
      }
    }
  }

  if (mistake.original_question) {
    const originalContent = mistake.original_question.content || mistake.original_question.question || ''
    const storedContent = mistake.question_content || ''
    if (originalContent && storedContent &&
        storedContent.trim() !== originalContent.trim() &&
        !storedContent.trim().includes(originalContent.trim()) &&
        !originalContent.trim().includes(storedContent.trim())) {
      issues.push({
        type: 'content_mismatch',
        severity: 'warning',
        message: '存储的题目内容与原始题目不一致'
      })
    }
  }

  if (mistake.assessment_id && !options && questionType === 'choice') {
    issues.push({
      type: 'missing_options',
      severity: 'warning',
      message: '选择题缺少选项数据，答案显示可能不准确'
    })
  }

  return {
    valid: issues.length === 0,
    issues,
    hasErrors: issues.some(i => i.severity === 'error'),
    hasWarnings: issues.some(i => i.severity === 'warning')
  }
}

export function getAnswerDisplayText(mistake, answerField = 'user_answer') {
  const options = mistake.options || mistake.original_question?.options || null
  const answer = mistake[answerField]

  if (answerField === 'user_answer' && mistake.user_answer_display) {
    return mistake.user_answer_display
  }
  if (answerField === 'correct_answer' && mistake.correct_answer_display) {
    return mistake.correct_answer_display
  }

  const resolved = resolveAnswerDisplay(answer, options)
  return resolved.display
}
