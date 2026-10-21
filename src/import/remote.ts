import type { Color } from '../game/rules'

// Recent games of a chess.com or Lichess account, through their public APIs (both allow
// requests from any page). Nothing needs a login; private or closed accounts simply fail.

export type Site = 'chesscom' | 'lichess'

export const SITE_NAME: Record<Site, string> = { chesscom: 'chess.com', lichess: 'Lichess' }

export interface RemotePlayer {
  name: string
  rating?: number
}

export interface RemoteGame {
  site: Site
  id: string
  url: string
  pgn: string
  white: RemotePlayer
  black: RemotePlayer
  /** "1-0", "0-1", "1/2-1/2" */
  result: string
  /** bullet, blitz, rapid, classical, daily */
  speed: string
  /** "5+3", "10 min", "1 Tag" */
  clock: string
  /** end of the game, ms */
  date: number
  opening?: string
  /** the searched account's side and result */
  color: Color
  score: 1 | 0.5 | 0
  /** chess.com's own accuracy, when the game was reviewed there */
  accuracy?: { white: number; black: number }
}

export interface RemoteProfile {
  site: Site
  name: string
  avatar?: string
  url: string
  ratings: { label: string; rating: number }[]
}

/** A page of games plus how to ask for the next, older one. */
export interface GamePage {
  games: RemoteGame[]
  next: string | null
}

export type ImportErrorCode = 'not-found' | 'blocked' | 'rate-limited' | 'failed'

export class ImportError extends Error {
  readonly code: ImportErrorCode
  constructor(code: ImportErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

async function getJson(url: string, init?: RequestInit) {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    // a network error here almost always means the page may not reach that site at all
    throw new ImportError('blocked', 'Keine Verbindung zum Server.')
  }
  if (res.status === 404) throw new ImportError('not-found', 'Diesen Benutzer gibt es nicht.')
  if (res.status === 429 || res.status === 403) throw new ImportError('rate-limited', 'Zu viele Anfragen, bitte kurz warten.')
  if (!res.ok) throw new ImportError('failed', `Der Server antwortet mit ${res.status}.`)
  return res
}

const SPEED_NAME: Record<string, string> = {
  ultraBullet: 'bullet',
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  classical: 'classical',
  correspondence: 'daily',
  daily: 'daily',
}

function clockLabel(initial: number, increment: number) {
  const min = initial / 60
  const base = min >= 1 ? String(Math.round(min * 10) / 10) : `${initial}s`
  return increment ? `${base}+${increment}` : `${base} min`
}

const scoreOf = (result: string, color: Color): 1 | 0.5 | 0 =>
  result === '1/2-1/2' ? 0.5 : (result === '1-0') === (color === 'white') ? 1 : 0

// ---------------------------------------------------------------- chess.com

interface ChesscomGame {
  url: string
  pgn?: string
  time_control: string
  end_time: number
  time_class: string
  rules: string
  accuracies?: { white: number; black: number }
  eco?: string
  white: { username: string; rating: number; result: string }
  black: { username: string; rating: number; result: string }
}

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])

function chesscomResult(g: ChesscomGame) {
  if (g.white.result === 'win') return '1-0'
  if (g.black.result === 'win') return '0-1'
  return DRAWS.has(g.white.result) ? '1/2-1/2' : '*'
}

function chesscomClock(tc: string) {
  if (tc.includes('/')) {
    const days = Math.round(Number(tc.split('/')[1]) / 86400)
    return days === 1 ? '1 Tag' : `${days} Tage`
  }
  const [base, inc] = tc.split('+').map(Number)
  return clockLabel(base, inc || 0)
}

/** "https://www.chess.com/openings/Sicilian-Defense-Alapin-Variation" → "Sicilian Defense Alapin Variation" */
const openingFromUrl = (url?: string) => (url ? decodeURIComponent(url.split('/openings/')[1] ?? '').replace(/-/g, ' ').trim() || undefined : undefined)

