import { Check, X } from 'lucide-react'
import type { Color } from '../game/rules'

export type Mark = 'target' | 'hit' | 'miss' | 'answer'

const FILES = 'abcdefgh'

/** An empty board of 64 buttons, for the coordinate exercises. */
export function SquareBoard({
  orientation,
  marks = {},
  coordinates = false,
  onPick,
}: {
  orientation: Color
  marks?: Record<string, Mark>
  coordinates?: boolean
  onPick?: (square: string) => void
}) {
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = orientation === 'white' ? [...FILES] : [...FILES].reverse()
  return (
    <div className={`square-board ${onPick ? 'pickable' : ''}`}>
      {ranks.map((rank, r) =>
        files.map((file, f) => {
          const sq = `${file}${rank}`
          const dark = (FILES.indexOf(file) + rank) % 2 === 1
          const mark = marks[sq]
          return (
            <button
              key={sq}
              type="button"
              className={`sq ${dark ? 'dark' : 'light'} ${mark ?? ''}`}
              onClick={onPick ? () => onPick(sq) : undefined}
              tabIndex={onPick ? 0 : -1}
              aria-label={onPick ? sq : undefined}
            >
              {mark === 'hit' && <Check className="sq-icon" strokeWidth={3} />}
              {mark === 'miss' && <X className="sq-icon" strokeWidth={3} />}
              {coordinates && f === 0 && <span className="sq-rank">{rank}</span>}
              {coordinates && r === 7 && <span className="sq-file">{file}</span>}
            </button>
          )
        }),
      )}
    </div>
  )
}
