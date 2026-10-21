import { levelOf } from '../engine/levels'
import { getLang, t, type Lang } from '../i18n/i18n'
import { MOTIFS, PHASE_NAMES, type Insights, type Phase } from './insights'
import { today, type DailyPlan, type PlanTask } from './plan'

// The AI coach: Claude reads the player's numbers and the candidate tasks and writes
// the day's plan. With the Rookly backend it runs on the server for Pro members
// (supabase/functions/coach); inside a claude.ai artifact it uses the viewer's own
// Claude account through the runtime's `sample`; elsewhere it is absent.
import { callFunction, CloudError, cloudEnabled } from '../account/cloud'

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

/** Whether this copy of the app can ask the AI coach at all. */
export const coachAvailable = async () => cloudEnabled || !!(await getSample())

interface Answer {
  summary?: unknown
  focus?: unknown
  plan?: unknown
}

const DAY = 24 * 60 * 60 * 1000

/** How the coach is told which language to write in; the server function has the same list. */
const WRITE_IN: Record<Lang, string> = {
  de: 'auf Deutsch (Du-Form)',
  en: 'auf Englisch (in English, addressing the player as "you")',
  fr: 'auf Französisch (en français, en tutoyant la personne)',
  it: 'auf Italienisch (in italiano, dando del tu)',
}

export async function aiPlan(
  ins: Insights,
  tasks: PlanTask[],
  ctx: { level: number; puzzleRating: number; streak: number },
  refresh: boolean,
): Promise<DailyPlan> {
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
    'Sprich die Person direkt an, konkret und ohne Floskeln. Erfinde keine Zahlen, nutze nur die gegebenen.',
    `Schreibe alle Texte (summary, focus, reason) ${WRITE_IN[getLang()]}.`,
    '',
    'Antworte nur mit JSON in dieser Form:',
    '{"summary": "2-3 Sätze: wie du spielst und woran es heute geht", "focus": [{"title": "kurzer Name der Schwäche", "why": "woran man es in seinen Partien sieht", "tip": "ein konkreter Denk-Tipp für die nächste Partie"}], "plan": [{"id": "eine id aus den Einheiten", "reason": "ein Satz, warum heute"}]}',
    'focus: höchstens 3 Einträge. plan: nur ids aus der Liste unten.',
    '',
    `Spielerdaten: ${JSON.stringify(data)}`,
    `Einheiten: ${JSON.stringify(options)}`,
  ].join('\n')

  let answer: Answer
  if (cloudEnabled) answer = await callFunction<Answer>('coach', { data, options, lang: getLang() })
  else {
    const s = await getSample()
    if (!s) throw { code: 'not_granted' }
    answer = await s.json<Answer>(prompt, { modelTier: 'default', cache: { gcTime: DAY, refresh } })
  }
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
  const code = e instanceof CloudError ? e.code : (e as { code?: string })?.code
  switch (code) {
    case 'not_signed_in':
      return t('Melde dich an, um den KI-Coach zu nutzen.')
    case 'pro_required':
      return t('Der KI-Coach gehört zu Pro.')
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
      return t('Der KI-Coach ist hier nicht verfügbar. Der Plan unten kommt aus der eigenen Auswertung.')
    case 'rate_limited':
      return t('Der Coach hat heute schon genug geplant. Morgen gibt es einen neuen Plan.')
    case 'cancelled':
      return null
    default:
      return t('Der Coach hat gerade keine Antwort geliefert. Versuch es gleich nochmal.')
  }
}
