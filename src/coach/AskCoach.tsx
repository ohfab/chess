import type { Line } from '../engine/engine'

export interface AskCoachProps {
  fen: string
  /** the engine's view of the position, if the live engine runs */
  lines: Line[]
  /** the game so far in SAN, for context */
  moves: string[]
  onClose: () => void
}

/** Ask the AI coach about the position on the board. */
export function AskCoachDialog({ onClose }: AskCoachProps) {
  void onClose
  return null
}
