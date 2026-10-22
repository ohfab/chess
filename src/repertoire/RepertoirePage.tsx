import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, BookMarked, Check, Compass, Download, Target } from 'lucide-react'
import { numbered, type Color } from '../game/rules'
import { progressKey, useGame, type Progress } from '../game/store'
import { locale, t, tn } from '../i18n/i18n'
import { MiniBoard } from '../trainer/MiniBoard'
import { Display } from '../ui/Display'
import { Loader } from '../ui/Loader'
import { analyseRepertoire, ownGames, scoreOf, suggestions, type OpeningUse, type Repertoire } from './analyse'
import './repertoire.css'

export interface RepertoireProps {
  onBack: () => void
  /** opens the opening trainer on this variation and side */
  onTrain: (openingId: string, variation: number, side: Color) => void
  /** the analysis page, to load games from chess.com or Lichess */
  onImport: () => void
}

const disjunction = (items: string[]) => new Intl.ListFormat(locale(), { type: 'disjunction' }).format(items)

/** The analysis, done again whenever the archive changes. */
function useRepertoire() {
  const history = useGame((s) => s.history)
  const [data, setData] = useState<Repertoire | null>(null)
  useEffect(() => {
    let live = true
    void analyseRepertoire(history).then((r) => live && setData(r))
    return () => {
      live = false
    }
  }, [history])
  return data
}

