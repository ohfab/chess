import { Chess, type Square } from 'chess.js'
import type { Key } from '@lichess-org/chessground/types'
import { t } from '../i18n/i18n'

export type Color = 'white' | 'black'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export interface Ply {
  san: string
  uci: string
  /** position after the move */
  fen: string
}

export type Outcome =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'resign'; winner: Color }
  /** the loser's clock ran out (games with a clock against Stockfish) */
  | { kind: 'timeout'; winner: Color }
  | { kind: 'draw'; reason: 'stalemate' | 'repetition' | 'fifty' | 'material' }

export const turnOf = (fen: string): Color => (fen.split(' ')[1] === 'b' ? 'black' : 'white')

export const opposite = (c: Color): Color => (c === 'white' ? 'black' : 'white')

const CASTLE_ROOK: Record<string, string> = { g1: 'h1', c1: 'a1', g8: 'h8', c8: 'a8' }

/** Legal destinations per square, in the shape chessground wants. */
export function legalDests(fen: string): Map<Key, Key[]> {
  const chess = new Chess(fen)
  const dests = new Map<Key, Key[]>()
  const add = (from: string, to: string) => {
    const list = dests.get(from as Key)
    if (!list) dests.set(from as Key, [to as Key])
    else if (!list.includes(to as Key)) list.push(to as Key)
  }
  for (const m of chess.moves({ verbose: true })) {
    add(m.from, m.to)
    // castling also works by dropping the king on its rook
    if (m.isKingsideCastle() || m.isQueensideCastle()) add(m.from, CASTLE_ROOK[m.to])
  }
  return dests
}

/** UCI for a board move, turning king-onto-rook into the castling move. */
export function toUci(fen: string, orig: string, dest: string) {
  const piece = new Chess(fen).get(orig as Square)
  if (piece?.type === 'k' && Math.abs(orig.charCodeAt(0) - dest.charCodeAt(0)) > 1) {
    const to = Object.keys(CASTLE_ROOK).find((k) => CASTLE_ROOK[k] === dest)
    if (to && to[1] === orig[1]) return orig + to
  }
  return orig + dest
}

export function isPromotion(fen: string, from: string, to: string) {
  const piece = new Chess(fen).get(from as Square)
  return piece?.type === 'p' && (to[1] === '8' || to[1] === '1')
}

/** Plays a UCI move ("e2e4", "e7e8q") and returns the new ply, or null if illegal. */
export function play(fen: string, uci: string): Ply | null {
  const chess = new Chess(fen)
  try {
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return { san: m.san, uci: m.lan, fen: chess.fen() }
  } catch {
    return null
  }
}

/** UCI for a SAN move in the position, or null if it is not legal there. */
export function sanToUci(fen: string, san: string) {
  try {
    return new Chess(fen).move(san).lan
  } catch {
    return null
  }
}

export function inCheck(fen: string) {
  return new Chess(fen).inCheck()
}

/** Checkmate or stalemate on the board (repetition needs the game history, see outcomeOf). */
export function isFinal(fen: string) {
  const chess = new Chess(fen)
  return chess.isCheckmate() || chess.isStalemate()
}

/** Outcome of the game at the end of `plies`, judged with the full history for repetition. */
export function outcomeOf(startFen: string, plies: Ply[]): Outcome | null {
  const chess = new Chess(startFen)
  for (const p of plies) chess.move(p.san)
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: opposite(turnOf(chess.fen())) }
  if (chess.isStalemate()) return { kind: 'draw', reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { kind: 'draw', reason: 'material' }
  if (chess.isThreefoldRepetition()) return { kind: 'draw', reason: 'repetition' }
  if (chess.isDrawByFiftyMoves()) return { kind: 'draw', reason: 'fifty' }
  return null
}

/** Converts a UCI line into SAN moves from the given position (stops at the first illegal move). */
export function pvToSan(fen: string, pv: string[], max = 12): string[] {
  const chess = new Chess(fen)
  const out: string[] = []
  for (const uci of pv.slice(0, max)) {
    try {
      out.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
    } catch {
      break
    }
  }
  return out
}

const FIGURINE: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' }

/** SAN with piece symbols instead of English letters ("Nf6" → "♞f6"), as chess.com shows it. */
export const figurine = (san: string) => san.replace(/[KQRBN]/g, (p) => FIGURINE[p])

/** Moves with numbers, as written in a book: "3.e5 ♝f5 4.h4". `fromPly` counts plies before the first one. */
export function numbered(sans: string[], fromPly = 0) {
  return sans
    .map((san, i) => {
      const ply = fromPly + i
      const n = Math.floor(ply / 2) + 1
      const label = ply % 2 === 0 ? `${n}.` : i === 0 ? `${n}…` : ''
      return label + figurine(san)
    })
    .join(' ')
}

/** Full move number and side for the position before a move. */
export function moveNumber(fen: string) {
  return Number(fen.split(' ')[5] ?? 1)
}

export function validateFen(fen: string): string | null {
  try {
    new Chess(fen)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : t('Ungültige FEN')
  }
}

export function loadPgn(pgn: string): { startFen: string; plies: Ply[] } | null {
  const chess = new Chess()
  try {
    chess.loadPgn(pgn)
  } catch {
    return null
  }
  const startFen = chess.getHeaders().FEN ?? START_FEN
  const replay = new Chess(startFen)
  const plies = chess.history().map((san) => {
    const m = replay.move(san)
    return { san: m.san, uci: m.lan, fen: replay.fen() }
  })
  return { startFen, plies }
}

export function toPgn(startFen: string, plies: Ply[], headers: Record<string, string>) {
  const chess = new Chess(startFen)
  if (startFen !== START_FEN) {
    chess.setHeader('SetUp', '1')
    chess.setHeader('FEN', startFen)
  }
  for (const [k, v] of Object.entries(headers)) chess.setHeader(k, v)
  for (const p of plies) chess.move(p.san)
  return chess.pgn()
}
