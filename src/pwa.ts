import { create } from 'zustand'
import { registerSW } from 'virtual:pwa-register'

// The website keeps itself in the browser to work offline, so a new version arrives in
// the background. Right after opening, the page reloads into it at once; later on the
// player gets a banner instead, so nothing they are doing is cut off.

export const useUpdate = create<{ ready: boolean }>(() => ({ ready: false }))

const opened = Date.now()

export function startUpdates() {
  registerSW({
    immediate: true,
    onNeedReload() {
      if (Date.now() - opened < 30_000) location.reload()
      else useUpdate.setState({ ready: true })
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // an open tab asks for a new version every hour and whenever it comes back to the front
      const check = () => void registration.update().catch(() => {})
      setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })
}
