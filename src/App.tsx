import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import {
  Activity,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Flag,
  Lightbulb,
  LayoutGrid,
  ListTree,
  MessageCircleQuestion,
  Play,
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
import { cancelReviews, formatScore, getAnalyst, getOpponent, opponentMove, useAnalysis, warmReview, whiteScore, whiteShare } from './engine/useEngine'
import { useOpening } from './game/openings'
import {
  figurine,
  inCheck,
  isFinal,
  isPromotion,
  legalDests,
  moveNumber,
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
import { fenAt, progressKey, useGame, type Mode } from './game/store'
import { Badge } from './review/Badge'
import { boardBadge } from './review/glyphs'
import { explain, explainBest } from './review/explain'
import { ASPECT_ORDER, reviewReport, type Aspect } from './review/stats'
import { evaluate, isError, JUDGEMENT, JUDGEMENT_ORDER, lossOf, reviewedPrefix, runReview, type Review } from './review/review'
import { hintMove, judgeMove, lineOf, loadBook, openingById, pickBookMove, type Verdict } from './trainer/book'
import { OpeningBrowser } from './trainer/OpeningBrowser'
import { OpeningSetup, type TrainingSetup } from './trainer/OpeningSetup'
import { useTrainer } from './trainer/useTrainer'
import { onVariationLearned, type LessonTask } from './lesson/lesson'
import { LessonPrompt } from './lesson/LessonPrompt'
import { RushPage } from './rush/RushPage'
import { VisualPage } from './visual/VisualPage'
import { GuessPage } from './guess/GuessPage'
import { RepertoirePage } from './repertoire/RepertoirePage'
import { AchievementsPage } from './progress/AchievementsPage'
import { AchievementToasts } from './progress/LevelBadge'
import { bump } from './progress/stats'
import { AskCoachDialog } from './coach/AskCoach'
import { cloudEnabled } from './account/cloud'
import { explainMove, moveInstruction } from './trainer/explainMove'
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
import { awaitPro, openAccount, requirePro, useAccount } from './account/account'
import { AI_ENABLED } from './account/plans'
import { CoursesPage } from './courses/CoursesPage'
import { copyText, onBackButton } from './native/native'
import { AccountDialog, UpgradeDialog } from './account/AccountDialogs'
import { Welcome } from './account/Welcome'
import { APP_NAME } from './brand'
import { t, tk, tn } from './i18n/i18n'
import { PlayPage } from './play/PlayPage'
import { TacticsPage } from './puzzles/TacticsPage'
import { SettingsDialog } from './ui/SettingsDialog'
import { EngineLines } from './ui/EngineLines'
import { EvalBar } from './ui/EvalBar'
import { EvalGraph } from './ui/EvalGraph'
import { MoveList } from './ui/MoveList'
import { PlayerStrip } from './ui/PlayerStrip'

type Dialog = 'settings' | 'import' | 'share' | 'result' | 'ask'

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

type View =
  | 'today'
  | 'play'
  | 'tactics'
  | 'analyse'
  | 'editor'
  | 'board'
  | 'openings'
  | 'setup'
  | 'drill'
  | 'rush'
  | 'visual'
  | 'guess'
  | 'repertoire'
  | 'achievements'
  | 'courses'

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
  // after the quick first pass: how much of the game is searched again at full depth
  const [refining, setRefining] = useState<number | null>(null)
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
  // "Bester Zug": the engine's line from `at`, shown as a side line and played move by move
  const [followup, setFollowup] = useState<{ at: number; end: number; own: boolean; playing: boolean } | null>(null)
  const shownLine = g.sideline && followup ? followup : null
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
    void awaitPro().then((ok) => flash(ok ? t('Danke! Pro ist aktiv.') : t('Danke! Pro wird gleich aktiv.')))
    // runs once, on the page Stripe sent the player back to
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // a game from the endgame trainer, and the blunder guard's verdict on the player's last move
  const [endgame, setEndgame] = useState<Endgame | null>(null)
  const [guard, setGuard] = useState<{ fen: string; status: 'checking' | 'warn' | 'ok'; text?: string; san?: string } | null>(null)
  // archived games get reviewed in the background, except while a live game needs the CPU
  // and while the player's own review runs, which wants every core
  useBackgroundReviews((view === 'board' && (mode === 'play' || mode === 'training') && !outcome) || progress !== null || refining !== null)

  const reviewed = review ? reviewedPrefix(review, plies) : 0
  // the game itself, also while the board shows a side line
  const gameLine = g.sideline?.plies ?? plies
  const gameReviewed = review ? reviewedPrefix(review, gameLine) : 0
  // a game from chess.com or Lichess on the board: its players' names and ratings
  const imported = mode === 'analysis' ? g.history.find((x) => x.key === g.gameKey && x.mode === 'import')?.source : undefined
  const reviewing = mode === 'analysis' && review !== null && reviewed > 0
  const moveReview = reviewing && cursor > 0 && cursor <= reviewed ? review.moves[cursor - 1] : null
  const named = useOpening(startFen, plies, cursor)

  // ---------------------------------------------------------------- opponent

  // Stockfish answers the latest position, even while the player looks back through the game
  const liveFen = fenAt(g, plies.length)
  // a learning run waits for the player before each opponent move
  const learning = mode === 'training' && !!training?.learn
  const thinking = (mode === 'play' || mode === 'training') && !outcome && turnOf(liveFen) !== playerColor && !learning
  // in a drill the opponent plays theory while there is some, then Stockfish at the chosen strength
  const bookStep = trainer.step
  const bookLoading = trainer.loading

  // ---------------------------------------------------------------- learning run

  // The first run of a variation: an arrow shows the player's move; once it is played the
  // coach explains why, and the opponent's reply follows on "Weiter".
  const learnLine = learning ? training!.line : []
  const learnDone = learning && plies.length >= learnLine.length
  const learnSan = learning && !learnDone ? learnLine[plies.length] : null
  const learnUci = learnSan ? sanToUci(liveFen, learnSan) : null
  const learnMine = learning && turnOf(liveFen) === playerColor
  const [learnIntro, setLearnIntro] = useState<number | null>(null)
  const introOpen = learning && plies.length === 0 && learnIntro !== g.gameId
  const [learnMiss, setLearnMiss] = useState(false)
  // why the last move was played, and (for the opponent's first move) why the next one is
  const lastIdea = useMemo(() => {
    if (!learning || !plies.length) return null
    const i = plies.length - 1
    const before = i === 0 ? startFen : plies[i - 1].fen
    const prev = plies[i - 1]
    return explainMove(before, plies[i].uci, prev ? { to: prev.uci.slice(2, 4), capture: prev.san.includes('x') } : undefined)
  }, [learning, plies, startFen])
  const nextIdea = useMemo(() => (learning && learnUci && !plies.length ? explainMove(liveFen, learnUci) : null), [learning, learnUci, plies.length, liveFen])
  const lastWasMine = learning && plies.length > 0 && turnOf(fenAt(g, plies.length - 1)) === playerColor

  const learnNext = () => {
    if (!learnUci || learnMine || learnDone) return
    setLearnMiss(false)
    useGame.getState().append(learnUci)
  }

  // a finished learning run counts for the variation and for today's plan
  useEffect(() => {
    if (!learnDone || !training || training.recorded) return
    const s = useGame.getState()
    const key = progressKey(training.openingId, training.variation, playerColor)
    s.updateTraining({ recorded: true })
    s.markLearned(key)
    s.advanceTask(`opening:${key}`)
    onVariationLearned(key)
  }, [learnDone, training, playerColor])

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
      // without the better move: the guard warns, it doesn't give the answer away
      const why = explain('blunder', before, liveFen, ply.uci, { ...a, best: null }, b)
      setGuard({ fen: liveFen, status: 'warn', san: ply.san, text: why || t('Damit verschenkst du viel.') })
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
    if (mode === 'play' && !endgame) {
      bump('gamesPlayed')
      if (outcome.kind !== 'draw' && outcome.winner === s.playerColor) bump('gamesWon')
    }
    // a review often follows a finished game: have its engines ready
    warmReview()
    // let the final move land before the result appears
    const timer = setTimeout(() => setDialog('result'), 700)
    return () => clearTimeout(timer)
    // endgame is the trainer's position, set before the game started
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, mode])

  // the analysis page leads to reviews: boot their engines while the player looks around
  useEffect(() => {
    if (view === 'analyse' || (view === 'board' && mode === 'analysis')) warmReview()
  }, [view, mode])

  // ---------------------------------------------------------------- actions

  const flash = (text: string) => {
    setToast(text)
    setTimeout(() => setToast((cur) => (cur === text ? null : cur)), 1800)
  }

  const nav = (to: number) => {
    setRetry(null)
    setPromotion(null)
    setFollowup((f) => (f?.playing ? { ...f, playing: false } : f))
    useGame.getState().goTo(to)
  }

  const backToGame = () => {
    setFollowup(null)
    setRetry(null)
    useGame.getState().backToGame()
  }

  const stopReview = () => {
    reviewRun.current++
    setProgress(null)
    setRefining(null)
    cancelReviews()
  }

  const resetBoardState = () => {
    stopReview()
    setFollowup(null)
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
    let variation = setup.choice === 'random' ? Math.floor(Math.random() * o.variations.length) : setup.choice
    // in random mode, avoid the same variation twice in a row
    const prev = useGame.getState().training
    if (setup.choice === 'random' && o.variations.length > 1 && prev?.openingId === o.id && prev.variation === variation)
      variation = (variation + 1 + Math.floor(Math.random() * (o.variations.length - 1))) % o.variations.length
    // the first run of every variation is a learning run
    const learned = (v: number) => (useGame.getState().progress[progressKey(o.id, v, setup.side)]?.learned ?? 0) > 0
    if (setup.choice === 'random' && setup.learn) {
      const fresh = o.variations.map((_, i) => i).filter((i) => !learned(i))
      if (fresh.length) variation = fresh[Math.floor(Math.random() * fresh.length)]
    }
    const learn = !!setup.learn || !learned(variation)
    resetBoardState()
    setLearnMiss(false)
    getOpponent().newGame()
    g.startTraining(
      { openingId: o.id, choice: setup.choice, variation, line: lineOf(o, variation), strict: setup.strict, mistakes: 0, hints: 0, learn },
      setup.side,
      setup.level,
    )
  }

  const restartTraining = () => {
    if (!training) return
    startTraining({ openingId: training.openingId, choice: training.choice, side: playerColor, level, strict: training.strict, learn: training.learn })
  }

  /** A lesson from the daily prompt or the Today page: one variation, learned or repeated. */
  const startLesson = (task: LessonTask) =>
    startTraining({ openingId: task.openingId, choice: task.variation, side: task.side, level, strict: true, learn: task.learn })

  const askCoach = () => {
    if (cloudEnabled && !requirePro('ask')) return
    setDialog('ask')
  }

  /** The same variation again, from memory or once more with arrows. */
  const replayVariation = (learn: boolean) => {
    if (!training) return
    startTraining({ openingId: training.openingId, choice: training.variation, side: playerColor, level, strict: training.strict, learn })
  }

  /** Checks a drill move against the theory; true when it was handled here. */
  const trainerMove = (uci: string) => {
    if (!training || !trainer.step || !atEnd || outcome) return false
    const ply = play(fen, uci)
    if (!ply) return false
    let verdict = judgeMove(trainer.step, ply.san)
    const here = plies.length
    setTrainerHint(null)
    // "all variations": the player cannot know which one was drawn, so a move that starts
    // another variation of this opening switches the run to that one instead of counting
    if (verdict.kind === 'other-line' && training.choice === 'random') {
      const o = openingById(training.openingId)
      const played = [...plies.map((p) => p.san), ply.san]
      const other = o?.variations.findIndex((_, i) => {
        const l = lineOf(o, i)
        return l.length >= played.length && played.every((m, k) => l[k] === m)
      })
      if (o && other !== undefined && other >= 0) {
        g.updateTraining({ variation: other, line: lineOf(o, other) })
        const games = trainer.step.moves.reduce((sum, [, n]) => sum + n, 0)
        const hit = trainer.step.moves.find(([m]) => m === ply.san)
        verdict = { kind: 'line', share: hit && games ? hit[1] / games : 0, main: hit === trainer.step.moves[0] }
      }
    }
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
    // a side line on the board: the review is about the game
    if (useGame.getState().sideline) backToGame()
    const s = useGame.getState()
    if (!s.plies.length) return flash(t('Noch keine Züge zum Auswerten'))
    s.countReview()
    const run = ++reviewRun.current
    setDialog(null)
    setRetry(null)
    setHintFen(null)
    s.analyse()
    setProgress(0)
    setRefining(null)
    // the review belongs to this game: opening another one ends it
    const key = s.gameKey
    const alive = () => run === reviewRun.current && useGame.getState().gameKey === key
    void runReview(
      s.startFen,
      s.plies,
      (done, total) => alive() && setProgress(done / total),
      alive,
      undefined,
      undefined,
      // the quick pass opens the review; the full-depth pass then sharpens it in place
      (preview, refined) => {
        if (!alive()) return
        const st = useGame.getState()
        st.setReview(preview)
        if (refined === 0) {
          setProgress(null)
          st.goTo(0)
        }
        setRefining(refined)
      },
    ).then((result) => {
      if (run !== reviewRun.current) return
      setProgress(null)
      setRefining(null)
      if (useGame.getState().gameKey !== key) return
      if (!result) return flash(t('Auswertung abgebrochen'))
      const st = useGame.getState()
      st.setReview(result)
      // the archived copy gets the review too, so the coach can learn from it
      const archived = st.history.find((x) => x.key === st.gameKey)
      if (archived && archived.ucis.join() === result.ucis.join()) st.attachReview(st.gameKey, packReview(result))
      bump('reviewsDone')
      // brilliant moves of the player's own games count for the achievements
      const own = st.vsEngine || archived?.mode === 'import'
      const firstWhite = turnOf(st.startFen) === 'white'
      const brilliant = result.moves.filter((m, i) => m.judgement === 'brilliant' && ((i % 2 === 0) === firstWhite ? 'white' : 'black') === st.playerColor).length
      if (own && brilliant) bump('brilliantsFound', brilliant)
    })
  }

  // ---------------------------------------------------------------- daily training

  const startMistakes = (insights: Insights, count: number, from: View, taskId?: string) => {
    const solved = new Set(useGame.getState().solvedMistakes)
    const items: DrillItem[] = insights.mistakes
      .filter((m) => !solved.has(`${m.gameKey}:${m.ply}`))
      .slice(0, count)
      .map((m) => ({ kind: 'mistake', key: `${m.gameKey}:${m.ply}`, fen: m.fen, best: m.best, playedSan: m.san, winBefore: m.winBefore, date: m.date }))
    if (!items.length) return flash(t('Alle Fehler sind schon gelöst'))
    setDrill({ title: t('Deine Fehler'), items, taskId, from })
    setView('drill')
  }

  const startPuzzles = async (theme: string | undefined, count: number, from: View, taskId?: string) => {
    const s = useGame.getState()
    const puzzles = await pickPuzzles({ theme, rating: s.puzzleRating, count, skip: new Set(s.seenPuzzles) })
    if (!puzzles.length) return flash(t('Keine neuen Aufgaben zu diesem Thema'))
    setDrill({ title: theme ? themeName(theme) : t('Taktik-Mix'), items: puzzles.map((puzzle) => ({ kind: 'puzzle', puzzle })), taskId, from })
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
    const s = useGame.getState()
    if (fresh || !s.woodpecker) s.startWoodpecker((await woodpeckerSet(s.puzzleRating)).map((p) => p.id))
    const w = useGame.getState().woodpecker!
    const items: DrillItem[] = (await puzzlesById(w.ids.slice(w.index))).map((puzzle) => ({ kind: 'puzzle', puzzle }))
    if (!items.length) return flash(t('Das Set ist leer'))
    setDrill({ title: t('Woodpecker · Runde {n}', { n: w.cycle }), items, taskId: 'woodpecker', from: 'tactics' })
    setView('drill')
  }

  const startDailyPuzzle = (puzzle: Puzzle) => {
    setDrill({ title: t('Tagesaufgabe'), items: [{ kind: 'puzzle', puzzle }], taskId: 'daily-puzzle', from: 'today' })
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
    if (solved) bump('puzzlesSolved')
    if (taskId && taskId !== 'daily-puzzle') s.advanceTask(taskId)
  }

  const openArchived = (game: SavedGame) => {
    resetBoardState()
    g.openSaved(game)
  }

  // ---------------------------------------------------------------- imported games

  const analyseRemote = (remote: RemoteGame) => {
    const saved = useGame.getState().importGame(remote)
    if (!saved) return flash(t('Diese Partie lässt sich nicht laden'))
    openArchived(saved)
    if (!saved.review) startReview()
  }

  /** Files games in the archive without opening them; the background reviewer takes them from there. */
  const queueRemote = (games: RemoteGame[]) => {
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
    setFollowup(null)
    if (!useGame.getState().move(uci)) setResync((r) => r + 1)
  }

  const tryRetry = (r: Retry, orig: Key, dest: Key) => {
    if (!review) return
    const uci = toUci(r.fen, orig, dest) + (isPromotion(r.fen, orig, dest) ? 'q' : '')
    const ply = play(r.fen, uci)
    if (!ply) return setResync((n) => n + 1)
    if (settings.sound) playSound(soundFor(ply.san))
    const shown = { fen: ply.fen, lastMove: squares(ply.uci) }
    if (ply.uci === r.best) return setRetry({ ...r, shown, status: 'right', note: t('{san} ist der beste Zug.', { san: figurine(ply.san) }) })
    if (ply.uci === plies[r.ply].uci) return setRetry({ ...r, shown, status: 'wrong', note: t('Das war der Partiezug. Such einen besseren!') })
    setRetry({ ...r, shown, status: 'checking' })
    const before = review.evals[r.ply].win
    void evaluate(ply.fen, undefined, 1, getAnalyst()).then((e) =>
      setRetry((cur) => {
        if (!cur || cur.ply !== r.ply || cur.shown?.fen !== ply.fen) return cur
        if (e && lossOf(before, e.win, turnOf(r.fen)) < 0.02) return { ...cur, status: 'right', note: t('{san} ist auch stark.', { san: figurine(ply.san) }) }
        return { ...cur, status: 'wrong', note: t("{san} ist nicht der beste Zug. Versuch's nochmal!", { san: figurine(ply.san) }) }
      }),
    )
  }

  // the best line plays itself, about a move a second
  const autoplay = !!shownLine?.playing && cursor < shownLine.end
  useEffect(() => {
    if (!autoplay) return
    const timer = setTimeout(() => useGame.getState().goTo(useGame.getState().cursor + 1), 900)
    return () => clearTimeout(timer)
  }, [autoplay, cursor])

  // after a miss, put the pieces back for the next try
  useEffect(() => {
    if (retry?.status !== 'wrong') return
    const timer = setTimeout(() => setRetry((r) => (r?.status === 'wrong' ? { ...r, shown: null, status: 'try' } : r)), 900)
    return () => clearTimeout(timer)
  }, [retry?.status])

  const onMove = (orig: Key, dest: Key, premove: boolean) => {
    if (retry) return tryRetry(retry, orig, dest)
    setHintFen(null)
    // a learning run takes only the move the arrow shows
    if (learning) {
      const uci = toUci(fen, orig, dest) + (isPromotion(fen, orig, dest) ? 'q' : '')
      if (learnMine && learnUci && uci.slice(0, 4) === learnUci.slice(0, 4)) {
        setLearnMiss(false)
        return commit(learnUci)
      }
      if (settings.sound) playSound('wrong')
      setLearnMiss(true)
      return setResync((r) => r + 1)
    }
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
    copyText(text).then(
      () => flash(t('{what} kopiert', { what })),
      () => flash(t('Kopieren nicht möglich')),
    )

  const pgn = () => {
    const result = !outcome ? '*' : outcome.kind === 'draw' ? '1/2-1/2' : outcome.winner === 'white' ? '1-0' : '0-1'
    const names = (c: Color) => (!vsEngine ? '?' : c === playerColor ? t('Ich') : `Stockfish (${levelOf(level).label})`)
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
      // in a learning run, Enter, space and → step on to the opponent's move
      if (learning && atEnd && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) {
        e.preventDefault()
        if (introOpen) setLearnIntro(g.gameId)
        else learnNext()
        return
      }
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
  const dests = useMemo(
    () => (learning && learnMine && learnUci && !introOpen ? new Map([[learnUci.slice(0, 2) as Key, [learnUci.slice(2, 4) as Key]]]) : legalDests(retryFen ?? fen)),
    [retryFen, fen, learning, learnMine, learnUci, introOpen],
  )
  const movableColor = retry
    ? retry.status === 'try'
      ? turnOf(retry.fen)
      : undefined
    : mode !== 'analysis'
      ? atEnd && !outcome && !(learning && (introOpen || learnDone || !learnMine))
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
    if (learning) {
      if (introOpen) return out
      // the move to play now, or the idea of the move just played while the opponent waits
      if (learnMine && learnUci) arrow(learnUci, 'best')
      const idea = learnMine ? null : lastWasMine || learnDone ? lastIdea : nextIdea
      if (!learnMine && !lastWasMine && learnUci) arrow(learnUci, 'opponent')
      idea?.arrows.forEach(([orig, dest]) => out.push({ orig, dest, brush: 'idea' }))
      idea?.squares.forEach((orig) => out.push({ orig, brush: 'control' }))
      return out
    }
    if (shownLine) {
      // the move the line plays next
      if (cursor < shownLine.end && plies[cursor]) arrow(plies[cursor].uci, 'best')
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
  }, [retry, learning, introOpen, learnMine, learnUci, lastWasMine, learnDone, lastIdea, nextIdea, shownLine, moveReview, review, plies, cursor, showLines, analysis, hintOn, bookStep, atEnd, liveFen, playerColor, note, trainerHint])

  // ---------------------------------------------------------------- coach

  const retryable = moveReview && (moveReview.judgement === 'inaccuracy' || isError(moveReview.judgement))
  const startRetry = () => {
    if (!review || !moveReview) return
    const i = cursor - 1
    setHintFen(null)
    setRetry({ ply: i, fen: fenAt(g, i), best: review.evals[i].best, shown: null, status: 'try' })
  }

  // the engine's best move instead of the game move, and how the game would have gone on
  const showBest = () => {
    if (!review || !moveReview) return
    const at = cursor - 1
    const e = review.evals[at]
    const line = e.pv?.length ? e.pv : e.best ? [e.best] : []
    setRetry(null)
    if (!line.length || !g.showLine(at, line, cursor)) return flash(t('Dazu gibt es keine Variante.'))
    setFollowup({ at, end: useGame.getState().plies.length, own: plies[at].uci === line[0], playing: true })
  }
  const playedBest = !!moveReview && !!review && plies[cursor - 1]?.uci === review.evals[cursor - 1]?.best

  let coach: ReactNode
  if (progress !== null) {
    coach = (
      <Coach title={t('Partie wird ausgewertet')} progress={progress}>
        {t('Stockfish prüft jeden Zug … {n} %', { n: Math.round(progress * 100) })}
      </Coach>
    )
  } else if (retry) {
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
            {t('Weiter')}
          </button>
        ) : (
          <button className="btn-secondary small" onClick={() => setRetry({ ...retry, shown: null, status: 'solution', note: undefined })}>
            {t('Lösung zeigen')}
          </button>
        )}
        <button className="btn-secondary small" onClick={() => setRetry(null)}>
          {t('Zurück zur Partie')}
        </button>
      </>
    )
    const bestSan = retry.best ? pvToSan(retry.fen, [retry.best])[0] : null
    coach =
      retry.status === 'right' ? (
        <Coach judgement="best" title={t('Richtig!')} actions={actions}>
          {retry.note}
        </Coach>
      ) : retry.status === 'solution' ? (
        <Coach judgement="best" title={t('Bester Zug: {san}', { san: bestSan ? figurine(bestSan) : '–' })} actions={actions}>
          {t('Der grüne Pfeil zeigt ihn auf dem Brett.')}
        </Coach>
      ) : (
        <Coach
          title={
            retry.status === 'checking'
              ? t('Moment …')
              : turnOf(retry.fen) === 'white'
                ? t('Weiß am Zug – finde den besten Zug')
                : t('Schwarz am Zug – finde den besten Zug')
          }
          actions={actions}
        >
          {retry.status === 'checking' ? t('Stockfish prüft deinen Zug.') : (retry.note ?? t('Statt {san} gab es etwas Besseres.', { san: figurine(plies[retry.ply].san) }))}
        </Coach>
      )
  } else if (shownLine && review) {
    const e = review.evals[shownLine.at]
    const line = plies.slice(shownLine.at, shownLine.end)
    const first = figurine(line[0].san)
    coach = (
      <Coach
        judgement="best"
        title={shownLine.own ? t('{san} war der beste Zug', { san: first }) : t('Bester Zug: {san}', { san: first })}
        score={e.score}
        actions={
          <>
            <button className="btn-primary small" onClick={backToGame}>
              {t('Weiter')} <ChevronRight size={15} />
            </button>
            <button className="btn-secondary small" onClick={() => (useGame.getState().goTo(shownLine.at), setFollowup({ ...shownLine, playing: true }))}>
              <Play size={14} /> {t('Nochmal abspielen')}
            </button>
          </>
        }
      >
        {explainBest(fenAt(g, shownLine.at), line.map((p) => p.uci), e.score)}{' '}
        <span className="line-moves">
          {line.map((p, k) => {
            const ply = shownLine.at + k
            // move numbers as in the move list, also for games from a set-up position
            const half = ply + (turnOf(startFen) === 'black' ? 1 : 0)
            const n = moveNumber(startFen) + Math.floor(half / 2)
            const label = half % 2 === 0 ? `${n}.` : k === 0 ? `${n}…` : ''
            return (
              <button key={k} className={`line-move ${cursor === ply + 1 ? 'on' : ''}`} onClick={() => nav(ply + 1)}>
                {label}
                {figurine(p.san)}
              </button>
            )
          })}
        </span>
      </Coach>
    )
  } else if (g.sideline && cursor > g.sideline.at) {
    coach = (
      <Coach
        title={t('Eigene Variante')}
        actions={
          <button className="btn-primary small" onClick={backToGame}>
            <CornerUpLeft size={15} /> {t('Zurück zur Partie')}
          </button>
        }
      >
        {t('Die Partie bleibt gespeichert, du kannst jederzeit zurück.')}
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
          j !== 'book' && (
            <>
              <button className="btn-secondary small" onClick={showBest}>
                <Lightbulb size={16} /> {playedBest ? t('Folgezüge') : t('Bester Zug')}
              </button>
              {retryable && (
                <button className="btn-secondary small" onClick={startRetry}>
                  <RotateCcw size={16} /> {t('Nochmal versuchen')}
                </button>
              )}
            </>
          )
        }
      >
        {text}
      </Coach>
    )
  } else if (reviewing && cursor === 0) {
    coach = (
      <Coach title={t('Auswertung fertig')}>
        {t('Geh mit')} <ChevronRight size={14} className="inline" /> {t('Zug für Zug durch die Partie. Bei Fehlern kannst du es nochmal versuchen.')}
      </Coach>
    )
  } else if (learning && trainer.drill && trainer.variation) {
    coach = learnCoach()
  } else if (trainer.active && training && trainer.drill && trainer.variation) {
    coach = trainingCoach()
  } else if (mode === 'play' && guard && guard.fen === liveFen && guard.status === 'warn' && !outcome) {
    coach = (
      <Coach
        judgement="blunder"
        title={t('Vorsicht!')}
        actions={
          <>
            <button className="btn-primary small" onClick={() => (g.takeback(), setGuard(null))}>
              <Undo2 size={15} /> {t('Zurücknehmen')}
            </button>
            <button className="btn-secondary small" onClick={() => setGuard({ ...guard, status: 'ok' })}>
              {t('Trotzdem spielen')}
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
        ? t('Remis')
        : outcome.winner === playerColor
          ? t('Du hast gewonnen!')
          : t('Stockfish gewinnt')
      : thinking
        ? guardWait
          ? t('Patzer-Schutz prüft deinen Zug …')
          : t('Stockfish denkt …')
        : turn === playerColor
          ? t('Du bist am Zug')
          : t('Stockfish ist am Zug')
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
    coach = <Coach title={t('Analysebrett')}>{named ? `${named.eco} · ${named.name}` : t('Zieh frei für beide Seiten. Stockfish rechnet mit.')}</Coach>
  }

  function learnCoach(): ReactNode {
    const drill = trainer.drill!
    const variation = trainer.variation!
    const total = learnLine.length
    // the move being shown: the player's next one, else the one just played (or White's first)
    const shown = learnMine ? plies.length + 1 : Math.max(plies.length, 1)
    const counter = <span className="coach-line">{t('Lernen · Zug {n} von {total}', { n: Math.min(shown, total), total })}</span>
    const last = plies[plies.length - 1]
    const lastSide = last && turnOf(fenAt(g, plies.length - 1)) === 'white'
    if (introOpen)
      return (
        <Coach
          title={`${drill.name} · ${variation.name}`}
          actions={
            <button className="btn-primary small" onClick={() => setLearnIntro(g.gameId)}>
              {t('Los geht’s')} <ChevronRight size={15} />
            </button>
          }
        >
          {variation.note ?? drill.about} {t('Beim ersten Durchgang zeigt ein Pfeil jeden Zug, und der Coach erklärt, warum er gespielt wird.')}
        </Coach>
      )
    if (learnDone)
      return (
        <Coach
          judgement="best"
          title={t('Variante gelernt!')}
          actions={
            <>
              <button className="btn-primary small" onClick={() => replayVariation(false)}>
                {t('Jetzt aus dem Kopf üben')}
              </button>
              <button className="btn-secondary small" onClick={() => replayVariation(true)}>
                <RotateCcw size={15} /> {t('Nochmal ansehen')}
              </button>
            </>
          }
        >
          {last && lastIdea && (
            <span className="learn-why">
              <b className="coach-san">{figurine(last.san)}</b> {lastIdea.text}
            </span>
          )}
          {t('Du hast alle Züge der Variante gesehen. Jetzt spielst du sie ohne Pfeile.')}
        </Coach>
      )
    const san = figurine(learnSan!)
    if (learnMine)
      return (
        <Coach title={t('Dein Zug: {san}', { san })}>
          {last && lastIdea && (
            <span className="learn-why">
              {lastSide ? t('Weiß spielte {san}:', { san: figurine(last.san) }) : t('Schwarz spielte {san}:', { san: figurine(last.san) })} {lastIdea.text}
            </span>
          )}
          {moveInstruction(liveFen, learnUci!)} {learnMiss && <b>{t('Zieh die Figur, die der grüne Pfeil zeigt.')}</b>}
          {counter}
        </Coach>
      )
    // the opponent is next: first why the player's move was good, then their reply on "Weiter"
    const nextLabel = turnOf(liveFen) === 'white' ? t('Weiter: Weiß zieht') : t('Weiter: Schwarz zieht')
    return (
      <Coach
        judgement={lastWasMine ? 'best' : undefined}
        title={lastWasMine && last ? t('Warum {san}?', { san: figurine(last.san) }) : turnOf(liveFen) === 'white' ? t('Weiß beginnt mit {san}', { san }) : t('Schwarz spielt {san}', { san })}
        actions={
          <button className="btn-primary small" onClick={learnNext}>
            {nextLabel} <ChevronRight size={15} />
          </button>
        }
      >
        {(lastWasMine ? lastIdea : nextIdea)?.text}
        {counter}
      </Coach>
    )
  }

  function trainingCoach(): ReactNode {
    const tr = training!
    const drill = trainer.drill!
    const label = levelOf(level).label
    const last = plies[plies.length - 1]
    const opponentMoved = !!last && turnOf(liveFen) === playerColor
    const status = thinking
      ? t('Der Gegner überlegt …')
      : opponentMoved
        ? t('Gegner: {move}. Du bist dran.', { move: numbered([last.san], plies.length - 1) })
        : t('Du bist dran.')
    const fresh = note && note.ply >= plies.length - 2 ? note : null
    const more = (
      <>
        <button className="btn-primary small" onClick={restartTraining}>
          <RotateCcw size={15} /> {t('Nochmal')}
        </button>
        <button className="btn-secondary small" onClick={() => openSetup(tr.openingId)}>
          {t('Andere Variante')}
        </button>
      </>
    )

    if (trainer.loading) return <Coach title={t('Theorie wird geladen …')} />
    if (outcome) {
      const won = outcome.kind !== 'draw' && outcome.winner === playerColor
      return (
        <Coach title={outcome.kind === 'draw' ? t('Remis') : won ? t('Du hast gewonnen!') : t('Der Gegner gewinnt')} actions={more}>
          {t('Werte die Partie aus, um zu sehen, wo es nach der Eröffnung gekippt ist.')}
        </Coach>
      )
    }
    // the line is played out: say so until the player's next move
    const afterLine = plies.slice(tr.line.length)
    const movedSince = afterLine.some((_, j) => turnOf(fenAt(g, tr.line.length + j)) === playerColor)
    if (trainer.lineDone && tr.recorded && !movedSince) {
      const tally = [tr.mistakes && tn(tr.mistakes, '1 Fehler', '{n} Fehler'), tr.hints && tn(tr.hints, '1 Tipp', '{n} Tipps')].filter(Boolean).join(' · ')
      return (
        <Coach judgement={tr.cleanRun ? 'best' : 'book'} title={tr.cleanRun ? t('Variante gemeistert!') : t('Variante durchgespielt')} actions={more}>
          {tr.cleanRun ? t('Alle Züge der Variante saßen, dafür gibt es den Haken.') : t('{tally}. Spiel sie einmal ohne Fehler und Tipps, dann gibt es den Haken.', { tally })}{' '}
          {trainer.bookOver ? t('Ab hier spielt der Gegner frei mit {level} weiter.', { level: label }) : t('Du kannst weiterspielen: der Gegner folgt jetzt den Meisterpartien.')}
        </Coach>
      )
    }
    if (trainer.bookOver) {
      return (
        <Coach judgement="book" title={t('Ende der Theorie')} actions={more}>
          {!trainer.lineDone && `${t('Du hast die Variante verlassen')}. `}
          {t('Ab hier spielt der Gegner frei mit {level} weiter.', { level: label })}
        </Coach>
      )
    }
    if (fresh && isWrong(fresh.verdict) && 'expected' in fresh.verdict) {
      const off = fresh.verdict.kind === 'off'
      const answer = fresh.tries >= 2 ? ` ${t('Richtig ist {san}, siehe Pfeil.', { san: figurine(fresh.verdict.expected) })}` : ''
      return (
        <Coach
          judgement={off ? 'mistake' : 'inaccuracy'}
          title={
            <span>
              <b className="coach-san">{figurine(fresh.san)}</b> {off ? t('ist keine Theorie') : t('gehört zu einer anderen Variante')}
            </span>
          }
        >
          {tr.strict ? `${t("Versuch's nochmal.")}${answer}` : `${t('Ab hier spielst du außerhalb der {name}.', { name: trainer.variation!.name })} ${status}`}
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
              <b className="coach-san">{figurine(fresh.san)}</b> {main ? t('ist der Hauptzug') : t('ist Theorie')}
            </span>
          }
        >
          {share > 0 && `${t('{n} % der Meisterpartien.', { n: Math.round(share * 100) })} `}
          {status}
          {named && <span className="coach-line">{named.name}</span>}
        </Coach>
      )
    }
    return (
      <Coach title={`${drill.name} · ${trainer.variation!.name}`}>
        {plies.length === 0
          ? playerColor === 'white'
            ? t('Du spielst Weiß und beginnst. Spiel die Züge der Theorie.')
            : t('Du spielst Schwarz, der Gegner beginnt. Spiel die Züge der Theorie.')
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
        name={vsEngine ? (engine ? (mode === 'training' ? t('Gegner') : 'Stockfish') : t('Du')) : color === 'white' ? t('Weiß') : t('Schwarz')}
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
    <button className="nav-btn" onClick={() => nav(cursor - 1)} disabled={cursor === 0 && !retry} aria-label={t('Vorheriger Zug')}>
      <ChevronLeft size={26} />
    </button>
  )
  const navRight = (
    <button className="nav-btn" onClick={() => nav(cursor + 1)} disabled={atEnd} aria-label={t('Nächster Zug')}>
      <ChevronRight size={26} />
    </button>
  )

  const toggleEngine = () => g.updateSettings({ analysisEngine: !settings.analysisEngine })

  const openShare = () => {
    setShare({ pgn: pgn(), fen })
    setDialog('share')
  }

  const evalTool = (
    <Tool label={t('Bewertung')} icon={<Activity size={20} />} onClick={() => g.updateSettings({ evalInPlay: !settings.evalInPlay })} on={settings.evalInPlay} />
  )

  let tools: ReactNode
  if (mode === 'play' && !outcome) {
    tools = (
      <>
        <Tool
          label={t('Tipp')}
          icon={<Lightbulb size={20} />}
          onClick={() => setHintFen(hintOn ? null : fen)}
          disabled={turn !== playerColor || !atEnd}
          on={hintOn}
        />
        {evalTool}
        <Tool label={t('Schutz')} icon={<ShieldCheck size={20} />} onClick={() => g.updateSettings({ blunderGuard: !settings.blunderGuard })} on={settings.blunderGuard} />
        <Tool label={t('Zug zurück')} icon={<Undo2 size={20} />} onClick={() => (g.takeback(), setGuard(null))} disabled={plies.length === 0} />
        <Tool label={confirmResign ? t('Sicher?') : t('Aufgeben')} icon={<Flag size={20} />} onClick={resign} disabled={plies.length < 2} on={confirmResign} />
      </>
    )
  } else if (learning && training) {
    tools = (
      <>
        <Tool label={t('Neustart')} icon={<RotateCcw size={20} />} onClick={() => replayVariation(true)} />
        <Tool label={t('Varianten')} icon={<ListTree size={20} />} onClick={() => openSetup(training.openingId)} />
        {!learnMine && !learnDone && !introOpen && (
          <button className="btn-primary" onClick={learnNext}>
            {t('Weiter')}
          </button>
        )}
      </>
    )
  } else if (mode === 'training' && training && !outcome) {
    tools = (
      <>
        <Tool
          label={t('Tipp')}
          icon={<Lightbulb size={20} />}
          onClick={trainingHint}
          disabled={turnOf(liveFen) !== playerColor || !atEnd}
          on={trainerHint === liveFen || hintOn}
        />
        {evalTool}
        <Tool label={t('Zug zurück')} icon={<Undo2 size={20} />} onClick={() => g.takeback()} disabled={plies.length === 0} />
        <Tool label={t('Neustart')} icon={<RotateCcw size={20} />} onClick={restartTraining} />
        <Tool label={t('Varianten')} icon={<ListTree size={20} />} onClick={() => openSetup(training.openingId)} />
      </>
    )
  } else if (mode === 'training' && training) {
    tools = (
      <>
        <Tool label={t('Auswertung')} icon={<Star size={20} />} onClick={startReview} />
        <Tool label={t('Varianten')} icon={<ListTree size={20} />} onClick={() => openSetup(training.openingId)} />
        <button className="btn-primary" onClick={restartTraining}>
          {t('Nochmal')}
        </button>
      </>
    )
  } else if (mode === 'play') {
    tools = (
      <>
        <Tool label={t('Auswertung')} icon={<Star size={20} />} onClick={startReview} />
        <button className="btn-primary" onClick={() => openNew()}>
          {t('Neue Partie')}
        </button>
      </>
    )
  } else if (reviewing) {
    tools = (
      <>
        <Tool label={t('Engine')} icon={<Activity size={20} />} onClick={toggleEngine} on={settings.analysisEngine} />
        {AI_ENABLED && <Tool label={t('Coach fragen')} icon={<MessageCircleQuestion size={20} />} onClick={askCoach} />}
        {g.sideline ? (
          <Tool label={t('Zur Partie')} icon={<CornerUpLeft size={20} />} onClick={backToGame} />
        ) : (
          <>
            <Tool label={t('Bester Zug')} icon={<Lightbulb size={20} />} onClick={showBest} disabled={!moveReview || moveReview.judgement === 'book'} />
            <Tool label={t('Nochmal')} icon={<RotateCcw size={20} />} onClick={startRetry} disabled={!retryable || !!retry} />
          </>
        )}
        <button className="btn-primary" onClick={() => openNew()}>
          {t('Neue Partie')}
        </button>
      </>
    )
  } else {
    tools = (
      <>
        <Tool label={t('Engine')} icon={<Activity size={20} />} onClick={toggleEngine} on={settings.analysisEngine} />
        {AI_ENABLED && <Tool label={t('Coach fragen')} icon={<MessageCircleQuestion size={20} />} onClick={askCoach} />}
        {g.sideline && <Tool label={t('Zur Partie')} icon={<CornerUpLeft size={20} />} onClick={backToGame} />}
        <Tool label={t('Auswerten')} icon={<Star size={20} />} onClick={startReview} disabled={plies.length === 0 || progress !== null} />
        {!g.sideline && <Tool label={t('Laden')} icon={<Upload size={20} />} onClick={() => setDialog('import')} />}
        <Tool label={t('Stellung')} icon={<LayoutGrid size={20} />} onClick={() => openEditor(fen)} />
        <Tool label={t('Teilen')} icon={<Share2 size={20} />} onClick={openShare} />
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
          : view === 'analyse' || view === 'editor' || view === 'repertoire'
            ? 'analysis'
            : view === 'rush' || view === 'visual' || view === 'guess' || view === 'courses'
              ? 'tactics'
              : view === 'achievements'
                ? 'today'
                : (view as Tab)
  const goAnalysis = () => {
    if (mode !== 'analysis') g.analyse()
    setView('board')
  }
  const navigate = (to: Tab) => setView(to === 'analysis' ? 'analyse' : to)
  const setupOpening = setupId ? openingById(setupId) : undefined
  const running = mode === 'play' && plies.length > 0 && !outcome
  const boardTitle =
    mode === 'play'
      ? endgame
        ? t('Endspiel: {name}', { name: endgame.name })
        : t('Gegen Stockfish {level}', { level: levelOf(level).label })
      : mode === 'training'
        ? (trainer.drill?.name ?? t('Eröffnungstraining'))
        : imported
          ? `${imported.white} – ${imported.black}`
          : reviewing
            ? t('Partie-Auswertung')
            : t('Analyse')
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
    view === 'board' ? boardTitle : view === 'drill' ? drill?.title : view === 'setup' ? setupOpening?.name : view === 'editor' ? t('Brett-Editor') : null

  // Android's back button: closes what lies on top, else goes one page back, else leaves the app
  useEffect(
    () =>
      onBackButton(() => {
        if (document.querySelector('.modal-backdrop, .lesson-sheet')) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
          return true
        }
        const parent = back ?? SUB_PAGE_PARENT[view] ?? (view !== 'today' ? 'today' : null)
        if (!parent) return false
        setView(parent)
        return true
      }),
    [back, view],
  )

  return (
    <div className={`app view-${view}`}>
      <Nav tab={tab} onNavigate={navigate} onSettings={() => setDialog('settings')} onAccount={openAccount} />

      <header className="mobile-head">
        {back ? (
          <button className="icon-btn" onClick={() => setView(back)} aria-label={t('Zurück')}>
            <ChevronLeft size={24} />
          </button>
        ) : (
          <button className="brand" onClick={() => setView('today')} aria-label={t('{app}, zur Startseite', { app: APP_NAME })}>
            <Logo className="brand-mark" />
            <span className="brand-name">{APP_NAME}</span>
          </button>
        )}
        {headTitle && <b className="mobile-title">{headTitle}</b>}
        <div className="topbar-actions">
          {view === 'board' && (
            <button className="icon-btn" onClick={() => g.flip()} aria-label={t('Brett drehen')}>
              <ArrowUpDown size={20} />
            </button>
          )}
          <button className="icon-btn" onClick={() => setDialog('settings')} aria-label={t('Einstellungen')}>
            <SettingsIcon size={20} />
          </button>
          {account.status !== 'local' && (
            <button className="icon-btn account-btn" onClick={openAccount} aria-label={t('Konto')}>
              {account.email ? <span className="account-dot">{account.email.slice(0, 1).toUpperCase()}</span> : <UserRound size={20} />}
            </button>
          )}
        </div>
      </header>

      {view === 'play' && (
        <main className="page">
          <PlayPage
            level={level}
            running={running ? { fen: liveFen, orientation, label: t('{level} · Zug {n}', { level: levelOf(level).label, n: Math.ceil(plies.length / 2) }), onResume: () => setView('board') } : undefined}
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
            onRepertoire={() => setView('repertoire')}
          />
        </main>
      )}
      {view === 'repertoire' && (
        <main className="page">
          <RepertoirePage
            onBack={() => setView('analyse')}
            onTrain={(openingId, variation, side) => startTraining({ openingId, choice: variation, side, level, strict: true })}
            onImport={() => setView('analyse')}
          />
        </main>
      )}
      {view === 'rush' && (
        <main className="page">
          <RushPage onBack={() => setView('tactics')} />
        </main>
      )}
      {view === 'visual' && (
        <main className="page">
          <VisualPage onBack={() => setView('tactics')} />
        </main>
      )}
      {view === 'guess' && (
        <main className="page">
          <GuessPage onBack={() => setView('tactics')} />
        </main>
      )}
      {view === 'achievements' && (
        <main className="page">
          <AchievementsPage onBack={() => setView('today')} />
        </main>
      )}
      {view === 'courses' && (
        <main className="page">
          <CoursesPage onBack={() => setView('tactics')} onTrain={(theme) => void startPuzzles(theme, 5, 'courses')} />
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
            onCourses={() => setView('courses')}
            onMistakes={(ins) => startMistakes(ins, 5, 'tactics')}
            onWoodpecker={(fresh) => void startWoodpecker(fresh)}
            onEndgame={startEndgame}
            onRush={() => setView('rush')}
            onVisual={() => setView('visual')}
            onGuess={() => setView('guess')}
          />
        </main>
      )}
      {view === 'today' && (
        <main className="page">
          <TodayPage
            onStart={(t, ins) => void startTask(t, ins)}
            onOpenGame={openArchived}
            onDailyPuzzle={startDailyPuzzle}
            onLesson={startLesson}
            onAchievements={() => setView('achievements')}
          />
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
            <button className="icon-btn" onClick={() => g.flip()} aria-label={t('Brett drehen')} title={t('Brett drehen (F)')}>
              <ArrowUpDown size={18} />
            </button>
          </div>
          {/* a new key with each move, so the coach's bubble slides in again */}
          <div className="coach-slot" key={`${cursor}:${plies.length}:${retry?.status ?? ''}:${learnIntro}`}>
            {coach}
            {refining !== null && reviewing && (
              <div className="refining" title={t('Stockfish rechnet jede Stellung nochmal tiefer durch, die Bewertungen können sich noch leicht ändern')}>
                <span className="refining-bar" style={{ width: `${Math.round(refining * 100)}%` }} />
                <span>{t('Feinschliff {n} %', { n: Math.round(refining * 100) })}</span>
              </div>
            )}
          </div>

          {reviewing && progress === null && cursor === 0 && <Summary review={review} plies={gameReviewed} startFen={startFen} moves={gameLine} onJump={nav} />}
          {reviewing && progress === null && <EvalGraph review={review} cursor={Math.min(cursor, reviewed)} onJump={nav} />}

          {showLines && (
            <EngineLines fen={fen} analysis={analysis} final={final} onPlay={mode === 'analysis' ? (uci) => commit(uci) : undefined} />
          )}

          <MoveList startFen={startFen} plies={plies} cursor={cursor} reviews={reviewing ? review.moves.slice(0, reviewed) : []} sideFrom={g.sideline?.at} onJump={nav} />

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
      {dialog === 'ask' && <AskCoachDialog fen={fen} lines={analysis?.lines ?? []} moves={plies.slice(0, cursor).map((p) => p.san)} onClose={() => setDialog(null)} />}
      <LessonPrompt active={view === 'today' && g.onboarded && !dialog && !account.upgrade && !account.accountOpen} onStart={startLesson} />
      <AchievementToasts />
      {dialog === 'result' && outcome && (
        <ResultDialog
          outcome={outcome}
          playerColor={playerColor}
          opponentLevel={vsEngine && mode === 'play' ? level : undefined}
          onReview={startReview}
          onNew={openNew}
          rematchLabel={mode === 'training' || endgame ? t('Nochmal') : t('Revanche')}
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

/** Where Android's back button leads from the pages that have their own way back. */
const SUB_PAGE_PARENT: Partial<Record<View, View>> = { rush: 'tactics', visual: 'tactics', guess: 'tactics', courses: 'tactics', repertoire: 'analyse', achievements: 'today' }

const ASPECT_NAME: Record<Aspect, string> = {
  opening: tk('Eröffnung'),
  middlegame: tk('Mittelspiel'),
  endgame: tk('Endspiel'),
  tactics: tk('Taktik'),
  strategy: tk('Strategie'),
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
        <b>{t('Weiß')}</b>
        <span />
        <b>{t('Schwarz')}</b>
      </div>
      <div className="summary-row">
        <span>{t('Genauigkeit')}</span>
        <b className="acc white">{review.accuracy.white.toFixed(1)}</b>
        <span />
        <b className="acc black">{review.accuracy.black.toFixed(1)}</b>
      </div>
      <div className="summary-row elo-row" title={t('Geschätzt aus der Genauigkeit dieser einen Partie')}>
        <span>{t('Spielstärke')}</span>
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
        <span className="moments-title">{t('Partie nach Phasen')}</span>
        {ASPECT_ORDER.map((a) => {
          const w = report.white.aspects[a]
          const b = report.black.aspects[a]
          if (!w && !b) return null
          const cell = (x: typeof w) =>
            x ? (
              <span className="aspect-cell" title={tn(x.moves, '1 Zug', '{n} Züge')}>
                <Badge judgement={x.judgement} size={18} />
                <b>{Math.round(x.accuracy)}</b>
              </span>
            ) : (
              <span className="aspect-cell muted">–</span>
            )
          return (
            <div className="summary-row aspect-row" key={a}>
              <span>{t(ASPECT_NAME[a])}</span>
              {cell(w)}
              <span />
              {cell(b)}
            </div>
          )
        })}
      </div>
      {hasMoments && (
        <div className="moments">
          <span className="moments-title">{t('Schlüsselmomente')}</span>
          {moments.map(({ color, best, worst }) => (
            <div key={color} className="moments-row">
              <span className="muted">{color === 'white' ? t('Weiß') : t('Schwarz')}</span>
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
              {!best && !worst && <span className="muted small">{t('ohne große Fehler')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
