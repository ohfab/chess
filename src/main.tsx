import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useGame } from './game/store'
import { applyBoard, applyPieces } from './theme/theme'
import './index.css'

// paint the saved board and pieces before the first frame
const { settings } = useGame.getState()
applyBoard(settings.board)
void applyPieces(settings.pieces)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
