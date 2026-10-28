import { tk, translateFields } from '../i18n/i18n'

export interface Level {
  level: number
  /** rough playing strength, as a player would describe an opponent */
  label: string
  /** the opponent's character name (src/play/bots.ts draws and voices it); the same in every language */
  name: string
  /** what kind of player that strength is, e.g. "Vereinsspieler" */
  kind: string
  go: string
  options: Record<string, number | boolean>
}

// The low levels weaken Stockfish through Skill Level and a shallow search, so they also
// miss tactics. From ~1400 on, Stockfish's own UCI_Elo limiter takes over. The numbers are
// approximate: the browser build uses a smaller network than the one UCI_Elo was tuned on.
const skill = (s: number) => ({ UCI_LimitStrength: false, 'Skill Level': s })
const elo = (e: number) => ({ UCI_LimitStrength: true, UCI_Elo: e, 'Skill Level': 20 })

// kinds and labels are read through t(); names stay as they are
// i18n-fields: kind
export const LEVELS: Level[] = ([
  { level: 1, label: '~800', name: 'Pip', kind: 'Einsteiger', go: 'depth 1 movetime 50', options: skill(0) },
  { level: 2, label: '~1000', name: 'Bit', kind: 'Anfänger', go: 'depth 2 movetime 100', options: skill(3) },
  { level: 3, label: '~1200', name: 'Mimi', kind: 'Gelegenheitsspieler', go: 'depth 4 movetime 200', options: skill(6) },
  { level: 4, label: '~1400', name: 'Rocco', kind: 'Vereinsspieler', go: 'movetime 300', options: elo(1400) },
  { level: 5, label: '~1600', name: 'Nova', kind: 'Starker Vereinsspieler', go: 'movetime 400', options: elo(1600) },
  { level: 6, label: '~1800', name: 'Taro', kind: 'Turnierspieler', go: 'movetime 500', options: elo(1800) },
  { level: 7, label: '~2000', name: 'Zora', kind: 'Experte', go: 'movetime 600', options: elo(2000) },
  { level: 8, label: '~2200', name: 'Rex', kind: 'Meister', go: 'movetime 800', options: elo(2200) },
  { level: 9, label: '~2500', name: 'Draco', kind: 'Großmeister', go: 'movetime 1000', options: elo(2500) },
  { level: 10, label: tk('Ideal'), name: 'Omega', kind: 'Immer der beste Zug', go: 'depth 22 movetime 2000', options: skill(20) },
] as Level[]).map((l) => translateFields(l, 'kind', 'label'))

export const IDEAL = LEVELS.length

export const levelOf = (n: number) => LEVELS[Math.min(Math.max(n, 1), LEVELS.length) - 1]
