export function getEligibleClasses(classes, courseId) {
  if (!courseId) return []
  return (classes || []).filter(item =>
    (item.courses || []).some(course => String(course.course_id) === String(courseId))
  )
}

export function getStudentsForClass(classes, classId) {
  if (!classId) return []
  return (classes || []).find(item => String(item.id) === String(classId))?.students || []
}

export function canGeneratePersonalized({
  loading,
  planLoading,
  plan,
  courseId,
  classId,
  studentId,
  topic,
  resourceTypes,
}) {
  return !loading && !planLoading && Boolean(
    plan && courseId && classId && studentId && topic?.trim() && resourceTypes?.length
  )
}

export function isTerminalGenerationStatus(status) {
  return ['completed', 'partial', 'failed'].includes(status)
}

export function shouldShowPollingWarning(errorCount) {
  return errorCount >= 3
}
