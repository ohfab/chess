import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import {
  Activity,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Lightbulb,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  Share2,
  Star,
  Undo2,
  Upload,
} from 'lucide-react'
import { Board } from './board/Board'
import { Piece } from './board/Piece'
import { Promotion } from './board/Promotion'
import { levelOf } from './engine/levels'
import { formatScore, getOpponent, getReviewer, opponentMove, useAnalysis, whiteScore, whiteShare } from './engine/useEngine'
import { useOpening } from './game/openings'
import { figurine, inCheck, isFinal, isPromotion, legalDests, opposite, play, pvToSan, toPgn, toUci, turnOf, type Color, type Ply } from './game/rules'
import { playSound, soundFor } from './game/sound'
import { fenAt, useGame, type Mode } from './game/store'
import { Badge } from './review/Badge'
import { boardBadge } from './review/glyphs'
import { evaluate, JUDGEMENT, JUDGEMENT_ORDER, lossOf, reviewedPrefix, runReview, type Review } from './review/review'
import { Coach } from './ui/Coach'
import { ImportDialog, NewGameDialog, ResultDialog, SettingsDialog, ShareDialog } from './ui/Dialogs'
import { EngineLines } from './ui/EngineLines'
import { EvalBar } from './ui/EvalBar'
import { EvalGraph } from './ui/EvalGraph'
import { MoveList } from './ui/MoveList'
import { PlayerStrip } from './ui/PlayerStrip'

type Dialog = 'new' | 'settings' | 'import' | 'share' | 'result'

/** "Try again" on a reviewed move: the board goes back one ply and waits for a better move. */
interface Retry {
  /** index of the move being retried */
  ply: number
  /** position before that move */
  fen: string
  best: string | null
  /** the attempt currently on the board */
  shown: { fen: string; lastMove: [Key, Key] } | null
  status: 'try' | 'checking' | 'wrong' | 'right' | 'solution'
  note?: string
}

const squares = (uci: string): [Key, Key] => [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]

