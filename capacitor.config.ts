import type { CapacitorConfig } from '@capacitor/cli'

// The Android and iOS apps: the web build in dist/ (npm run app), wrapped by Capacitor.
// The app id is permanent once the app is in a store; change it before the first upload
// if it should follow the domain (for example com.rookly.app).
const config: CapacitorConfig = {
  appId: 'app.rookly',
  appName: 'Rookly',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  plugins: {
    // edge to edge, with the safe areas in env(safe-area-inset-*) (see the end of index.css)
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    LocalNotifications: { smallIcon: 'ic_stat_rookly', iconColor: '#416b59' },
  },
}

export default config
