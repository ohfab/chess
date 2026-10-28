import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  resolve: {
    // the app's icons are pixel drawings with lucide's names and props (src/ui/pixel-icons.tsx)
    alias: [{ find: /^lucide-react$/, replacement: fileURLToPath(new URL('./src/ui/pixel-icons.tsx', import.meta.url)) }],
  },
  plugins: [
    react(),
    // offline support and "add to home screen"; off for the claude.ai artifact build,
    // which runs inside a sandboxed frame where a service worker makes no sense
    VitePWA({
      disable: !!process.env.NO_PWA,
      registerType: 'autoUpdate',
      injectRegister: false, // src/pwa.ts registers it and handles updates
      manifest: false, // public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,mp3,webmanifest,woff2}'],
        // the slow asm.js engine is only a fallback for browsers without WebAssembly;
        // of the fonts only the Latin letters are needed offline
        globIgnores: ['**/stockfish-19-asm-*.js', '**/{press-start-2p,silkscreen}-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/legal\//],
        // a new version takes over at once; src/pwa.ts then reloads into it
        skipWaiting: true,
        clientsClaim: true,
        // the daily reminder's push handler (public/push-sw.js)
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
