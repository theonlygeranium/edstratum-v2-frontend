import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

import { onRequest as middleware } from '../functions/_middleware'
import {
  onRequestOptions as chatOptions,
  onRequestPost as chat,
} from '../functions/api/chat'
import { onRequestGet as config } from '../functions/api/config'
import { onRequestPost as escalate } from '../functions/api/escalate'
import {
  onRequestOptions as analyticsOptions,
  onRequestPost as analytics,
} from '../functions/api/analytics'
import { onRequestGet as health } from '../functions/api/health'
import { onRequest as sessions } from '../functions/api/sessions/[[route]]'
import { onRequestPost as tts } from '../functions/api/tts'
import { stratumApiUrlForRuntime } from '../src/stratum/stratumConfig'

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

  entries() {
    return [...this.values.entries()]
  }
}

/**
 * In-memory mock for the Cloudflare Cache API (`caches.default`).
 * The rate-limit middleware reads/writes counters via `cache.match()` and
 * `cache.put()` using synthetic Request objects as keys. This mock reproduces
 * that contract so unit tests can exercise the middleware without a real
 * Workers runtime.
 */
class MemoryCache {
  private entries = new Map<string, Response>()

  async match(request: Request): Promise<Response | undefined> {
    const stored = this.entries.get(request.url)
    if (stored) {
      // Return a clone so callers can independently consume the body
      return new Response(stored.body, {
        status: stored.status,
        statusText: stored.statusText,
        headers: stored.headers,
      })
    }
    return undefined
  }

  async put(request: Request, response: Response): Promise<void> {
    // Clone the response body so it can be read multiple times
    const body = await response.text()
    this.entries.set(request.url, new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }))
  }
}

/**
 * Install a `caches` global with a `default` MemoryCache instance.
 * Must be called before any middleware test that exercises the rate limiter,
 * since the middleware accesses `caches.default` at runtime.
 */
function installCacheApi() {
  const cache = new MemoryCache()
  const cachesMock = { default: cache }
  ;(globalThis as unknown as { caches: unknown }).caches = cachesMock
  return cache
}

interface SessionRow {
  id: string
  created_at: number
  last_active: number
  escalated: number
  intake_complete: number
}

interface MessageRow {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations_json: string | null
  created_at: number
}

class MemoryD1Statement {
  private values: unknown[] = []

  constructor(
    private db: MemoryD1,
    private query: string,
  ) {}

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async first<T>() {
    this.db.calls.push({ query: this.query, values: this.values })
    if (this.query.startsWith('SELECT id FROM sessions WHERE id = ?')) {
      const session = this.db.sessions.get(String(this.values[0]))
      return (session ? { id: session.id } : null) as T | null
    }

    return null
  }

  async all<T>() {
    this.db.calls.push({ query: this.query, values: this.values })
    if (this.query.startsWith('SELECT id, role, content, citations_json, created_at FROM messages')) {
      const sessionId = String(this.values[0])
      return {
        results: [...this.db.messages.values()]
          .filter((message) => message.session_id === sessionId)
          .sort((left, right) => left.created_at - right.created_at)
          .map(({ session_id: _sessionId, ...message }) => message),
      } as T
    }

    return { results: [] } as T
  }

