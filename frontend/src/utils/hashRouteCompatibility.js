const HASH_ROUTE_PREFIXES = ['/admin', '/teacher', '/student', '/ai-tutor', '/login', '/welcome']

export function normalizeHashRoute(
  locationObject = window.location,
  historyObject = window.history
) {
  const path = locationObject.pathname || '/'
  const isAppRoute = HASH_ROUTE_PREFIXES.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  )
  if (!locationObject.hash && path !== '/' && isAppRoute) {
    const search = locationObject.search || ''
    historyObject.replaceState(null, '', `/#${path}${search}`)
    return true
  }
  return false
}