export default function App() {
  const g = useGame()
  const { mode, plies, cursor, startFen, outcome, settings, review, playerColor, level, orientation, vsEngine } = g
  const fen = fenAt(g, cursor)
  const turn = turnOf(fen)
  const atEnd = cursor === plies.length

  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [promotion, setPromotion] = useState<{ orig: Key; dest: Key } | null>(null)
  const [resync, setResync] = useState(0)
  const [hintFen, setHintFen] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [retry, setRetry] = useState<Retry | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)
  const [share, setShare] = useState<{ pgn: string; fen: string } | null>(null)
  const reviewRun = useRef(0)

  const reviewed = review ? reviewedPrefix(review, plies) : 0
  const reviewing = mode === 'analysis' && review !== null && reviewed > 0
  const moveReview = reviewing && cursor > 0 && cursor <= reviewed ? review.moves[cursor - 1] : null
  const opening = useOpening(startFen, plies, cursor)

  // ---------------------------------------------------------------- opponent

  // Stockfish answers the latest position, even while the player looks back through the game
  const liveFen = fenAt(g, plies.length)
  const thinking = mode === 'play' && !outcome && turnOf(liveFen) !== playerColor
  useEffect(() => {
    if (!thinking) return
    const id = useGame.getState().gameId
    let live = true
    void opponentMove(liveFen, level).then((uci) => {
      const s = useGame.getState()
      if (live && uci && s.gameId === id && fenAt(s, s.plies.length) === liveFen) s.append(uci)
    })
    return () => {
      live = false
      getOpponent().cancel()
    }
  }, [thinking, liveFen, level, g.gameId])

  // ---------------------------------------------------------------- live engine

  const showEval = !retry && progress === null && (mode === 'analysis' ? settings.analysisEngine : settings.evalInPlay)
  const hintOn = hintFen === fen && !retry
  const final = useMemo(() => isFinal(fen), [fen])
  const analysis = useAnalysis(fen, (showEval || hintOn) && !final, showEval ? settings.multiPv : 1)

  const bar = useMemo(() => {
    const top = analysis?.lines[0]
    if (top) {
      const s = whiteScore(top.score, fen)
      return { share: whiteShare(s), label: formatScore(s) }
    }
    const result = (win: number) => (win === 1 ? '1-0' : win === 0 ? '0-1' : '½')
    if (reviewing && cursor <= reviewed) {
      const e = review.evals[cursor]
      return { share: e.win, label: e.score ? formatScore(e.score) : result(e.win) }
    }
    if (final) {
      const win = inCheck(fen) ? (turn === 'white' ? 0 : 1) : 0.5
      return { share: win, label: result(win) }
    }
    return null
  }, [analysis, fen, turn, final, reviewing, review, cursor, reviewed])

  // ---------------------------------------------------------------- sounds & game end

  const last = useRef({ cursor, id: g.gameId, outcome })
  useEffect(() => {
    const prev = last.current
    last.current = { cursor, id: g.gameId, outcome }
    if (!settings.sound) return
    if (prev.id === g.gameId && cursor === prev.cursor + 1 && plies[cursor - 1]) playSound(soundFor(plies[cursor - 1].san))
    if (outcome && !prev.outcome) playSound('end')
  }, [cursor, g.gameId, plies, outcome, settings.sound])

  const prevOutcome = useRef(outcome)
  useEffect(() => {
    const was = prevOutcome.current
    prevOutcome.current = outcome
    if (!outcome || was || mode !== 'play') return
    // let the final move land before the result appears
    const t = setTimeout(() => setDialog('result'), 700)
    return () => clearTimeout(t)
  }, [outcome, mode])

  // ---------------------------------------------------------------- actions

  const flash = (text: string) => {
    setToast(text)
    setTimeout(() => setToast((t) => (t === text ? null : t)), 1800)
  }

  const nav = (to: number) => {
    setRetry(null)
    setPromotion(null)
    useGame.getState().goTo(to)
  }

  const stopReview = () => {
    reviewRun.current++
    setProgress(null)
    getReviewer().cancel()
  }

  const startGame = (opts: { mode: Mode; playerColor: Color; level: number }) => {
    stopReview()
    setRetry(null)
    setHintFen(null)
    setPromotion(null)
    setDialog(null)
    getOpponent().newGame()
    g.newGame(opts)
  }

  const loadGame = (start: string, list: Ply[]) => {
    stopReview()
    setRetry(null)
    setDialog(null)
    g.load(start, list)
  }

  const startReview = () => {
    const s = useGame.getState()
    if (!s.plies.length) return flash('Noch keine Züge zum Auswerten')
    const run = ++reviewRun.current
    setDialog(null)
    setRetry(null)
    setHintFen(null)
    s.analyse()
    setProgress(0)
    void runReview(
      s.startFen,
      s.plies,
      (done, total) => run === reviewRun.current && setProgress(done / total),
      () => run === reviewRun.current,
    ).then((result) => {
      if (run !== reviewRun.current) return
      setProgress(null)
      if (!result) return flash('Auswertung abgebrochen')
      useGame.getState().setReview(result)
      useGame.getState().goTo(0)
    })
  }

  const commit = (uci: string) => {
    if (!useGame.getState().move(uci)) setResync((r) => r + 1)
  }

  const tryRetry = (r: Retry, orig: Key, dest: Key) => {
    if (!review) return
    const uci = toUci(r.fen, orig, dest) + (isPromotion(r.fen, orig, dest) ? 'q' : '')
    const ply = play(r.fen, uci)
    if (!ply) return setResync((n) => n + 1)
    if (settings.sound) playSound(soundFor(ply.san))
    const shown = { fen: ply.fen, lastMove: squares(ply.uci) }
    if (ply.uci === r.best) return setRetry({ ...r, shown, status: 'right', note: `${figurine(ply.san)} ist der beste Zug.` })
    if (ply.uci === plies[r.ply].uci) return setRetry({ ...r, shown, status: 'wrong', note: 'Das war der Partiezug. Such einen besseren!' })
    setRetry({ ...r, shown, status: 'checking' })
    const before = review.evals[r.ply].win
    void evaluate(ply.fen).then((e) =>
      setRetry((cur) => {
        if (!cur || cur.ply !== r.ply || cur.shown?.fen !== ply.fen) return cur
        if (e && lossOf(before, e.win, turnOf(r.fen)) < 0.02) return { ...cur, status: 'right', note: `${figurine(ply.san)} ist auch stark.` }
        return { ...cur, status: 'wrong', note: `${figurine(ply.san)} ist nicht der beste Zug. Versuch's nochmal!` }
      }),
    )
  }

  // after a miss, put the pieces back for the next try
  useEffect(() => {
    if (retry?.status !== 'wrong') return
    const t = setTimeout(() => setRetry((r) => (r?.status === 'wrong' ? { ...r, shown: null, status: 'try' } : r)), 900)
    return () => clearTimeout(t)
  }, [retry?.status])

  const onMove = (orig: Key, dest: Key, premove: boolean) => {
    if (retry) return tryRetry(retry, orig, dest)
    setHintFen(null)
    if (isPromotion(fen, orig, dest)) {
      if (premove || settings.autoQueen) commit(toUci(fen, orig, dest) + 'q')
      else setPromotion({ orig, dest })
      return
    }
    commit(toUci(fen, orig, dest))
  }

  const pickPromotion = (piece: 'q' | 'n' | 'r' | 'b' | null) => {
    const p = promotion
    setPromotion(null)
    if (!p || !piece) return setResync((r) => r + 1)
    commit(toUci(fen, p.orig, p.dest) + piece)
  }

  const resign = () => {
    if (!confirmResign) {
      setConfirmResign(true)
      setTimeout(() => setConfirmResign(false), 3000)
      return
    }
    setConfirmResign(false)
    g.resign()
  }

  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(
      () => flash(`${what} kopiert`),
      () => flash('Kopieren nicht möglich'),
    )

  const pgn = () => {
    const result = !outcome ? '*' : outcome.kind === 'draw' ? '1/2-1/2' : outcome.winner === 'white' ? '1-0' : '0-1'
    const names = (c: Color) => (!vsEngine ? '?' : c === playerColor ? 'Ich' : `Stockfish (Stufe ${level})`)
    return toPgn(startFen, plies, {
      Event: 'Knightly',
      Date: new Date().toISOString().slice(0, 10).replaceAll('-', '.'),
      White: names('white'),
      Black: names('black'),
      Result: result,
    })
  }

  // keyboard: arrows step through the game, f flips the board
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const s = useGame.getState()
      const to: Record<string, number> = { ArrowLeft: s.cursor - 1, ArrowRight: s.cursor + 1, ArrowUp: 0, Home: 0, ArrowDown: s.plies.length, End: s.plies.length }
      if (e.key in to) {
        e.preventDefault()
        nav(to[e.key])
      } else if (e.key === 'f') s.flip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------------------------------------------------------------- board

  const boardFen = retry ? (retry.shown?.fen ?? retry.fen) : fen
  const retryFen = retry?.fen
  const dests = useMemo(() => legalDests(retryFen ?? fen), [retryFen, fen])
  const movableColor = retry
    ? retry.status === 'try'
      ? turnOf(retry.fen)
      : undefined
    : mode === 'play'
      ? atEnd && !outcome
        ? playerColor
        : undefined
      : turn
  const lastMove = retry
    ? (retry.shown?.lastMove ?? (retry.ply > 0 ? squares(plies[retry.ply - 1].uci) : undefined))
    : cursor > 0
      ? squares(plies[cursor - 1].uci)
      : undefined

  const shapes = useMemo(() => {
    const out: DrawShape[] = []
    const arrow = (uci: string, brush: string) => {
      const [orig, dest] = squares(uci)
      out.push({ orig, dest, brush })
    }
    if (retry) {
      if (retry.status === 'solution' && retry.best) arrow(retry.best, 'best')
      return out
    }
    if (moveReview && review) {
      const ply = plies[cursor - 1]
      const best = review.evals[cursor - 1].best
      if (best && best !== ply.uci && moveReview.judgement !== 'book') arrow(best, 'best')
      out.push({ orig: squares(ply.uci)[1], customSvg: { html: boardBadge(moveReview.judgement) } })
    } else if (mode === 'analysis' && showEval && analysis) {
      analysis.lines.slice(0, 2).forEach((l, i) => l.pv[0] && arrow(l.pv[0], i === 0 ? 'engine' : 'engine2'))
    }
    if (hintOn && analysis?.lines[0]?.pv[0]) arrow(analysis.lines[0].pv[0], 'hint')
    return out
  }, [retry, moveReview, review, plies, cursor, mode, showEval, analysis, hintOn])

  // ---------------------------------------------------------------- coach

  const retryable = moveReview && ['inaccuracy', 'mistake', 'blunder'].includes(moveReview.judgement)
  const startRetry = () => {
    if (!review || !moveReview) return
    const i = cursor - 1
    setHintFen(null)
    setRetry({ ply: i, fen: fenAt(g, i), best: review.evals[i].best, shown: null, status: 'try' })
  }

  let coach: ReactNode
  if (progress !== null) {
    coach = (
      <Coach title="Partie wird ausgewertet" progress={progress}>
        Stockfish prüft jeden Zug … {Math.round(progress * 100)} %
      </Coach>
    )
  } else if (retry) {
    const who = turnOf(retry.fen) === 'white' ? 'Weiß' : 'Schwarz'
    const actions = (
      <>
        {retry.status === 'right' ? (
          <button
            className="btn-primary small"
            onClick={() => {
              setRetry(null)
              useGame.getState().goTo(retry.ply + 2)
            }}
          >
            Weiter
          </button>
        ) : (
          <button className="btn-secondary small" onClick={() => setRetry({ ...retry, shown: null, status: 'solution', note: undefined })}>
            Lösung zeigen
          </button>
        )}
        <button className="btn-secondary small" onClick={() => setRetry(null)}>
          Zurück zur Partie
        </button>
      </>
    )
    const bestSan = retry.best ? pvToSan(retry.fen, [retry.best])[0] : null
    coach =
      retry.status === 'right' ? (
        <Coach judgement="best" title="Richtig!" actions={actions}>
          {retry.note}
        </Coach>
      ) : retry.status === 'solution' ? (
        <Coach judgement="best" title={`Bester Zug: ${bestSan ? figurine(bestSan) : '–'}`} actions={actions}>
          Der grüne Pfeil zeigt ihn auf dem Brett.
        </Coach>
      ) : (
        <Coach title={retry.status === 'checking' ? 'Moment …' : `${who} am Zug – finde den besten Zug`} actions={actions}>
          {retry.status === 'checking' ? 'Stockfish prüft deinen Zug.' : (retry.note ?? `Statt ${figurine(plies[retry.ply].san)} gab es etwas Besseres.`)}
        </Coach>
      )
  } else if (moveReview && review) {
    const ply = plies[cursor - 1]
    const j = moveReview.judgement
    const best = review.evals[cursor - 1].best
    const bestSan = best && best !== ply.uci ? pvToSan(fenAt(g, cursor - 1), [best])[0] : null
    coach = (
      <Coach
        judgement={j}
        title={
          <span>
            <b className="coach-san">{figurine(ply.san)}</b> {JUDGEMENT[j].phrase}
          </span>
        }
        actions={
          retryable && (
            <button className="btn-secondary small" onClick={startRetry}>
              <RotateCcw size={16} /> Nochmal versuchen
            </button>
          )
        }
      >
        {j === 'book' ? opening?.name : bestSan ? `Bester Zug war ${figurine(bestSan)}.` : null}
      </Coach>
    )
  } else if (reviewing && cursor === 0) {
    coach = (
      <Coach title="Auswertung fertig">
        Geh mit <ChevronRight size={14} className="inline" /> Zug für Zug durch die Partie. Bei Fehlern kannst du es nochmal versuchen.
      </Coach>
    )
  } else if (mode === 'play') {
    const title = outcome
      ? outcome.kind === 'draw'
        ? 'Remis'
        : outcome.winner === playerColor
          ? 'Du hast gewonnen!'
          : 'Stockfish gewinnt'
      : thinking
        ? 'Stockfish denkt …'
        : turn === playerColor
          ? 'Du bist am Zug'
          : 'Stockfish ist am Zug'
    coach = <Coach title={title}>{opening ? `${opening.eco} · ${opening.name}` : `Stufe ${level} · ${levelOf(level).label}`}</Coach>
  } else {
    coach = <Coach title="Analysebrett">{opening ? `${opening.eco} · ${opening.name}` : 'Zieh frei für beide Seiten. Stockfish rechnet mit.'}</Coach>
  }

  // ---------------------------------------------------------------- layout

  const topColor = opposite(orientation)
  const strip = (color: Color) => {
    const engine = vsEngine && color !== playerColor
    return (
      <PlayerStrip
        color={color}
        bot={engine}
        name={vsEngine ? (engine ? 'Stockfish' : 'Du') : color === 'white' ? 'Weiß' : 'Schwarz'}
        detail={engine ? `Stufe ${level}` : undefined}
        startFen={startFen}
        fen={boardFen}
        thinking={thinking && engine}
        active={!outcome && turnOf(boardFen) === color}
        accuracy={reviewing && progress === null ? review.accuracy[color] : undefined}
      />
    )
  }

  const navLeft = (
    <button className="nav-btn" onClick={() => nav(cursor - 1)} disabled={cursor === 0 && !retry} aria-label="Vorheriger Zug">
      <ChevronLeft size={26} />
    </button>
  )
  const navRight = (
    <button className="nav-btn" onClick={() => nav(cursor + 1)} disabled={atEnd} aria-label="Nächster Zug">
      <ChevronRight size={26} />
    </button>
  )

  const toggleEngine = () => g.updateSettings({ analysisEngine: !settings.analysisEngine })

  const openShare = () => {
    setShare({ pgn: pgn(), fen })
    setDialog('share')
  }

  let tools: ReactNode
  if (mode === 'play' && !outcome) {
    tools = (
      <>
        <Tool
          label="Tipp"
          icon={<Lightbulb size={20} />}
          onClick={() => setHintFen(hintOn ? null : fen)}
          disabled={turn !== playerColor || !atEnd}
          on={hintOn}
        />
        <Tool label="Zurücknehmen" icon={<Undo2 size={20} />} onClick={() => g.takeback()} disabled={plies.length === 0} />
        <Tool label={confirmResign ? 'Sicher?' : 'Aufgeben'} icon={<Flag size={20} />} onClick={resign} disabled={plies.length < 2} on={confirmResign} />
      </>
    )
  } else if (mode === 'play') {
    tools = (
      <>
        <Tool label="Auswertung" icon={<Star size={20} />} onClick={startReview} />
        <button className="btn-primary" onClick={() => setDialog('new')}>
          Neue Partie
        </button>
      </>
    )
  } else if (reviewing) {
    tools = (
      <>
        <Tool label="Engine" icon={<Activity size={20} />} onClick={toggleEngine} on={settings.analysisEngine} />
        <Tool label="Nochmal" icon={<RotateCcw size={20} />} onClick={startRetry} disabled={!retryable || !!retry} />
        <button className="btn-primary" onClick={() => setDialog('new')}>
          Neue Partie
        </button>
      </>
    )
  } else {
    tools = (
      <>
        <Tool label="Engine" icon={<Activity size={20} />} onClick={toggleEngine} on={settings.analysisEngine} />
        <Tool label="Auswerten" icon={<Star size={20} />} onClick={startReview} disabled={plies.length === 0 || progress !== null} />
        <Tool label="Laden" icon={<Upload size={20} />} onClick={() => setDialog('import')} />
        <Tool label="Teilen" icon={<Share2 size={20} />} onClick={openShare} />
      </>
    )
  }

  const title = mode === 'play' ? 'Gegen Stockfish' : reviewing || progress !== null ? 'Partie-Auswertung' : 'Analyse'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Piece role="knight" color="white" className="brand-mark" />
          <span className="brand-name">Knightly</span>
        </div>
        <h1 className="topbar-title">{title}</h1>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => setDialog('new')} aria-label="Neue Partie">
            <Plus size={22} />
          </button>
          <button className="icon-btn" onClick={() => g.flip()} aria-label="Brett drehen">
            <ArrowUpDown size={20} />
          </button>
          <button className="icon-btn" onClick={() => setDialog('settings')} aria-label="Einstellungen">
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="stage">
          {strip(topColor)}
          <div className="board-row">
            {(showEval || reviewing) && <EvalBar share={bar?.share ?? null} label={bar?.label} orientation={orientation} />}
            <div className="board-wrap">
              <Board
                fen={boardFen}
                orientation={orientation}
                turnColor={turnOf(boardFen)}
                lastMove={lastMove}
                check={inCheck(boardFen)}
                movableColor={movableColor}
                dests={dests}
                premove={mode === 'play' && !retry && atEnd && !outcome}
                coordinates={settings.coordinates}
                shapes={shapes}
                resync={resync}
                onMove={onMove}
              />
              {promotion && <Promotion dest={promotion.dest} color={turn} orientation={orientation} onPick={pickPromotion} />}
            </div>
          </div>
          {strip(orientation)}
        </section>

        <aside className="side">
          <div className="coach-slot">{coach}</div>

          {reviewing && progress === null && cursor === 0 && <Summary review={review} plies={reviewed} startFen={startFen} />}
          {reviewing && progress === null && <EvalGraph review={review} cursor={Math.min(cursor, reviewed)} onJump={nav} />}

          {showEval && (
            <EngineLines fen={fen} analysis={analysis} final={final} onPlay={mode === 'analysis' ? (uci) => commit(uci) : undefined} />
          )}

          <MoveList startFen={startFen} plies={plies} cursor={cursor} reviews={reviewing ? review.moves.slice(0, reviewed) : []} onJump={nav} />

          <div className="toolbar">
            {navLeft}
            <div className="tools">{tools}</div>
            {navRight}
          </div>
        </aside>
      </main>

      {dialog === 'new' && <NewGameDialog mode={mode} level={level} onStart={startGame} onClose={() => setDialog(null)} />}
      {dialog === 'settings' && <SettingsDialog settings={settings} onChange={g.updateSettings} onClose={() => setDialog(null)} />}
      {dialog === 'import' && <ImportDialog onLoad={loadGame} onClose={() => setDialog(null)} />}
      {dialog === 'share' && share && <ShareDialog pgn={share.pgn} fen={share.fen} onCopy={copy} onClose={() => setDialog(null)} />}
      {dialog === 'result' && outcome && (
        <ResultDialog
          outcome={outcome}
          playerColor={playerColor}
          onReview={startReview}
          onNew={() => setDialog('new')}
          onRematch={() => startGame({ mode: 'play', playerColor: opposite(playerColor), level })}
          onClose={() => setDialog(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Tool({ label, icon, onClick, disabled, on }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; on?: boolean }) {
  return (
    <button className={`tool ${on ? 'on' : ''}`} onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

/** Accuracy and move-quality counts per side, as on chess.com's review summary. */
function Summary({ review, plies, startFen }: { review: Review; plies: number; startFen: string }) {
  const firstWhite = turnOf(startFen) === 'white'
  const counts: Record<Color, Record<string, number>> = { white: {}, black: {} }
  review.moves.slice(0, plies).forEach((m, i) => {
    const c = counts[(i % 2 === 0) === firstWhite ? 'white' : 'black']
    c[m.judgement] = (c[m.judgement] ?? 0) + 1
  })
  return (
    <div className="summary">
      <div className="summary-row head">
        <span />
        <b>Weiß</b>
        <span />
        <b>Schwarz</b>
      </div>
      <div className="summary-row">
        <span>Genauigkeit</span>
        <b className="acc white">{review.accuracy.white.toFixed(1)}</b>
        <span />
        <b className="acc black">{review.accuracy.black.toFixed(1)}</b>
      </div>
      {JUDGEMENT_ORDER.map((j) => (
        <div className="summary-row" key={j}>
          <span>{JUDGEMENT[j].label}</span>
          <b style={{ color: JUDGEMENT[j].color }}>{counts.white[j] ?? 0}</b>
          <Badge judgement={j} size={18} />
          <b style={{ color: JUDGEMENT[j].color }}>{counts.black[j] ?? 0}</b>
        </div>
      ))}
    </div>
  )
}