  async run() {
    this.db.calls.push({ query: this.query, values: this.values })

    if (this.query.startsWith('INSERT INTO sessions')) {
      const [id, createdAt, lastActive] = this.values
      this.db.sessions.set(String(id), {
        id: String(id),
        created_at: Number(createdAt),
        last_active: Number(lastActive),
        escalated: 0,
        intake_complete: 0,
      })
    }

    if (this.query.startsWith('INSERT OR IGNORE INTO sessions')) {
      const [id, createdAt, lastActive] = this.values
      if (!this.db.sessions.has(String(id))) {
        this.db.sessions.set(String(id), {
          id: String(id),
          created_at: Number(createdAt),
          last_active: Number(lastActive),
          escalated: 0,
          intake_complete: 0,
        })
      }
    }

    if (this.query === 'UPDATE sessions SET last_active = ? WHERE id = ?') {
      const [lastActive, id] = this.values
      const session = this.db.sessions.get(String(id))
      if (session) {
        session.last_active = Number(lastActive)
      }
    }

    if (this.query.startsWith('INSERT OR REPLACE INTO messages')) {
      const [id, sessionId, role, content, citationsJson, createdAt] = this.values
      this.db.messages.set(String(id), {
        id: String(id),
        session_id: String(sessionId),
        role: role as MessageRow['role'],
        content: String(content),
        citations_json: citationsJson === null ? null : String(citationsJson),
        created_at: Number(createdAt),
      })
    }

    if (this.query.startsWith('UPDATE sessions SET') && this.query !== 'UPDATE sessions SET last_active = ? WHERE id = ?') {
      const sessionId = String(this.values[this.values.length - 1])
      const session = this.db.sessions.get(sessionId)
      if (session) {
        let valueIndex = 0
        session.last_active = Number(this.values[valueIndex])
        valueIndex += 1
        if (this.query.includes('escalated = ?')) {
          session.escalated = Number(this.values[valueIndex])
          valueIndex += 1
        }
        if (this.query.includes('intake_complete = ?')) {
          session.intake_complete = Number(this.values[valueIndex])
        }
      }
    }

    if (this.query === 'DELETE FROM messages WHERE session_id = ?') {
      const sessionId = String(this.values[0])
      for (const [id, message] of this.db.messages) {
        if (message.session_id === sessionId) {
          this.db.messages.delete(id)
        }
      }
    }

    if (this.query === 'DELETE FROM sessions WHERE id = ?') {
      this.db.sessions.delete(String(this.values[0]))
    }

    if (this.query.startsWith('DELETE FROM messages WHERE session_id IN')) {
      const cutoff = Number(this.values[0])
      const expired = new Set(
        [...this.db.sessions.values()]
          .filter((session) => session.last_active < cutoff)
          .map((session) => session.id),
      )
      for (const [id, message] of this.db.messages) {
        if (expired.has(message.session_id)) {
          this.db.messages.delete(id)
        }
      }
    }

    if (this.query === 'DELETE FROM sessions WHERE last_active < ?') {
      const cutoff = Number(this.values[0])
      for (const [id, session] of this.db.sessions) {
        if (session.last_active < cutoff) {
          this.db.sessions.delete(id)
        }
      }
    }

    return { success: true }
  }
}

class MemoryD1 {
  sessions = new Map<string, SessionRow>()
  messages = new Map<string, MessageRow>()
  calls: Array<{ query: string; values: unknown[] }> = []

  prepare(query: string) {
    return new MemoryD1Statement(this, query)
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
    maxIntakeQuestions: 7,
  })

  const kv = new MemoryKV()
  await kv.put(
    'runtime',
    JSON.stringify({
      ragEnabled: false,
      voiceEnabled: true,
      persistenceEnabled: true,
      maxIntakeQuestions: 6,
    }),
  )

  const malformed = await config({
    env: { STRATUM_CONFIG: kv },
  } as never)
  expect(await malformed.json()).toEqual({
    ragEnabled: false,
    voiceEnabled: true,
    persistenceEnabled: true,
    maxIntakeQuestions: 7,
  })
})

test('security headers allow same-origin microphone only for voice readiness', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')

  expect(headers).toContain('Permissions-Policy:')
  expect(headers).toContain('microphone=(self)')
  expect(headers).not.toContain('microphone=()')
})

test('static asset misses cannot fall through to SPA index HTML', () => {
  const redirectsPath = new URL('../public/_redirects', import.meta.url)
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
  const notFound = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8')

  expect(existsSync(redirectsPath)).toBe(false)
  expect(headers).not.toMatch(/^\/assets\/\*/m)
  expect(notFound).toContain('Page Not Found')
})

