import { useEffect, useMemo, useState } from 'react'
import { progressKey, useGame } from '../game/store'
import { bookAt, loadBook, openingById, type BookNode } from './book'
import { onVariationRun } from '../lesson/lesson'

function useBook(id: string | undefined) {
  const [loaded, setLoaded] = useState<{ id: string; tree: BookNode[] } | null>(null)
  useEffect(() => {
    if (!id) return
    let live = true
    void loadBook(id).then((tree) => live && setLoaded({ id, tree }))
    return () => {
      live = false
    }
  }, [id])
  return loaded && loaded.id === id ? loaded.tree : null
}

/** Where the current opening drill stands: the theory at the latest position and whether it is over. */
export function useTrainer() {
  const { mode, training, plies, playerColor, updateTraining, recordProgress } = useGame()
  const active = mode === 'training' && training !== null
  const drill = active ? openingById(training.openingId) : undefined
  const tree = useBook(drill?.id)
  const played = useMemo(() => plies.map((p) => p.san), [plies])
  const line = training?.line
  const step = useMemo(() => (drill && tree && line ? bookAt(tree, drill, line, played) : null), [drill, tree, line, played])

  const loading = active && !tree
  const bookOver = active && tree !== null && step === null
  // the chosen line itself is on the board: what the run is about; later moves are free practice
  const lineDone = active && !!line && played.length >= line.length && line.every((m, i) => played[i] === m)
  // the game has left the chosen line (possible when wrong moves are allowed)
  const offLine = !!line && played.some((m, i) => i < line.length && m !== line[i])
  const clean = !!training && training.mistakes === 0 && training.hints === 0 && !offLine

  // count each run once: when the line is played out, or when the theory ends after leaving it
  // (learning runs are counted on their own)
  useEffect(() => {
    if (!(lineDone || bookOver) || !training || !drill || training.recorded || training.learn) return
    updateTraining({ recorded: true, cleanRun: clean })
    const key = progressKey(drill.id, training.variation, playerColor)
    recordProgress(key, clean)
    // spaced repetition: a clean run that is due moves the variation a step towards mastery
    onVariationRun(key, clean)
  }, [lineDone, bookOver, training, drill, playerColor, clean, updateTraining, recordProgress])

  return {
    active,
    drill,
    variation: drill && training ? drill.variations[training.variation] : undefined,
    step,
    loading,
    bookOver,
    lineDone,
    offLine,
    clean,
  }
}
