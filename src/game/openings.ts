import { useEffect, useState } from 'react'
import type { Ply } from './rules'

export interface Opening {
  eco: string
  name: string
}

type Table = Record<string, [string, string]>

let table: Table | null = null
let loading: Promise<Table> | null = null

const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ')

export function loadOpenings() {
  loading ??= import('../data/openings.json').then((m) => (table = m.default as unknown as Table))
  return loading
}

/** Whether the position is a named opening position (needs loadOpenings first). */
export const isBook = (fen: string) => table !== null && epd(fen) in table

/** Name of the deepest known opening position along the line up to `cursor`. */
function lookup(t: Table, startFen: string, plies: Ply[], cursor: number): Opening | null {
  for (let i = cursor; i >= 0; i--) {
    const hit = t[epd(i === 0 ? startFen : plies[i - 1].fen)]
    if (hit) return { eco: hit[0], name: hit[1] }
  }
  return null
}

export function useOpening(startFen: string, plies: Ply[], cursor: number) {
  const [ready, setReady] = useState(table !== null)
  useEffect(() => {
    if (!ready) void loadOpenings().then(() => setReady(true))
  }, [ready])
  if (!ready || !table) return null
  return lookup(table, startFen, plies, cursor)
}