test('rate limiter returns 429 after 60 rapid requests', async () => {
  Date.now = () => 1_800_000
  const kv = new MemoryKV()
  const next = async () => new Response('ok', { status: 200 })
  // The middleware reads/writes the edge Cache API (caches.default) for
  // instant per-colo counter reads. Install an in-memory mock so the test
  // exercises the same code path as production.
  installCacheApi()
  // The middleware calls context.waitUntil() for the background KV persist.
  const waitUntil = async (promise: Promise<unknown>) => { await promise }

  for (let index = 0; index < 60; index += 1) {
    const response = await middleware({
      env: { RATE_LIMIT: kv },
      request: new Request('https://edstratumlabs.ai/api/config', {
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
      }),
      next,
      waitUntil,
    } as never)
    expect(response.status).toBe(200)
  }

  const limited = await middleware({
    env: { RATE_LIMIT: kv },
    request: new Request('https://edstratumlabs.ai/api/config', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    }),
    next,
    waitUntil,
  } as never)

  expect(limited.status).toBe(429)
  expect(limited.headers.get('Retry-After')).toBe('60')
  expect(await limited.json()).toEqual({ error: 'rate_limited' })
})

test('POST /api/analytics fails closed when analytics storage is unbound', async () => {
  let upstreamCalls = 0
  globalThis.fetch = async () => {
    upstreamCalls += 1
    return Response.json({})
  }

  const response = await analytics({
    env: {},
    request: new Request('https://edstratumlabs.ai/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          event: 'chatbot_opened',
          session: 'analytics-session',
          ts: 1_800_000,
        },
      ]),
    }),
  } as never)

  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ error: 'analytics_not_configured' })
  expect(upstreamCalls).toBe(0)
})

test('POST /api/analytics records aggregate counters only', async () => {
  Date.now = () => Date.parse('2026-07-20T12:00:00Z')
  const kv = new MemoryKV()

  const response = await analytics({
    env: { ANALYTICS_EVENTS: kv },
    request: new Request('https://edstratumlabs.ai/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          event: 'chatbot_opened',
          session: 'analytics-session',
          ts: 1_800_000,
          properties: {
            content: 'Do not store this conversation text',
          },
        },
        {
          event: 'first_message_sent',
          session: 'analytics-session',
          ts: 1_800_001,
          properties: {
            mode: 'open',
            source: 'manual_submit',
            prompt: 'Do not store my prompt',
          },
        },
        {
          event: 'handoff_intent',
          session: 'analytics-session',
          ts: 1_800_002,
          properties: {
            trigger: 'explicit',
          },
        },
      ]),
    }),
  } as never)

  expect(response.status).toBe(202)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ ok: true, count: 3 })

  const entries = Object.fromEntries(kv.entries())
  expect(JSON.parse(entries['analytics:v1:daily:2026-07-20:event:chatbot_opened'])).toEqual({
    count: 1,
    updatedAt: Date.parse('2026-07-20T12:00:00Z'),
  })
  expect(JSON.parse(entries['analytics:v1:daily:2026-07-20:event:first_message_sent'])).toMatchObject({
    count: 1,
  })
  expect(JSON.parse(entries['analytics:v1:daily:2026-07-20:property:first_message_sent:mode:open'])).toMatchObject({
    count: 1,
  })
  expect(JSON.parse(entries['analytics:v1:daily:2026-07-20:property:first_message_sent:source:manual_submit'])).toMatchObject({
    count: 1,
  })
  expect(JSON.parse(entries['analytics:v1:daily:2026-07-20:property:handoff_intent:trigger:explicit'])).toMatchObject({
    count: 1,
  })
  expect(JSON.stringify(entries)).not.toContain('conversation text')
  expect(JSON.stringify(entries)).not.toContain('Do not store my prompt')
  expect(JSON.stringify(entries)).not.toContain('analytics-session')
})

test('POST /api/analytics rejects malformed and unsafe payloads', async () => {
  const kv = new MemoryKV()

  const invalidJson = await analytics({
    env: { ANALYTICS_EVENTS: kv },
    request: new Request('https://edstratumlabs.ai/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }),
  } as never)

  expect(invalidJson.status).toBe(400)
  expect(await invalidJson.json()).toEqual({ error: 'invalid_analytics_payload' })

  const unknownEvent = await analytics({
    env: { ANALYTICS_EVENTS: kv },
    request: new Request('https://edstratumlabs.ai/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          event: 'message_text',
          session: 'analytics-session',
          ts: 1_800_000,
        },
      ]),
    }),
  } as never)

  expect(unknownEvent.status).toBe(400)
  expect(await unknownEvent.json()).toEqual({ error: 'invalid_analytics_event' })

  const oversizedBatch = await analytics({
    env: { ANALYTICS_EVENTS: kv },
    request: new Request('https://edstratumlabs.ai/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.from({ length: 21 }, () => ({
        event: 'chatbot_opened',
        session: 'analytics-session',
        ts: 1_800_000,
      }))),
    }),
  } as never)

  expect(oversizedBatch.status).toBe(413)
  expect(await oversizedBatch.json()).toEqual({ error: 'analytics_batch_too_large' })
  expect(kv.entries()).toHaveLength(0)
})

