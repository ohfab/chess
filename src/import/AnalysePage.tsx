import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, ExternalLink, LayoutGrid, Loader2, Microscope, Search, Sparkles, Star, Upload, X } from 'lucide-react'
import { Piece } from '../board/Piece'
import { APP_NAME, APP_URL } from '../brand'
import { useGame } from '../game/store'
import { locale, t, tk, tn } from '../i18n/i18n'
import { ImportError, SITE_NAME, fetchGames, fetchProfile, remoteKey, type RemoteGame, type RemoteProfile, type Site } from './remote'
import { Display } from '../ui/Display'

interface Props {
  onAnalyse: (game: RemoteGame) => void
  /** files games in the archive so the coach can learn from them */
  onQueue: (games: RemoteGame[]) => number | null
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
  { id: 'all', label: tk('Alle') },
  { id: 'rapid', label: tk('Schnellschach') },
  { id: 'blitz', label: tk('Blitz') },
  { id: 'bullet', label: tk('Bullet') },
  { id: 'daily', label: tk('Täglich') },
  { id: 'classical', label: tk('Klassisch') },
]


function errorText(e: unknown, site: Site, name: string) {
  if (e instanceof ImportError) {
    if (e.code === 'not-found') return t('Auf {site} gibt es kein Konto „{name}“.', { site: SITE_NAME[site], name })
    if (e.code === 'rate-limited') return t('{site} bremst gerade. Versuch es in einer Minute nochmal.', { site: SITE_NAME[site] })
    if (e.code === 'blocked')
      return t('Diese Ansicht darf {site} nicht erreichen. Öffne {app} als Webseite ({url}) oder lade die PGN dort herunter und füge sie mit „PGN einfügen“ ein.', {
        site: SITE_NAME[site],
        app: APP_NAME,
        url: APP_URL,
      })
    return e.message
  }
  return t('Das hat nicht geklappt.')
}

