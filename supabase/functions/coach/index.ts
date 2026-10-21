// The AI coach for Pro members: Claude reads the player's numbers and today's candidate tasks
// and returns the day's plan. Body: { data, options, lang } as built by src/coach/ai.ts.
import Anthropic from 'npm:@anthropic-ai/sdk@1'
import { json, preflight } from '../_shared/http.ts'
import { admin, isPro, profileOf, userFrom } from '../_shared/supabase.ts'

const client = new Anthropic() // ANTHROPIC_API_KEY from the function's secrets
const MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-opus-5-5'
const DAILY_LIMIT = Number(Deno.env.get('COACH_DAILY_LIMIT') ?? 3)

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

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const user = await userFrom(req)
  if (!user) return json(req, { error: 'not_signed_in' }, 401)
  if (!isPro(await profileOf(user.id))) return json(req, { error: 'pro_required' }, 402)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || !Array.isArray(body.options)) return json(req, { error: 'bad_request' }, 400)
  const lang = typeof body.lang === 'string' && body.lang in WRITE_IN ? body.lang : 'de'
  const input = JSON.stringify({ data: body.data ?? {}, options: body.options })
  if (input.length > 30000) return json(req, { error: 'too_large' }, 413)

  const { data: allowed, error } = await admin.rpc('use_coach', { uid: user.id, daily_limit: DAILY_LIMIT })
  if (error) return json(req, { error: 'failed' }, 500)
  if (!allowed) return json(req, { error: 'rate_limited' }, 429)

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // a declined request is re-run on Anthropic's recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      system: system(lang),
      messages: [{ role: 'user', content: `Spielerdaten und Einheiten:\n${input}` }],
    })
    if (response.stop_reason === 'refusal') return json(req, { error: 'refused' }, 422)
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return json(req, { error: 'invalid_json' }, 502)
    return json(req, JSON.parse(text.text))
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(req, { error: 'rate_limited' }, 429)
    if (e instanceof Anthropic.APIError) {
      console.error('anthropic', e.status, e.message)
      return json(req, { error: 'upstream' }, 502)
    }
    if (e instanceof SyntaxError) return json(req, { error: 'invalid_json' }, 502)
    throw e
  }
})
