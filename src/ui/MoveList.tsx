import { useEffect, useRef } from 'react'
import { Badge } from '../review/Badge'
import type { MoveReview } from '../review/review'
import { figurine, moveNumber, turnOf, type Ply } from '../game/rules'
import { t } from '../i18n/i18n'

interface Props {
  startFen: string
  plies: Ply[]
  cursor: number
  /** reviews for the first plies, if the game was reviewed */
  reviews: MoveReview[]
  /** plies from here on are a side line, not the game */
  sideFrom?: number
  onJump: (cursor: number) => void
}

export function MoveList({ startFen, plies, cursor, reviews, sideFrom, onJump }: Props) {
  const box = useRef<HTMLDivElement>(null)

  // keep the current move in view without scrolling the page
  useEffect(() => {
    const el = box.current
    const active = el?.querySelector<HTMLElement>('.move.active')
    if (!el || !active) return
    const a = active.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    if (a.top < b.top || a.bottom > b.bottom) el.scrollTop += a.top - b.top - b.height / 2 + a.height / 2
    if (a.left < b.left || a.right > b.right) el.scrollLeft += a.left - b.left - b.width / 2 + a.width / 2
  }, [cursor, plies.length])

  // rows of [number, white ply index, black ply index]; a game may start with Black to move
  const rows: [number, number | null, number | null][] = []
  let number = moveNumber(startFen)
  let i = 0
  if (turnOf(startFen) === 'black' && plies.length) rows.push([number++, null, i++])
  for (; i < plies.length; i += 2) rows.push([number++, i, i + 1 < plies.length ? i + 1 : null])

  const cell = (idx: number | null) =>
    idx === null ? (
      <span className="move empty" />
    ) : (
      <button className={`move ${cursor === idx + 1 ? 'active' : ''} ${sideFrom !== undefined && idx >= sideFrom ? 'side-line' : ''}`} onClick={() => onJump(idx + 1)}>
        {reviews[idx] && <Badge judgement={reviews[idx].judgement} size={16} />}
        {figurine(plies[idx].san)}
      </button>
    )

  return (
    <div className="movelist" ref={box}>
      {rows.length === 0 && <div className="movelist-empty">{t('Noch keine Züge')}</div>}
      {rows.map(([n, w, b]) => (
        <div className="moverow" key={n}>
          <span className="movenum">{n}.</span>
          {cell(w)}
          {cell(b)}
        </div>
      ))}
    </div>
  )
}
