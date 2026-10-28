import { Engine, type Line } from '../engine/engine'
import { formatScore, whiteScore } from '../engine/useEngine'
import { isFinal, pvToSan, turnOf } from '../game/rules'
import { getLang, t, type Lang } from '../i18n/i18n'
import { callFunction, CloudError, cloudEnabled } from '../account/cloud'
import { bump } from '../progress/stats'
import { getSample } from './ai'

// Questions to the AI coach about one position. The coach gets the position, the moves so
// far and Stockfish's lines, and is told to explain from those lines instead of inventing
// its own analysis. Transport as for the daily plan (src/coach/ai.ts): the Enpixant backend
// for Pro members, the viewer's own Claude inside a claude.ai artifact, otherwise nothing.

export interface AskTurn {
  question: string
  answer: string
  /** key moves the coach points to, in SAN as in the engine lines */
  moves: string[]
}

export interface AskPosition {
  fen: string
  /** the game up to this position, SAN */
  moves: string[]
  lines: Line[]
}

/** How many earlier questions and answers go along as context. */
const HISTORY = 4

const WRITE_IN: Record<Lang, string> = {
  de: 'auf Deutsch (Du-Form)',
  en: 'auf Englisch (in English, addressing the player as "you")',
  fr: 'auf Französisch (en français, en tutoyant la personne)',
  it: 'auf Italienisch (in italiano, dando del tu)',
}

/** The facts the coach may use: whose move it is, the moves so far and the engine's lines from White's view. */
export function positionFacts({ fen, moves, lines }: AskPosition) {
  return {
    fen,
    sideToMove: turnOf(fen) === 'white' ? 'White' : 'Black',
    gameOver: isFinal(fen),
    movesSoFar: moves.join(' '),
    engineLines: lines.slice(0, 3).map((l) => ({
      evalForWhite: formatScore(whiteScore(l.score, fen)),
      depth: l.depth,
      line: pvToSan(fen, l.pv, 8).join(' '),
    })),
  }
}

const prompt = (facts: ReturnType<typeof positionFacts>, history: AskTurn[], question: string) =>
  [
    'Du bist ein erfahrener, freundlicher Schachtrainer in der Trainings-App Enpixant. Eine Person fragt dich zur Stellung auf ihrem Analysebrett.',
    'Grundlage sind die Stockfish-Linien unten (Bewertung aus Sicht von Weiß: + ist gut für Weiß). Stütze jede Aussage über Züge, Drohungen und Bewertungen auf diese Linien.',
    'Erfinde keine eigenen Varianten und keine Bewertungen. Wenn die Linien eine Frage nicht beantworten oder fehlen, sag das ehrlich und erkläre die allgemeinen Ideen der Stellung.',
    `Antworte ${WRITE_IN[getLang()]}, in 2 bis 5 kurzen Sätzen, konkret und ohne Floskeln. Schreib Züge so, wie sie in den Linien stehen.`,
    '',
    'Antworte nur mit JSON in dieser Form:',
    '{"answer": "deine Antwort", "moves": ["bis zu 3 Züge aus den Linien, um die es in der Antwort geht"]}',
    '',
    `Stellung: ${JSON.stringify(facts)}`,
    `Bisheriges Gespräch: ${JSON.stringify(history.map(({ question, answer }) => ({ question, answer })))}`,
    `Frage: ${question}`,
  ].join('\n')

interface Answer {
  answer?: unknown
  moves?: unknown
}

/** Asks the coach; resolves with its answer or throws a CloudError-like `{ code }`. */
export async function askCoach(position: AskPosition, history: AskTurn[], question: string): Promise<AskTurn> {
  const facts = positionFacts(position)
  const recent = history.slice(-HISTORY)
  let answer: Answer
  if (cloudEnabled) {
    answer = await callFunction<Answer>('coach', {
      kind: 'ask',
      position: facts,
      history: recent.map(({ question, answer }) => ({ question, answer })),
      question,
      lang: getLang(),
    })
  } else {
    const s = await getSample()
    if (!s) throw { code: 'not_granted' }
    answer = await s.json<Answer>(prompt(facts, recent, question), { modelTier: 'default', cache: false })
  }
  const text = typeof answer?.answer === 'string' ? answer.answer.trim() : ''
  if (!text) throw { code: 'invalid_json' }
  const moves = Array.isArray(answer.moves) ? answer.moves.filter((m): m is string => typeof m === 'string').slice(0, 3) : []
  bump('coachQuestions')
  return { question, answer: text, moves }
}

let engine: Engine | null = null

/**
 * Stockfish's three best lines for a position, for questions asked while the live engine is
 * off. A worker of its own, started on the first such question.
 */
export async function engineLines(fen: string): Promise<Line[]> {
  if (isFinal(fen)) return []
  engine ??= new Engine()
  let lines: Line[] = []
  await engine.search({ fen, go: 'depth 16 movetime 1500', options: { MultiPV: 3 }, onInfo: (info) => (lines = info.lines) })
  return lines
}

/** Whether this copy of the app can reach the coach at all. */
export const askAvailable = async () => cloudEnabled || !!(await getSample())

/** What to tell the player when the coach could not answer. */
export function askError(e: unknown) {
  const code = e instanceof CloudError ? e.code : (e as { code?: string })?.code
  switch (code) {
    case 'not_signed_in':
      return t('Melde dich an, um den Coach zu fragen.')
    case 'pro_required':
      return t('Fragen an den Coach gehören zu Pro.')
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
      return t('Der KI-Coach ist in dieser Version nicht verfügbar.')
    case 'rate_limited':
      return t('Für heute hast du genug gefragt. Morgen geht es weiter.')
    case 'too_large':
      return t('Die Frage ist zu lang. Fass sie kürzer.')
    case 'cancelled':
      return null
    default:
      return t('Der Coach hat gerade keine Antwort geliefert. Versuch es gleich nochmal.')
  }
}
