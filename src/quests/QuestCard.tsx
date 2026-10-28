import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Check, Gem, Zap } from 'lucide-react'
import { playJingle } from '../game/sound'
import { t, tn } from '../i18n/i18n'
import { today } from '../lesson/srs'
import { CHEST_XP, QUEST_XP } from '../progress/achievements'
import { useStats } from '../progress/stats'
import { celebrate } from '../ui/confetti'
import { drawQuests, markChestShown, markShown, progressOf, questById, refreshQuests, useQuests, type QuestDef } from './quests'
import './quests.css'

/** True once most of the element is on screen (always, without IntersectionObserver). */
function useInView(ref: RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return seen
}

const centre = (el: Element | null | undefined) => {
  const r = el?.getBoundingClientRect()
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined
}

/** Blocks of the progress bar: one per step up to 12, at least four, ten for big targets. */
const segmentsFor = (target: number) => (target > 12 ? 10 : target >= 4 ? target : target * Math.ceil(4 / target))

function untilMidnight(now: number) {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  const minutes = Math.max(1, Math.ceil((next.getTime() - now) / 60000))
  return minutes >= 60 ? tn(Math.floor(minutes / 60), 'Neue Quests in 1 Stunde', 'Neue Quests in {n} Stunden') : tn(minutes, 'Neue Quests in 1 Minute', 'Neue Quests in {n} Minuten')
}

/**
 * The day's three quests on the Today page, as in an old console game: blocky progress bars,
 * a little fanfare for each quest done and a treasure chest when all three are. The rewards
 * are counted in quests.ts the moment a quest is finished; this card celebrates them when
 * it comes into view.
 */
