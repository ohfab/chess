// The AI coach for Pro members. Two kinds of request:
// - the day's plan: Claude reads the player's numbers and today's candidate tasks.
//   Body: { data, options, lang } as built by src/coach/ai.ts.
// - a question about a position: Body: { kind: 'ask', position, history, question, lang }
//   as built by src/coach/ask.ts; the answer must stay with the engine lines it gets.
import Anthropic from 'npm:@anthropic-ai/sdk@1'
import { json, preflight } from '../_shared/http.ts'
import { admin, isPro, profileOf, userFrom } from '../_shared/supabase.ts'

const client = new Anthropic() // ANTHROPIC_API_KEY from the function's secrets
const MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-opus-5-5'
const DAILY_LIMIT = Number(Deno.env.get('COACH_DAILY_LIMIT') ?? 3)
const ASK_LIMIT = Number(Deno.env.get('COACH_ASK_LIMIT') ?? 30)

/** The app's languages and how the coach is told to write in them (same list as src/coach/ai.ts). */
const WRITE_IN: Record<string, string> = {
  de: 'auf Deutsch (Du-Form)',
  en: 'auf Englisch (in English, addressing the player as "you")',
  fr: 'auf Französisch (en français, en tutoyant la personne)',
  it: 'auf Italienisch (in italiano, dando del tu)',
}

const system = (lang: string) =>
  [
    'Du bist ein erfahrener, freundlicher Schachtrainer in der Trainings-App Rookly.',
    'Du bekommst die Zahlen aus den von Stockfish ausgewerteten Partien einer Person und die Trainingseinheiten, die die App heute anbieten kann.',
    'Stelle daraus das Training für heute zusammen: 3 bis 5 Einheiten in sinnvoller Reihenfolge, die genau an den größten Schwächen ansetzen.',
    'Sprich die Person direkt an, konkret und ohne Floskeln. Nutze nur die gegebenen Zahlen, erfinde keine.',
    `Schreibe alle Texte (summary, focus, reason) ${WRITE_IN[lang] ?? WRITE_IN.de}.`,
    'summary: 2 bis 3 Sätze, wie die Person spielt und woran es heute geht. focus: höchstens 3 Schwächen mit einem konkreten Denk-Tipp. plan: nur ids aus der Liste der Einheiten.',
  ].join('\n')

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    focus: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, why: { type: 'string' }, tip: { type: 'string' } },
        required: ['title', 'why', 'tip'],
        additionalProperties: false,
      },
    },
    plan: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, reason: { type: 'string' } },
        required: ['id', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'focus', 'plan'],
  additionalProperties: false,
}

const askSystem = (lang: string) =>
  [
    'Du bist ein erfahrener, freundlicher Schachtrainer in der Trainings-App Rookly. Eine Person fragt dich zur Stellung auf ihrem Analysebrett.',
    'Du bekommst die Stellung (FEN), die Züge bis dahin und die besten Stockfish-Linien (Bewertung aus Sicht von Weiß: + ist gut für Weiß).',
    'Stütze jede Aussage über Züge, Drohungen und Bewertungen auf diese Linien. Erfinde keine eigenen Varianten und keine Bewertungen.',
    'Wenn die Linien eine Frage nicht beantworten oder fehlen, sag das ehrlich und erkläre die allgemeinen Ideen der Stellung.',
    `Antworte ${WRITE_IN[lang] ?? WRITE_IN.de}, in 2 bis 5 kurzen Sätzen, konkret und ohne Floskeln. Schreib Züge so, wie sie in den Linien stehen.`,
    'answer: deine Antwort. moves: bis zu 3 Züge aus den Linien, um die es in der Antwort geht.',
  ].join('\n')

const ASK_SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'string' }, moves: { type: 'array', items: { type: 'string' } } },
  required: ['answer', 'moves'],
  additionalProperties: false,
}

/** One structured answer from Claude, or the error code and HTTP status to report instead. */
async function structured(system: string, content: string, schema: Record<string, unknown>, maxTokens: number): Promise<{ data: unknown } | { error: string; status: number }> {
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // a declined request is re-run on Anthropic's recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content }],
    })
    if (response.stop_reason === 'refusal') return { error: 'refused', status: 422 }
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return { error: 'invalid_json', status: 502 }
    return { data: JSON.parse(text.text) }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { error: 'rate_limited', status: 429 }
    if (e instanceof Anthropic.APIError) {
      console.error('anthropic', e.status, e.message)
      return { error: 'upstream', status: 502 }
    }
    if (e instanceof SyntaxError) return { error: 'invalid_json', status: 502 }
    throw e
  }
}

const reply = (req: Request, result: { data: unknown } | { error: string; status: number }) =>
  'data' in result ? json(req, result.data) : json(req, { error: result.error }, result.status)

/** A question about a position, with up to four earlier questions and answers as context. */
async function ask(req: Request, userId: string, body: Record<string, unknown>, lang: string) {
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question || typeof body.position !== 'object' || body.position === null) return json(req, { error: 'bad_request' }, 400)
  if (question.length > 600) return json(req, { error: 'too_large' }, 413)
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-4)
    .map((h) => ({ question: String(h?.question ?? '').slice(0, 600), answer: String(h?.answer ?? '').slice(0, 2000) }))
  const input = JSON.stringify({ position: body.position, history })
  if (input.length > 20000) return json(req, { error: 'too_large' }, 413)

  const { data: allowed, error } = await admin.rpc('use_coach_ask', { uid: userId, daily_limit: ASK_LIMIT })
  if (error) return json(req, { error: 'failed' }, 500)
  if (!allowed) return json(req, { error: 'rate_limited' }, 429)

  return reply(req, await structured(askSystem(lang), `Stellung und bisheriges Gespräch:\n${input}\n\nFrage: ${question}`, ASK_SCHEMA, 4000))
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const user = await userFrom(req)
  if (!user) return json(req, { error: 'not_signed_in' }, 401)
  if (!isPro(await profileOf(user.id))) return json(req, { error: 'pro_required' }, 402)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return json(req, { error: 'bad_request' }, 400)
  const lang = typeof body.lang === 'string' && body.lang in WRITE_IN ? body.lang : 'de'
  if (body.kind === 'ask') return ask(req, user.id, body, lang)
  if (!Array.isArray(body.options)) return json(req, { error: 'bad_request' }, 400)
  const input = JSON.stringify({ data: body.data ?? {}, options: body.options })
  if (input.length > 30000) return json(req, { error: 'too_large' }, 413)

  const { data: allowed, error } = await admin.rpc('use_coach', { uid: user.id, daily_limit: DAILY_LIMIT })
  if (error) return json(req, { error: 'failed' }, 500)
  if (!allowed) return json(req, { error: 'rate_limited' }, 429)

  return reply(req, await structured(system(lang), `Spielerdaten und Einheiten:\n${input}`, PLAN_SCHEMA, 16000))
})