test('POST /api/analytics returns 503 when storage write fails', async () => {
  class ThrowingKV extends MemoryKV {
    override async put() {
      throw new Error('storage unavailable')
    }
  }

  const response = await analytics({
    env: { ANALYTICS_EVENTS: new ThrowingKV() },
    request: new Request('https://edstratumlabs.ai/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          event: 'backend_error',
          session: 'analytics-session',
          ts: 1_800_000,
          properties: { mode: 'open', status: 'stream_event' },
        },
      ]),
    }),
  } as never)

  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ error: 'analytics_storage_unavailable' })
})

test('OPTIONS /api/analytics returns no-store preflight response', async () => {
  const response = await analyticsOptions({
    env: {},
    request: new Request('https://edstratumlabs.ai/api/analytics', {
      method: 'OPTIONS',
    }),
  } as never)

  expect(response.status).toBe(204)
  expect(response.headers.get('Allow')).toBe('POST, OPTIONS')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
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

test('production chat runtime uses same-origin API surface', () => {
  expect(
    stratumApiUrlForRuntime('https://railway.example/', {
      hostname: 'edstratumlabs.ai',
      origin: 'https://edstratumlabs.ai',
    }),
  ).toBe('https://edstratumlabs.ai')
  expect(
    stratumApiUrlForRuntime('https://railway.example/', {
      hostname: 'www.edstratumlabs.ai',
      origin: 'https://www.edstratumlabs.ai',
    }),
  ).toBe('https://www.edstratumlabs.ai')
  expect(
    stratumApiUrlForRuntime('https://railway.example/', {
      hostname: 'preview.edstratumlabs.pages.dev',
      origin: 'https://preview.edstratumlabs.pages.dev',
    }),
  ).toBe('https://railway.example/')
  expect(
    stratumApiUrlForRuntime(undefined, {
      hostname: 'localhost',
      origin: 'http://localhost:4173',
    }),
  ).toBe('')
})

test('POST /api/chat streams Railway SSE and forwards safe QA headers', async () => {
  const payload = {
    messages: [],
    mode: 'open',
    intakeIndex: null,
    intakeAnswers: {},
    sessionId: 'session-chat',
  }
  let forwardedUrl = ''
  let forwardedBody = ''
  let forwardedHeaders = new Headers()

  globalThis.fetch = async (input, init) => {
    forwardedUrl = String(input)
    forwardedBody = String(init?.body)
    forwardedHeaders = new Headers(init?.headers)
    return new Response('data: {"type":"done"}\n\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    })
  }

  const response = await chat({
    env: { RAILWAY_API_URL: 'https://railway.example/' },
    request: new Request('https://edstratumlabs.ai/api/chat', {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        'X-Stratum-Eval': 'true',
        'X-Stratum-QA': 'true',
        'X-Stratum-Session': 'session-chat',
      },
      body: JSON.stringify(payload),
    }),
  } as never)

  expect(forwardedUrl).toBe('https://railway.example/api/chat')
  expect(forwardedHeaders.get('Accept')).toBe('text/event-stream')
  expect(forwardedHeaders.get('X-Stratum-Eval')).toBe('true')
  expect(forwardedHeaders.get('X-Stratum-QA')).toBe('true')
  expect(forwardedHeaders.get('X-Stratum-Session')).toBe('session-chat')
  expect(JSON.parse(forwardedBody)).toEqual(payload)
  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.text()).toBe('data: {"type":"done"}\n\n')
})

test('POST /api/chat fails closed when Railway is unavailable', async () => {
  globalThis.fetch = async () => {
    throw new Error('network unavailable')
  }

  const response = await chat({
    env: { RAILWAY_API_URL: 'https://railway.example' },
    request: new Request('https://edstratumlabs.ai/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  } as never)

  expect(response.status).toBe(502)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ error: 'chat_proxy_unavailable' })
})

test('OPTIONS /api/chat returns no-store preflight response', async () => {
  const response = await chatOptions({
    env: {},
    request: new Request('https://edstratumlabs.ai/api/chat', {
      method: 'OPTIONS',
    }),
  } as never)

  expect(response.status).toBe(204)
  expect(response.headers.get('Allow')).toBe('POST, OPTIONS')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
})

test('POST /api/escalate proxies complete QA payload to Railway', async () => {
  const payload = {
    leadName: 'QA Lead',
    leadEmail: 'qa@example.com',
    intakeSummary: {
      situation: 'Safe QA path',
      capabilities: 'Proxy contract',
      firstStep: 'Suppressed handoff',
    },
    escalationReason: 'explicit',
    sessionId: 'session-qa',
    timestamp: '2026-07-20T09:00:00Z',
  }
  let forwardedUrl = ''
  let forwardedBody = ''
  let forwardedHeaders = new Headers()

  globalThis.fetch = async (input, init) => {
    forwardedUrl = String(input)
    forwardedBody = String(init?.body)
    forwardedHeaders = new Headers(init?.headers)
    return Response.json({
      success: true,
      status: 'suppressed',
      messageId: 'qa-suppressed',
      error: null,
    })
  }

  const response = await escalate({
    env: { RAILWAY_API_URL: 'https://railway.example/' },
    request: new Request('https://edstratumlabs.ai/api/escalate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stratum-QA': 'true',
        'X-Stratum-Session': 'session-qa',
      },
      body: JSON.stringify(payload),
    }),
  } as never)

  expect(forwardedUrl).toBe('https://railway.example/api/escalate')
  expect(forwardedHeaders.get('X-Stratum-QA')).toBe('true')
  expect(forwardedHeaders.get('X-Stratum-Session')).toBe('session-qa')
  expect(JSON.parse(forwardedBody)).toEqual(payload)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({
    success: true,
    status: 'suppressed',
    messageId: 'qa-suppressed',
    error: null,
  })
})

