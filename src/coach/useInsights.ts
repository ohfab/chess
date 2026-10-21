import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../game/store'
import { analyse, loadNames, type Names } from './insights'

/** The analysis of the archived games, recomputed when a game or review comes in. */
export function useInsights() {
  const history = useGame((s) => s.history)
  const level = useGame((s) => s.level)
  const [names, setNames] = useState<Names | null>(null)
  useEffect(() => void loadNames().then(setNames), [])
  return useMemo(() => analyse(history, level, names), [history, level, names])
}
