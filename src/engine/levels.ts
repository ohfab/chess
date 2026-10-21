export interface Level {
  level: number
  label: string
  skill: number
  depth: number
  movetime: number
}

// Skill Level weakens Stockfish by sometimes picking a worse candidate;
// shallow depth and short think time make the low levels miss tactics too.
export const LEVELS: Level[] = [
  { level: 1, label: 'Einsteiger', skill: 0, depth: 1, movetime: 50 },
  { level: 2, label: 'Anfänger', skill: 3, depth: 2, movetime: 100 },
  { level: 3, label: 'Gelegenheitsspieler', skill: 6, depth: 4, movetime: 150 },
  { level: 4, label: 'Vereinsspieler', skill: 9, depth: 6, movetime: 250 },
  { level: 5, label: 'Starker Vereinsspieler', skill: 12, depth: 9, movetime: 400 },
  { level: 6, label: 'Experte', skill: 15, depth: 12, movetime: 600 },
  { level: 7, label: 'Meister', skill: 18, depth: 16, movetime: 900 },
  { level: 8, label: 'Volle Stärke', skill: 20, depth: 24, movetime: 1500 },
]

export const levelOf = (n: number) => LEVELS[Math.min(Math.max(n, 1), LEVELS.length) - 1]
