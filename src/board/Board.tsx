import { useEffect, useRef, useState } from 'react'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import type { Color } from '../game/rules'
import { drawn } from './arrows'
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
  // arrows and circles the player draws with a right-drag, and the one being drawn right now
  const [userShapes, setUserShapes] = useState<DrawShape[]>([])
  const [preview, setPreview] = useState<DrawShape | null>(null)
  // a hidden board has no size; shapes are placed only once it has one
  const [width, setWidth] = useState(0)

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
      // chessground still handles drawing; its own rendering is hidden (board.css) and
      // every shape is drawn by arrows.ts instead
      drawable: { enabled: true, visible: true, onChange: (shapes) => setUserShapes(shapes) },
    })
    // chessground caches the board's screen position and only refreshes it on scroll or resize;
    // panels above the board can change height and move it, so measure again on every press
    const wrap = el.current!
    const remeasure = () => api.current?.state.dom.bounds.clear()
    for (const ev of ['mousedown', 'touchstart']) wrap.addEventListener(ev, remeasure, { capture: true, passive: true })

    // follow the shape being drawn so it shows while the button is held
    let last = ''
    const track = () => {
      const cur = api.current?.state.drawable.current
      const key = cur ? `${cur.orig}${cur.mouseSq ?? ''}${cur.brush}` : ''
      if (key === last) return
      last = key
      setPreview(cur ? { orig: cur.orig, dest: cur.mouseSq, brush: cur.brush } : null)
    }
    const settle = () => requestAnimationFrame(track)
    const sized = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    sized.observe(wrap)
    document.addEventListener('mousemove', track, { passive: true })
    document.addEventListener('mouseup', settle)
    return () => {
      for (const ev of ['mousedown', 'touchstart']) wrap.removeEventListener(ev, remeasure, { capture: true })
      document.removeEventListener('mousemove', track)
      document.removeEventListener('mouseup', settle)
      sized.disconnect()
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

  const { shapes, orientation } = props
  useEffect(() => {
    if (!width) return api.current?.setAutoShapes([])
    const all = [...shapes, ...userShapes].map((s) => drawn(s, orientation))
    if (preview) all.push(drawn(preview, orientation, true))
    api.current?.setAutoShapes(all)
  }, [shapes, orientation, userShapes, preview, width])

  return <div ref={el} className="board" />
}
