import { useLayoutEffect, useRef } from 'react'

/**
 * A chess piece drawn with the board's piece set. chessground styles <piece class="queen white">,
 * which React would flag as an unknown tag, so the element is created by hand.
 */
export function Piece({ role, color, className = '' }: { role: string; color: string; className?: string }) {
  const slot = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const piece = document.createElement('piece')
    piece.className = `${role} ${color}`
    slot.current?.replaceChildren(piece)
  }, [role, color])
  return <span ref={slot} className={`cg-wrap piece-slot ${className}`} aria-hidden />
}
