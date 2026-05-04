/**
 * PWA工具函数
 * 
 * 提供Service Worker注册、推送通知、后台同步等功能
 */

/**
 * 注册Service Worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    })

    console.log('[PWA] Service Worker registered:', registration)

    // 监听Service Worker更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 有新版本可用
          console.log('[PWA] New version available')
          
          // 可以在这里提示用户刷新页面
          if (window.confirm('发现新版本，是否立即更新？')) {
            newWorker.postMessage({ type: 'SKIP_WAITING' })
            window.location.reload()
          }
        }
      })
    })

    return registration
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error)
    return null
  }
}

/**
 * 注销Service Worker
 */
export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.unregister()
    console.log('[PWA] Service Worker unregistered')
  } catch (error) {
    console.error('[PWA] Service Worker unregistration failed:', error)
  }
}

/**
 * 检查Service Worker更新
 */
export async function checkForUpdates() {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.update()
    console.log('[PWA] Checked for updates')
    return true
  } catch (error) {
    console.error('[PWA] Update check failed:', error)
    return false
  }
}

/**
 * 请求通知权限
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('[PWA] Notifications not supported')
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    console.log('[PWA] Notification permission:', permission)
    return permission === 'granted'
  } catch (error) {
    console.error('[PWA] Notification permission request failed:', error)
    return false
  }
}

/**
 * 订阅推送通知
 */
export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[PWA] Push notifications not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    
    // 检查现有订阅
    let subscription = await registration.pushManager.getSubscription()
    
    if (!subscription) {
      // 创建新订阅
      // 注意：实际使用时需要替换为真实的VAPID公钥
      const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY'
      
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      })
      
      console.log('[PWA] Push notification subscribed:', subscription)
      
      // 发送订阅信息到服务器
      await sendSubscriptionToServer(subscription)
    }
    
    return subscription
  } catch (error) {
    console.error('[PWA] Push notification subscription failed:', error)
    return null
  }
}

/**
 * 取消推送通知订阅
 */
export async function unsubscribeFromPushNotifications() {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    
    if (subscription) {
      await subscription.unsubscribe()
      console.log('[PWA] Push notification unsubscribed')
      
      // 通知服务器取消订阅
      await removeSubscriptionFromServer(subscription)
    }
    
    return true
  } catch (error) {
    console.error('[PWA] Push notification unsubscription failed:', error)
    return false
  }
}

/**
 * 注册后台同步
 */
export async function registerBackgroundSync(tag = 'sync-data') {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.log('[PWA] Background sync not supported')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.sync.register(tag)
    console.log('[PWA] Background sync registered:', tag)
    return true
  } catch (error) {
    console.error('[PWA] Background sync registration failed:', error)
    return false
  }
}

/**
 * 检查PWA安装状态
 */
export function checkPWAStatus() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone ||
                      document.referrer.includes('android-app://')
  
  const isServiceWorkerSupported = 'serviceWorker' in navigator
  const isPushSupported = 'PushManager' in window
  const isSyncSupported = 'SyncManager' in window
  
  return {
    isStandalone,
    isServiceWorkerSupported,
    isPushSupported,
    isSyncSupported,
    isOnline: navigator.onLine
  }
}

/**
 * 添加到主屏幕提示
 */
export function setupAddToHomeScreen() {
  let deferredPrompt = null

  window.addEventListener('beforeinstallprompt', (event) => {
    // 阻止默认提示
    event.preventDefault()
    deferredPrompt = event
    
    // 可以在这里显示自定义的安装提示UI
    console.log('[PWA] Before install prompt captured')
    
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('pwa:installable', {
      detail: { prompt: () => showInstallPrompt() }
    }))
  })

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed')
    deferredPrompt = null
    
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('pwa:installed'))
  })

  async function showInstallPrompt() {
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available')
      return false
    }

    deferredPrompt.prompt()
    
    const { outcome } = await deferredPrompt.userChoice
    console.log('[PWA] Install prompt outcome:', outcome)
    
    deferredPrompt = null
    return outcome === 'accepted'
  }

  return {
    get isInstallable() {
      return deferredPrompt !== null
    },
    showInstallPrompt
  }
}

/**
 * 监听网络状态变化
 */
export function setupNetworkStatusListener(callback) {
  const updateOnlineStatus = () => {
    const status = {
      isOnline: navigator.onLine,
      connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection
    }
    
    callback(status)
  }

  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  
  // 初始状态
  updateOnlineStatus()

  return () => {
    window.removeEventListener('online', updateOnlineStatus)
    window.removeEventListener('offline', updateOnlineStatus)
  }
}

/**
 * 发送本地通知
 */
export function sendLocalNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.log('[PWA] Cannot send notification')
    return false
  }

  try {
    const notification = new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      ...options
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
      
      if (options.onClick) {
        options.onClick()
      }
    }

    return true
  } catch (error) {
    console.error('[PWA] Notification send failed:', error)
    return false
  }
}

/**
 * 将VAPID公钥转换为Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  
  return outputArray
}

/**
 * 发送订阅信息到服务器
 */
async function sendSubscriptionToServer(subscription) {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    })
    
    if (!response.ok) {
      throw new Error('Failed to send subscription to server')
    }
    
    console.log('[PWA] Subscription sent to server')
  } catch (error) {
    console.error('[PWA] Failed to send subscription:', error)
  }
}

/**
 * 从服务器移除订阅信息
 */
async function removeSubscriptionFromServer(subscription) {
  try {
    const response = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    })
    
    if (!response.ok) {
      throw new Error('Failed to remove subscription from server')
    }
    
    console.log('[PWA] Subscription removed from server')
  } catch (error) {
    console.error('[PWA] Failed to remove subscription:', error)
  }
}

/**
 * 初始化PWA
 */
export async function initPWA() {
  console.log('[PWA] Initializing...')
  
  // 注册Service Worker
  const registration = await registerServiceWorker()
  
  // 设置添加到主屏幕
  const installPrompt = setupAddToHomeScreen()
  
  // 设置网络状态监听
  const removeNetworkListener = setupNetworkStatusListener((status) => {
    console.log('[PWA] Network status changed:', status)
    
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('pwa:networkchange', {
      detail: status
    }))
  })
  
  // 请求通知权限
  const notificationPermission = await requestNotificationPermission()
  
  if (notificationPermission) {
    // 订阅推送通知
    await subscribeToPushNotifications()
  }
  
  console.log('[PWA] Initialization complete')
  
  return {
    registration,
    installPrompt,
    removeNetworkListener,
    notificationPermission
  }
}

export default {
  registerServiceWorker,
  unregisterServiceWorker,
  checkForUpdates,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  registerBackgroundSync,
  checkPWAStatus,
  setupAddToHomeScreen,
  setupNetworkStatusListener,
  sendLocalNotification,
  initPWA
}
