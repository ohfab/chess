// Push messages for the daily reminder, loaded into the generated service worker
// (vite.config.ts, workbox importScripts). Sent by supabase/functions/send-reminders.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rookly', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'rookly',
      data: { url: data.url || './' },
    }),
  )
})

// a tap on the reminder brings an open Rookly to the front, or opens it
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) if (w.url.startsWith(self.registration.scope) && 'focus' in w) return w.focus()
      return self.clients.openWindow(target)
    }),
  )
})