test('POST /api/escalate preserves Railway delivery failure status', async () => {
  globalThis.fetch = async () =>
    Response.json(
      {
        success: false,
        status: 'failed',
        messageId: null,
        error: 'missing_email_config',
      },
      { status: 500 },
    )

  const response = await escalate({
    env: { RAILWAY_API_URL: 'https://railway.example' },
    request: new Request('https://edstratumlabs.ai/api/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  } as never)

  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({
    success: false,
    status: 'failed',
    messageId: null,
    error: 'missing_email_config',
  })
})

test('POST /api/tts proxies audio stream and session header to Railway', async () => {
  const kv = new MemoryKV()
  await kv.put('runtime', JSON.stringify({ voiceEnabled: true }))
  let forwardedUrl = ''
  let forwardedBody = ''
  let forwardedHeaders = new Headers()

  globalThis.fetch = async (input, init) => {
    forwardedUrl = String(input)
    forwardedBody = String(init?.body)
    forwardedHeaders = new Headers(init?.headers)
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    })
  }

  const response = await tts({
    env: { RAILWAY_API_URL: 'https://railway.example/', STRATUM_CONFIG: kv },
    request: new Request('https://edstratumlabs.ai/api/tts', {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'X-Stratum-Session': 'voice-session',
      },
      body: JSON.stringify({ text: 'Hello from STRATUM.' }),
    }),
  } as never)

  expect(forwardedUrl).toBe('https://railway.example/api/tts')
  expect(forwardedHeaders.get('Accept')).toBe('audio/mpeg')
  expect(forwardedHeaders.get('X-Stratum-Session')).toBe('voice-session')
  expect(JSON.parse(forwardedBody)).toEqual({ text: 'Hello from STRATUM.' })
  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3])
})

