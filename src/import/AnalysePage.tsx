import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, ExternalLink, LayoutGrid, Loader2, Microscope, Search, Sparkles, Upload, X } from 'lucide-react'
import { Piece } from '../board/Piece'
import { useGame } from '../game/store'
import { ImportError, SITE_NAME, fetchGames, fetchProfile, remoteKey, type RemoteGame, type RemoteProfile, type Site } from './remote'

interface Props {
  onAnalyse: (game: RemoteGame) => void
  /** files games in the archive so the coach can learn from them */
  onQueue: (games: RemoteGame[]) => number
  onBoard: () => void
  onEditor: () => void
  onPaste: () => void
}

interface Search {
  site: Site
  name: string
  profile: RemoteProfile | null
  games: RemoteGame[]
  next: string | null
}

// the last search survives leaving the page
let remembered: Search | null = null

const SPEEDS: { id: string; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'rapid', label: 'Schnellschach' },
  { id: 'blitz', label: 'Blitz' },
  { id: 'bullet', label: 'Bullet' },
  { id: 'daily', label: 'Täglich' },
  { id: 'classical', label: 'Klassisch' },
]

const PAGES_URL = 'https://ohfab.github.io/chess/'

function errorText(e: unknown, site: Site, name: string) {
  if (e instanceof ImportError) {
    if (e.code === 'not-found') return `Auf ${SITE_NAME[site]} gibt es kein Konto „${name}“.`
    if (e.code === 'rate-limited') return `${SITE_NAME[site]} bremst gerade. Versuch es in einer Minute nochmal.`
    if (e.code === 'blocked')
      return `Diese Ansicht darf ${SITE_NAME[site]} nicht erreichen. Öffne Knightly als Webseite (${PAGES_URL}) oder lade die PGN dort herunter und füge sie mit „PGN einfügen“ ein.`
    return e.message
  }
  return 'Das hat nicht geklappt.'
}

