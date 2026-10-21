import { t, tk, translateFields } from '../i18n/i18n'

/** Names for the lichess puzzle themes the trainer uses, read through t(). */
export const THEME_NAMES: Record<string, string> = {
  hangingPiece: tk('Hängende Figuren'),
  fork: tk('Gabeln'),
  pin: tk('Fesselungen'),
  skewer: tk('Spieße'),
  discoveredAttack: tk('Abzugsangriffe'),
  mateIn1: tk('Matt in 1'),
  mateIn2: tk('Matt in 2'),
  mateIn3: tk('Matt in 3'),
  backRankMate: tk('Grundreihenmatt'),
  trappedPiece: tk('Gefangene Figuren'),
  deflection: tk('Ablenkung'),
  attraction: tk('Hinlenkung'),
  sacrifice: tk('Opfer'),
  defensiveMove: tk('Verteidigung'),
  endgame: tk('Endspiel'),
  advancedPawn: tk('Freibauern'),
  opening: tk('Eröffnungsfallen'),
  kingsideAttack: tk('Königsangriff'),
  quietMove: tk('Stille Züge'),
  clearance: tk('Räumung'),
}
translateFields(THEME_NAMES, ...Object.keys(THEME_NAMES))

export const themeName = (theme: string) => THEME_NAMES[theme] ?? t('Taktik-Mix')
