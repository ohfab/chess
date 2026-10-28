import type { CapacitorConfig } from '@capacitor/cli'

// The Android and iOS apps: the web build in dist/ (npm run app), wrapped by Capacitor.
// The app id is permanent once the app is in a store; change it before the first upload
// if it should follow the domain (for example com.enpixant.app).
const config: CapacitorConfig = {
  appId: 'app.enpixant',
  appName: 'Enpixant',
  webDir: 'dist',
  backgroundColor: '#c4c2a4',
  plugins: {
    // edge to edge, with the safe areas in env(safe-area-inset-*) (see the end of index.css)
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    LocalNotifications: { smallIcon: 'ic_stat_enpixant', iconColor: '#4b4a3b' },
  },
}

export default config
