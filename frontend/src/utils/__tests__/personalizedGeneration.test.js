import {
  canGeneratePersonalized,
  getEligibleClasses,
  getStudentsForClass,
  isTerminalGenerationStatus,
  shouldShowPollingWarning,
} from '../personalizedGeneration'
import { expect, test } from '@jest/globals'

const classes = [
  { id: 1, courses: [{ course_id: 10 }], students: [{ user_id: 101 }] },
  { id: 2, courses: [{ course_id: 20 }], students: [{ user_id: 202 }] },
]

test('course and class selections only expose valid downstream options', () => {
  expect(getEligibleClasses(classes, 10).map(item => item.id)).toEqual([1])
  expect(getStudentsForClass(classes, 1).map(item => item.user_id)).toEqual([101])
  expect(getStudentsForClass(classes, '')).toEqual([])
})

test('generation stays disabled until course class student and profile plan are ready', () => {
  const ready = {
    loading: false,
    planLoading: false,
    plan: { strategy: {} },
    courseId: '10',
    classId: '1',
    studentId: '101',
    topic: '循环结构',
    resourceTypes: ['document'],
  }
  expect(canGeneratePersonalized(ready)).toBe(true)
  expect(canGeneratePersonalized({ ...ready, studentId: '' })).toBe(false)
  expect(canGeneratePersonalized({ ...ready, plan: null })).toBe(false)
  expect(canGeneratePersonalized({ ...ready, loading: true })).toBe(false)
})

test('polling stops for every terminal state and warns after repeated interruption', () => {
  expect(isTerminalGenerationStatus('generating')).toBe(false)
  expect(isTerminalGenerationStatus('completed')).toBe(true)
  expect(isTerminalGenerationStatus('partial')).toBe(true)
  expect(isTerminalGenerationStatus('failed')).toBe(true)
  expect(shouldShowPollingWarning(2)).toBe(false)
  expect(shouldShowPollingWarning(3)).toBe(true)
})
