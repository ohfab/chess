import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../game/store'
import { bump, recordBest } from '../progress/stats'

// Results of "guess the move": the best share of points per game and how often it was played.

interface GuessState {
  /** best result per game, 0..100 % of the possible points */
  best: Record<string, number>
  plays: Record<string, number>
}

export const useGuess = create<GuessState>()(persist(() => ({ best: {}, plays: {} }), { name: 'rookly-guess', storage: safeStorage, version: 1 }))

/** Files a finished game; true when it beats the best result so far. */
export function finishGame(id: string, percent: number) {
  const old = useGuess.getState().best[id]
  useGuess.setState((s) => ({
    plays: { ...s.plays, [id]: (s.plays[id] ?? 0) + 1 },
    best: old === undefined || percent > old ? { ...s.best, [id]: percent } : s.best,
  }))
  bump('guessGames')
  recordBest('guessBest', percent)
  return old === undefined || percent > old
}
