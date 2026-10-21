/** German names for the lichess puzzle themes the trainer uses. */
export const THEME_NAMES: Record<string, string> = {
  hangingPiece: 'Hängende Figuren',
  fork: 'Gabeln',
  pin: 'Fesselungen',
  skewer: 'Spieße',
  discoveredAttack: 'Abzugsangriffe',
  mateIn1: 'Matt in 1',
  mateIn2: 'Matt in 2',
  mateIn3: 'Matt in 3',
  backRankMate: 'Grundreihenmatt',
  trappedPiece: 'Gefangene Figuren',
  deflection: 'Ablenkung',
  attraction: 'Hinlenkung',
  sacrifice: 'Opfer',
  defensiveMove: 'Verteidigung',
  endgame: 'Endspiel',
  advancedPawn: 'Freibauern',
  opening: 'Eröffnungsfallen',
  kingsideAttack: 'Königsangriff',
  quietMove: 'Stille Züge',
  clearance: 'Räumung',
}

export const themeName = (t: string) => THEME_NAMES[t] ?? 'Taktik-Mix'
