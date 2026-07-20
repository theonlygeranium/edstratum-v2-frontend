import { expect, test } from '@playwright/test'

import { onRequest as middleware } from '../functions/_middleware'
import { onRequestGet as config } from '../functions/api/config'
import { onRequestGet as health } from '../functions/api/health'

class MemoryKV {
  private values = new Map<string, string>()

  async get(key: string, options?: { type?: 'json' | 'text' }) {
    const value = this.values.get(key) ?? null
    if (options?.type === 'json') {
      return value ? JSON.parse(value) : null
    }
    return value
  }

  async put(key: string, value: string) {
    this.values.set(key, value)
  }
}

const originalFetch = globalThis.fetch
const originalDateNow = Date.now

test.afterEach(() => {
  globalThis.fetch = originalFetch
  Date.now = originalDateNow
})

test('GET /api/health returns 200 with backend status object', async () => {
  globalThis.fetch = async () =>
    Response.json({
      status: 'healthy',
      stratum: 'online',
      backend_enabled: true,
    })

  const response = await health({
    env: { RAILWAY_API_URL: 'https://railway.example' },
    request: new Request('https://edstratumlabs.ai/api/health'),
  } as never)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    status: 'healthy',
    stratum: 'online',
    backend_enabled: true,
  })
})

test('GET /api/config returns runtime config object', async () => {
  const kv = new MemoryKV()
  await kv.put(
    'runtime',
    JSON.stringify({
      ragEnabled: true,
      voiceEnabled: false,
      persistenceEnabled: true,
      maxIntakeQuestions: 7,
    }),
  )

  const response = await config({
    env: { STRATUM_CONFIG: kv },
  } as never)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    ragEnabled: true,
    voiceEnabled: false,
    persistenceEnabled: true,
    maxIntakeQuestions: 7,
  })
})

test('GET /api/config falls back when KV is absent or malformed', async () => {
  const fallback = await config({ env: {} } as never)
  expect(await fallback.json()).toEqual({
    ragEnabled: true,
    voiceEnabled: false,
    persistenceEnabled: false,
    maxIntakeQuestions: 6,
  })

  const kv = new MemoryKV()
  await kv.put(
    'runtime',
    JSON.stringify({
      ragEnabled: false,
      voiceEnabled: true,
      persistenceEnabled: true,
      maxIntakeQuestions: 99,
    }),
  )

  const malformed = await config({
    env: { STRATUM_CONFIG: kv },
  } as never)
  expect(await malformed.json()).toEqual({
    ragEnabled: false,
    voiceEnabled: true,
    persistenceEnabled: true,
    maxIntakeQuestions: 6,
  })
})

test('rate limiter returns 429 after 60 rapid requests', async () => {
  Date.now = () => 1_800_000
  const kv = new MemoryKV()
  const next = async () => new Response('ok', { status: 200 })

  for (let index = 0; index < 60; index += 1) {
    const response = await middleware({
      env: { RATE_LIMIT: kv },
      request: new Request('https://edstratumlabs.ai/api/config', {
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
      }),
      next,
    } as never)
    expect(response.status).toBe(200)
  }

  const limited = await middleware({
    env: { RATE_LIMIT: kv },
    request: new Request('https://edstratumlabs.ai/api/config', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    }),
    next,
  } as never)

  expect(limited.status).toBe(429)
  expect(limited.headers.get('Retry-After')).toBe('60')
  expect(await limited.json()).toEqual({ error: 'rate_limited' })
})

test('X-Stratum-Session header is forwarded to upstream', async () => {
  let forwardedSession: string | null = null
  let forwardedUrl = ''
  globalThis.fetch = async (input, init) => {
    forwardedUrl = String(input)
    forwardedSession = new Headers(init?.headers).get('X-Stratum-Session')
    return Response.json({ status: 'healthy' })
  }

  await health({
    env: { RAILWAY_API_URL: 'https://railway.example/' },
    request: new Request('https://edstratumlabs.ai/api/health', {
      headers: { 'X-Stratum-Session': 'session-123' },
    }),
  } as never)

  expect(forwardedUrl).toBe('https://railway.example/api/health')
  expect(forwardedSession).toBe('session-123')
})

test('cached health response has Cache-Control header', async () => {
  globalThis.fetch = async () => Response.json({ status: 'healthy' })

  const response = await health({
    env: { RAILWAY_API_URL: 'https://railway.example' },
    request: new Request('https://edstratumlabs.ai/api/health'),
  } as never)

  expect(response.headers.get('Cache-Control')).toBe('public, max-age=30')
})