/** Analysis hub: games from chess.com and Lichess, the free board and the position editor. */
export function AnalysePage({ onAnalyse, onQueue, onBoard, onEditor, onPaste }: Props) {
  const { accounts, history, rememberAccount, forgetAccount } = useGame()
  const [site, setSite] = useState<Site>(remembered?.site ?? accounts[0]?.site ?? 'chesscom')
  const [name, setName] = useState(remembered?.name ?? accounts[0]?.name ?? '')
  const [search, setSearch] = useState<Search | null>(remembered)
  const [busy, setBusy] = useState<'search' | 'more' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState('all')
  const [queued, setQueued] = useState<number | null>(null)

  useEffect(() => {
    remembered = search
  }, [search])

  const run = async (s: Site, n: string) => {
    const user = n.trim()
    if (!user) return
    setSite(s)
    setName(user)
    setBusy('search')
    setError(null)
    setQueued(null)
    try {
      const [profile, page] = await Promise.all([fetchProfile(s, user).catch(() => null), fetchGames(s, user)])
      setSearch({ site: s, name: profile?.name ?? user, profile, games: page.games, next: page.next })
      setSpeed('all')
      rememberAccount(s, profile?.name ?? user)
    } catch (e) {
      setError(errorText(e, s, user))
    } finally {
      setBusy(null)
    }
  }

  const more = async () => {
    if (!search?.next) return
    setBusy('more')
    try {
      const page = await fetchGames(search.site, search.name, search.next)
      setSearch({ ...search, games: [...search.games, ...page.games], next: page.next })
    } catch (e) {
      setError(errorText(e, search.site, search.name))
    } finally {
      setBusy(null)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(site, name)
  }

  const saved = useMemo(() => new Map(history.map((g) => [g.key, g])), [history])
  const shown = search ? search.games.filter((g) => speed === 'all' || g.speed === speed) : []
  const speeds = search ? SPEEDS.filter((s) => s.id === 'all' || search.games.some((g) => g.speed === s.id)) : []

  return (
    <div className="analyse-page">
      <div className="page-head">
        <h2>Analyse</h2>
        <p className="muted">Deine Partien von chess.com und Lichess auswerten, Stellungen aufbauen oder frei ausprobieren</p>
      </div>

      <div className="tool-cards">
        <button className="tool-card" onClick={onBoard}>
          <Microscope size={22} />
          <b>Analysebrett</b>
          <span>Frei ziehen, Stockfish rechnet mit</span>
        </button>
        <button className="tool-card" onClick={onEditor}>
          <LayoutGrid size={22} />
          <b>Brett-Editor</b>
          <span>Figuren aufstellen, dann analysieren oder spielen</span>
        </button>
        <button className="tool-card" onClick={onPaste}>
          <Upload size={22} />
          <b>PGN einfügen</b>
          <span>Partie oder FEN aus der Zwischenablage</span>
        </button>
      </div>

      <section className="import-card">
        <h3>Partien suchen</h3>
        <form className="import-form" onSubmit={submit}>
          <div className="segmented site-pick">
            {(['chesscom', 'lichess'] as Site[]).map((s) => (
              <button type="button" key={s} className={site === s ? 'on' : ''} onClick={() => setSite(s)}>
                <i className={`site-dot ${s}`} /> {SITE_NAME[s]}
              </button>
            ))}
          </div>
          <div className="import-input">
            <Search size={18} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Benutzername auf ${SITE_NAME[site]}`}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Benutzername"
            />
            <button className="btn-primary small" disabled={!name.trim() || busy === 'search'}>
              {busy === 'search' ? <Loader2 size={16} className="spin" /> : 'Suchen'}
            </button>
          </div>
        </form>
        {accounts.length > 0 && (
          <div className="accounts">
            {accounts.map((a) => (
              <span key={`${a.site}:${a.name}`} className="account-chip">
                <button onClick={() => void run(a.site, a.name)}>
                  <i className={`site-dot ${a.site}`} /> {a.name}
                </button>
                <button className="chip-x" onClick={() => forgetAccount(a.site, a.name)} aria-label={`${a.name} entfernen`}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      {search && (
        <>
          <Profile search={search} />
          <Record games={search.games} />

          <div className="section-head games-head">
            <h3>
              Partien von {search.name} <span className="muted">· {search.games.length}</span>
            </h3>
            <button
              className="btn-secondary small"
              onClick={() => setQueued(onQueue(search.games.slice(0, 10)))}
              title="Die letzten zehn Partien kommen ins Archiv und werden im Hintergrund ausgewertet"
            >
              <Sparkles size={15} /> Letzte 10 für den Coach
            </button>
          </div>
          {queued !== null && (
            <p className="muted small">
              {queued ? `${queued} ${queued === 1 ? 'Partie' : 'Partien'} im Archiv, Stockfish wertet sie im Hintergrund aus.` : 'Die letzten zehn sind schon im Archiv.'}
            </p>
          )}
          {speeds.length > 2 && (
            <div className="chips">
              {speeds.map((s) => (
                <button key={s.id} className={`chip ${speed === s.id ? 'on' : ''}`} onClick={() => setSpeed(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="remote-games">
            {shown.map((g) => {
              const own = saved.get(remoteKey(g))
              const opp = g.color === 'white' ? g.black : g.white
              return (
                <div key={g.id} className="remote-game">
                  <span className={`result ${g.score === 1 ? 'won' : g.score === 0 ? 'lost' : 'draw'}`}>{g.score === 1 ? 'S' : g.score === 0 ? 'N' : 'R'}</span>
                  <Piece role="king" color={g.color} className="remote-side" />
                  <span className="remote-text">
                    <b>
                      {opp.name}
                      {opp.rating ? <span className="muted"> ({opp.rating})</span> : null}
                    </b>
                    <span className="muted">
                      {g.clock || g.speed} · {new Date(g.date).toLocaleDateString('de-DE')}
                      {g.opening ? ` · ${shortOpening(g.opening)}` : ''}
                    </span>
                  </span>
                  {own?.review ? (
                    <span className="remote-acc" title="Deine Genauigkeit laut Knightly">
                      {own.review.accuracy[g.color].toFixed(1)}
                    </span>
                  ) : g.accuracy ? (
                    <span className="remote-acc site" title="Genauigkeit laut chess.com">
                      {g.accuracy[g.color].toFixed(1)}
                    </span>
                  ) : null}
                  <a className="icon-btn remote-link" href={g.url} target="_blank" rel="noreferrer" aria-label={`Auf ${SITE_NAME[g.site]} ansehen`}>
                    <ExternalLink size={16} />
                  </a>
                  <button className="btn-primary small" onClick={() => onAnalyse(g)}>
                    {own?.review ? 'Öffnen' : 'Analysieren'}
                  </button>
                </div>
              )
            })}
            {!shown.length && <p className="muted">Keine Partien {speed !== 'all' ? 'in dieser Bedenkzeit ' : ''}gefunden.</p>}
          </div>
          {search.next && (
            <button className="btn-secondary more-btn" onClick={more} disabled={busy === 'more'}>
              {busy === 'more' ? <Loader2 size={16} className="spin" /> : <ChevronDown size={16} />} Ältere Partien laden
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** chess.com names end in the moves ("… Main Line 4.g3 Nf6 5.Bg2"); the list shows the name only */
const shortOpening = (name: string) => name.split(/\s\d+\.|\s\.\.\./)[0].trim()

const FAMILY_END = new Set(['Defense', 'Defence', 'Opening', 'Game', 'Gambit', 'Attack', 'System', 'Countergambit'])

/** "Pirc Defense Classical Variation" and "Pirc Defense: Austrian Attack" are both "Pirc Defense". */
function family(name: string) {
  const words = shortOpening(name).split(/[\s:,]+/).filter(Boolean)
  const end = words.findIndex((w) => FAMILY_END.has(w))
  return words.slice(0, end >= 0 ? end + 1 : Math.min(2, words.length)).join(' ')
}

function Profile({ search }: { search: Search }) {
  const p = search.profile
  const [avatarOk, setAvatarOk] = useState(true)
  return (
    <div className="profile-card">
      {p?.avatar && avatarOk ? (
        <img className="profile-avatar" src={p.avatar} alt="" onError={() => setAvatarOk(false)} />
      ) : (
        <span className="profile-avatar fallback">{search.name.slice(0, 1).toUpperCase()}</span>
      )}
      <div className="profile-text">
        <b>{search.name}</b>
        <a className="muted" href={p?.url} target="_blank" rel="noreferrer">
          {SITE_NAME[search.site]} <ExternalLink size={12} className="inline" />
        </a>
      </div>
      <div className="profile-ratings">
        {p?.ratings.map((r) => (
          <span key={r.label} className="rating-pill">
            <span>{r.label}</span>
            <b>{r.rating}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Score over the loaded games, per colour and per opening, like chessigma's player report. */
function Record({ games }: { games: RemoteGame[] }) {
  if (games.length < 3) return null
  const sum = (list: RemoteGame[]) => ({
    n: list.length,
    won: list.filter((g) => g.score === 1).length,
    drawn: list.filter((g) => g.score === 0.5).length,
    lost: list.filter((g) => g.score === 0).length,
  })
  const all = sum(games)
  const white = sum(games.filter((g) => g.color === 'white'))
  const black = sum(games.filter((g) => g.color === 'black'))
  const byOpening = new Map<string, RemoteGame[]>()
  for (const g of games) {
    const name = g.opening && family(g.opening)
    if (name) byOpening.set(name, [...(byOpening.get(name) ?? []), g])
  }
  const openings = [...byOpening.entries()]
    .map(([name, list]) => ({ name, ...sum(list) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
  const pct = (r: ReturnType<typeof sum>) => (r.n ? Math.round(((r.won + r.drawn / 2) / r.n) * 100) : 0)

  return (
    <div className="record">
      <div className="record-cell">
        <span className="stat-label">Bilanz</span>
        <b className="stat-value">
          {all.won}–{all.drawn}–{all.lost}
        </b>
        <WinBar r={all} />
      </div>
      <div className="record-cell">
        <span className="stat-label">Mit Weiß</span>
        <b className="stat-value">{pct(white)} %</b>
        <WinBar r={white} />
      </div>
      <div className="record-cell">
        <span className="stat-label">Mit Schwarz</span>
        <b className="stat-value">{pct(black)} %</b>
        <WinBar r={black} />
      </div>
      {openings.length > 0 && (
        <div className="record-cell wide">
          <span className="stat-label">Häufigste Eröffnungen</span>
          <ul className="record-openings">
            {openings.map((o) => (
              <li key={o.name}>
                <span>{o.name}</span>
                <span className="muted">{o.n}×</span>
                <b>{pct(o)} %</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function WinBar({ r }: { r: { n: number; won: number; drawn: number; lost: number } }) {
  if (!r.n) return <span className="muted small">keine Partien</span>
  return (
    <span className="winbar" title={`${r.won} Siege, ${r.drawn} Remis, ${r.lost} Niederlagen`}>
      <i className="w" style={{ width: `${(r.won / r.n) * 100}%` }} />
      <i className="d" style={{ width: `${(r.drawn / r.n) * 100}%` }} />
      <i className="l" style={{ width: `${(r.lost / r.n) * 100}%` }} />
    </span>
  )
}