/** The player's own repertoire, read from their games. */
export function RepertoirePage({ onBack, onTrain, onImport }: RepertoireProps) {
  const data = useRepertoire()
  const progress = useGame((s) => s.progress)
  const total = useGame((s) => ownGames(s.history).length)
  const [picked, setPicked] = useState<Color | null>(null)
  const side: Color = picked ?? (data && data.games.black > data.games.white ? 'black' : 'white')

  return (
    <div className="repertoire">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Analyse')}
      </button>
      <div className="page-head">
        <Display first={t('Mein')} second={t('Repertoire')} note={tn(total, '1 Partie', '{n} Partien')} />
        <p className="muted">{t('Aus deinen Partien gegen Stockfish und von chess.com und Lichess: was du spielst, wie gut es läuft und wo du die Theorie verlässt.')}</p>
      </div>

      {!data ? (
        <div className="rep-loading">
          <Loader size={44} />
          <span className="muted">{t('Partien werden ausgewertet …')}</span>
        </div>
      ) : total < 3 ? (
        <Empty onImport={onImport} />
      ) : (
        <>
          <div className="segmented rep-sides" role="tablist">
            {(['white', 'black'] as const).map((c) => (
              <button key={c} role="tab" aria-selected={side === c} className={side === c ? 'on' : ''} onClick={() => setPicked(c)}>
                {c === 'white' ? t('Als Weiß') : t('Als Schwarz')} <span className="rep-tab-count">{data.games[c]}</span>
              </button>
            ))}
          </div>
          <Overview key={`o-${side}`} data={data} side={side} onTrain={onTrain} />
          {data.uses[side].length > 0 ? (
            <Uses key={`g-${side}`} uses={data.uses[side]} progress={progress} onTrain={onTrain} />
          ) : (
            <p className="muted">{side === 'white' ? t('Noch keine Partien mit Weiß.') : t('Noch keine Partien mit Schwarz.')}</p>
          )}
          {data.unknown > 0 && (
            <p className="muted small rep-unknown">
              {tn(data.unknown, '1 Partie folgt keiner Eröffnung aus dem Trainer.', '{n} Partien folgen keiner Eröffnung aus dem Trainer.')}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Empty({ onImport }: { onImport: () => void }) {
  return (
    <div className="rep-empty">
      <span className="rep-empty-icon">
        <BookMarked size={28} />
      </span>
      <b>{t('Noch zu wenig Partien')}</b>
      <p className="muted">{t('Lade deine Partien von chess.com oder Lichess. Auch Partien gegen Stockfish zählen.')}</p>
      <button className="btn-primary" onClick={onImport}>
        <Download size={17} /> {t('Partien laden')}
      </button>
    </div>
  )
}

/** A few sentences on what the player plays with this colour, and the gaps. */
function Overview({ data, side, onTrain }: { data: Repertoire; side: Color; onTrain: RepertoireProps['onTrain'] }) {
  const uses = data.uses[side]
  const played = new Set(uses.map((u) => u.opening.id))
  const lines: string[] = []
  const gaps: { text: string; against: 'e4' | 'd4' | null }[] = []
  const games = (n: number) => tn(n, '1 Partie', '{n} Partien')

  if (side === 'white') {
    const firsts = Object.entries(data.firstMoves.white).sort((a, b) => b[1].games - a[1].games)
    const top = firsts[0]
    if (top && data.games.white)
      lines.push(t('Du eröffnest meistens mit {first} ({share} % deiner Partien).', { first: numbered([top[0]]), share: Math.round((top[1].games / data.games.white) * 100) }))
    const own = uses.filter((u) => u.opening.side === 'white')
    if (own[0]) lines.push(t('Deine häufigste Eröffnung: {name} ({games}, {score} % der Punkte).', { name: own[0].opening.name, games: games(own[0].games.length), score: scoreOf(own[0]) ?? '–' }))
    const faced = uses.filter((u) => u.opening.side === 'black')
    if (faced[0]) lines.push(t('Am häufigsten triffst du auf {name} ({games}, {score} % der Punkte).', { name: faced[0].opening.name, games: games(faced[0].games.length), score: scoreOf(faced[0]) ?? '–' }))
    if (!own.some((u) => u.games.length >= 2)) gaps.push({ text: t('Mit Weiß hast du noch keine feste Eröffnung.'), against: top?.[0] === 'd4' ? 'd4' : 'e4' })
  } else {
    for (const first of ['e4', 'd4'] as const) {
      // the player's own defence: a Black opening of the catalog (a White system they meet is not one)
      const vs = uses.filter((u) => u.games[0].game.sans[0] === first && u.opening.side === 'black')
      const count = data.firstMoves.black[first]?.games ?? 0
      if (!count) continue
      const main = vs[0]
      if (main && main.games.length >= 2)
        lines.push(t('Gegen {first} spielst du meistens {name} ({games}, {score} % der Punkte).', { first: numbered([first]), name: main.opening.name, games: games(main.games.length), score: scoreOf(main) ?? '–' }))
      else gaps.push({ text: t('Gegen {first} hast du noch keine feste Antwort.', { first: numbered([first]) }), against: first })
    }
    const faced = uses.filter((u) => u.opening.side === 'white')
    if (faced[0]) lines.push(t('Am häufigsten triffst du auf {name} ({games}, {score} % der Punkte).', { name: faced[0].opening.name, games: games(faced[0].games.length), score: scoreOf(faced[0]) ?? '–' }))
  }
  const leaks = uses.filter((u) => u.leak).length
  if (leaks) lines.push(tn(leaks, 'In 1 Eröffnung verlässt du die Theorie früher als nötig.', 'In {n} Eröffnungen verlässt du die Theorie früher als nötig.'))

  if (!lines.length && !gaps.length) return null
  return (
    <div className="rep-overview">
      {lines.length > 0 && (
        <div className="rep-summary">
          <Compass size={22} />
          <div>
            {lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        </div>
      )}
      {gaps.map((gap) => (
        <div key={gap.text} className="rep-gap">
          <span className="rep-gap-icon">
            <Target size={20} />
          </span>
          <div>
            <b>{gap.text}</b>
            <span className="muted">{t('Vorschläge zum Lernen:')}</span>
            <div className="rep-suggest">
              {suggestions(side, gap.against, played).map((o) => (
                <button key={o.id} className="chip" onClick={() => onTrain(o.id, 0, side)}>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Openings played more than once get a card; the rest are a short list below. */
function Uses({ uses, progress, onTrain }: { uses: OpeningUse[]; progress: Record<string, Progress>; onTrain: RepertoireProps['onTrain'] }) {
  const regular = uses.filter((u) => u.games.length >= 2)
  const cards = regular.length ? regular : uses
  const rest = regular.length ? uses.filter((u) => u.games.length < 2) : []
  return (
    <>
      <div className="rep-grid">
        {cards.map((u, i) => (
          <OpeningCard key={u.opening.id} use={u} index={i} progress={progress} onTrain={onTrain} />
        ))}
      </div>
      {rest.length > 0 && (
        <section className="rep-rest">
          <div className="section-head">
            <h3>{t('Einzelne Partien')}</h3>
            <span className="muted">{tn(rest.length, '1 Eröffnung', '{n} Eröffnungen')}</span>
          </div>
          <div className="rep-rows">
            {rest.map((u, i) => {
              const score = scoreOf(u)
              const main = u.variations[0]?.[0] ?? u.leak?.variation ?? 0
              return (
                <div key={u.opening.id} className="rep-row" style={{ '--i': i } as CSSProperties}>
                  <span className={`rep-dot ${score === null ? '' : score >= 50 ? (score > 50 ? 'won' : 'draw') : 'lost'}`} aria-hidden />
                  <span className="rep-row-text">
                    <b>{u.opening.name}</b>
                    <span className="muted">
                      {u.leak
                        ? t('{move} statt {theory}', { move: numbered([u.leak.exit.san], u.leak.exit.ply), theory: numbered([u.leak.exit.theory[0]], u.leak.exit.ply) })
                        : t('in der Theorie bis Zug {n}', { n: Math.max(1, Math.round(u.depth / 2)) })}
                    </span>
                  </span>
                  <button className="btn-secondary small" onClick={() => onTrain(u.opening.id, u.leak?.variation ?? main, u.side)}>
                    {t('Üben')}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

function progressLabel(p: Progress | undefined) {
  if (p?.clean) return { on: true, text: tn(p.clean, '1× fehlerfrei geübt', '{n}× fehlerfrei geübt') }
  if (p?.learned) return { on: true, text: t('Gelernt') }
  return { on: false, text: t('Noch nicht trainiert') }
}

function OpeningCard({ use, index, progress, onTrain }: { use: OpeningUse; index: number; progress: Record<string, Progress>; onTrain: RepertoireProps['onTrain'] }) {
  const { opening, side, won, drawn, lost, leak } = use
  const finished = won + drawn + lost
  const score = scoreOf(use)
  const main = use.variations[0]?.[0] ?? leak?.variation ?? 0
  const label = progressLabel(progress[progressKey(opening.id, main, side)])
  const date = useMemo(() => new Date(use.last).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }), [use.last])
  const theory = leak ? disjunction(leak.exit.theory.slice(0, 2).map((m) => numbered([m], leak.exit.ply))) : ''
  return (
    <article className="rep-card" style={{ '--i': index } as CSSProperties}>
      <header>
        <div className="rep-title">
          {opening.side !== side && <span className="rep-eyebrow">{side === 'white' ? t('Gegen diese Verteidigung') : t('Gegen diesen Aufbau')}</span>}
          <b>{opening.name}</b>
          {use.variations.length > 0 && (
            <span className="muted">
              {use.variations
                .slice(0, 2)
                .map(([v]) => opening.variations[v].name)
                .join(' · ')}
            </span>
          )}
        </div>
        <span className="rep-count">{tn(use.games.length, '1 Partie', '{n} Partien')}</span>
      </header>

      {finished > 0 && (
        <div className="rep-score">
          <div className="winbar" aria-hidden>
            <i className="w" style={{ width: `${(won / finished) * 100}%` }} />
            <i className="d" style={{ width: `${(drawn / finished) * 100}%` }} />
            <i className="l" style={{ width: `${(lost / finished) * 100}%` }} />
          </div>
          <span>
            <b>{score} %</b> <span className="muted">+{won} ={drawn} −{lost}</span>
          </span>
        </div>
      )}
      <p className="muted small rep-meta">
        {t('Zuletzt {date}', { date })} · {t('in der Theorie bis Zug {n}', { n: Math.max(1, Math.round(use.depth / 2)) })}
      </p>

      {leak ? (
        <div className="rep-leak">
          <div className="rep-leak-board">
            <MiniBoard fen={leak.exit.fen} orientation={side} last={leak.exit.last} />
          </div>
          <div className="rep-leak-text">
            <span className="rep-leak-title">{t('Hier verlässt du oft die Theorie')}</span>
            <b>{t('{move} statt {theory}', { move: numbered([leak.exit.san], leak.exit.ply), theory })}</b>
            <span className="muted small">{tn(leak.count, 'in 1 Partie', 'in {n} Partien')}</span>
            <button className="btn-primary small" onClick={() => onTrain(opening.id, leak.variation, side)}>
              {t('Diese Stelle trainieren')}
            </button>
          </div>
        </div>
      ) : (
        <p className="rep-ok">
          <Check size={16} /> {use.theirExits ? t('Du bleibst in der Theorie, bis der Gegner abweicht.') : t('Du kennst die Theorie so weit, wie deine Partien gingen.')}
        </p>
      )}

      <footer>
        <span className={`pill ${label.on ? '' : 'off'}`}>{label.text}</span>
        <button className="btn-secondary small" onClick={() => onTrain(opening.id, main, side)}>
          {t('Variante üben')}
        </button>
      </footer>
    </article>
  )
}
