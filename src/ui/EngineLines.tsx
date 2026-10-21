import { formatScore, whiteScore, type Analysis } from '../engine/useEngine'
import { figurine, moveNumber, pvToSan, turnOf } from '../game/rules'
import { t } from '../i18n/i18n'

interface Props {
  fen: string
  analysis: Analysis | null
  /** mate or stalemate on the board: nothing to calculate */
  final: boolean
  onPlay?: (uci: string) => void
}

/** Stockfish's top lines for the position, numbered like a game score. */
export function EngineLines({ fen, analysis, final, onPlay }: Props) {
  const black = turnOf(fen) === 'black'
  const number = moveNumber(fen)
  return (
    <div className="lines">
      <div className="lines-head">
        <span>Stockfish 19</span>
        <span className="muted">{final ? t('Partie zu Ende') : analysis ? t('Tiefe {n}', { n: analysis.depth }) : t('rechnet …')}</span>
      </div>
      {analysis?.lines.map((line) => {
        const score = whiteScore(line.score, fen)
        const good = 'mate' in score ? score.mate > 0 : score.cp >= 0
        const san = pvToSan(fen, line.pv, 10)
        return (
          <button key={line.multipv} className="line" onClick={() => onPlay?.(line.pv[0])} disabled={!onPlay}>
            <span className={`line-score ${good ? 'white' : 'black'}`}>{formatScore(score)}</span>
            <span className="line-moves">
              {san.map((m, i) => {
                const ply = i + (black ? 1 : 0)
                const label = ply % 2 === 0 ? `${number + ply / 2}. ` : i === 0 ? `${number}… ` : ''
                return (
                  <span key={i}>
                    {label}
                    {figurine(m)}{' '}
                  </span>
                )
              })}
            </span>
          </button>
        )
      })}
    </div>
  )
}
