// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { visitorsResponse, type VisitorStore } from './visitors'

const FIRST_SESSION = 'ddf8d866-3936-4dc7-91ec-b78f0b7485ef'
const SECOND_SESSION = '752bc749-8124-43bb-bdfa-5b26093ca173'

function memoryStore(): VisitorStore {
  const sessions = new Set<string>()
  return {
    record: vi.fn(async (sessionId) => {
      sessions.add(sessionId)
      return { count: sessions.size, rateLimited: false }
    }),
  }
}

function request(sessionId: string, headers: HeadersInit = {}): Request {
  return new Request('https://meclipse.test/api/visitors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ sessionId }),
  })
}

describe('visitorsResponse', () => {
  it('counts a session once even when the page is refreshed', async () => {
    const store = memoryStore()
    const first = await visitorsResponse(request(FIRST_SESSION), { store, hashSecret: 'test-secret' })
    const refresh = await visitorsResponse(request(FIRST_SESSION), { store, hashSecret: 'test-secret' })
    const nextSession = await visitorsResponse(request(SECOND_SESSION), { store, hashSecret: 'test-secret' })

    expect(await first.json()).toMatchObject({ count: 1, approximate: true })
    expect(await refresh.json()).toMatchObject({ count: 1, approximate: true })
    expect(await nextSession.json()).toMatchObject({ count: 2, approximate: true })
  })

  it('passes only an irreversible address bucket to the rate limiter', async () => {
    const store = memoryStore()
    await visitorsResponse(request(FIRST_SESSION, { 'x-vercel-forwarded-for': '203.0.113.42' }), {
      store,
      hashSecret: 'test-secret',
    })

    const rateKey = vi.mocked(store.record).mock.calls[0][1]
    expect(rateKey).toMatch(/^meclipse:visitor-rate:[0-9a-f]{24}$/)
    expect(rateKey).not.toContain('203.0.113.42')
  })

  it('rejects malformed identifiers and cross-site submissions', async () => {
    const store = memoryStore()
    const malformed = await visitorsResponse(request('not-a-session'), { store })
    const crossSite = await visitorsResponse(request(FIRST_SESSION, { Origin: 'https://attacker.test' }), { store })

    expect(malformed.status).toBe(400)
    expect(crossSite.status).toBe(403)
    expect(store.record).not.toHaveBeenCalled()
  })

  it('fails quietly when persistent storage has not been configured', async () => {
    const response = await visitorsResponse(request(FIRST_SESSION))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ available: false })
  })
})
