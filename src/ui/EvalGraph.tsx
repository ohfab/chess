import type { MouseEvent } from 'react'
import { JUDGEMENT, type Judgement, type Review } from '../review/review'

const MARKED: Judgement[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']

const W = 600
const H = 80

/** Eval over the game, White's share filled from the bottom; click to jump to a move. */
export function EvalGraph({ review, cursor, onJump }: { review: Review; cursor: number; onJump: (ply: number) => void }) {
  const n = review.evals.length
  const fx = (i: number) => (n === 1 ? 0.5 : i / (n - 1))
  const line = review.evals.map((e, i) => `${(fx(i) * W).toFixed(1)},${((1 - e.win) * H).toFixed(1)}`).join(' L')

  const jump = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onJump(Math.round(((e.clientX - rect.left) / rect.width) * (n - 1)))
  }

  return (
    <div className="evalgraph" onClick={jump} role="img" aria-label="Bewertungsverlauf">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={`M0,${H} L${line} L${W},${H} Z`} className="evalgraph-area" />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="evalgraph-mid" />
      </svg>
      <span className="evalgraph-cursor" style={{ left: `${fx(cursor) * 100}%` }} />
      {/* dots in HTML so they stay round while the svg stretches */}
      {review.moves.map((m, i) =>
        MARKED.includes(m.judgement) ? (
          <span
            key={i}
            className="evalgraph-dot"
            style={{
              left: `${fx(i + 1) * 100}%`,
              top: `${(1 - review.evals[i + 1].win) * 100}%`,
              background: JUDGEMENT[m.judgement].color,
            }}
          />
        ) : null,
      )}
    </div>
  )
}
