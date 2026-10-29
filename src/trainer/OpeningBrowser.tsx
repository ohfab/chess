import { useMemo, useState } from 'react'
import { Search, Play } from 'lucide-react'
import { numbered } from '../game/rules'
import { locale, t, tk, tn } from '../i18n/i18n'
import { progressKey, type Progress } from '../game/store'
import { fenAfter, rootOf } from './book'
import { CATALOG, type OpeningDef } from './catalog'
import { MiniBoard } from './MiniBoard'
import { Display } from '../ui/Display'
import { cardFor, STEPS, useLessons, type Card } from '../lesson/srs'
import '../lesson/lesson.css'

const GROUPS: { id: string; title: string; short: string; match: (o: OpeningDef) => boolean }[] = [
  { id: 'w-e4', title: tk('Mit Weiß · 1.e4'), short: tk('Weiß · 1.e4'), match: (o) => o.side === 'white' && o.group === 'e4' },
  { id: 'w-d4', title: tk('Mit Weiß · 1.d4'), short: tk('Weiß · 1.d4'), match: (o) => o.side === 'white' && o.group === 'd4' },
  { id: 'w-flank', title: tk('Mit Weiß · Flankeneröffnungen'), short: tk('Weiß · Flanke'), match: (o) => o.side === 'white' && o.group === 'flank' },
  { id: 'b-e4', title: tk('Mit Schwarz · gegen 1.e4'), short: tk('Schwarz · gegen 1.e4'), match: (o) => o.side === 'black' && o.group === 'e4' },
  { id: 'b-d4', title: tk('Mit Schwarz · gegen 1.d4'), short: tk('Schwarz · gegen 1.d4'), match: (o) => o.side === 'black' && o.group === 'd4' },
]

/** whether the player has begun any variation of the opening, with either colour */
const begun = (o: OpeningDef, stored: Record<string, Card>, progress: Record<string, Progress>) =>
  (['white', 'black'] as const).some((side) => o.variations.some((_, i) => cardFor(progressKey(o.id, i, side), stored, progress)))

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface Props {
  progress: Record<string, Progress>
  /** the drill in progress, if any */
  current?: { title: string; onResume: () => void }
  onPick: (id: string) => void
}

export function OpeningBrowser({ progress, current, onPick }: Props) {
  const [query, setQuery] = useState('')
  const stored = useLessons((s) => s.cards)
  const mine = useMemo(() => CATALOG.filter((o) => begun(o, stored, progress)), [stored, progress])
  // one group at a time, so the page stays short; the player's own openings first once there are any
  const [group, setGroup] = useState(() => (mine.length ? 'mine' : GROUPS[0].id))

  const q = fold(query.trim())
  const found = useMemo(() => (q ? CATALOG.filter((o) => [o.name, o.en, ...o.variations.map((v) => v.name)].some((t) => fold(t).includes(q))) : []), [q])
  // a search looks through all of them, grouped as usual
  const shown: { title: string; items: OpeningDef[] }[] = q
    ? GROUPS.map((g) => ({ title: t(g.title), items: found.filter(g.match) })).filter((g) => g.items.length)
    : group === 'mine'
      ? [{ title: t('Deine Eröffnungen'), items: mine }]
      : GROUPS.filter((g) => g.id === group).map((g) => ({ title: t(g.title), items: CATALOG.filter(g.match) }))

  return (
    <div className="openings">
      <div className="openings-head">
        <div>
          <Display first={t('Eröffnungen')} second={t('meistern')} />
          <p className="muted">
            {t('{n} Eröffnungen, Theorie aus {games} Turnierpartien', { n: CATALOG.length, games: new Intl.NumberFormat(locale()).format(200000) })}
          </p>
        </div>
        {current && (
          <button className="resume" onClick={current.onResume}>
            <Play size={16} />
            <span>
              {t('Weiter trainieren')}
              <small>{current.title}</small>
            </span>
          </button>
        )}
      </div>

      <div className="openings-tools">
        <label className="search">
          <Search size={18} />
          <input
            id="opening-search"
            type="search"
            placeholder={t('Suchen, z. B. Caro-Kann oder Najdorf')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {!q && (
        <div className="group-chips" role="tablist" aria-label={t('Eröffnungen')}>
          {mine.length > 0 && (
            <button role="tab" aria-selected={group === 'mine'} className={`chip ${group === 'mine' ? 'on' : ''}`} onClick={() => setGroup('mine')}>
              {t('Deine')} <span className="chip-count">{mine.length}</span>
            </button>
          )}
          {GROUPS.map((g) => (
            <button key={g.id} role="tab" aria-selected={group === g.id} className={`chip ${group === g.id ? 'on' : ''}`} onClick={() => setGroup(g.id)}>
              {t(g.short)} <span className="chip-count">{CATALOG.filter(g.match).length}</span>
            </button>
          ))}
        </div>
      )}

      {shown.map((section) => (
        <section key={section.title} className="opening-group">
          <h3>{section.title}</h3>
          <div className="opening-grid">
            {section.items.map((o) => (
              <OpeningCard key={o.id} opening={o} progress={progress} onPick={() => onPick(o.id)} />
            ))}
          </div>
        </section>
      ))}
      {q && found.length === 0 && <p className="muted empty">{t('Keine Eröffnung gefunden.')}</p>}
    </div>
  )
}

function OpeningCard({ opening, progress, onPick }: { opening: OpeningDef; progress: Record<string, Progress>; onPick: () => void }) {
  const root = rootOf(opening)
  const fen = useMemo(() => fenAfter(opening.moves.split(' ')), [opening.moves])
  const stored = useLessons((s) => s.cards)
  // the side the player trains it with: the opening's own, unless only the other one is begun
  const cardsOf = (side: typeof opening.side) => opening.variations.map((_, i) => cardFor(progressKey(opening.id, i, side), stored, progress))
  const own = cardsOf(opening.side)
  const other = cardsOf(opening.side === 'white' ? 'black' : 'white')
  const cards: (Card | null)[] = own.some(Boolean) || !other.some(Boolean) ? own : other
  const learned = cards.filter(Boolean).length
  const mastered = cards.filter((c) => c && c.step >= STEPS).length
  const share = cards.reduce((sum, c) => sum + (c?.step ?? 0), 0) / (cards.length * STEPS)
  return (
    <button className="opening-card" onClick={onPick}>
      <MiniBoard fen={fen} orientation={opening.side} />
      <span className="opening-card-text">
        <b>{opening.name}</b>
        {opening.en !== opening.name && <span className="muted">{opening.en}</span>}
        <span className="opening-moves">{numbered(root)}</span>
        <span className="opening-meta">
          {tn(opening.variations.length, '1 Variante', '{n} Varianten')}
          {learned > 0 && <span className="pill">{t('{done}/{total} gelernt', { done: learned, total: opening.variations.length })}</span>}
          {mastered > 0 && <span className="pill">{t('{done}/{total} gemeistert', { done: mastered, total: opening.variations.length })}</span>}
        </span>
        {learned > 0 && (
          <span className="mastery-thin" title={t('Fortschritt bis alle Varianten sitzen')}>
            <i style={{ width: `${Math.max(4, share * 100)}%` }} />
          </span>
        )}
      </span>
    </button>
  )
}
