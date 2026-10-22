import { useEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { t, tn } from '../i18n/i18n'
import { celebrate } from '../ui/confetti'
import { TIER_NAMES, tierXp, type AchievementDef } from './achievements'
import { useProgressStore } from './progressStore'
import { useProgress } from './useProgress'
import './progress.css'

/** A ring that fills up to `share` (0..1), animated from empty when it first appears. */
export function LevelRing({ share, size, stroke = 4, children }: { share: number; size: number; stroke?: number; children?: ReactNode }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(share))
    return () => cancelAnimationFrame(id)
  }, [share])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="pg-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle className="pg-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="pg-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={`${c * Math.min(1, Math.max(0, shown))} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="pg-ring-label">{children}</span>
    </span>
  )
}

/** The player's level with the XP bar, for the top of the Today page. */
export function LevelBadge({ onOpen }: { onOpen: () => void }) {
  const p = useProgress()
  return (
    <button className="pg-badge" onClick={onOpen} title={t('{xp} XP · noch {n} XP bis Level {next}', { xp: p.xp, n: p.span - p.into, next: p.level + 1 })} aria-label={t('Level {n}', { n: p.level })}>
      <LevelRing share={p.into / p.span} size={30} stroke={3.5}>
        {p.level}
      </LevelRing>
      <span className="pg-badge-name">{t(p.name)}</span>
    </button>
  )
}

type Toast = { id: number } & (
  | { kind: 'achievement'; def: AchievementDef; tier: number }
  | { kind: 'level'; level: number; name: string }
  | { kind: 'more'; n: number }
)

let nextId = 0

// the cards waiting to be shown; a store rather than component state, since the watcher
// below writes it from an effect
const useQueue = create<{ items: Toast[] }>(() => ({ items: [] }))
const dequeue = () => useQueue.setState((q) => ({ items: q.items.slice(1) }))

/** Announces achievements and levels reached since they were last shown, one at a time. */
export function AchievementToasts() {
  const snap = useProgress()
  const shown = useQueue((q) => q.items[0])
  const card = useRef<HTMLDivElement>(null)

  // take in what is new since the last look; on the very first look everything stays quiet
  useEffect(() => {
    const st = useProgressStore.getState()
    const reached: Record<string, number> = {}
    const news: Toast[] = []
    for (const a of snap.achievements) {
      if (a.tier > (st.reached[a.def.id] ?? 0)) {
        reached[a.def.id] = a.tier
        news.push({ id: ++nextId, kind: 'achievement', def: a.def, tier: a.tier })
      }
    }
    const records = {
      bestStreak: Math.max(st.bestStreak, snap.bestStreak),
      bestRating: Math.max(st.bestRating, snap.bestRating),
    }
    const levelUp = snap.level > st.levelSeen
    const changed = news.length > 0 || levelUp || records.bestStreak !== st.bestStreak || records.bestRating !== st.bestRating || !st.ready
    if (!changed) return
    const now = Date.now()
    useProgressStore.setState({
      reached: { ...st.reached, ...reached },
      // what was already done before the first look is not "recent"
      unlockedAt: st.ready ? { ...st.unlockedAt, ...Object.fromEntries(Object.keys(reached).map((id) => [id, now])) } : st.unlockedAt,
      levelSeen: Math.max(st.levelSeen, snap.level),
      ...records,
      ready: true,
    })
    if (!st.ready) return
    // a sync can bring a lot at once: two cards and a summary are enough
    const cards: Toast[] = news.length > 3 ? [...news.slice(0, 2), { id: ++nextId, kind: 'more', n: news.length - 2 }] : news
    if (levelUp) cards.push({ id: ++nextId, kind: 'level', level: snap.level, name: snap.name })
    useQueue.setState((q) => ({ items: [...q.items, ...cards] }))
  }, [snap])

  // each card stays a few seconds; a tap closes it sooner
  useEffect(() => {
    if (!shown) return
    const box = card.current?.getBoundingClientRect()
    celebrate(shown.kind === 'level' ? { count: 140 } : { count: 60, origin: box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined })
    const timer = setTimeout(dequeue, shown.kind === 'level' ? 4500 : 3500)
    return () => clearTimeout(timer)
  }, [shown])

  if (!shown) return null
  const close = dequeue

  if (shown.kind === 'level')
    return (
      <div className="pg-levelup-backdrop" onClick={close} role="status">
        <div className="pg-levelup" key={shown.id}>
          <LevelRing share={1} size={112} stroke={7}>
            <b>{shown.level}</b>
          </LevelRing>
          <span className="pg-eyebrow">{t('Neues Level')}</span>
          <b className="pg-levelup-title">{t('Level {n} erreicht', { n: shown.level })}</b>
          <span className="muted">{t(shown.name)}</span>
        </div>
      </div>
    )

  return (
    <div className="pg-toast" ref={card} onClick={close} role="status" key={shown.id}>
      {shown.kind === 'achievement' ? (
        <>
          <span className={`pg-medal tier-${shown.def.tiers.length > 1 ? shown.tier : 'one'}`}>
            <shown.def.icon size={22} />
          </span>
          <span className="pg-toast-text">
            <span className="pg-eyebrow">{t('Erfolg freigeschaltet')}</span>
            <b>
              {t(shown.def.title)}
              {shown.def.tiers.length > 1 && <span className="pg-tier"> · {t(TIER_NAMES[shown.tier - 1])}</span>}
            </b>
          </span>
          {tierXp(shown.def) > 0 && <span className="pg-xp">+{tierXp(shown.def)} XP</span>}
        </>
      ) : (
        <span className="pg-toast-text">
          <span className="pg-eyebrow">{t('Erfolg freigeschaltet')}</span>
          <b>{tn(shown.n, '1 weiterer Erfolg', '{n} weitere Erfolge')}</b>
        </span>
      )}
    </div>
  )
}
