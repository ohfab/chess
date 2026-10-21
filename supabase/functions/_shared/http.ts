// CORS and JSON helpers shared by the edge functions.

const ALLOWED = (Deno.env.get('APP_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  // without a configured list every origin may call; the functions still require a login
  const allow = ALLOWED.length === 0 || ALLOWED.includes(origin) ? origin || '*' : ALLOWED[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders(req) }) : null)

/** A return address on one of the app's own origins, so checkout cannot redirect elsewhere. */
export function safeReturnUrl(candidate: unknown): string {
  const fallback = Deno.env.get('APP_URL') ?? 'http://localhost:5173/'
  if (typeof candidate !== 'string') return fallback
  try {
    const url = new URL(candidate)
    const allowed = [...ALLOWED, new URL(fallback).origin]
    return allowed.includes(url.origin) ? url.toString() : fallback
  } catch {
    return fallback
  }
}