async function chesscomProfile(name: string): Promise<RemoteProfile> {
  const user = name.toLowerCase()
  const p = await (await getJson(`https://api.chess.com/pub/player/${encodeURIComponent(user)}`)).json()
  const ratings: RemoteProfile['ratings'] = []
  try {
    const st = await (await getJson(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/stats`)).json()
    for (const [key, label] of [
      ['chess_rapid', 'Schnellschach'],
      ['chess_blitz', 'Blitz'],
      ['chess_bullet', 'Bullet'],
      ['chess_daily', 'Täglich'],
    ])
      if (st[key]?.last?.rating) ratings.push({ label, rating: st[key].last.rating })
    if (st.tactics?.highest?.rating) ratings.push({ label: 'Taktik', rating: st.tactics.highest.rating })
  } catch {
    // ratings are a nice extra; the games still load without them
  }
  return { site: 'chesscom', name: p.username ?? name, avatar: p.avatar, url: p.url ?? `https://www.chess.com/member/${user}`, ratings }
}

async function chesscomGames(name: string, cursor: string | null): Promise<GamePage> {
  const user = name.toLowerCase()
  // the cursor is the list of monthly archives still to read, newest last
  let months: string[] = cursor
    ? JSON.parse(cursor)
    : (await (await getJson(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`)).json()).archives
  const games: RemoteGame[] = []
  // read whole months until there are enough games for a page
  while (months.length && games.length < 20) {
    const url = months[months.length - 1]
    months = months.slice(0, -1)
    const data = await (await getJson(url)).json()
    for (const g of (data.games as ChesscomGame[]).slice().reverse()) {
      if (g.rules !== 'chess' || !g.pgn) continue
      const color: Color = g.white.username.toLowerCase() === user ? 'white' : 'black'
      const result = chesscomResult(g)
      if (result === '*') continue
      games.push({
        site: 'chesscom',
        id: g.url.split('/').pop() ?? g.url,
        url: g.url,
        pgn: g.pgn,
        white: { name: g.white.username, rating: g.white.rating },
        black: { name: g.black.username, rating: g.black.rating },
        result,
        speed: g.time_class,
        clock: chesscomClock(g.time_control),
        date: g.end_time * 1000,
        opening: openingFromUrl(g.eco),
        color,
        score: scoreOf(result, color),
        accuracy: g.accuracies,
      })
    }
  }
  return { games, next: months.length ? JSON.stringify(months) : null }
}

// ---------------------------------------------------------------- Lichess

interface LichessGame {
  id: string
  variant: string
  speed: string
  status: string
  createdAt: number
  lastMoveAt: number
  winner?: 'white' | 'black'
  players: Record<Color, { user?: { name: string }; rating?: number; aiLevel?: number }>
  opening?: { name: string }
  clock?: { initial: number; increment: number }
  daysPerTurn?: number
  pgn: string
}

const playerName = (p: LichessGame['players']['white']) => p.user?.name ?? (p.aiLevel ? `Stockfish Stufe ${p.aiLevel}` : 'Anonym')

async function lichessProfile(name: string): Promise<RemoteProfile> {
  const p = await (await getJson(`https://lichess.org/api/user/${encodeURIComponent(name)}`)).json()
  const ratings: RemoteProfile['ratings'] = []
  for (const [key, label] of [
    ['rapid', 'Schnellschach'],
    ['blitz', 'Blitz'],
    ['bullet', 'Bullet'],
    ['classical', 'Klassisch'],
    ['puzzle', 'Taktik'],
  ])
    if (p.perfs?.[key]?.games) ratings.push({ label, rating: p.perfs[key].rating })
  return { site: 'lichess', name: p.username ?? name, url: `https://lichess.org/@/${p.username ?? name}`, ratings }
}

async function lichessGames(name: string, cursor: string | null): Promise<GamePage> {
  const params = new URLSearchParams({ max: '25', pgnInJson: 'true', opening: 'true', clocks: 'false', evals: 'false', finished: 'true' })
  if (cursor) params.set('until', cursor)
  const res = await getJson(`https://lichess.org/api/games/user/${encodeURIComponent(name)}?${params}`, { headers: { Accept: 'application/x-ndjson' } })
  const lines = (await res.text()).split('\n').filter(Boolean)
  const raw = lines.map((l) => JSON.parse(l) as LichessGame)
  const games: RemoteGame[] = []
  for (const g of raw) {
    if ((g.variant !== 'standard' && g.variant !== 'fromPosition') || g.status === 'started' || g.status === 'created' || g.status === 'aborted') continue
    const white = playerName(g.players.white)
    const color: Color = white.toLowerCase() === name.toLowerCase() ? 'white' : 'black'
    const result = g.winner ? (g.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2'
    games.push({
      site: 'lichess',
      id: g.id,
      url: `https://lichess.org/${g.id}`,
      pgn: g.pgn,
      white: { name: white, rating: g.players.white.rating },
      black: { name: playerName(g.players.black), rating: g.players.black.rating },
      result,
      speed: SPEED_NAME[g.speed] ?? g.speed,
      clock: g.clock ? clockLabel(g.clock.initial, g.clock.increment) : g.daysPerTurn ? `${g.daysPerTurn} ${g.daysPerTurn === 1 ? 'Tag' : 'Tage'}` : '',
      date: g.lastMoveAt,
      opening: g.opening?.name,
      color,
      score: scoreOf(result, color),
    })
  }
  const last = raw[raw.length - 1]
  return { games, next: raw.length >= 25 && last ? String(last.createdAt - 1) : null }
}

// ---------------------------------------------------------------- both

export const fetchProfile = (site: Site, name: string) => (site === 'chesscom' ? chesscomProfile(name) : lichessProfile(name))

export const fetchGames = (site: Site, name: string, cursor: string | null = null) =>
  site === 'chesscom' ? chesscomGames(name, cursor) : lichessGames(name, cursor)

/** Key of an imported game in the archive. */
export const remoteKey = (g: Pick<RemoteGame, 'site' | 'id'>) => `${g.site}:${g.id}`
