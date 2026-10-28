import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useGame } from './game/store'
import { applyBoard, applyPieces } from './theme/theme'
import { initAccount } from './account/account'
import './account/synced'
import { warmUp } from './engine/useEngine'
import { startAutoSync } from './import/autosync'
import { setLang, t } from './i18n/i18n'
import { startUpdates, useUpdate } from './pwa'
import { isNativeApp, startNative, styleSystemBars } from './native/native'
import '@fontsource-variable/inter-tight'
import './index.css'

// paint the saved board and pieces before the first frame
const { settings } = useGame.getState()
applyBoard(settings.board)
void applyPieces(settings.pieces)
void initAccount()
// boot Stockfish while the page settles, not when the first move needs it
const idle = (window as { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 800))
idle(warmUp)
// new games of the player's own chess.com or Lichess account, reviewed in the background
idle(startAutoSync)

setLang(settings.lang)
applyTheme(settings.theme)
// the website keeps itself offline with a service worker; the apps carry their files inside
if (isNativeApp) void startNative()
else startUpdates()

/** Light or dark palette (see the top of index.css), and the browser bar to match. */
function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#21201d' : '#ffffff')
  styleSystemBars(theme)
}

/** The whole app renders again when the language changes; t() then reads the new one. */
function Root() {
  const lang = useGame((s) => s.settings.lang)
  const theme = useGame((s) => s.settings.theme)
  const update = useUpdate((s) => s.ready)
  setLang(lang)
  applyTheme(theme)
  return (
    <>
      <App />
      {update && (
        <div className="update-banner" role="status">
          <span>{t('Eine neue Version von Rookly ist bereit.')}</span>
          <button className="btn-primary small" onClick={() => location.reload()}>
            {t('Neu laden')}
          </button>
        </div>
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
