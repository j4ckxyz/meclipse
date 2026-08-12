const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RATE_LIMIT_PER_HOUR = 12
const COUNTER_KEY = 'meclipse:visitor-sessions:v1'

const RECORD_SCRIPT = `
local attempts = redis.call('INCR', KEYS[1])
if attempts == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
if attempts > tonumber(ARGV[2]) then
  return {0, redis.call('PFCOUNT', KEYS[2]), 1}
end
local added = redis.call('PFADD', KEYS[2], ARGV[1])
return {added, redis.call('PFCOUNT', KEYS[2]), 0}
`

export type VisitorStore = {
  record: (sessionId: string, rateKey: string) => Promise<{ count: number; rateLimited: boolean }>
}

type VisitorConfig = {
  store?: VisitorStore
  upstashUrl?: string
  upstashToken?: string
  hashSecret?: string
  countOffset?: number
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function clientAddress(request: Request): string {
  return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

async function hmac(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

function upstashStore(url: string, token: string): VisitorStore {
  return {
    async record(sessionId, rateKey) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', RECORD_SCRIPT, '2', rateKey, COUNTER_KEY, sessionId, String(RATE_LIMIT_PER_HOUR)]),
      })
      if (!response.ok) throw new Error(`Visitor store returned ${response.status}`)
      const payload = await response.json() as { result?: [number, number, number]; error?: string }
      if (payload.error || !Array.isArray(payload.result)) throw new Error(payload.error || 'Invalid visitor-store response')
      return { count: Number(payload.result[1]), rateLimited: Boolean(payload.result[2]) }
    },
  }
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export async function visitorsResponse(request: Request, config: VisitorConfig = {}): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not allowed.' }, 403)

  let body: { sessionId?: unknown }
  try {
    body = await request.json() as { sessionId?: unknown }
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  if (!SESSION_ID.test(sessionId)) return json({ error: 'Invalid session identifier.' }, 400)

  const store = config.store || (
    config.upstashUrl && config.upstashToken
      ? upstashStore(config.upstashUrl, config.upstashToken)
      : null
  )
  if (!store) return json({ available: false }, 503)

  try {
    const secret = config.hashSecret || config.upstashToken || 'meclipse-local-development'
    const addressHash = await hmac(clientAddress(request), secret)
    const result = await store.record(sessionId, `meclipse:visitor-rate:${addressHash}`)
    const offset = Number.isFinite(config.countOffset) ? Math.max(0, Math.floor(config.countOffset || 0)) : 0
    return json({
      available: true,
      count: result.count + offset,
      approximate: true,
      counted: !result.rateLimited,
    })
  } catch {
    return json({ available: false }, 503)
  }
}
