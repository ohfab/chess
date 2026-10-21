import { useLayoutEffect, useRef } from 'react'
import type { Color } from '../game/rules'

const ROLE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

/** A static board picture for menus: no interaction, just the pieces of a FEN. */
export function MiniBoard({ fen, orientation, last }: { fen: string; orientation: Color; last?: [string, string] }) {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const at = (file: number, rank: number) => {
      const x = orientation === 'white' ? file : 7 - file
      const y = orientation === 'white' ? 7 - rank : rank
      return `left:${x * 12.5}%;top:${y * 12.5}%`
    }
    const square = (key: string) => at(key.charCodeAt(0) - 97, Number(key[1]) - 1)
    let html = last ? last.map((k) => `<i class="mini-last" style="${square(k)}"></i>`).join('') : ''
    fen
      .split(' ')[0]
      .split('/')
      .forEach((row, r) => {
        let file = 0
        for (const ch of row) {
          if (ch >= '1' && ch <= '8') {
            file += Number(ch)
            continue
          }
          const color = ch === ch.toUpperCase() ? 'white' : 'black'
          html += `<piece class="${ROLE[ch.toLowerCase()]} ${color}" style="${at(file, 7 - r)}"></piece>`
          file++
        }
      })
    el.current!.innerHTML = html
  }, [fen, orientation, last])
  return <div ref={el} className="miniboard cg-wrap" aria-hidden />
}
