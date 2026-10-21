import { useMemo, useState } from 'react'
import { Search, Play } from 'lucide-react'
import { numbered } from '../game/rules'
import { progressKey, type Progress } from '../game/store'
import { fenAfter, rootOf } from './book'
import { CATALOG, type OpeningDef } from './catalog'
import { MiniBoard } from './MiniBoard'

const GROUPS: { title: string; match: (o: OpeningDef) => boolean }[] = [
  { title: 'Mit Weiß · 1.e4', match: (o) => o.side === 'white' && o.group === 'e4' },
  { title: 'Mit Weiß · 1.d4', match: (o) => o.side === 'white' && o.group === 'd4' },
  { title: 'Mit Weiß · Flankeneröffnungen', match: (o) => o.side === 'white' && o.group === 'flank' },
  { title: 'Mit Schwarz · gegen 1.e4', match: (o) => o.side === 'black' && o.group === 'e4' },
  { title: 'Mit Schwarz · gegen 1.d4', match: (o) => o.side === 'black' && o.group === 'd4' },
]

type Filter = 'all' | 'white' | 'black'

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface Props {
  progress: Record<string, Progress>
  /** the drill in progress, if any */
  current?: { title: string; onResume: () => void }
  onPick: (id: string) => void
}

export function OpeningBrowser({ progress, current, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    const q = fold(query.trim())
    return CATALOG.filter(
      (o) =>
        (filter === 'all' || o.side === filter) &&
        (!q || [o.name, o.en, ...o.variations.map((v) => v.name)].some((t) => fold(t).includes(q))),
    )
  }, [query, filter])

  return (
    <div className="openings">
      <div className="openings-head">
        <div>
          <h2>Eröffnungen</h2>
          <p className="muted">{CATALOG.length} Eröffnungen, Theorie aus 200.000 Turnierpartien</p>
        </div>
        {current && (
          <button className="resume" onClick={current.onResume}>
            <Play size={16} />
            <span>
              Weiter trainieren
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
            placeholder="Suchen, z. B. Caro-Kann oder Najdorf"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="segmented small">
          {(['all', 'white', 'black'] as const).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Alle' : f === 'white' ? 'Weiß' : 'Schwarz'}
            </button>
          ))}
        </div>
      </div>

      {GROUPS.map((group) => {
        const items = visible.filter(group.match)
        if (!items.length) return null
        return (
          <section key={group.title} className="opening-group">
            <h3>{group.title}</h3>
            <div className="opening-grid">
              {items.map((o) => (
                <OpeningCard key={o.id} opening={o} progress={progress} onPick={() => onPick(o.id)} />
              ))}
            </div>
          </section>
        )
      })}
      {visible.length === 0 && <p className="muted empty">Keine Eröffnung gefunden.</p>}
    </div>
  )
}

function OpeningCard({ opening, progress, onPick }: { opening: OpeningDef; progress: Record<string, Progress>; onPick: () => void }) {
  const root = rootOf(opening)
  const fen = useMemo(() => fenAfter(opening.moves.split(' ')), [opening.moves])
  const practised = opening.variations.filter((_, i) => progress[progressKey(opening.id, i, opening.side)]?.runs).length
  const mastered = opening.variations.filter((_, i) => progress[progressKey(opening.id, i, opening.side)]?.clean).length
  return (
    <button className="opening-card" onClick={onPick}>
      <MiniBoard fen={fen} orientation={opening.side} />
      <span className="opening-card-text">
        <b>{opening.name}</b>
        <span className="muted">{opening.en}</span>
        <span className="opening-moves">{numbered(root)}</span>
        <span className="opening-meta">
          {opening.variations.length} Varianten
          {practised > 0 && (
            <span className="pill">
              {mastered}/{opening.variations.length} gemeistert
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
