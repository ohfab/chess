import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

// The Android and iOS apps (Capacitor, see capacitor.config.ts) run this same web build in a
// web view. This file is where the app differs from the website: the back button, the colour
// of the status bar, and the clipboard. Everything native is loaded on demand, so the website
// never downloads it.

export const isNativeApp = Capacitor.isNativePlatform()

/** Answers Android's back button; true when it handled it, false to leave the app. */
type BackHandler = () => boolean

let backHandler: BackHandler | null = null

/** The app's current answer to the back button (the latest one registered wins). */
export function onBackButton(handler: BackHandler) {
  backHandler = handler
  return () => {
    if (backHandler === handler) backHandler = null
  }
}

export async function startNative() {
  if (!isNativeApp) return
  const { App } = await import('@capacitor/app')
  void App.addListener('backButton', () => {
    if (!backHandler?.()) void App.exitApp()
  })
  const { startReminders } = await import('./reminders')
  await startReminders()
}

let barsTheme: 'light' | 'dark' | null = null

/** Dark icons on the light theme, light ones on the dark theme. */
export function styleSystemBars(theme: 'light' | 'dark') {
  if (!isNativeApp || theme === barsTheme) return
  barsTheme = theme
  void SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
}

/** Copies text; the web views of the apps go through the native clipboard. */
export async function copyText(text: string) {
  if (!isNativeApp) return navigator.clipboard.writeText(text)
  const { Clipboard } = await import('@capacitor/clipboard')
  await Clipboard.write({ string: text })
}
