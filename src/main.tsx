import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useGame } from './game/store'
import { applyBoard, applyPieces } from './theme/theme'
import { initAccount } from './account/account'
import { warmUp } from './engine/useEngine'
import { setLang } from './i18n/i18n'
import './index.css'

// paint the saved board and pieces before the first frame
const { settings } = useGame.getState()
applyBoard(settings.board)
void applyPieces(settings.pieces)
void initAccount()
// boot Stockfish while the page settles, not when the first move needs it
const idle = (window as { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 800))
idle(warmUp)

setLang(settings.lang)

/** The whole app renders again when the language changes; t() then reads the new one. */
function Root() {
  const lang = useGame((s) => s.settings.lang)
  setLang(lang)
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
