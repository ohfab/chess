import type { Key } from '@lichess-org/chessground/types'
import type { Color } from '../game/rules'
import { t, tk } from '../i18n/i18n'
import { Piece } from './Piece'

const ROLES = [
  ['q', 'queen', tk('Dame')],
  ['n', 'knight', tk('Springer')],
  ['r', 'rook', tk('Turm')],
  ['b', 'bishop', tk('Läufer')],
] as const

interface Props {
  dest: Key
  color: Color
  orientation: Color
  onPick: (piece: 'q' | 'n' | 'r' | 'b' | null) => void
}

/** Lichess-style picker: the four pieces stack down the promotion file from the target square. */
export function Promotion({ dest, color, orientation, onPick }: Props) {
  const file = dest.charCodeAt(0) - 97
  const left = (orientation === 'white' ? file : 7 - file) * 12.5
  const fromTop = (color === 'white') === (orientation === 'white')
  return (
    <div className="promotion" onClick={() => onPick(null)}>
      {ROLES.map(([p, role, name], i) => (
        <button
          key={p}
          className="promotion-choice"
          style={{ left: `${left}%`, [fromTop ? 'top' : 'bottom']: `${i * 12.5}%` }}
          onClick={(e) => {
            e.stopPropagation()
            onPick(p)
          }}
          aria-label={t(name)}
        >
          <Piece role={role} color={color} />
        </button>
      ))}
    </div>
  )
}