/** Analysis hub: games from chess.com and Lichess, the free board and the position editor. */
export function AnalysePage({ onAnalyse, onQueue, onBoard, onEditor, onPaste }: Props) {
  const { accounts, history, rememberAccount, forgetAccount, updateSettings } = useGame()
  // the player's own account: its games load by themselves
  const me = useGame((s) => s.settings.myAccount)
  const [site, setSite] = useState<Site>(remembered?.site ?? me?.site ?? accounts[0]?.site ?? 'chesscom')
  const [name, setName] = useState(remembered?.name ?? me?.name ?? accounts[0]?.name ?? '')
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
      // the first account someone looks up is almost always their own
      if (!useGame.getState().settings.myAccount) updateSettings({ myAccount: { site: s, name: profile?.name ?? user } })
    } catch (e) {
      setError(errorText(e, s, user))
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!remembered && me) void run(me.site, me.name)
    // once, when the page opens without a search from before
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isMe = (s: Site, n: string) => !!me && me.site === s && me.name.toLowerCase() === n.toLowerCase()

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
        <Display first={t('Analyse')} second={t('deiner Partien')} />
        <p className="muted">{t('Deine Partien von chess.com und Lichess auswerten, Stellungen aufbauen oder frei ausprobieren')}</p>
      </div>

      <div className="tool-cards">
        <button className="tool-card" onClick={onBoard}>
          <Microscope size={22} />
          <b>{t('Analysebrett')}</b>
          <span>{t('Frei ziehen, Stockfish rechnet mit')}</span>
        </button>
        <button className="tool-card" onClick={onEditor}>
          <LayoutGrid size={22} />
          <b>{t('Brett-Editor')}</b>
          <span>{t('Figuren aufstellen, dann analysieren oder spielen')}</span>
        </button>
        <button className="tool-card" onClick={onPaste}>
          <Upload size={22} />
          <b>{t('PGN einfügen')}</b>
          <span>{t('Partie oder FEN aus der Zwischenablage')}</span>
        </button>
      </div>

      <section className="import-card">
        <h3>{t('Partien suchen')}</h3>
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
              placeholder={t('Benutzername auf {site}', { site: SITE_NAME[site] })}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={t('Benutzername')}
            />
            <button className="btn-primary small" disabled={!name.trim() || busy === 'search'}>
              {busy === 'search' ? <Loader2 size={16} className="spin" /> : t('Suchen')}
            </button>
          </div>
        </form>
        {accounts.length > 0 && (
          <div className="accounts">
            {[...accounts].sort((a, b) => Number(isMe(b.site, b.name)) - Number(isMe(a.site, a.name))).map((a) => (
              <span key={`${a.site}:${a.name}`} className={`account-chip ${isMe(a.site, a.name) ? 'mine' : ''}`}>
                <button onClick={() => void run(a.site, a.name)}>
                  {isMe(a.site, a.name) ? <Star size={13} className="mine-star" aria-label={t('Mein Konto')} /> : <i className={`site-dot ${a.site}`} />} {a.name}
                </button>
                <button className="chip-x" onClick={() => forgetAccount(a.site, a.name)} aria-label={t('{name} entfernen', { name: a.name })}>
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
          <Profile
            search={search}
            mine={isMe(search.site, search.name)}
            onMine={() => updateSettings({ myAccount: isMe(search.site, search.name) ? null : { site: search.site, name: search.name } })}
          />
          <Record games={search.games} />

          <div className="section-head games-head">
            <h3>
              {t('Partien von {name}', { name: search.name })} <span className="muted">· {search.games.length}</span>
            </h3>
            <button
              className="btn-secondary small"
              onClick={() => {
                const n = onQueue(search.games.slice(0, 10))
                if (n !== null) setQueued(n)
              }}
              title={t('Die letzten zehn Partien kommen ins Archiv und werden im Hintergrund ausgewertet')}
            >
              <Sparkles size={15} /> {t('Letzte 10 für den Coach')}
            </button>
          </div>
          {queued !== null && (
            <p className="muted small">
              {queued
                ? tn(queued, '1 Partie im Archiv, Stockfish wertet sie im Hintergrund aus.', '{n} Partien im Archiv, Stockfish wertet sie im Hintergrund aus.')
                : t('Die letzten zehn sind schon im Archiv.')}
            </p>
          )}
          {speeds.length > 2 && (
            <div className="chips">
              {speeds.map((s) => (
                <button key={s.id} className={`chip ${speed === s.id ? 'on' : ''}`} onClick={() => setSpeed(s.id)}>
                  {t(s.label)}
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
                  <span className={`result ${g.score === 1 ? 'won' : g.score === 0 ? 'lost' : 'draw'}`}>{/* first letters of win, loss, draw */ g.score === 1 ? t('S') : g.score === 0 ? t('N') : t('R')}</span>
                  <Piece role="king" color={g.color} className="remote-side" />
                  <span className="remote-text">
                    <b>
                      {opp.name}
                      {opp.rating ? <span className="muted"> ({opp.rating})</span> : null}
                    </b>
                    <span className="muted">
                      {g.clock || g.speed} · {new Date(g.date).toLocaleDateString(locale())}
                      {g.opening ? ` · ${shortOpening(g.opening)}` : ''}
                    </span>
                  </span>
                  {own?.review ? (
                    <span className="remote-acc" title={t('Deine Genauigkeit laut {app}', { app: APP_NAME })}>
                      {own.review.accuracy[g.color].toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  ) : g.accuracy ? (
                    <span className="remote-acc site" title={t('Genauigkeit laut chess.com')}>
                      {g.accuracy[g.color].toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  ) : null}
                  <a className="icon-btn remote-link" href={g.url} target="_blank" rel="noreferrer" aria-label={t('Auf {site} ansehen', { site: SITE_NAME[g.site] })}>
                    <ExternalLink size={16} />
                  </a>
                  <button className="btn-primary small" onClick={() => onAnalyse(g)}>
                    {own?.review ? t('Öffnen') : t('Analysieren')}
                  </button>
                </div>
              )
            })}
            {!shown.length && <p className="muted">{speed !== 'all' ? t('Keine Partien in dieser Bedenkzeit gefunden.') : t('Keine Partien gefunden.')}</p>}
          </div>
          {search.next && (
            <button className="btn-secondary more-btn" onClick={more} disabled={busy === 'more'}>
              {busy === 'more' ? <Loader2 size={16} className="spin" /> : <ChevronDown size={16} />} {t('Ältere Partien laden')}
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

function Profile({ search, mine, onMine }: { search: Search; mine: boolean; onMine: () => void }) {
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
      <button
        className={`mine-btn ${mine ? 'on' : ''}`}
        onClick={onMine}
        aria-pressed={mine}
        title={mine ? t('Deine Partien laden beim Öffnen der Analyse von selbst') : t('Als dein Konto merken: die Partien laden dann von selbst')}
      >
        <Star size={15} /> {mine ? t('Mein Konto') : t('Das bin ich')}
      </button>
      <div className="profile-ratings">
        {p?.ratings.map((r) => (
          <span key={r.label} className="rating-pill">
            <span>{t(r.label)}</span>
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
        <span className="stat-label">{t('Bilanz')}</span>
        <b className="stat-value">
          {all.won}–{all.drawn}–{all.lost}
        </b>
        <WinBar r={all} />
      </div>
      <div className="record-cell">
        <span className="stat-label">{t('Mit Weiß')}</span>
        <b className="stat-value">{pct(white)} %</b>
        <WinBar r={white} />
      </div>
      <div className="record-cell">
        <span className="stat-label">{t('Mit Schwarz')}</span>
        <b className="stat-value">{pct(black)} %</b>
        <WinBar r={black} />
      </div>
      {openings.length > 0 && (
        <div className="record-cell wide">
          <span className="stat-label">{t('Häufigste Eröffnungen')}</span>
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
  if (!r.n) return <span className="muted small">{t('keine Partien')}</span>
  return (
    <span className="winbar" title={t('{won} Siege, {drawn} Remis, {lost} Niederlagen', { won: r.won, drawn: r.drawn, lost: r.lost })}>
      <i className="w" style={{ width: `${(r.won / r.n) * 100}%` }} />
      <i className="d" style={{ width: `${(r.drawn / r.n) * 100}%` }} />
      <i className="l" style={{ width: `${(r.lost / r.n) * 100}%` }} />
    </span>
  )
}
