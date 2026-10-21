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
  LayoutGrid,
  ListTree,
  RotateCcw,
  Settings as SettingsIcon,
  Share2,
  ShieldCheck,
  Star,
  Undo2,
  Upload,
  UserRound,
} from 'lucide-react'
import { Board } from './board/Board'
import { Promotion } from './board/Promotion'
import { IDEAL, levelOf } from './engine/levels'
import { formatScore, getOpponent, getReviewer, opponentMove, useAnalysis, whiteScore, whiteShare } from './engine/useEngine'
import { useOpening } from './game/openings'
import {
  figurine,
  inCheck,
  isFinal,
  isPromotion,
  legalDests,
  numbered,
  opposite,
  play,
  pvToSan,
  sanToUci,
  START_FEN,
  toPgn,
  toUci,
  turnOf,
  type Color,
  type Ply,
} from './game/rules'
import { playSound, setSoundSet, soundFor } from './game/sound'
import { applyBoard, applyPieces } from './theme/theme'
import { fenAt, useGame, type Mode } from './game/store'
import { Badge } from './review/Badge'
import { boardBadge } from './review/glyphs'
import { explain } from './review/explain'
import { ASPECT_ORDER, reviewReport, type Aspect } from './review/stats'
import { evaluate, isError, JUDGEMENT, JUDGEMENT_ORDER, lossOf, reviewedPrefix, runReview, type Review } from './review/review'
import { hintMove, judgeMove, lineOf, loadBook, openingById, pickBookMove, type Verdict } from './trainer/book'
import { OpeningBrowser } from './trainer/OpeningBrowser'
import { OpeningSetup, type TrainingSetup } from './trainer/OpeningSetup'
import { useTrainer } from './trainer/useTrainer'
import { TodayPage } from './coach/TodayPage'
import type { Insights } from './coach/insights'
import type { PlanTask } from './coach/plan'
import { packReview, type SavedGame } from './history/archive'
import { DrillPlayer, type DrillItem, type DrillResult } from './puzzles/DrillPlayer'
import { pickPuzzles, puzzlesById, rate, woodpeckerSet, type Puzzle } from './puzzles/puzzles'
import type { Endgame } from './puzzles/endgames'
import { themeName } from './puzzles/themes'
import { Coach } from './ui/Coach'
import { ImportDialog, ResultDialog, ShareDialog } from './ui/Dialogs'
import { AnalysePage } from './import/AnalysePage'
import { remoteKey, type RemoteGame } from './import/remote'
import { BoardEditor } from './editor/BoardEditor'
import { useBackgroundReviews } from './history/reviews'
import { Nav, type Tab } from './ui/Nav'
import { Logo } from './ui/Logo'
import { allowReview, awaitPro, openAccount, requirePro, useAccount } from './account/account'
import { AccountDialog, UpgradeDialog } from './account/AccountDialogs'
import { Welcome } from './account/Welcome'
import { APP_NAME } from './brand'
import { PlayPage } from './play/PlayPage'
import { TacticsPage } from './puzzles/TacticsPage'
import { SettingsDialog } from './ui/SettingsDialog'
import { EngineLines } from './ui/EngineLines'
import { EvalBar } from './ui/EvalBar'
import { EvalGraph } from './ui/EvalGraph'
import { MoveList } from './ui/MoveList'
import { PlayerStrip } from './ui/PlayerStrip'

type Dialog = 'settings' | 'import' | 'share' | 'result'

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

type View = 'today' | 'play' | 'tactics' | 'analyse' | 'editor' | 'board' | 'openings' | 'setup' | 'drill'

/** Feedback on the player's last move in an opening drill. */
interface TrainerNote {
  verdict: Verdict
  san: string
  /** number of plies on the board when the move was tried */
  ply: number
  /** attempts at this position, for wrong moves */
  tries: number
}

const squares = (uci: string): [Key, Key] => [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]
const isWrong = (v: Verdict) => v.kind === 'off' || v.kind === 'other-line'