export function QuestCard() {
  const q = useQuests()
  const counts = useStats((s) => s.counts)
  const [now, setNow] = useState(() => Date.now())

  // a new day brings new quests, also with the app left open overnight
  useEffect(() => {
    refreshQuests()
    const tick = () => {
      refreshQuests()
      setNow(Date.now())
    }
    const id = setInterval(tick, 30000)
    const onShow = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [])

  const day = today()
  const drawn = q.day === day
  // until the quests are drawn (the account may still be syncing) the same ones show, untouched
  const quests: QuestDef[] = drawn ? q.ids.map(questById).filter((x) => !!x) : drawQuests(day)
  const base = drawn ? q.base : counts
  const doneCount = drawn ? quests.filter((x) => q.done.includes(x.id)).length : 0

  // ---------------------------------------------------------------- celebrations
  const box = useRef<HTMLElement>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const chestRef = useRef<HTMLDivElement>(null)
  const visible = useInView(box)
  const [popping, setPopping] = useState<string[]>([])
  const [opening, setOpening] = useState(false)
  const timers = useRef<number[]>([])
  const queued = useRef(new Set<string>())
  useEffect(() => {
    const pending = timers.current
    const waiting = queued.current
    // what did not get its moment yet gets it next time the card is shown
    return () => {
      pending.forEach(clearTimeout)
      pending.length = 0
      waiting.clear()
    }
  }, [])

  useEffect(() => {
    if (!visible || !drawn) return
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
    let delay = 350
    for (const id of q.done) {
      if (q.shown.includes(id) || queued.current.has(id)) continue
      queued.current.add(id)
      later(delay, () => {
        celebrate({ count: 36, origin: centre(rows.current.get(id)) })
        playJingle('quest')
        setPopping((p) => [...p, id])
        markShown(id)
        later(1400, () => setPopping((p) => p.filter((x) => x !== id)))
      })
      delay += 750
    }
    if (q.chest && !q.chestShown && !queued.current.has('chest')) {
      queued.current.add('chest')
      later(delay + 150, () => {
        setOpening(true)
        playJingle('chest')
        markChestShown()
        // the confetti when the lid flies open
        later(520, () => celebrate({ count: 110, origin: centre(chestRef.current) }))
      })
    }
  }, [visible, drawn, q.done, q.shown, q.chest, q.chestShown])

  const chestState = opening ? 'opening' : q.chest && q.chestShown && drawn ? 'open' : q.chest && drawn ? 'ready' : 'closed'
  const open = chestState === 'opening' || chestState === 'open'

  return (
    <section className="quest-card" ref={box}>
      <div className="section-head">
        <h3>{t('Tagesquests')}</h3>
        <span className={`quest-count ${doneCount === quests.length ? 'all' : ''}`} aria-label={t('{done} von {total} Quests geschafft', { done: doneCount, total: quests.length })}>
          <Gem size={13} /> {doneCount}/{quests.length}
        </span>
      </div>

      <div className="quest-log">
        <ul className="quest-list">
          {quests.map((quest, i) => {
            const done = drawn && q.done.includes(quest.id)
            const value = done ? quest.target : progressOf(quest, counts, base)
            const segs = segmentsFor(quest.target)
            const on = done ? segs : Math.floor((value / quest.target) * segs)
            const Icon = quest.icon
            return (
              <li
                key={quest.id}
                ref={(el) => {
                  if (el) rows.current.set(quest.id, el)
                  else rows.current.delete(quest.id)
                }}
                className={`quest-row ${done ? 'done' : ''} ${quest.hard ? 'hard' : ''} ${popping.includes(quest.id) ? 'pop' : ''}`}
                style={{ '--row': i } as CSSProperties}
              >
                <span className="quest-icon">{done ? <Check size={20} strokeWidth={3} /> : <Icon size={20} />}</span>
                <span className="quest-main">
                  <span className="quest-title">
                    <b>{t(quest.title, { n: quest.target })}</b>
                    {quest.hard && (
                      <span className="quest-tag">
                        <Zap size={11} /> {t('Schwer')}
                      </span>
                    )}
                  </span>
                  <span className="quest-where">{quest.where.map((w) => t(w)).join(' › ')}</span>
                  <span
                    className="quest-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={quest.target}
                    aria-valuenow={value}
                    aria-label={t('{done} von {total}', { done: value, total: quest.target })}
                  >
                    {Array.from({ length: segs }, (_, k) => (
                      <i key={k} className={k < on ? 'on' : ''} style={{ '--i': k } as CSSProperties} />
                    ))}
                  </span>
                </span>
                <span className="quest-side">
                  <b className="quest-num">
                    {value}/{quest.target}
                  </b>
                  <span className="quest-xp">+{QUEST_XP} XP</span>
                </span>
              </li>
            )
          })}
        </ul>

        <div className={`quest-chest ${chestState}`} ref={chestRef}>
          <Chest />
          <span className="quest-chest-text">
            <b>{open ? t('Truhe geöffnet!') : t('Schatztruhe')}</b>
            <span className="muted">{open ? t('Alle Quests geschafft. Morgen gibt es neue.') : t('Schließe alle drei Quests ab.')}</span>
          </span>
          <span className="quest-xp">+{CHEST_XP} XP</span>
        </div>
      </div>
      <p className="quest-reset">{untilMidnight(now)}</p>
    </section>
  )
}

/** A pixel treasure chest (16 × 15 pixels): the lid flies up, a gem rises and sparkles. */
function Chest() {
  return (
    <svg className="chest" viewBox="-1 -10 18 25" shapeRendering="crispEdges" aria-hidden>
      <g className="chest-glow">
        <rect className="px-spark" x="2" y="-6" width="2" height="1" />
        <rect className="px-spark" x="12" y="-6" width="2" height="1" />
        <rect className="px-spark" x="4" y="-9" width="1" height="1" />
        <rect className="px-spark" x="11" y="-9" width="1" height="1" />
        <rect className="px-spark" x="3" y="-2" width="1" height="1" />
        <rect className="px-spark" x="12" y="-2" width="1" height="1" />
      </g>
      {/* the lid tipped back, and the dark inside */}
      <g className="chest-back">
        <rect className="px-ink" x="1" y="0" width="14" height="5" />
        <rect className="px-wood" x="2" y="1" width="12" height="3" />
        <rect className="px-shade" x="2" y="1" width="12" height="3" />
        <rect className="px-gold" x="4" y="1" width="1" height="3" />
        <rect className="px-gold" x="11" y="1" width="1" height="3" />
      </g>
      <rect className="px-ink" x="2" y="4" width="12" height="3" />
      <g className="chest-gem">
        <rect className="px-ink" x="6" y="-3" width="4" height="1" />
        <rect className="px-ink" x="5" y="-2" width="1" height="2" />
        <rect className="px-ink" x="10" y="-2" width="1" height="2" />
        <rect className="px-ink" x="6" y="0" width="1" height="1" />
        <rect className="px-ink" x="9" y="0" width="1" height="1" />
        <rect className="px-ink" x="7" y="1" width="2" height="1" />
        <rect className="px-gold" x="6" y="-2" width="4" height="2" />
        <rect className="px-gold" x="7" y="0" width="2" height="1" />
        <rect className="px-facet" x="8" y="-2" width="2" height="1" />
        <rect className="px-facet" x="9" y="-1" width="1" height="1" />
      </g>
      <g className="chest-body">
        <rect className="px-ink" x="1" y="6" width="14" height="9" />
        <rect className="px-wood" x="2" y="7" width="12" height="7" />
        <rect className="px-shade" x="2" y="12" width="12" height="2" />
        <rect className="px-gold" x="4" y="7" width="1" height="7" />
        <rect className="px-gold" x="11" y="7" width="1" height="7" />
      </g>
      <g className="chest-lid">
        <rect className="px-ink" x="2" y="0" width="12" height="1" />
        <rect className="px-ink" x="1" y="1" width="14" height="6" />
        <rect className="px-wood" x="2" y="1" width="12" height="5" />
        <rect className="px-light" x="3" y="1" width="10" height="1" />
        <rect className="px-gold" x="4" y="1" width="1" height="5" />
        <rect className="px-gold" x="11" y="1" width="1" height="5" />
        <rect className="px-ink" x="6" y="4" width="4" height="5" />
        <rect className="px-gold" x="7" y="5" width="2" height="3" />
        <rect className="px-ink" x="7" y="6" width="1" height="1" />
      </g>
    </svg>
  )
}