test('POST /api/tts fails closed when runtime voice is disabled', async () => {
  const kv = new MemoryKV()
  await kv.put('runtime', JSON.stringify({ voiceEnabled: false }))
  let upstreamCalls = 0
  globalThis.fetch = async () => {
    upstreamCalls += 1
    return new Response(new Uint8Array([1, 2, 3]))
  }

  for (const env of [{}, { STRATUM_CONFIG: kv }]) {
    const response = await tts({
      env,
      request: new Request('https://edstratumlabs.ai/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Do not proxy while disabled.' }),
      }),
    } as never)

    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ detail: 'tts_disabled' })
  }
  expect(upstreamCalls).toBe(0)
})

test('POST /api/tts fails closed when runtime config is malformed', async () => {
  const kv = new MemoryKV()
  await kv.put('runtime', 'not-json')
  let upstreamCalls = 0
  globalThis.fetch = async () => {
    upstreamCalls += 1
    return new Response(new Uint8Array([1, 2, 3]))
  }

  const response = await tts({
    env: { STRATUM_CONFIG: kv },
    request: new Request('https://edstratumlabs.ai/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Do not proxy with malformed config.' }),
    }),
  } as never)

  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ detail: 'tts_disabled' })
  expect(upstreamCalls).toBe(0)
})

test('POST /api/tts preserves Railway validation failure response', async () => {
  const kv = new MemoryKV()
  await kv.put('runtime', JSON.stringify({ voiceEnabled: true }))
  globalThis.fetch = async () =>
    Response.json(
      { detail: [{ type: 'string_type', loc: ['body', 'text'] }] },
      { status: 422 },
    )

  const response = await tts({
    env: { RAILWAY_API_URL: 'https://railway.example', STRATUM_CONFIG: kv },
    request: new Request('https://edstratumlabs.ai/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 5 }),
    }),
  } as never)

  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({
    detail: [{ type: 'string_type', loc: ['body', 'text'] }],
  })
})

async function createPersistedSession(db = new MemoryD1()) {
  const response = await sessions({
    env: { STRATUM_DB: db, SESSION_SECRET: 'test-secret' },
    request: new Request('https://edstratumlabs.ai/api/sessions', {
      method: 'POST',
    }),
    params: {},
  } as never)

  const data = await response.json() as { sessionId: string; sessionToken: string }
  return { db, response, ...data }
}

test('POST /api/sessions creates a signed D1 session', async () => {
  const { db, response, sessionId, sessionToken } = await createPersistedSession()

  expect(response.status).toBe(201)
  expect(sessionId).toMatch(/^stratum-/)
  expect(sessionToken.length).toBeGreaterThan(20)
  expect(db.sessions.has(sessionId)).toBe(true)
})

test('session message routes require bearer auth before D1 reads', async () => {
  const db = new MemoryD1()

  const response = await sessions({
    env: { STRATUM_DB: db, SESSION_SECRET: 'test-secret' },
    request: new Request('https://edstratumlabs.ai/api/sessions/stratum-test-session/messages'),
    params: { route: ['stratum-test-session', 'messages'] },
  } as never)

  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ error: 'missing_authorization' })
  expect(db.calls).toHaveLength(0)
})

test('POST and GET /api/sessions/:id/messages round-trip message history', async () => {
  const { db, sessionId, sessionToken } = await createPersistedSession()
  const headers = {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  }

  const write = await sessions({
    env: { STRATUM_DB: db, SESSION_SECRET: 'test-secret' },
    request: new Request(`https://edstratumlabs.ai/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          {
            id: 'user-1',
            role: 'user',
            content: 'Hello',
            timestamp: 10,
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: 'Here is a source.',
            timestamp: 20,
            citations: [{ source: 'KB', excerpt: 'Evidence' }],
          },
        ],
      }),
    }),
    params: { route: [sessionId, 'messages'] },
  } as never)

  expect(write.status).toBe(200)
  expect(await write.json()).toEqual({ ok: true, count: 2 })

  const read = await sessions({
    env: { STRATUM_DB: db, SESSION_SECRET: 'test-secret' },
    request: new Request(`https://edstratumlabs.ai/api/sessions/${sessionId}/messages`, {
      headers,
    }),
    params: { route: [sessionId, 'messages'] },
  } as never)

  expect(read.status).toBe(200)
  expect(await read.json()).toEqual({
    sessionId,
    messages: [
      {
        id: 'user-1',
        role: 'user',
        content: 'Hello',
        timestamp: 10,
        citations: [],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Here is a source.',
        timestamp: 20,
        citations: [{ source: 'KB', excerpt: 'Evidence' }],
      },
    ],
  })
})

