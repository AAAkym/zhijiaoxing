/**
 * Service Worker for PWA
 * 
 * 提供离线访问能力、缓存策略和推送通知支持
 */

const CACHE_NAME = 'zhijiaoxing-cache-v1'
const STATIC_CACHE_NAME = 'zhijiaoxing-static-v1'
const DYNAMIC_CACHE_NAME = 'zhijiaoxing-dynamic-v1'

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
]

// 安装事件 - 预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[Service Worker] Install failed:', error)
      })
  )
})

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 删除旧的缓存
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients')
        return self.clients.claim()
      })
  )
})

// 获取事件 - 缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // 跳过非GET请求
  if (request.method !== 'GET') {
    return
  }
  
  // 跳过chrome扩展请求
  if (url.protocol === 'chrome-extension:') {
    return
  }
  
  // 策略1: 缓存优先 - 静态资源
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request))
    return
  }
  
  // 策略2: 网络优先 - API请求
  if (isAPIRequest(request)) {
    event.respondWith(networkFirst(request))
    return
  }
  
  // 策略3: 缓存然后更新 - 页面请求
  if (isPageRequest(request)) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }
  
  // 默认策略: 网络优先
  event.respondWith(networkFirst(request))
})

/**
 * 判断是否是静态资源
 */
function isStaticAsset(request) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.json'
  ]
  
  const url = new URL(request.url)
  return staticExtensions.some(ext => url.pathname.endsWith(ext))
}

/**
 * 判断是否是API请求
 */
function isAPIRequest(request) {
  const url = new URL(request.url)
  return url.pathname.startsWith('/api/') || 
         url.pathname.startsWith('/auth/')
}

/**
 * 判断是否是页面请求
 */
function isPageRequest(request) {
  const acceptHeader = request.headers.get('accept') || ''
  return acceptHeader.includes('text/html')
}

/**
 * 缓存优先策略
 */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE_NAME)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    // 在后台更新缓存
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone())
        }
      })
      .catch(() => {})
    
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.error('[Service Worker] Cache first failed:', error)
    throw error
  }
}

/**
 * 网络优先策略
 */
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME)
  
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // 更新缓存
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url)
    
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // 返回离线页面
    if (isPageRequest(request)) {
      return caches.match('/offline.html')
    }
    
    throw error
  }
}

/**
 * 缓存然后更新策略
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME)
  const cachedResponse = await cache.match(request)
  
  // 发起网络请求更新缓存
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    })
    .catch((error) => {
      console.log('[Service Worker] Stale while revalidate failed:', error)
      throw error
    })
  
  // 优先返回缓存，如果没有缓存则等待网络请求
  return cachedResponse || fetchPromise
}

// 推送通知事件
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event)
  
  let notificationData = {
    title: '智教星',
    body: '您有一条新消息',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default',
    requireInteraction: false,
    data: {
      url: '/'
    }
  }
  
  // 解析推送数据
  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = { ...notificationData, ...data }
    } catch (error) {
      notificationData.body = event.data.text()
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: notificationData.actions || [
        {
          action: 'open',
          title: '打开'
        },
        {
          action: 'close',
          title: '关闭'
        }
      ]
    })
  )
})

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event)
  
  event.notification.close()
  
  const notificationData = event.notification.data || {}
  const url = notificationData.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 查找已打开的窗口
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        
        // 打开新窗口
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})

// 后台同步事件
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag)
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData())
  }
})

/**
 * 同步数据
 */
async function syncData() {
  try {
    // 从IndexedDB获取待同步的数据
    const db = await openDB('zhijiaoxing-sync', 1)
    const tx = db.transaction('sync-queue', 'readonly')
    const store = tx.objectStore('sync-queue')
    const requests = await store.getAll()
    
    // 发送同步请求
    for (const request of requests) {
      try {
        await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(request.body)
        })
        
        // 删除已同步的请求
        const deleteTx = db.transaction('sync-queue', 'readwrite')
        const deleteStore = deleteTx.objectStore('sync-queue')
        await deleteStore.delete(request.id)
      } catch (error) {
        console.error('[Service Worker] Sync request failed:', error)
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error)
  }
}

// 消息事件 - 与主线程通信
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data)
  
  const { type, payload } = event.data
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME })
      break
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys()
          .then((cacheNames) => {
            return Promise.all(
              cacheNames.map((cacheName) => caches.delete(cacheName))
            )
          })
          .then(() => {
            event.ports[0].postMessage({ success: true })
          })
      )
      break
      
    default:
      console.log('[Service Worker] Unknown message type:', type)
  }
})

// 周期性后台同步（如果支持）
if ('periodicSync' in self.registration) {
  self.registration.periodicSync.register('sync-data', {
    minInterval: 24 * 60 * 60 * 1000 // 24小时
  }).catch((error) => {
    console.log('[Service Worker] Periodic sync registration failed:', error)
  })
}

console.log('[Service Worker] Service worker loaded')
