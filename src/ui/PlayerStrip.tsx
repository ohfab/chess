import { Bot, User } from 'lucide-react'
import { Piece } from '../board/Piece'
import type { Color } from '../game/rules'
import { t } from '../i18n/i18n'
import { BotAvatar } from '../play/BotAvatar'
import { ClockFace } from '../play/PlayTools'

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const ROLE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' }

const count = (fen: string, ch: string) => fen.split(' ')[0].split(ch).length - 1

/** Pieces each side has taken since `startFen`, and the material balance from White's view. */
function material(startFen: string, fen: string) {
  const taken: Record<Color, string[]> = { white: [], black: [] }
  let balance = 0
  for (const p of ['q', 'r', 'b', 'n', 'p']) {
    const P = p.toUpperCase()
    balance += (count(fen, P) - count(fen, p)) * VALUES[p]
    for (let i = count(fen, p); i < count(startFen, p); i++) taken.white.push(p)
    for (let i = count(fen, P); i < count(startFen, P); i++) taken.black.push(p)
  }
  return { taken, balance }
}

interface Props {
  name: string
  detail?: string
  color: Color
  bot: boolean
  startFen: string
  fen: string
  thinking?: boolean
  active?: boolean
  accuracy?: number
  /** a Stockfish character from the play page: its pixel face instead of the robot icon */
  botLevel?: number
  /** a game with a clock: this side's time, running while `since` is set */
  clock?: { left: number; since: number | null }
  /** what the opponent says right now (a German key for t), in a bubble over the board */
  say?: { text: string; n: number } | null
  /** where the bubble goes: under a strip above the board, over a strip below it */
  sayAt?: 'below' | 'above'
}

export function PlayerStrip({ name, detail, color, bot, startFen, fen, thinking, active, accuracy, botLevel, clock, say, sayAt = 'below' }: Props) {
  const { taken, balance } = material(startFen, fen)
  const lead = color === 'white' ? balance : -balance
  return (
    <div className={`player ${active ? 'active' : ''} ${clock ? 'timed' : ''}`}>
      {botLevel ? (
        <BotAvatar level={botLevel} className="avatar strip-bot" />
      ) : (
        <div className={`avatar ${color}`}>{bot ? <Bot size={22} /> : <User size={22} />}</div>
      )}
      <div className="player-text">
        <div className="player-name">
          {name}
          {detail && <span className="player-detail">{detail}</span>}
        </div>
        <div className="captured">
          {taken[color].map((p, i) => (
            <Piece key={i} role={ROLE[p]} color={color === 'white' ? 'black' : 'white'} />
          ))}
          {lead > 0 && <span className="lead">+{lead}</span>}
        </div>
      </div>
      {thinking && (
        <div className="thinking" aria-label={t('denkt nach')}>
          <i />
          <i />
          <i />
        </div>
      )}
      {accuracy !== undefined && <div className={`accuracy ${color}`}>{accuracy.toFixed(1)}</div>}
      {clock && <ClockFace left={clock.left} since={clock.since} />}
      {say && (
        <div key={say.n} className={`bot-say ${sayAt}`} role="status">
          {t(say.text)}
        </div>
      )}
    </div>
  )
}
