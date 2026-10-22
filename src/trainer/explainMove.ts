import { Chess, type Square } from 'chess.js'
import type { Key } from '@lichess-org/chessground/types'
import { locale, t, tk } from '../i18n/i18n'

// Why a theory move is played, worked out from the position: what it occupies, controls,
// prepares, opens, attacks or pins. The learning run of the opening trainer shows this
// before each move, with the squares and ideas drawn on the board.

export interface MoveIdea {
  /** one or two short sentences, without a subject: "Controls d5. Prepares d5." */
  text: string
  /** squares to ring on the board */
  squares: Key[]
  /** extra arrows for the idea behind the move (a pawn push it prepares, a pinned piece) */
  arrows: [Key, Key][]
}

type Role = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

const VALUE: Record<Role, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }
// the object of a sentence ("develops the knight"), German accusative
const PIECE: Record<Role, string> = {
  p: tk('den Bauern'),
  n: tk('den Springer'),
  b: tk('den Läufer'),
  r: tk('den Turm'),
  q: tk('die Dame'),
  k: tk('den König'),
}
const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])
const WIDE_CENTER = new Set(['c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6'])
const FILES = 'abcdefgh'

const list = (items: string[]) => new Intl.ListFormat(locale(), { type: 'conjunction' }).format(items)

/** Squares a piece standing on `from` attacks in this position (pawns: their capture squares). */
function attacks(chess: Chess, from: Square): Square[] {
  const piece = chess.get(from)
  if (!piece) return []
  const out: Square[] = []
  for (const f of FILES)
    for (let r = 1; r <= 8; r++) {
      const sq = `${f}${r}` as Square
      if (sq !== from && chess.attackers(sq, piece.color).includes(from)) out.push(sq)
    }
  return out
}

const step = (sq: Square, df: number, dr: number): Square | null => {
  const f = FILES.indexOf(sq[0]) + df
  const r = Number(sq[1]) + dr
  return f >= 0 && f < 8 && r >= 1 && r <= 8 ? (`${FILES[f]}${r}` as Square) : null
}

/** A piece the slider on `from` pins against its king or queen, with the square behind it. */
function pinOf(chess: Chess, from: Square): { pinned: Square; behind: Square; role: Role } | null {
  const piece = chess.get(from)
  if (!piece || !'brq'.includes(piece.type)) return null
  const dirs: [number, number][] = []
  if (piece.type !== 'r') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1])
  if (piece.type !== 'b') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1])
  for (const [df, dr] of dirs) {
    let sq = step(from, df, dr)
    let first: Square | null = null
    while (sq) {
      const p = chess.get(sq)
      if (p) {
        if (p.color === piece.color) break
        if (!first) first = sq
        else {
          const front = chess.get(first)!
          if ((p.type === 'k' || (p.type === 'q' && VALUE[front.type as Role] < 9)) && front.type !== 'k') return { pinned: first, behind: sq, role: p.type as Role }
          break
        }
      }
      sq = step(sq, df, dr)
    }
  }
  return null
}

/** How many squares each bishop of `color` reaches, by square. */
function bishopReach(chess: Chess, color: 'w' | 'b') {
  const out = new Map<Square, number>()
  for (const row of chess.board()) for (const p of row) if (p && p.type === 'b' && p.color === color) out.set(p.square, attacks(chess, p.square).length)
  return out
}

/**
 * The reasons for the move `uci` in `fen`, most telling first. `previous` is the move that
 * led to `fen`, so that taking back on its square reads as a recapture.
 */
