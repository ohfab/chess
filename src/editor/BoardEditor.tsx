import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Key, Piece as CgPiece, Role } from '@lichess-org/chessground/types'
import { ArrowUpDown, Eraser, Hand, Microscope, RotateCcw, Swords, Trash2 } from 'lucide-react'
import { Chess } from 'chess.js'
import { Piece } from '../board/Piece'
import { START_FEN, type Color } from '../game/rules'
import { t, tk } from '../i18n/i18n'
import '@lichess-org/chessground/assets/chessground.base.css'
import '@lichess-org/chessground/assets/chessground.cburnett.css'
import '../board/board.css'

const ROLES: Role[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']
const ROLE_NAME: Record<Role, string> = {
  king: tk('König'),
  queen: tk('Dame'),
  rook: tk('Turm'),
  bishop: tk('Läufer'),
  knight: tk('Springer'),
  pawn: tk('Bauer'),
}
const EMPTY = '8/8/8/8/8/8/8/8'

type Tool = 'move' | 'delete' | `${Color}-${Role}`

interface Castling {
  K: boolean
  Q: boolean
  k: boolean
  q: boolean
}

interface Props {
  fen: string
  coordinates: boolean
  onAnalyse: (fen: string) => void
  onPlay: (fen: string, color: Color) => void
}

const placementOf = (fen: string) => fen.split(' ')[0]

/** Which castlings the pieces still allow: king and rook on their home squares. */
function possible(placement: string): Castling {
  const rows = placement.split('/')
  const expand = (row: string) => row.replace(/\d/g, (n) => '.'.repeat(Number(n)))
  const r1 = expand(rows[7] ?? '')
  const r8 = expand(rows[0] ?? '')
  return { K: r1[4] === 'K' && r1[7] === 'R', Q: r1[4] === 'K' && r1[0] === 'R', k: r8[4] === 'k' && r8[7] === 'r', q: r8[4] === 'k' && r8[0] === 'r' }
}

function fullFen(placement: string, turn: Color, castling: Castling) {
  const can = possible(placement)
  const rights = (['K', 'Q', 'k', 'q'] as const).filter((c) => castling[c] && can[c]).join('') || '-'
  return `${placement} ${turn === 'white' ? 'w' : 'b'} ${rights} - 0 1`
}

/** Why the position cannot be played, or null. */
function problem(fen: string): string | null {
  const placement = placementOf(fen)
  const count = (ch: string) => [...placement].filter((c) => c === ch).length
  if (count('K') !== 1 || count('k') !== 1) return t('Jede Seite braucht genau einen König.')
  const rows = placement.split('/')
  if (/[pP]/.test(rows[0]) || /[pP]/.test(rows[7])) return t('Bauern dürfen nicht auf der ersten oder letzten Reihe stehen.')
  try {
    const chess = new Chess(fen)
    // the side that just moved may not have left its king in check
    const other = fen.split(' ')
    other[1] = other[1] === 'w' ? 'b' : 'w'
    other[3] = '-'
    if (new Chess(other.join(' ')).inCheck()) return t('Der König der Seite, die nicht am Zug ist, steht im Schach.')
    if (chess.isGameOver()) return chess.isCheckmate() ? t('Die Stellung ist schon matt.') : t('Die Stellung ist schon remis.')
  } catch (e) {
    return e instanceof Error ? t('Ungültige Stellung: {reason}', { reason: e.message.replace(/^Invalid FEN: /, '') }) : t('Ungültige Stellung.')
  }
  return null
}

/** Set up any position: drag pieces from the trays, drag them off the board to remove them. */
export function BoardEditor({ fen: initial, coordinates, onAnalyse, onPlay }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const [placement, setPlacement] = useState(placementOf(initial))
  const [turn, setTurn] = useState<Color>(initial.split(' ')[1] === 'b' ? 'black' : 'white')
  const [castling, setCastling] = useState<Castling>(() => {
    const c = initial.split(' ')[2] ?? '-'
    return { K: c.includes('K'), Q: c.includes('Q'), k: c.includes('k'), q: c.includes('q') }
  })
  const [orientation, setOrientation] = useState<Color>('white')
  const [tool, setTool] = useState<Tool>('move')
  const toolRef = useRef(tool)
  toolRef.current = tool
  const [fenText, setFenText] = useState<string | null>(null)

  useEffect(() => {
    const cg = Chessground(el.current!, {
      fen: placement,
      orientation,
      coordinates,
      movable: { free: true, color: 'both', showDests: false },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true, deleteOnDropOff: true },
      highlight: { lastMove: false, check: false },
      animation: { enabled: true, duration: 120 },
      drawable: { enabled: false },
      events: {
        change: () => setPlacement(cg.getFen()),
        select: (key: Key) => {
          const t = toolRef.current
          if (t === 'move') return
          cg.selectSquare(null)
          const current = cg.state.pieces.get(key)
          if (t === 'delete') cg.setPieces(new Map([[key, undefined]]))
          else {
            const [color, role] = t.split('-') as [Color, Role]
            const same = current && current.color === color && current.role === role
            cg.setPieces(new Map([[key, same ? undefined : { color, role }]]))
          }
          setPlacement(cg.getFen())
        },
      },
    })
    api.current = cg
    const wrap = el.current!
    const remeasure = () => cg.state.dom.bounds.clear()
    for (const ev of ['mousedown', 'touchstart']) wrap.addEventListener(ev, remeasure, { capture: true, passive: true })
    return () => {
      for (const ev of ['mousedown', 'touchstart']) wrap.removeEventListener(ev, remeasure, { capture: true })
      cg.destroy()
    }
    // created once; later changes go through set()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (api.current && api.current.getFen() !== placement) api.current.set({ fen: placement })
  }, [placement])
  useEffect(() => api.current?.set({ orientation }), [orientation])
  useEffect(() => api.current?.set({ coordinates }), [coordinates])
  // with a piece or the eraser picked, a click places instead of moving
  useEffect(() => api.current?.set({ movable: { color: tool === 'move' ? 'both' : undefined } }), [tool])

  const fen = fullFen(placement, turn, castling)
  const issue = problem(fen)
  const can = possible(placement)

  const spare = (color: Color) => (
    <div className={`spares ${color}`}>
      <button className={`spare-tool ${tool === 'move' ? 'on' : ''}`} onClick={() => setTool('move')} aria-label={t('Ziehen')} title={t('Figuren ziehen')}>
        <Hand size={20} />
      </button>
      {ROLES.map((role) => {
        const id: Tool = `${color}-${role}`
        return (
          <button
            key={role}
            className={`spare ${tool === id ? 'on' : ''}`}
            onClick={() => setTool(tool === id ? 'move' : id)}
            onPointerDown={(e: ReactPointerEvent) => {
              // dragging a tray piece onto the board places it
              if (e.button !== 0 || !api.current) return
              api.current.dragNewPiece({ color, role } as CgPiece, e.nativeEvent as unknown as MouseEvent)
            }}
            aria-label={`${t(ROLE_NAME[role])} · ${color === 'white' ? t('Weiß') : t('Schwarz')}`}
          >
            <Piece role={role} color={color} className="spare-piece" />
          </button>
        )
      })}
      <button className={`spare-tool ${tool === 'delete' ? 'on' : ''}`} onClick={() => setTool(tool === 'delete' ? 'move' : 'delete')} aria-label={t('Radierer')} title={t('Figuren entfernen')}>
        <Eraser size={20} />
      </button>
    </div>
  )

  const applyFen = () => {
    if (fenText === null) return
    const parts = fenText.trim().split(/\s+/)
    if (!parts[0] || parts[0].split('/').length !== 8) return
    setPlacement(parts[0])
    setTurn(parts[1] === 'b' ? 'black' : 'white')
    const c = parts[2] ?? '-'
    setCastling({ K: c.includes('K'), Q: c.includes('Q'), k: c.includes('k'), q: c.includes('q') })
    setFenText(null)
  }

  return (
    <main className="layout editor">
      <section className="stage">
        {spare(orientation === 'white' ? 'black' : 'white')}
        <div className="board-row">
          <div className="board-wrap">
            <div ref={el} className="board" />
          </div>
        </div>
        {spare(orientation)}
      </section>

      <aside className="side editor-side">
        <div className="panel-head">
          <b>{t('Brett-Editor')}</b>
          <button className="icon-btn" onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')} aria-label={t('Brett drehen')}>
            <ArrowUpDown size={18} />
          </button>
        </div>
        <div className="editor-body">
          <p className="muted small">{t('Figuren aus den Leisten aufs Brett ziehen oder antippen und dann aufs Feld klicken. Vom Brett ziehen entfernt eine Figur.')}</p>

          <div className="field-label">{t('Am Zug')}</div>
          <div className="segmented">
            {(['white', 'black'] as const).map((c) => (
              <button key={c} className={turn === c ? 'on' : ''} onClick={() => setTurn(c)}>
                {c === 'white' ? t('Weiß') : t('Schwarz')}
              </button>
            ))}
          </div>

          <div className="field-label">{t('Rochade')}</div>
          <div className="castling">
            {(
              [
                ['K', 'white', 'O-O'],
                ['Q', 'white', 'O-O-O'],
                ['k', 'black', 'O-O'],
                ['q', 'black', 'O-O-O'],
              ] as const
            ).map(([c, side, label]) => (
              <label key={c} className={`check ${can[c] ? '' : 'off'}`}>
                <input type="checkbox" checked={castling[c] && can[c]} disabled={!can[c]} onChange={(e) => setCastling({ ...castling, [c]: e.target.checked })} />
                {side === 'white' ? t('Weiß') : t('Schwarz')} {label}
              </label>
            ))}
          </div>

          <div className="editor-quick">
            <button className="btn-secondary small" onClick={() => (setPlacement(placementOf(START_FEN)), setTurn('white'), setCastling({ K: true, Q: true, k: true, q: true }))}>
              <RotateCcw size={15} /> {t('Startstellung')}
            </button>
            <button className="btn-secondary small" onClick={() => setPlacement(EMPTY)}>
              <Trash2 size={15} /> {t('Leeren')}
            </button>
          </div>

          <div className="field-label">FEN</div>
          <div className="fen-row">
            <input
              className="fen-input"
              value={fenText ?? fen}
              onChange={(e) => setFenText(e.target.value)}
              onBlur={applyFen}
              onKeyDown={(e) => e.key === 'Enter' && applyFen()}
              spellCheck={false}
              aria-label="FEN"
            />
          </div>

          {issue && <p className="error">{issue}</p>}
        </div>

        <div className="toolbar editor-actions">
          <button className="btn-secondary" disabled={!!issue} onClick={() => onPlay(fen, turn)}>
            <Swords size={17} className="inline" /> {t('Gegen Stockfish')}
          </button>
          <button className="btn-primary" disabled={!!issue} onClick={() => onAnalyse(fen)}>
            <Microscope size={17} className="inline" /> {t('Analysieren')}
          </button>
        </div>
      </aside>
    </main>
  )
}
