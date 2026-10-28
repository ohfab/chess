import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'
import { Piece } from '../board/Piece'
import type { Line } from '../engine/engine'
import { formatScore, whiteScore } from '../engine/useEngine'
import { figurine, isFinal, turnOf } from '../game/rules'
import { t, tk } from '../i18n/i18n'
import { Modal } from '../ui/Modal'
import { askAvailable, askCoach, askError, engineLines, type AskTurn } from './ask'
import './ask.css'

export interface AskCoachProps {
  fen: string
  /** the engine's view of the position, if the live engine runs */
  lines: Line[]
  /** the game so far in SAN, for context */
  moves: string[]
  onClose: () => void
}

const SUGGESTIONS = [tk('Was ist hier der Plan?'), tk('Warum ist der beste Zug gut?'), tk('Was droht der Gegner?'), tk('Welche Fehler sollte ich vermeiden?')]

/** Ask the AI coach about the position on the board. */
export function AskCoachDialog({ fen, lines, moves, onClose }: AskCoachProps) {
  const [turns, setTurns] = useState<AskTurn[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    void askAvailable().then((ok) => live && setAvailable(ok))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns.length, pending, error])

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || pending) return
    setText('')
    setError(null)
    setPending(q)
    try {
      // the live engine's lines as they stand now, or a short search of its own when it is off
      const known = lines.length ? lines : await engineLines(fen)
      const turn = await askCoach({ fen, moves, lines: known }, turns, q)
      setTurns((all) => [...all, turn])
    } catch (e) {
      setError(askError(e))
    } finally {
      setPending(null)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(text)
  }

  const top = lines[0]
  const side = turnOf(fen) === 'white' ? t('Weiß am Zug') : t('Schwarz am Zug')

  return (
    <Modal title={t('Coach fragen')} onClose={onClose} className="ask-modal">
      <div className="ask-context">
        <span className="pill">{isFinal(fen) ? t('Partie zu Ende') : side}</span>
        {top && <span className="ask-eval">{formatScore(whiteScore(top.score, fen))}</span>}
        <span className="muted">{t('Der Coach hält sich an die Stockfish-Linien.')}</span>
      </div>

      <div className="ask-chat" ref={scroller} aria-live="polite">
        <Message from="coach">{t('Frag mich zu dieser Stellung: was der Plan ist, warum ein Zug gut ist oder was der Gegner vorhat.')}</Message>
        {turns.map((turn, i) => (
          <div key={i} className="ask-turn">
            <Message from="you">{turn.question}</Message>
            <Message from="coach">
              {turn.answer}
              {turn.moves.length > 0 && (
                <span className="ask-moves">
                  {turn.moves.map((m) => (
                    <span key={m} className="ask-move">
                      {figurine(m)}
                    </span>
                  ))}
                </span>
              )}
            </Message>
          </div>
        ))}
        {pending && (
          <div className="ask-turn">
            <Message from="you">{pending}</Message>
            <Message from="coach" typing />
          </div>
        )}
        {error && <p className="error ask-error">{error}</p>}
      </div>

      {available === false ? (
        <p className="ask-unavailable">{t('Der KI-Coach ist in dieser Version nicht verfügbar. Mit einem Enpixant-Konto und Pro kannst du ihm zu jeder Stellung Fragen stellen.')}</p>
      ) : (
        <>
          <div className="ask-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => void ask(t(s))} disabled={!!pending || available === null}>
                {t(s)}
              </button>
            ))}
          </div>
          <form className="ask-form" onSubmit={submit}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('Deine Frage zur Stellung …')}
              maxLength={500}
              aria-label={t('Deine Frage zur Stellung')}
            />
            <button className="ask-send" disabled={!text.trim() || !!pending || available === null} aria-label={t('Fragen')}>
              <ArrowUp size={20} />
            </button>
          </form>
        </>
      )}
    </Modal>
  )
}

function Message({ from, typing, children }: { from: 'coach' | 'you'; typing?: boolean; children?: ReactNode }) {
  return (
    <div className={`ask-msg ${from}`}>
      {from === 'coach' && <Piece role="knight" color="white" className="coach-avatar ask-avatar" />}
      <div className="ask-bubble">
        {typing ? (
          <span className="ask-typing" aria-label={t('Der Coach schreibt …')}>
            <i />
            <i />
            <i />
          </span>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
