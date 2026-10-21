import { levelOf } from '../engine/levels'
import { MOTIFS, PHASE_NAMES, type Insights, type Phase } from './insights'
import { today, type DailyPlan, type PlanTask } from './plan'

// The AI coach: Claude reads the player's numbers and the candidate tasks and writes
// the day's plan. It runs through the claude.ai artifact runtime (`sample`), which
// asks the viewer once and uses their own Claude account; elsewhere it is simply absent.

interface SampleOptions {
  modelTier?: 'quick' | 'default' | 'complex'
  cache?: boolean | { gcTime?: number; refresh?: boolean }
  signal?: AbortSignal
}
interface Sample {
  json<T>(input: string, options?: SampleOptions): Promise<T>
}
interface ClaudeRuntime {
  use(name: 'sample'): Promise<Sample | null>
}

let sample: Promise<Sample | null> | null = null

/** The sampling function, or null outside a Claude viewer. */
export function getSample() {
  const runtime = (window as unknown as { claude?: ClaudeRuntime }).claude
  sample ??= runtime?.use ? runtime.use('sample').catch(() => null) : Promise.resolve(null)
  return sample
}

interface Answer {
  summary?: unknown
  focus?: unknown
  plan?: unknown
}

const DAY = 24 * 60 * 60 * 1000

export async function aiPlan(
  ins: Insights,
  tasks: PlanTask[],
  ctx: { level: number; puzzleRating: number; streak: number },
  refresh: boolean,
): Promise<DailyPlan> {
  const s = await getSample()
  if (!s) throw { code: 'not_granted' }

  const phases = (Object.keys(ins.phases) as Phase[]).map((p) => ({
    phase: PHASE_NAMES[p],
    moves: ins.phases[p].moves,
    errorRate: `${Math.round(ins.phases[p].rate * 1000) / 10} %`,
  }))
  const data = {
    games: ins.games,
    reviewedGames: ins.reviewed,
    results: ins.results,
    accuracy: {
      average: ins.accuracy.average?.toFixed(1),
      last5: ins.accuracy.recent?.toFixed(1),
      previous5: ins.accuracy.previous?.toFixed(1),
    },
    errorsByPhase: phases,
    recurringPatterns: ins.motifs.map((m) => ({ pattern: MOTIFS[m.motif].name, count: m.count })),
    openings: ins.openings.slice(0, 6),
    recentMistakes: ins.mistakes.slice(0, 8).map((m) => ({
      phase: PHASE_NAMES[m.phase],
      played: m.san,
      expectedScoreLost: `${Math.round(m.loss * 100)} %`,
      patterns: m.motifs.map((x) => MOTIFS[x].name),
    })),
    opponentLevel: levelOf(ctx.level).label,
    puzzleRating: ctx.puzzleRating,
    streakDays: ctx.streak,
  }
  const options = tasks.map((t) => ({ id: t.id, title: t.title, facts: t.reason }))

  const prompt = [
    'Du bist ein erfahrener, freundlicher Schachtrainer. Du sprichst mit einer Person, die täglich mit einer App trainiert.',
    'Unten stehen die Zahlen aus ihren von Stockfish ausgewerteten Partien und die Trainingseinheiten, die die App heute anbieten kann.',
    'Stelle daraus das Training für heute zusammen: wähle 3 bis 5 Einheiten in sinnvoller Reihenfolge, die genau an den größten Schwächen ansetzen.',
    'Sprich die Person direkt an (Du-Form), auf Deutsch, konkret und ohne Floskeln. Erfinde keine Zahlen, nutze nur die gegebenen.',
    '',
    'Antworte nur mit JSON in dieser Form:',
    '{"summary": "2-3 Sätze: wie du spielst und woran es heute geht", "focus": [{"title": "kurzer Name der Schwäche", "why": "woran man es in seinen Partien sieht", "tip": "ein konkreter Denk-Tipp für die nächste Partie"}], "plan": [{"id": "eine id aus den Einheiten", "reason": "ein Satz, warum heute"}]}',
    'focus: höchstens 3 Einträge. plan: nur ids aus der Liste unten.',
    '',
    `Spielerdaten: ${JSON.stringify(data)}`,
    `Einheiten: ${JSON.stringify(options)}`,
  ].join('\n')

  const answer = await s.json<Answer>(prompt, { modelTier: 'default', cache: { gcTime: DAY, refresh } })
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const plan = Array.isArray(answer.plan) ? answer.plan : []
  const picked: PlanTask[] = []
  for (const entry of plan) {
    const id = typeof entry?.id === 'string' ? entry.id : ''
    const task = byId.get(id)
    if (!task || picked.includes(task)) continue
    picked.push({ ...task, reason: typeof entry.reason === 'string' && entry.reason ? entry.reason : task.reason })
  }
  if (picked.length === 0) throw { code: 'invalid_json' }
  const focus = (Array.isArray(answer.focus) ? answer.focus : [])
    .slice(0, 3)
    .map((f) => ({ title: String(f?.title ?? ''), why: String(f?.why ?? ''), tip: String(f?.tip ?? '') }))
    .filter((f) => f.title)
  return {
    date: today(),
    tasks: picked.slice(0, 5),
    summary: typeof answer.summary === 'string' ? answer.summary : '',
    focus,
    byAI: true,
  }
}

/** What to tell the player when the coach could not answer. */
export function aiError(e: unknown) {
  const code = (e as { code?: string })?.code
  switch (code) {
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
      return 'Der KI-Coach ist hier nicht verfügbar. Der Plan unten kommt aus der eigenen Auswertung.'
    case 'rate_limited':
      return 'Gerade zu viele Anfragen. Versuch es später nochmal.'
    case 'cancelled':
      return null
    default:
      return 'Der Coach hat gerade keine Antwort geliefert. Versuch es gleich nochmal.'
  }
}