test('PATCH /api/sessions/:id updates session flags', async () => {
  const { db, sessionId, sessionToken } = await createPersistedSession()

  const response = await sessions({
    env: { STRATUM_DB: db, SESSION_SECRET: 'test-secret' },
    request: new Request(`https://edstratumlabs.ai/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ escalated: true, intakeComplete: true }),
    }),
    params: { route: [sessionId] },
  } as never)

  expect(response.status).toBe(200)
  expect(db.sessions.get(sessionId)).toMatchObject({
    escalated: 1,
    intake_complete: 1,
  })
})

test('DELETE /api/sessions/:id removes scoped D1 session and messages', async () => {
  const { db, sessionId, sessionToken } = await createPersistedSession()
  db.messages.set('message-1', {
    id: 'message-1',
    session_id: sessionId,
    role: 'user',
    content: 'Delete my conversation.',
    citations_json: null,
    created_at: 10,
  })

  const response = await sessions({
    env: { STRATUM_DB: db, SESSION_SECRET: 'test-secret' },
    request: new Request(`https://edstratumlabs.ai/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    }),
    params: { route: [sessionId] },
  } as never)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
  expect(db.sessions.has(sessionId)).toBe(false)
  expect([...db.messages.values()].some((message) => message.session_id === sessionId)).toBe(false)
})

test('POST /api/sessions/purge removes sessions past the retention window with admin auth', async () => {
  Date.now = () => 2_000_000_000
  const db = new MemoryD1()
  const oldSession = 'stratum-old-session'
  const recentSession = 'stratum-recent-session'
  db.sessions.set(oldSession, {
    id: oldSession,
    created_at: Date.now() - 45 * 24 * 60 * 60 * 1000,
    last_active: Date.now() - 31 * 24 * 60 * 60 * 1000,
    escalated: 0,
    intake_complete: 0,
  })
  db.sessions.set(recentSession, {
    id: recentSession,
    created_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
    last_active: Date.now() - 1 * 24 * 60 * 60 * 1000,
    escalated: 0,
    intake_complete: 0,
  })
  db.messages.set('old-message', {
    id: 'old-message',
    session_id: oldSession,
    role: 'user',
    content: 'Expired conversation',
    citations_json: null,
    created_at: 1,
  })
  db.messages.set('recent-message', {
    id: 'recent-message',
    session_id: recentSession,
    role: 'assistant',
    content: 'Recent conversation',
    citations_json: null,
    created_at: 2,
  })

  const response = await sessions({
    env: { STRATUM_DB: db, SESSION_SECRET: 'test-secret' },
    request: new Request('https://edstratumlabs.ai/api/sessions/purge', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ olderThanDays: 30 }),
    }),
    params: { route: ['purge'] },
  } as never)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    ok: true,
    olderThanDays: 30,
    cutoff: Date.now() - 30 * 24 * 60 * 60 * 1000,
  })
  expect(db.sessions.has(oldSession)).toBe(false)
  expect(db.sessions.has(recentSession)).toBe(true)
  expect(db.messages.has('old-message')).toBe(false)
  expect(db.messages.has('recent-message')).toBe(true)
})

test('POST /api/sessions/purge rejects scoped session tokens', async () => {
  const { db, sessionToken } = await createPersistedSession()

  const response = await sessions({
    env: { STRATUM_DB: db, SESSION_SECRET: 'test-secret' },
    request: new Request('https://edstratumlabs.ai/api/sessions/purge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ olderThanDays: 30 }),
    }),
    params: { route: ['purge'] },
  } as never)

  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ error: 'forbidden' })
})

test('session routes fail closed when D1 is unbound', async () => {
  const response = await sessions({
    env: { SESSION_SECRET: 'test-secret' },
    request: new Request('https://edstratumlabs.ai/api/sessions', {
      method: 'POST',
    }),
    params: {},
  } as never)

  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'd1_not_configured' })
})