export function explainMove(fen: string, uci: string, previous?: { to: string; capture: boolean }): MoveIdea {
  const before = new Chess(fen)
  const from = uci.slice(0, 2) as Square
  const to = uci.slice(2, 4) as Square
  const mover = before.get(from)
  const result = new Chess(fen)
  let move
  try {
    move = result.move({ from, to, promotion: uci[4] ?? 'q' })
  } catch {
    return { text: '', squares: [], arrows: [] }
  }
  if (!mover) return { text: '', squares: [], arrows: [] }
  const us = mover.color
  const them = us === 'w' ? 'b' : 'w'
  const role = mover.type as Role
  // each reason brings the squares and arrows that show it; only the chosen ones are drawn
  const reasons: { rank: number; text: string; squares?: Key[]; arrows?: [Key, Key][] }[] = []
  const add = (rank: number, text: string, show: { squares?: Key[]; arrows?: [Key, Key][] } = {}) => reasons.push({ rank, text, ...show })
  const name = (sq: Square) => t(PIECE[result.get(sq)!.type as Role])

  if (move.isKingsideCastle() || move.isQueensideCastle()) add(100, t('Rochade: der König steht sicher, der Turm kommt ins Spiel.'))
  if (move.captured) {
    const retake = previous?.to === to && previous.capture
    add(90, retake ? t('Schlägt zurück, das Material bleibt ausgeglichen.') : t('Schlägt {piece} auf {square}.', { piece: t(PIECE[move.captured as Role]), square: to }))
  }
  if (result.inCheck()) add(85, t('Gibt Schach.'))

  const reach = attacks(result, to)
  const pin = pinOf(result, to)
  if (pin) {
    const text = pin.role === 'k' ? t('Fesselt {piece} auf {square} an den König.', { piece: name(pin.pinned), square: pin.pinned }) : t('Fesselt {piece} auf {square} an die Dame.', { piece: name(pin.pinned), square: pin.pinned })
    add(80, text, { arrows: [[to, pin.behind]] })
  }

  if (!pin && !move.captured) {
    // a piece worth more, one without cover, or a central pawn the pawn takes on
    const target = reach
      .filter((sq) => {
        const p = result.get(sq)
        if (!p || p.color !== them || p.type === 'k') return false
        return VALUE[p.type as Role] > VALUE[role] || result.attackers(sq, them).length === 0 || (role === 'p' && p.type === 'p' && CENTER.has(sq))
      })
      .sort((a, b) => VALUE[result.get(b)!.type as Role] - VALUE[result.get(a)!.type as Role])[0]
    if (target) add(role === 'p' ? 70 : 75, t('Greift {piece} auf {square} an.', { piece: name(target), square: target }), { arrows: [[to, target]] })
    else {
      // the defender of something we already attack, as Lb5 against Sc6 in the Spanish
      for (const sq of reach) {
        const p = result.get(sq)
        if (!p || p.color !== them || p.type === 'k') continue
        const guarded = attacks(result, sq).find((g) => {
          const q = result.get(g)
          return q && q.color === them && result.attackers(g, us).some((a) => a !== to)
        })
        if (guarded) {
          add(74, t('Greift den Verteidiger von {square} an.', { square: guarded }), { arrows: [[to, sq]], squares: [guarded] })
          break
        }
      }
    }
  }

  // own men on central squares the moved piece now backs up
  const backed = reach.filter((sq) => {
    const p = result.get(sq)
    return p && p.color === us && p.type !== 'k' && (CENTER.has(sq) || WIDE_CENTER.has(sq)) && !before.attackers(sq, us).includes(from)
  })

  if (role === 'p') {
    const rank = Number(to[1])
    const advanced = !move.captured && ((us === 'w' && rank >= 5) || (us === 'b' && rank <= 4))
    if (advanced) add(66, t('Gewinnt Raum und nimmt dem Gegner Felder.'))
    else if (CENTER.has(to)) add(65, t('Besetzt das Zentrum.'))
    // the squares a pawn controls are the point of most early pawn moves
    const covered = reach.filter((sq) => !result.get(sq) || result.get(sq)!.color === them)
    if (covered.length) add(covered.some((sq) => CENTER.has(sq)) ? 60 : 44, t('Kontrolliert {squares}.', { squares: list(covered) }), { squares: covered })
    if (backed.length) add(64, t('Stützt {piece} auf {square}.', { piece: name(backed[0]), square: backed[0] }), { squares: [backed[0]] })
    // a pawn that covers the square in front of a central pawn makes that push possible
    for (const file of 'de') {
      const home = `${file}${us === 'w' ? 2 : 7}` as Square
      const pawn = result.get(home)
      if (!pawn || pawn.type !== 'p' || pawn.color !== us || file === to[0]) continue
      for (const dist of [2, 1]) {
        const target = `${file}${us === 'w' ? 2 + dist : 7 - dist}` as Square
        if (!reach.includes(target) || result.get(target)) continue
        if (dist === 2 && result.get(`${file}${us === 'w' ? 3 : 6}` as Square)) continue
        add(58, t('Bereitet {move} vor.', { move: target }), { arrows: [[home, target]] })
        break
      }
    }
    // a pawn move frees one bishop and may shut in the other
    const reachBefore = bishopReach(before, us)
    for (const [sq, n] of bishopReach(result, us)) {
      const gain = n - (reachBefore.get(sq) ?? n)
      if (gain >= 2) add(45, t('Öffnet eine Diagonale für den Läufer.'))
      if (gain <= -3) add(43, t('Nachteil: der Läufer auf {square} hat weniger Platz.', { square: sq }), { squares: [sq] })
    }
    if ((to === 'g3' || to === 'b3' || to === 'g6' || to === 'b6') && before.get(`${to[0] === 'g' ? 'f' : 'c'}${us === 'w' ? 1 : 8}` as Square)?.type === 'b')
      add(50, t('Bereitet das Fianchetto vor: der Läufer kommt nach {square}.', { square: `${to[0]}${us === 'w' ? 2 : 7}` }))
    // offered: the opponent can take it and nothing takes back
    if (!move.captured && result.attackers(to, them).length > 0 && result.attackers(to, us).length === 0) add(72, t('Bietet einen Bauern an (Gambit).'))
  } else {
    const home = us === 'w' ? '1' : '8'
    if ((role === 'n' || role === 'b') && from[1] === home) add(52, t('Entwickelt {piece}.', { piece: t(PIECE[role]) }))
    if (role === 'b' && ['g2', 'b2', 'g7', 'b7'].includes(to)) add(56, t('Stellt den Läufer auf die lange Diagonale.'))
    if (role === 'q' && from[1] === home) add(42, t('Bringt die Dame ins Spiel.'))
    if (role !== 'k') {
      const free = (sq: Square) => !result.get(sq) || result.get(sq)!.color === them
      const inner = reach.filter((sq) => CENTER.has(sq) && free(sq))
      // knights work on the wider centre too; their squares in the opponent's half first
      const outer = role === 'n' ? reach.filter((sq) => WIDE_CENTER.has(sq) && free(sq)).sort((a, b) => (us === 'w' ? Number(b[1]) - Number(a[1]) : Number(a[1]) - Number(b[1]))) : []
      const shown = (inner.length ? inner : outer).slice(0, 3)
      if (shown.length) add(48, t('Kontrolliert {squares}.', { squares: list(shown) }), { squares: shown })
    }
    if (backed.length) add(50, t('Stützt {piece} auf {square}.', { piece: name(backed[0]), square: backed[0] }), { squares: [backed[0]] })
    // the last piece between king and rook leaves: castling is possible next
    const kingHome = us === 'w' ? 'e1' : 'e8'
    if (before.get(kingHome as Square)?.type === 'k' && !move.captured) {
      const between = (us === 'w' ? ['f1', 'g1'] : ['f8', 'g8']) as Square[]
      if (between.includes(from) && between.every((sq) => !result.get(sq))) add(46, t('Macht den Weg für die Rochade frei.'))
    }
    // stepping away from an attack
    if (before.attackers(from, them).length > 0 && result.attackers(to, them).length === 0 && !move.captured) add(62, t('Bringt sich vor dem Angriff in Sicherheit.'))
  }

  // covering an own piece the opponent attacks
  const guarded = reach.find((sq) => {
    const p = result.get(sq)
    return p && p.color === us && p.type !== 'k' && result.attackers(sq, them).length > 0 && !before.attackers(sq, us).length
  })
  if (guarded) add(57, t('Deckt {piece} auf {square}.', { piece: name(guarded), square: guarded }), { squares: [guarded] })

  reasons.sort((a, b) => b.rank - a.rank)
  const picked = reasons.filter((r, i, all) => all.findIndex((x) => x.text === r.text) === i).slice(0, 2)
  const text = picked.length ? picked.map((r) => r.text).join(' ') : t('Zieht {piece} nach {square}.', { piece: t(PIECE[role]), square: to })
  return { text, squares: [...new Set(picked.flatMap((r) => r.squares ?? []))] as Key[], arrows: picked.flatMap((r) => r.arrows ?? []) }
}

/** What to do, in words: "Move the pawn from c7 to c6." */
export function moveInstruction(fen: string, uci: string) {
  const chess = new Chess(fen)
  const from = uci.slice(0, 2) as Square
  const to = uci.slice(2, 4) as Square
  const piece = chess.get(from)
  if (!piece) return ''
  if (piece.type === 'k' && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) === 2) return to[0] === 'g' ? t('Mach die kurze Rochade.') : t('Mach die lange Rochade.')
  return t('Zieh {piece} von {from} nach {to}.', { piece: t(PIECE[piece.type as Role]), from, to })
}
