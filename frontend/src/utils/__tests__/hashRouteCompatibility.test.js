import { expect, jest, test } from '@jest/globals'
import { normalizeHashRoute } from '../hashRouteCompatibility'

test('converts direct teacher path into HashRouter path', () => {
  const replaceState = jest.fn()
  const changed = normalizeHashRoute(
    { pathname: '/teacher', search: '?tab=content', hash: '' },
    { replaceState }
  )

  expect(changed).toBe(true)
  expect(replaceState).toHaveBeenCalledWith(null, '', '/#/teacher?tab=content')
})

test('keeps existing hash and public root unchanged', () => {
  const replaceState = jest.fn()
  expect(normalizeHashRoute({ pathname: '/', search: '', hash: '' }, { replaceState })).toBe(false)
  expect(normalizeHashRoute({ pathname: '/', search: '', hash: '#/teacher' }, { replaceState })).toBe(false)
  expect(replaceState).not.toHaveBeenCalled()
})