export default function App() {
  const g = useGame()
  const { mode, plies, cursor, startFen, outcome, settings, review, playerColor, level, orientation, vsEngine, training } = g
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
  // a fresh start opens the opening menu; a game in progress stays on the board
  const [view, setView] = useState<View>(() => (useGame.getState().plies.length && !useGame.getState().outcome ? 'board' : 'today'))
  const [drill, setDrill] = useState<{ title: string; items: DrillItem[]; taskId?: string; from: View } | null>(null)
  const [setupId, setSetupId] = useState<string | null>(null)
  const [note, setNote] = useState<TrainerNote | null>(null)
  const [trainerHint, setTrainerHint] = useState<string | null>(null)
  const reviewRun = useRef(0)
  const trainer = useTrainer()
  const account = useAccount()

  // back from Stripe: wait for the webhook to switch the plan, then say so
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const result = params.get('checkout')
    if (!result) return
    params.delete('checkout')
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash)
    if (result !== 'success') return
    void awaitPro().then((ok) => flash(ok ? 'Danke! Pro ist aktiv.' : 'Danke! Pro wird gleich aktiv.'))
    // runs once, on the page Stripe sent the player back to
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // a game from the endgame trainer, and the blunder guard's verdict on the player's last move
  const [endgame, setEndgame] = useState<Endgame | null>(null)
  const [guard, setGuard] = useState<{ fen: string; status: 'checking' | 'warn' | 'ok'; text?: string; san?: string } | null>(null)
  // archived games get reviewed in the background, except while a live game needs the CPU
  useBackgroundReviews(view === 'board' && (mode === 'play' || mode === 'training') && !outcome)

  const reviewed = review ? reviewedPrefix(review, plies) : 0
  // a game from chess.com or Lichess on the board: its players' names and ratings
  const imported = mode === 'analysis' ? g.history.find((x) => x.key === g.gameKey && x.mode === 'import')?.source : undefined
  const reviewing = mode === 'analysis' && review !== null && reviewed > 0
  const moveReview = reviewing && cursor > 0 && cursor <= reviewed ? review.moves[cursor - 1] : null
  const named = useOpening(startFen, plies, cursor)

  // ---------------------------------------------------------------- opponent

  // Stockfish answers the latest position, even while the player looks back through the game
  const liveFen = fenAt(g, plies.length)
  const thinking = (mode === 'play' || mode === 'training') && !outcome && turnOf(liveFen) !== playerColor
  // in a drill the opponent plays theory while there is some, then Stockfish at the chosen strength
  const bookStep = trainer.step
  const bookLoading = trainer.loading

  // blunder guard: before Stockfish answers, check the player's move and warn if it throws the game
  const guardOn = settings.blunderGuard && mode === 'play' && vsEngine && plies.length > 0
  const guardWait = guardOn && thinking && (guard?.fen !== liveFen || guard.status !== 'ok')
  useEffect(() => {
    if (!guardOn || !thinking) return
    if (guard?.fen === liveFen) return
    const s = useGame.getState()
    const before = fenAt(s, s.plies.length - 1)
    const ply = s.plies[s.plies.length - 1]
    let live = true
    setGuard({ fen: liveFen, status: 'checking' })
    void (async () => {
      const a = await evaluate(before, 'depth 12 movetime 400')
      const b = a && live ? await evaluate(liveFen, 'depth 12 movetime 400') : null
      if (!live) return
      if (!a || !b || lossOf(a.win, b.win, s.playerColor) < 0.15) return setGuard({ fen: liveFen, status: 'ok' })
      const why = explain('blunder', before, liveFen, ply.uci, a, b)?.replace(/\s*Besser war.*$/, '')
      setGuard({ fen: liveFen, status: 'warn', san: ply.san, text: why || 'Damit verschenkst du viel.' })
    })()
    return () => {
      live = false
    }
    // runs once per position; the guard state it writes is not a reason to run again
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [guardOn, thinking, liveFen])

  useEffect(() => {
    if (!thinking || bookLoading || guardWait) return
    const id = useGame.getState().gameId
    let live = true
    const san = bookStep ? pickBookMove(bookStep, level === IDEAL) : null
    const reply = san
      ? new Promise<string | null>((resolve) => setTimeout(() => resolve(sanToUci(liveFen, san)), 550))
      : opponentMove(liveFen, level)
    void reply.then((uci) => {
      const s = useGame.getState()
      if (live && uci && s.gameId === id && fenAt(s, s.plies.length) === liveFen) s.append(uci)
    })
    return () => {
      live = false
      getOpponent().cancel()
    }
  }, [thinking, liveFen, level, g.gameId, bookStep, bookLoading, guardWait])

  // ---------------------------------------------------------------- live engine

  // the bar can be shown everywhere; engine lines and arrows only on the analysis board
  const showBar = !retry && progress === null && (mode === 'analysis' ? settings.analysisEngine : settings.evalInPlay)
  const showLines = showBar && mode === 'analysis'
  const hintOn = hintFen === fen && !retry
  const final = useMemo(() => isFinal(fen), [fen])
  const analysis = useAnalysis(fen, (showBar || hintOn) && !final, showLines ? settings.multiPv : 1)

  useEffect(() => applyBoard(settings.board), [settings.board])
  useEffect(() => void applyPieces(settings.pieces), [settings.pieces])
  useEffect(() => setSoundSet(settings.soundSet), [settings.soundSet])

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
    if (!outcome || was || mode === 'analysis') return
    const s = useGame.getState()
    s.archive()
    if (mode === 'play' && endgame) s.recordEndgame(endgame.id, outcome.kind === 'checkmate' && outcome.winner === s.playerColor)
    else if (mode === 'play') s.advanceTask(`game:${s.level}`)
    // let the final move land before the result appears
    const t = setTimeout(() => setDialog('result'), 700)
    return () => clearTimeout(t)
    // endgame is the trainer's position, set before the game started
    // oxlint-disable-next-line react-hooks/exhaustive-deps
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

  const resetBoardState = () => {
    stopReview()
    setRetry(null)
    setHintFen(null)
    setPromotion(null)
    setDialog(null)
    setNote(null)
    setTrainerHint(null)
    setView('board')
  }

  const startGame = (opts: { mode: Mode; playerColor: Color; level: number; startFen?: string }) => {
    resetBoardState()
    getOpponent().newGame()
    setEndgame(null)
    setGuard(null)
    g.newGame(opts)
  }

  const startEndgame = (e: Endgame) => {
    if (!requirePro('endgames')) return
    startGame({ mode: 'play', playerColor: e.color, level: IDEAL, startFen: e.fen })
    setEndgame(e)
  }

  const loadGame = (start: string, list: Ply[]) => {
    resetBoardState()
    g.load(start, list)
  }

  /** "New game": back to the opponent picker */
  const openNew = () => {
    setDialog(null)
    setView('play')
  }

  const openSetup = (id: string) => {
    void loadBook(id)
    setSetupId(id)
    setView('setup')
  }

  const startTraining = (setup: TrainingSetup) => {
    const o = openingById(setup.openingId)
    if (!o) return
    // the free plan trains each opening's main line
    if ((setup.choice === 'random' && o.variations.length > 1) || (setup.choice !== 'random' && setup.choice > 0)) {
      if (!requirePro('variations')) return
    }
    let variation = setup.choice === 'random' ? Math.floor(Math.random() * o.variations.length) : setup.choice
    // in random mode, avoid the same variation twice in a row
    const prev = useGame.getState().training
    if (setup.choice === 'random' && o.variations.length > 1 && prev?.openingId === o.id && prev.variation === variation)
      variation = (variation + 1 + Math.floor(Math.random() * (o.variations.length - 1))) % o.variations.length
    resetBoardState()
    getOpponent().newGame()
    g.startTraining(
      { openingId: o.id, choice: setup.choice, variation, line: lineOf(o, variation), strict: setup.strict, mistakes: 0, hints: 0 },
      setup.side,
      setup.level,
    )
  }

  const restartTraining = () => {
    if (!training) return
    startTraining({ openingId: training.openingId, choice: training.choice, side: playerColor, level, strict: training.strict })
  }

  /** Checks a drill move against the theory; true when it was handled here. */
  const trainerMove = (uci: string) => {
    if (!training || !trainer.step || !atEnd || outcome) return false
    const ply = play(fen, uci)
    if (!ply) return false
    const verdict = judgeMove(trainer.step, ply.san)
    const here = plies.length
    setTrainerHint(null)
    if (isWrong(verdict)) {
      const again = note !== null && note.ply === here && isWrong(note.verdict)
      if (!again) g.updateTraining({ mistakes: training.mistakes + 1 })
      setNote({ verdict, san: ply.san, ply: here, tries: again ? note.tries + 1 : 1 })
      if (training.strict) {
        if (settings.sound) playSound('wrong')
        setResync((r) => r + 1)
        return true
      }
    } else setNote({ verdict, san: ply.san, ply: here, tries: 0 })
    commit(uci)
    return true
  }

  const trainingHint = () => {
    if (!training) return
    if (!trainer.step) return setHintFen(hintOn ? null : fen)
    if (trainerHint === liveFen) return setTrainerHint(null)
    setTrainerHint(liveFen)
    g.updateTraining({ hints: training.hints + 1 })
  }

  const startReview = () => {
    const s = useGame.getState()
    if (!s.plies.length) return flash('Noch keine Züge zum Auswerten')
    if (!allowReview()) return
    s.countReview()
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
      const st = useGame.getState()
      st.setReview(result)
      st.goTo(0)
      // the archived copy gets the review too, so the coach can learn from it
      const archived = st.history.find((x) => x.key === st.gameKey)
      if (archived && archived.ucis.join() === result.ucis.join()) st.attachReview(st.gameKey, packReview(result))
    })
  }

  // ---------------------------------------------------------------- daily training

  const startMistakes = (insights: Insights, count: number, from: View, taskId?: string) => {
    const solved = new Set(useGame.getState().solvedMistakes)
    const items: DrillItem[] = insights.mistakes
      .filter((m) => !solved.has(`${m.gameKey}:${m.ply}`))
      .slice(0, count)
      .map((m) => ({ kind: 'mistake', key: `${m.gameKey}:${m.ply}`, fen: m.fen, best: m.best, playedSan: m.san, winBefore: m.winBefore, date: m.date }))
    if (!items.length) return flash('Alle Fehler sind schon gelöst')
    setDrill({ title: 'Deine Fehler', items, taskId, from })
    setView('drill')
  }

  const startPuzzles = async (theme: string | undefined, count: number, from: View, taskId?: string) => {
    const s = useGame.getState()
    const puzzles = await pickPuzzles({ theme, rating: s.puzzleRating, count, skip: new Set(s.seenPuzzles) })
    if (!puzzles.length) return flash('Keine neuen Aufgaben zu diesem Thema')
    setDrill({ title: theme ? themeName(theme) : 'Taktik-Mix', items: puzzles.map((puzzle) => ({ kind: 'puzzle', puzzle })), taskId, from })
    setView('drill')
  }

  const startTask = async (task: PlanTask, insights: Insights) => {
    const left = Math.max(1, task.target - task.done)
    if (task.kind === 'mistakes') startMistakes(insights, left, 'today', task.id)
    else if (task.kind === 'puzzles') await startPuzzles(task.theme, left, 'today', task.id)
    else if (task.kind === 'opening' && task.openingId) {
      startTraining({ openingId: task.openingId, choice: task.variation ?? 0, side: task.side ?? 'white', level, strict: true })
    } else if (task.kind === 'game') {
      startGame({ mode: 'play', playerColor: Math.random() < 0.5 ? 'white' : 'black', level: task.level ?? level })
    }
  }

  const startWoodpecker = async (fresh: boolean) => {
    if (!requirePro('woodpecker')) return
    const s = useGame.getState()
    if (fresh || !s.woodpecker) s.startWoodpecker((await woodpeckerSet(s.puzzleRating)).map((p) => p.id))
    const w = useGame.getState().woodpecker!
    const items: DrillItem[] = (await puzzlesById(w.ids.slice(w.index))).map((puzzle) => ({ kind: 'puzzle', puzzle }))
    if (!items.length) return flash('Das Set ist leer')
    setDrill({ title: `Woodpecker · Runde ${w.cycle}`, items, taskId: 'woodpecker', from: 'tactics' })
    setView('drill')
  }

  const startDailyPuzzle = (puzzle: Puzzle) => {
    setDrill({ title: 'Tagesaufgabe', items: [{ kind: 'puzzle', puzzle }], taskId: 'daily-puzzle', from: 'today' })
    setView('drill')
  }

  const drillResult = (taskId: string | undefined, { item, solved, ms }: DrillResult) => {
    const s = useGame.getState()
    // a Woodpecker set comes back again and again: counting it would inflate the rating
    if (taskId === 'woodpecker') return s.woodpeckerResult(solved, ms)
    if (taskId === 'daily-puzzle') s.setDailyPuzzle(solved)
    if (item.kind === 'puzzle') {
      const { puzzle } = item
      s.recordPuzzle(puzzle.id, puzzle.rating, puzzle.themes, solved, rate(s.puzzleRating, puzzle.rating, solved))
    } else s.recordMistake(item.key, solved)
    if (taskId && taskId !== 'daily-puzzle') s.advanceTask(taskId)
  }

  const openArchived = (game: SavedGame) => {
    resetBoardState()
    g.openSaved(game)
  }

  // ---------------------------------------------------------------- imported games

  const analyseRemote = (remote: RemoteGame) => {
    const saved = useGame.getState().importGame(remote)
    if (!saved) return flash('Diese Partie lässt sich nicht laden')
    openArchived(saved)
    if (!saved.review) startReview()
  }

  /** Files games in the archive without opening them; the background reviewer takes them from there. */
  const queueRemote = (games: RemoteGame[]) => {
    if (!requirePro('import')) return null
    const s = useGame.getState()
    const known = new Set(s.history.map((x) => x.key))
    let added = 0
    for (const remote of games) if (!known.has(remoteKey(remote)) && s.importGame(remote)) added++
    return added
  }

  const [editorFen, setEditorFen] = useState(START_FEN)
  const openEditor = (fen: string) => {
    setEditorFen(fen)
    setView('editor')
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
    // drill moves are judged before they reach the game; promotions in theory are queens
    if (mode === 'training' && trainer.step && trainerMove(toUci(fen, orig, dest) + (isPromotion(fen, orig, dest) ? 'q' : ''))) return
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
    const names = (c: Color) => (!vsEngine ? '?' : c === playerColor ? 'Ich' : `Stockfish (${levelOf(level).label})`)
    return toPgn(startFen, plies, {
      Event: APP_NAME,
      Date: new Date().toISOString().slice(0, 10).replaceAll('-', '.'),
      White: names('white'),
      Black: names('black'),
      Result: result,
    })
  }

  // keyboard: arrows step through the game, f flips the board
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || view !== 'board' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
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
    : mode !== 'analysis'
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
    } else if (showLines && analysis) {
      analysis.lines.slice(0, 2).forEach((l, i) => l.pv[0] && arrow(l.pv[0], i === 0 ? 'engine' : 'engine2'))
    }
    if (hintOn && analysis?.lines[0]?.pv[0]) arrow(analysis.lines[0].pv[0], 'hint')
    // drill hint: asked for, or shown after the second miss at the same spot
    if (bookStep && atEnd && turnOf(liveFen) === playerColor) {
      const missed = note && note.ply === plies.length && isWrong(note.verdict) && note.tries >= 2 ? note.verdict : null
      const san = missed && 'expected' in missed ? missed.expected : trainerHint === liveFen ? hintMove(bookStep) : null
      const uci = san && sanToUci(liveFen, san)
      if (uci) arrow(uci, 'hint')
    }
    return out
  }, [retry, moveReview, review, plies, cursor, showLines, analysis, hintOn, bookStep, atEnd, liveFen, playerColor, note, trainerHint])

  // ---------------------------------------------------------------- coach

  const retryable = moveReview && (moveReview.judgement === 'inaccuracy' || isError(moveReview.judgement))
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
    const after = review.evals[cursor]
    const text = j === 'book' ? named?.name : explain(j, fenAt(g, cursor - 1), ply.fen, ply.uci, review.evals[cursor - 1], after)
    coach = (
      <Coach
        judgement={j}
        title={
          <span>
            <b className="coach-san">{figurine(ply.san)}</b> {JUDGEMENT[j].phrase}
          </span>
        }
        score={after.score}
        actions={
          retryable && (
            <button className="btn-secondary small" onClick={startRetry}>
              <RotateCcw size={16} /> Nochmal versuchen
            </button>
          )
        }
      >
        {text}
      </Coach>
    )
  } else if (reviewing && cursor === 0) {
    coach = (
      <Coach title="Auswertung fertig">
        Geh mit <ChevronRight size={14} className="inline" /> Zug für Zug durch die Partie. Bei Fehlern kannst du es nochmal versuchen.
      </Coach>
    )
  } else if (trainer.active && training && trainer.drill && trainer.variation) {
    coach = trainingCoach()
  } else if (mode === 'play' && guard && guard.fen === liveFen && guard.status === 'warn' && !outcome) {
    coach = (
      <Coach
        judgement="blunder"
        title="Vorsicht!"
        actions={
          <>
            <button className="btn-primary small" onClick={() => (g.takeback(), setGuard(null))}>
              <Undo2 size={15} /> Zurücknehmen
            </button>
            <button className="btn-secondary small" onClick={() => setGuard({ ...guard, status: 'ok' })}>
              Trotzdem spielen
            </button>
          </>
        }
      >
        {guard.san && <b className="coach-san">{figurine(guard.san)}</b>} {guard.text}
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
        ? guardWait
          ? 'Patzer-Schutz prüft deinen Zug …'
          : 'Stockfish denkt …'
        : turn === playerColor
          ? 'Du bist am Zug'
          : 'Stockfish ist am Zug'
    coach = (
      <Coach title={title}>
        {endgame ? (
          <>
            <b>{endgame.goal}</b> {plies.length < 4 && endgame.tip}
          </>
        ) : named ? (
          `${named.eco} · ${named.name}`
        ) : (
          `${levelOf(level).label} · ${levelOf(level).name}`
        )}
      </Coach>
    )
  } else {
    coach = <Coach title="Analysebrett">{named ? `${named.eco} · ${named.name}` : 'Zieh frei für beide Seiten. Stockfish rechnet mit.'}</Coach>
  }

  function trainingCoach(): ReactNode {
    const t = training!
    const drill = trainer.drill!
    const label = levelOf(level).label
    const last = plies[plies.length - 1]
    const opponentMoved = !!last && turnOf(liveFen) === playerColor
    const status = thinking
      ? 'Der Gegner überlegt …'
      : opponentMoved
        ? `Gegner: ${numbered([last.san], plies.length - 1)}. Du bist dran.`
        : 'Du bist dran.'
    const fresh = note && note.ply >= plies.length - 2 ? note : null
    const more = (
      <>
        <button className="btn-primary small" onClick={restartTraining}>
          <RotateCcw size={15} /> Nochmal
        </button>
        <button className="btn-secondary small" onClick={() => openSetup(t.openingId)}>
          Andere Variante
        </button>
      </>
    )

    if (trainer.loading) return <Coach title="Theorie wird geladen …" />
    if (outcome) {
      const won = outcome.kind !== 'draw' && outcome.winner === playerColor
      return (
        <Coach title={outcome.kind === 'draw' ? 'Remis' : won ? 'Du hast gewonnen!' : 'Der Gegner gewinnt'} actions={more}>
          Werte die Partie aus, um zu sehen, wo es nach der Eröffnung gekippt ist.
        </Coach>
      )
    }
    if (trainer.bookOver) {
      const tally = [t.mistakes && `${t.mistakes} Fehler`, t.hints && `${t.hints} Tipps`].filter(Boolean).join(' · ')
      return (
        <Coach judgement={trainer.clean ? 'best' : 'book'} title={trainer.clean ? 'Variante gemeistert!' : 'Ende der Theorie'} actions={more}>
          {trainer.clean ? 'Alle Züge saßen.' : `${tally || 'Du hast die Variante verlassen'}.`} Ab hier spielt der Gegner frei mit {label} weiter.
        </Coach>
      )
    }
    if (fresh && isWrong(fresh.verdict) && 'expected' in fresh.verdict) {
      const off = fresh.verdict.kind === 'off'
      const answer = fresh.tries >= 2 ? ` Richtig ist ${figurine(fresh.verdict.expected)}, siehe Pfeil.` : ''
      return (
        <Coach
          judgement={off ? 'mistake' : 'inaccuracy'}
          title={
            <span>
              <b className="coach-san">{figurine(fresh.san)}</b> {off ? 'ist keine Theorie' : 'gehört zu einer anderen Variante'}
            </span>
          }
        >
          {t.strict ? `Versuch's nochmal.${answer}` : `Ab hier spielst du außerhalb der ${trainer.variation!.name}. ${status}`}
        </Coach>
      )
    }
    if (fresh && !isWrong(fresh.verdict) && 'share' in fresh.verdict) {
      const { share, main } = fresh.verdict
      return (
        <Coach
          judgement={main ? 'best' : 'book'}
          title={
            <span>
              <b className="coach-san">{figurine(fresh.san)}</b> {main ? 'ist der Hauptzug' : 'ist Theorie'}
            </span>
          }
        >
          {share > 0 && `${Math.round(share * 100)} % der Meisterpartien. `}
          {status}
          {named && <span className="coach-line">{named.name}</span>}
        </Coach>
      )
    }
    return (
      <Coach title={`${drill.name} · ${trainer.variation!.name}`}>
        {plies.length === 0
          ? `Du spielst ${playerColor === 'white' ? 'Weiß und beginnst' : 'Schwarz, der Gegner beginnt'}. Spiel die Züge der Theorie.`
          : status}
        {named && plies.length > 0 && <span className="coach-line">{named.name}</span>}
      </Coach>
    )
  }

  // ---------------------------------------------------------------- layout

  const topColor = opposite(orientation)
  const strip = (color: Color) => {
    const engine = vsEngine && color !== playerColor
    if (imported) {
      const name = color === 'white' ? imported.white : imported.black
      const elo = color === 'white' ? imported.whiteElo : imported.blackElo
      return (
        <PlayerStrip
          color={color}
          bot={false}
          name={name}
          detail={elo ? String(elo) : undefined}
          startFen={startFen}
          fen={boardFen}
          thinking={false}
          active={!outcome && turnOf(boardFen) === color}
          accuracy={reviewing && progress === null ? review.accuracy[color] : undefined}
        />
      )
    }
    return (
      <PlayerStrip
        color={color}
        bot={engine}
        name={vsEngine ? (engine ? (mode === 'training' ? 'Gegner' : 'Stockfish') : 'Du') : color === 'white' ? 'Weiß' : 'Schwarz'}
        detail={engine ? levelOf(level).label : undefined}
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

  const evalTool = (
    <Tool label="Bewertung" icon={<Activity size={20} />} onClick={() => g.updateSettings({ evalInPlay: !settings.evalInPlay })} on={settings.evalInPlay} />
  )

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
        {evalTool}
        <Tool label="Schutz" icon={<ShieldCheck size={20} />} onClick={() => g.updateSettings({ blunderGuard: !settings.blunderGuard })} on={settings.blunderGuard} />
        <Tool label="Zug zurück" icon={<Undo2 size={20} />} onClick={() => (g.takeback(), setGuard(null))} disabled={plies.length === 0} />
        <Tool label={confirmResign ? 'Sicher?' : 'Aufgeben'} icon={<Flag size={20} />} onClick={resign} disabled={plies.length < 2} on={confirmResign} />
      </>
    )
  } else if (mode === 'training' && training && !outcome) {
    tools = (
      <>
        <Tool
          label="Tipp"
          icon={<Lightbulb size={20} />}
          onClick={trainingHint}
          disabled={turnOf(liveFen) !== playerColor || !atEnd}
          on={trainerHint === liveFen || hintOn}
        />
 {evalTool}
        <Tool label="Zug zurück" icon={<Undo2 size={20} />} onClick={() => g.takeback()} disabled={plies.length === 0} />
        <Tool label="Neustart" icon={<RotateCcw size={20} />} onClick={restartTraining} />
        <Tool label="Varianten" icon={<ListTree size={20} />} onClick={() => openSetup(training.openingId)} />
      </>
    )
  } else if (mode === 'training' && training) {
    tools = (
      <>
        <Tool label="Auswertung" icon={<Star size={20} />} onClick={startReview} />
        <Tool label="Varianten" icon={<ListTree size={20} />} onClick={() => openSetup(training.openingId)} />
        <button className="btn-primary" onClick={restartTraining}>
          Nochmal
        </button>
      </>
    )
  } else if (mode === 'play') {
    tools = (
      <>
        <Tool label="Auswertung" icon={<Star size={20} />} onClick={startReview} />
        <button className="btn-primary" onClick={() => openNew()}>
          Neue Partie
        </button>
      </>
    )
  } else if (reviewing) {
    tools = (
      <>
        <Tool label="Engine" icon={<Activity size={20} />} onClick={toggleEngine} on={settings.analysisEngine} />
        <Tool label="Nochmal" icon={<RotateCcw size={20} />} onClick={startRetry} disabled={!retryable || !!retry} />
        <button className="btn-primary" onClick={() => openNew()}>
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
        <Tool label="Stellung" icon={<LayoutGrid size={20} />} onClick={() => openEditor(fen)} />
        <Tool label="Teilen" icon={<Share2 size={20} />} onClick={openShare} />
      </>
    )
  }

  const tab: Tab =
    view === 'drill'
      ? drill?.from === 'tactics'
        ? 'tactics'
        : 'today'
      : view === 'board'
        ? mode === 'training'
          ? 'openings'
          : mode
        : view === 'setup'
          ? 'openings'
          : view === 'analyse' || view === 'editor'
            ? 'analysis'
            : (view as Tab)
  const goAnalysis = () => {
    if (mode !== 'analysis') g.analyse()
    setView('board')
  }
  const navigate = (t: Tab) => setView(t === 'analysis' ? 'analyse' : t)
  const setupOpening = setupId ? openingById(setupId) : undefined
  const running = mode === 'play' && plies.length > 0 && !outcome
  const boardTitle =
    mode === 'play'
      ? endgame
        ? `Endspiel: ${endgame.name}`
        : `Gegen Stockfish ${levelOf(level).label}`
      : mode === 'training'
        ? (trainer.drill?.name ?? 'Eröffnungstraining')
        : imported
          ? `${imported.white} – ${imported.black}`
          : reviewing
            ? 'Partie-Auswertung'
            : 'Analyse'
  // phones: the board views get a back button instead of the tab bar
  const back: View | null =
    view === 'board'
      ? mode === 'training'
        ? 'openings'
        : mode === 'play'
          ? 'play'
          : 'analyse'
      : view === 'drill'
        ? (drill?.from ?? 'today')
        : view === 'setup'
          ? 'openings'
          : view === 'editor'
            ? 'analyse'
            : null
  const headTitle =
    view === 'board' ? boardTitle : view === 'drill' ? drill?.title : view === 'setup' ? setupOpening?.name : view === 'editor' ? 'Brett-Editor' : null

  return (
    <div className={`app view-${view}`}>
      <Nav tab={tab} onNavigate={navigate} onSettings={() => setDialog('settings')} onAccount={openAccount} />

      <header className="mobile-head">
        {back ? (
          <button className="icon-btn" onClick={() => setView(back)} aria-label="Zurück">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <button className="brand" onClick={() => setView('today')} aria-label={`${APP_NAME}, zur Startseite`}>
            <Logo className="brand-mark" />
            <span className="brand-name">{APP_NAME}</span>
          </button>
        )}
        {headTitle && <b className="mobile-title">{headTitle}</b>}
        <div className="topbar-actions">
          {view === 'board' && (
            <button className="icon-btn" onClick={() => g.flip()} aria-label="Brett drehen">
              <ArrowUpDown size={20} />
            </button>
          )}
          <button className="icon-btn" onClick={() => setDialog('settings')} aria-label="Einstellungen">
            <SettingsIcon size={20} />
          </button>
          {account.status !== 'local' && (
            <button className="icon-btn account-btn" onClick={openAccount} aria-label="Konto">
              {account.email ? <span className="account-dot">{account.email.slice(0, 1).toUpperCase()}</span> : <UserRound size={20} />}
            </button>
          )}
        </div>
      </header>

      {view === 'play' && (
        <main className="page">
          <PlayPage
            level={level}
            running={running ? { fen: liveFen, orientation, label: `${levelOf(level).label} · Zug ${Math.ceil(plies.length / 2)}`, onResume: () => setView('board') } : undefined}
            onStart={({ playerColor: color, level: l }) => startGame({ mode: 'play', playerColor: color, level: l })}
            onAnalysis={goAnalysis}
            onImport={() => setDialog('import')}
          />
        </main>
      )}
      {view === 'analyse' && (
        <main className="page">
          <AnalysePage
            onAnalyse={analyseRemote}
            onQueue={queueRemote}
            onBoard={() => (mode === 'analysis' ? setView('board') : loadGame(START_FEN, []))}
            onEditor={() => openEditor(mode === 'analysis' ? fen : START_FEN)}
            onPaste={() => setDialog('import')}
          />
        </main>
      )}
      {view === 'editor' && (
        <BoardEditor
          key={editorFen}
          fen={editorFen}
          coordinates={settings.coordinates}
          onAnalyse={(f) => loadGame(f, [])}
          onPlay={(f, color) => startGame({ mode: 'play', playerColor: color, level, startFen: f })}
        />
      )}
      {view === 'tactics' && (
        <main className="page">
          <TacticsPage
            onPuzzles={(theme) => void startPuzzles(theme, 5, 'tactics')}
            onMistakes={(ins) => startMistakes(ins, 5, 'tactics')}
            onWoodpecker={(fresh) => void startWoodpecker(fresh)}
            onEndgame={startEndgame}
          />
        </main>
      )}
      {view === 'today' && (
        <main className="page">
          <TodayPage onStart={(t, ins) => void startTask(t, ins)} onOpenGame={openArchived} onDailyPuzzle={startDailyPuzzle} />
        </main>
      )}
      {view === 'drill' && drill && (
        <DrillPlayer
          key={drill.title + drill.items.length}
          title={drill.title}
          items={drill.items}
          coordinates={settings.coordinates}
          sound={settings.sound}
          onResult={(r) => drillResult(drill.taskId, r)}
          onExit={() => setView(drill.from)}
        />
      )}
      {view === 'openings' && (
        <main className="page">
          <OpeningBrowser
            progress={g.progress}
            current={
              trainer.drill && trainer.variation && !outcome
                ? { title: `${trainer.drill.name}: ${trainer.variation.name}`, onResume: () => setView('board') }
                : undefined
            }
            onPick={openSetup}
          />
        </main>
      )}
      {view === 'setup' && setupOpening && (
        <main className="page">
          <OpeningSetup
            key={setupOpening.id}
            opening={setupOpening}
            progress={g.progress}
            level={level}
            onStart={startTraining}
            onBack={() => setView('openings')}
          />
        </main>
      )}
      <main className="layout" hidden={view !== 'board'}>
        <section className="stage">
          {strip(topColor)}
          <div className="board-row">
            {(showBar || reviewing) && <EvalBar share={bar?.share ?? null} label={bar?.label} orientation={orientation} />}
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
          <div className="panel-head">
            <b>{boardTitle}</b>
            <button className="icon-btn" onClick={() => g.flip()} aria-label="Brett drehen" title="Brett drehen (F)">
              <ArrowUpDown size={18} />
            </button>
          </div>
          <div className="coach-slot">{coach}</div>

          {reviewing && progress === null && cursor === 0 && <Summary review={review} plies={reviewed} startFen={startFen} moves={plies} onJump={nav} />}
          {reviewing && progress === null && <EvalGraph review={review} cursor={Math.min(cursor, reviewed)} onJump={nav} />}

          {showLines && (
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

      {dialog === 'settings' && <SettingsDialog settings={settings} onChange={g.updateSettings} onClose={() => setDialog(null)} />}
      {dialog === 'import' && <ImportDialog onLoad={loadGame} onClose={() => setDialog(null)} />}
      {dialog === 'share' && share && <ShareDialog pgn={share.pgn} fen={share.fen} onCopy={copy} onClose={() => setDialog(null)} />}
      {dialog === 'result' && outcome && (
        <ResultDialog
          outcome={outcome}
          playerColor={playerColor}
          opponentLevel={vsEngine && mode === 'play' ? level : undefined}
          onReview={startReview}
          onNew={openNew}
          rematchLabel={mode === 'training' || endgame ? 'Nochmal' : 'Revanche'}
          onRematch={() =>
            mode === 'training' ? restartTraining() : endgame ? startEndgame(endgame) : startGame({ mode: 'play', playerColor: opposite(playerColor), level })
          }
          onClose={() => setDialog(null)}
        />
      )}
      {account.accountOpen && <AccountDialog onClose={() => useAccount.setState({ accountOpen: false })} />}
      {account.upgrade && <UpgradeDialog onClose={() => useAccount.setState({ upgrade: null })} />}
      {!g.onboarded && <Welcome onDone={(next) => setView(next === 'analyse' ? 'analyse' : next)} />}
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

const ASPECT_NAME: Record<Aspect, string> = {
  opening: 'Eröffnung',
  middlegame: 'Mittelspiel',
  endgame: 'Endspiel',
  tactics: 'Taktik',
  strategy: 'Strategie',
}

/** Accuracy and move-quality counts per side, as on chess.com's review summary. */
function Summary({
  review,
  plies,
  startFen,
  moves,
  onJump,
}: {
  review: Review
  plies: number
  startFen: string
  moves: Ply[]
  onJump: (ply: number) => void
}) {
  const sans = moves.map((p) => p.san)
  const report = useMemo(() => reviewReport(review, startFen, moves, plies), [review, startFen, moves, plies])
  const firstWhite = turnOf(startFen) === 'white'
  const sideOf = (i: number): Color => ((i % 2 === 0) === firstWhite ? 'white' : 'black')
  const counts: Record<Color, Record<string, number>> = { white: {}, black: {} }
  review.moves.slice(0, plies).forEach((m, i) => {
    const c = counts[sideOf(i)]
    c[m.judgement] = (c[m.judgement] ?? 0) + 1
  })
  // key moments, as chessigma shows them: each side's finest move and its costliest one
  const moments = (['white', 'black'] as const).map((color) => {
    const own = review.moves.slice(0, plies).map((m, i) => ({ m, i })).filter(({ i }) => sideOf(i) === color)
    const rank = (j: string) => ['brilliant', 'great'].indexOf(j)
    const best = own.filter(({ m }) => rank(m.judgement) >= 0).sort((a, b) => rank(a.m.judgement) - rank(b.m.judgement))[0]
    const worst = own.filter(({ m }) => isError(m.judgement)).sort((a, b) => b.m.loss - a.m.loss)[0]
    return { color, best, worst }
  })
  const moveLabel = (i: number) => `${Math.floor((i + (firstWhite ? 0 : 1)) / 2) + 1}${sideOf(i) === 'white' ? '.' : '…'} ${figurine(sans[i] ?? '')}`
  const hasMoments = moments.some((x) => x.best || x.worst)
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
      <div className="summary-row elo-row" title="Geschätzt aus der Genauigkeit dieser einen Partie">
        <span>Spielstärke</span>
        <b>{report.white.elo ? `≈ ${report.white.elo}` : '–'}</b>
        <span />
        <b>{report.black.elo ? `≈ ${report.black.elo}` : '–'}</b>
      </div>
      {JUDGEMENT_ORDER.map((j) => (
        <div className="summary-row" key={j}>
          <span>{JUDGEMENT[j].label}</span>
          <b style={{ color: JUDGEMENT[j].color }}>{counts.white[j] ?? 0}</b>
          <Badge judgement={j} size={18} />
          <b style={{ color: JUDGEMENT[j].color }}>{counts.black[j] ?? 0}</b>
        </div>
      ))}
      <div className="aspects">
        <span className="moments-title">Partie nach Phasen</span>
        {ASPECT_ORDER.map((a) => {
          const w = report.white.aspects[a]
          const b = report.black.aspects[a]
          if (!w && !b) return null
          const cell = (x: typeof w) =>
            x ? (
              <span className="aspect-cell" title={`${x.moves} ${x.moves === 1 ? 'Zug' : 'Züge'}`}>
                <Badge judgement={x.judgement} size={18} />
                <b>{Math.round(x.accuracy)}</b>
              </span>
            ) : (
              <span className="aspect-cell muted">–</span>
            )
          return (
            <div className="summary-row aspect-row" key={a}>
              <span>{ASPECT_NAME[a]}</span>
              {cell(w)}
              <span />
              {cell(b)}
            </div>
          )
        })}
      </div>
      {hasMoments && (
        <div className="moments">
          <span className="moments-title">Schlüsselmomente</span>
          {moments.map(({ color, best, worst }) => (
            <div key={color} className="moments-row">
              <span className="muted">{color === 'white' ? 'Weiß' : 'Schwarz'}</span>
              {best && (
                <button className="moment" onClick={() => onJump(best.i + 1)}>
                  <Badge judgement={best.m.judgement} size={16} /> {moveLabel(best.i)}
                </button>
              )}
              {worst && (
                <button className="moment" onClick={() => onJump(worst.i + 1)}>
                  <Badge judgement={worst.m.judgement} size={16} /> {moveLabel(worst.i)}
                </button>
              )}
              {!best && !worst && <span className="muted small">ohne große Fehler</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
