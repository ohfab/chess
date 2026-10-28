import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Eye } from 'lucide-react'
import { t } from '../i18n/i18n'
import { formatClock, LOW_TIME } from './clock'
import './play.css'

/**
 * One side's clock: `left` as of `since`, counting down while `since` is set.
 * Only this small face renders on every tick, not the whole board view.
 */
export function ClockFace({ left, since }: { left: number; since: number | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (since === null) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [since])
  // a tick from before the clock started would add time: never show more than `left`
  const ms = since === null ? left : Math.max(0, Math.min(left, left - (now - since)))
  return (
    <div className={`clock ${since !== null ? 'run' : ''} ${ms < LOW_TIME ? 'low' : ''} ${ms <= 0 ? 'out' : ''}`} role="timer" aria-label={t('Restzeit {time}', { time: formatClock(ms) })}>
      {formatClock(ms)}
    </div>
  )
}

const PEEK_MS = 2000

/**
 * Blindfold: shows the pieces while held, and for at least two seconds after a tap
 * (a click from the keyboard shows them for two seconds as well).
 */
export function PeekTool({ onPeek }: { onPeek: (on: boolean) => void }) {
  const [on, setOn] = useState(false)
  const held = useRef(false)
  const until = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = () => {
    setOn(true)
    onPeek(true)
  }
  const hide = () => {
    setOn(false)
    onPeek(false)
  }
  const hideLater = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => !held.current && hide(), Math.max(0, until.current - Date.now()))
  }
  const press = (e: PointerEvent) => {
    if (e.button !== 0) return
    held.current = true
    until.current = Date.now() + PEEK_MS
    clearTimeout(timer.current)
    show()
  }
  const release = () => {
    if (!held.current) return
    held.current = false
    hideLater()
  }

  // a game that ends while the button is held takes the peek along
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      onPeek(false)
    },
    [onPeek],
  )

  return (
    <button
      className={`tool peek-tool ${on ? 'on' : ''}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // keyboard: Enter or space
        if (e.detail !== 0) return
        until.current = Date.now() + PEEK_MS
        show()
        hideLater()
      }}
      aria-pressed={on}
    >
      <Eye size={20} />
      <span>{t('Kurz zeigen')}</span>
    </button>
  )
}
