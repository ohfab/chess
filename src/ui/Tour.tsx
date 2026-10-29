import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { APP_NAME } from '../brand'
import { t, tk } from '../i18n/i18n'
import { BotAvatar } from '../play/BotAvatar'
import './tour.css'

// A short tour of the app after the welcome screen: Pip, the first opponent, points at each
// menu entry in turn and says what is there. Targets are found by their data-tour attribute;
// a step whose target is not on screen is shown in the middle instead.

interface Step {
  /** data-tour value of the element to point at */
  target?: string
  title: string
  text: string
}

const STEPS: Step[] = [
  { title: tk('Kurze Tour'), text: tk('Hallo, ich bin Pip! In einer halben Minute zeige ich dir, wo in {app} was ist.') },
  { target: 'today', title: tk('Heute'), text: tk('Dein Startpunkt. Hier steht jeden Tag, was du trainieren kannst.') },
  { target: 'plan', title: tk('Training für heute'), text: tk('Ein paar kurze Aufgaben, passend zu deinen Partien. Darunter: Lektionen zum Wiederholen, die Tagesaufgabe und drei Tagesquests.') },
  { target: 'play', title: tk('Spielen'), text: tk('Zehn Gegner von ~800 bis zur vollen Stärke von Stockfish, mit oder ohne Uhr, auf Wunsch blind.') },
  { target: 'tactics', title: tk('Taktik'), text: tk('Aufgaben nach Motiv, deine eigenen Fehler, Puzzle Rush, Kurse, Brett-Sehen und Endspiele.') },
  { target: 'openings', title: tk('Eröffnungen'), text: tk('Eröffnungen Zug für Zug lernen: erst mit Pfeilen und Erklärungen, dann aus dem Kopf.') },
  { target: 'analysis', title: tk('Analyse'), text: tk('Partien von chess.com oder Lichess laden und auswerten, frei analysieren oder eine Stellung aufbauen.') },
  { target: 'progress', title: tk('Level und Serie'), text: tk('Für jedes Training gibt es XP. Tipp auf dein Level, dann siehst du deine Erfolge. Die Flamme zählt die Tage in Folge.') },
  { target: 'settings', title: tk('Einstellungen'), text: tk('Brett, Figuren, Töne und Sprache. Dort kannst du diese Tour auch nochmal starten.') },
  { title: tk('Los geht’s!'), text: tk('Am besten fängst du mit dem Training für heute an. Viel Spaß!') },
]

/** The first element with this data-tour value that is on screen. */
function find(target: string) {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

const GAP = 12
const MARGIN = 16
/** about the height of the speech box, and where the page's header ends on phones */
const ROOM = 220
const HEADER = 72

/** The frame around the target, a little larger than it and kept on the screen. */
function hole(rect: DOMRect): CSSProperties {
  const top = Math.max(4, rect.top - 4)
  const bottom = Math.min(window.innerHeight - 4, rect.bottom + 4)
  return { left: rect.left - 4, top, width: rect.width + 8, height: Math.max(0, bottom - top) }
}

/** Where the target is now, after bringing it into view if it lies off screen. */
function locate(step: Step) {
  const el = step.target ? find(step.target) : null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' })
  // a tall target goes up under the header, to leave room for the speech box below it
  const now = el.getBoundingClientRect()
  if (now.bottom + GAP + ROOM > window.innerHeight && now.top - GAP - ROOM < 0) window.scrollBy(0, now.top - HEADER)
  return el.getBoundingClientRect()
}

export function Tour({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  const go = useCallback((i: number) => {
    setIndex(i)
    setRect(locate(STEPS[i]))
  }, [])
  const next = useCallback(() => (last ? onDone() : go(index + 1)), [last, onDone, go, index])
  const back = useCallback(() => go(Math.max(0, index - 1)), [go, index])

  // the target moves when the page scrolls, the window changes size or the page fills in
  useEffect(() => {
    const measure = () => {
      const el = step.target ? find(step.target) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.target])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') back()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, onDone])

  // the speech box: under the target, or over it when the target sits low; a target too tall
  // for either gets the box at the bottom of the screen, over its lower part. Its height is
  // only known once drawn, so its top is set right after.
  const boxRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    if (!rect) return void (el.style.top = '')
    const h = el.offsetHeight
    const below = rect.bottom + GAP
    const above = rect.top - GAP - h
    const fitsBelow = below + h <= window.innerHeight - MARGIN
    const fitsAbove = above >= MARGIN
    const low = rect.top + rect.height / 2 > window.innerHeight / 2
    const top = low ? (fitsAbove ? above : fitsBelow ? below : null) : fitsBelow ? below : fitsAbove ? above : null
    el.style.top = `${top ?? window.innerHeight - h - MARGIN}px`
  }, [rect, index])
  const width = Math.min(360, window.innerWidth - 2 * MARGIN)
  const box: CSSProperties = rect ? { width, left: Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - MARGIN) } : { width }

  return (
    <div className={`tour ${rect ? '' : 'centred'}`} role="dialog" aria-modal="true" aria-label={t('Kurze Tour')}>
      {rect ? (
        <div className="tour-hole" style={hole(rect)} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-box" style={box} key={index} ref={boxRef}>
        <div className="tour-head">
          <BotAvatar level={1} className="tour-guide" />
          <div>
            <span className="tour-step">
              {index + 1}/{STEPS.length}
            </span>
            <h2>{t(step.title)}</h2>
          </div>
        </div>
        <p>{t(step.text, { app: APP_NAME })}</p>
        <div className="tour-actions">
          {!last && (
            <button className="tour-skip" onClick={onDone}>
              {t('Überspringen')}
            </button>
          )}
          {index > 0 && (
            <button className="btn-secondary small" onClick={back} aria-label={t('Zurück')}>
              <ChevronLeft size={16} />
            </button>
          )}
          <button className="btn-primary small" onClick={next} autoFocus>
            {last ? t('Los geht’s') : t('Weiter')} {!last && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
