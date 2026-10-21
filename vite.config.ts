import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // offline support and "add to home screen"; off for the claude.ai artifact build,
    // which runs inside a sandboxed frame where a service worker makes no sense
    VitePWA({
      disable: !!process.env.NO_PWA,
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,mp3,webmanifest}'],
        // the slow asm.js engine is only a fallback for browsers without WebAssembly
        globIgnores: ['**/stockfish-19-asm-*.js'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/legal\//],
      },
    }),
  ],
})
