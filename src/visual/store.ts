import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../game/store'
import { bump, recordBest } from '../progress/stats'

// Best scores of the board vision exercises, per exercise and side.

export type VisualKey = 'find-white' | 'find-black' | 'name-white' | 'name-black' | 'blind'

interface VisualState {
  best: Partial<Record<VisualKey, number>>
  runs: number
}

export const useVisual = create<VisualState>()(persist(() => ({ best: {}, runs: 0 }), { name: 'rookly-visual', storage: safeStorage, version: 1 }))

/** Files a finished run; true when it beats the best so far. */
export function finishRun(key: VisualKey, score: number) {
  const old = useVisual.getState().best[key] ?? 0
  useVisual.setState((s) => ({ runs: s.runs + 1, best: score > old ? { ...s.best, [key]: score } : s.best }))
  bump('visualRuns')
  // the timed square exercises count for the overall record
  if (key !== 'blind') recordBest('visualBest', score)
  return score > old
}
