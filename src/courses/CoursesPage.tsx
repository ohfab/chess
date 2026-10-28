import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { CourseView } from './CourseView'
import { practice } from './store'
import { WorldMap } from './WorldMap'
import './courses.css'

// Courses: one tactical motif or mating pattern at a time, explained on a real position and
// then practised with puzzles of that theme. The levels sit on a world map; stars come from
// the puzzles solved per theme (themeStats).

export interface CoursesProps {
  onBack: () => void
  /** practise a motif: a few puzzles of this lichess puzzle theme */
  onTrain: (theme: string) => void
}

export function CoursesPage({ onBack, onTrain }: CoursesProps) {
  // coming back from a round of practice: open that course again
  const [back] = useState(() => (practice.theme ? { theme: practice.theme, solved: practice.solved, tries: practice.tries } : null))
  const [open, setOpen] = useState<string | null>(back?.theme ?? null)
  useEffect(() => {
    practice.theme = null
  }, [])
  // the tactics page was scrolled to reach this; every screen here starts at the top
  useEffect(() => window.scrollTo(0, 0), [open])

  const train = (theme: string) => {
    const st = useGame.getState().themeStats[theme] ?? { tries: 0, solved: 0 }
    Object.assign(practice, { theme, solved: st.solved, tries: st.tries })
    onTrain(theme)
  }

  if (open)
    return <CourseView key={open} theme={open} back={back?.theme === open ? back : undefined} onMap={() => setOpen(null)} onTrain={train} />
  return <WorldMap onBack={onBack} onOpen={setOpen} />
}
