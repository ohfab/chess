import { useEffect, useRef } from 'react'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import type { Color } from '../game/rules'
import '@lichess-org/chessground/assets/chessground.base.css'
import '@lichess-org/chessground/assets/chessground.cburnett.css'
import './board.css'

export interface BoardProps {
  fen: string
  orientation: Color
  turnColor: Color
  lastMove?: [Key, Key]
  check: boolean
  /** side that may move pieces; undefined locks the board */
  movableColor?: Color
  dests: Map<Key, Key[]>
  premove: boolean
  coordinates: boolean
  shapes: DrawShape[]
  /** bump to make the board forget a move it drew but the game did not take (cancelled promotion) */
  resync: number
  onMove: (orig: Key, dest: Key, premove: boolean) => void
}

export function Board(props: BoardProps) {
  const el = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const onMove = useRef(props.onMove)
  onMove.current = props.onMove

  const config = (): Config => ({
    fen: props.fen,
    orientation: props.orientation,
    turnColor: props.turnColor,
    lastMove: props.lastMove,
    check: props.check,
    coordinates: props.coordinates,
    movable: {
      free: false,
      color: props.movableColor,
      dests: props.dests,
      showDests: true,
    },
    premovable: { enabled: props.premove, showDests: true, castle: true },
    drawable: { autoShapes: props.shapes },
  })

  useEffect(() => {
    api.current = Chessground(el.current!, {
      ...config(),
      animation: { enabled: true, duration: 200 },
      draggable: { enabled: true, distance: 3, showGhost: true },
      highlight: { lastMove: true, check: true },
      autoCastle: true,
      disableContextMenu: true,
      movable: {
        ...config().movable,
        events: { after: (orig, dest, meta) => onMove.current(orig, dest, meta.premove) },
      },
      drawable: {
        enabled: true,
        visible: true,
        autoShapes: props.shapes,
        brushes: {
          green: { key: 'g', color: '#3f9b4a', opacity: 0.9, lineWidth: 10 },
          red: { key: 'r', color: '#c0453b', opacity: 0.9, lineWidth: 10 },
          blue: { key: 'b', color: '#3a6fd1', opacity: 0.9, lineWidth: 10 },
          yellow: { key: 'y', color: '#e3a92b', opacity: 0.9, lineWidth: 10 },
          engine: { key: 'e', color: '#4f8fe6', opacity: 0.8, lineWidth: 12 },
          engine2: { key: 'e2', color: '#4f8fe6', opacity: 0.4, lineWidth: 8 },
          hint: { key: 'h', color: '#f0a33a', opacity: 0.9, lineWidth: 12 },
          best: { key: 'bm', color: '#81b64c', opacity: 0.9, lineWidth: 12 },
        },
      },
    })
    // chessground caches the board's screen position and only refreshes it on scroll or resize;
    // panels above the board can change height and move it, so measure again on every press
    const wrap = el.current!
    const remeasure = () => api.current?.state.dom.bounds.clear()
    for (const ev of ['mousedown', 'touchstart']) wrap.addEventListener(ev, remeasure, { capture: true, passive: true })
    return () => {
      for (const ev of ['mousedown', 'touchstart']) wrap.removeEventListener(ev, remeasure, { capture: true })
      api.current?.destroy()
    }
    // chessground is created once; later prop changes go through api.set below
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const destsKey = [...props.dests].map(([k, v]) => k + v.join('')).join()
  useEffect(() => {
    api.current?.set(config())
    // ask once the new position and dests are in: a stored premove may now be legal
    if (props.premove && props.movableColor === props.turnColor) api.current?.playPremove()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fen, props.orientation, props.turnColor, props.lastMove?.join(), props.check, props.movableColor, destsKey, props.premove, props.resync])

  useEffect(() => {
    // coordinates are part of the board's DOM, which only a full redraw rebuilds
    api.current?.set({ coordinates: props.coordinates })
    api.current?.redrawAll()
  }, [props.coordinates])

  useEffect(() => {
    api.current?.setAutoShapes(props.shapes)
  }, [props.shapes])

  return <div ref={el} className="board" />
}
