import { expect, test } from '@playwright/test'

import { onRequest as middleware } from '../functions/_middleware'
import { onRequestGet as config } from '../functions/api/config'
import { onRequestGet as health } from '../functions/api/health'
import { onRequest as sessions } from '../functions/api/sessions/[[route]]'

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
