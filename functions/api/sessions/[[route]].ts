import { jsonResponse, type Env } from '../_types'

type RouteParam = string | string[] | undefined
type MessageRole = 'user' | 'assistant' | 'system'

interface SessionParams extends Record<string, unknown> {
  route?: RouteParam
}

interface StoredMessage {
  id: string
  session_id: string
  role: MessageRole
  content: string
  citations_json: string | null
  created_at: number
}

interface MessageInput {
  id?: unknown
  role?: unknown
  content?: unknown
  timestamp?: unknown
  citations?: unknown
}

const MAX_CONTENT_LENGTH = 16_000
const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/
const DEFAULT_PURGE_OLDER_THAN_DAYS = 30
const MAX_PURGE_OLDER_THAN_DAYS = 365
const DAY_MS = 24 * 60 * 60 * 1000

function routeParts(param: RouteParam) {
  if (Array.isArray(param)) {
    return param
  }

  return typeof param === 'string' && param.length > 0 ? param.split('/') : []
}

function bearerToken(request: Request) {
  const header = request.headers.get('Authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? null
}

function base64Url(buffer: ArrayBuffer) {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

async function signSession(secret: string, sessionId: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(sessionId))
  return base64Url(signature)
}

async function isAuthorized(request: Request, env: Env, sessionId: string) {
  const token = bearerToken(request)
  if (!token) {
    return false
  }

  if (env.SESSION_SECRET && constantTimeEqual(token, env.SESSION_SECRET)) {
    return true
  }

  return env.SESSION_SECRET
    ? constantTimeEqual(token, await signSession(env.SESSION_SECRET, sessionId))
    : false
}

function validSessionId(sessionId: string) {
  return SESSION_ID_PATTERN.test(sessionId)
}

function newId(prefix: string) {
  if (crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function readJson(request: Request) {
  const text = await request.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function normalizeCitations(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  const citations = value.filter((citation) => {
    if (!citation || typeof citation !== 'object') {
      return false
    }

    const candidate = citation as Record<string, unknown>
    return typeof candidate.source === 'string' && typeof candidate.excerpt === 'string'
  })

  return citations.length > 0 ? JSON.stringify(citations) : null
}

function normalizeMessage(input: unknown): StoredMessage | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as MessageInput
  if (
    candidate.role !== 'user' &&
    candidate.role !== 'assistant' &&
    candidate.role !== 'system'
  ) {
    return null
  }

  if (typeof candidate.content !== 'string' || candidate.content.length === 0) {
    return null
  }

  const createdAt =
    typeof candidate.timestamp === 'number' && Number.isFinite(candidate.timestamp)
      ? Math.trunc(candidate.timestamp)
      : Date.now()

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : newId('message'),
    session_id: '',
    role: candidate.role,
    content: candidate.content.slice(0, MAX_CONTENT_LENGTH),
    citations_json: normalizeCitations(candidate.citations),
    created_at: createdAt,
  }
}

function messagesFromBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null
  }

  const candidate = body as { message?: unknown; messages?: unknown }
  const rawMessages = Array.isArray(candidate.messages)
    ? candidate.messages
    : candidate.message
      ? [candidate.message]
      : null

  if (!rawMessages) {
    return null
  }

  const messages = rawMessages.map(normalizeMessage)
  return messages.every(Boolean) ? messages as StoredMessage[] : null
}

function purgeOlderThanDays(body: unknown): number | null {
  if (!body || typeof body !== 'object') {
    return DEFAULT_PURGE_OLDER_THAN_DAYS
  }

  const value = (body as { olderThanDays?: unknown }).olderThanDays
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_PURGE_OLDER_THAN_DAYS
  ) {
    return null
  }

  return value
}

function databaseUnavailable(env: Env) {
  if (!env.STRATUM_DB) {
    return jsonResponse({ error: 'd1_not_configured' }, { status: 503 })
  }

  if (!env.SESSION_SECRET) {
    return jsonResponse({ error: 'session_secret_not_configured' }, { status: 503 })
  }

  return null
}

function requireAdminAccess(request: Request, env: Env) {
  const unavailable = databaseUnavailable(env)
  if (unavailable) {
    return unavailable
  }

  const token = bearerToken(request)
  if (!token) {
    return jsonResponse({ error: 'missing_authorization' }, { status: 401 })
  }

  if (!constantTimeEqual(token, env.SESSION_SECRET!)) {
    return jsonResponse({ error: 'forbidden' }, { status: 403 })
  }

  return null
}

async function sessionExists(db: D1Database, sessionId: string) {
  const row = await db
    .prepare('SELECT id FROM sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ id: string }>()

  return Boolean(row)
}

async function touchSession(db: D1Database, sessionId: string, now: number) {
  await db
    .prepare(
      'INSERT OR IGNORE INTO sessions (id, created_at, last_active) VALUES (?, ?, ?)',
    )
    .bind(sessionId, now, now)
    .run()
  await db
    .prepare('UPDATE sessions SET last_active = ? WHERE id = ?')
    .bind(now, sessionId)
    .run()
}

async function createSession(env: Env) {
  const unavailable = databaseUnavailable(env)
  if (unavailable) {
    return unavailable
  }

  // The browser receives only this scoped token; SESSION_SECRET stays at the edge.
  const sessionId = newId('stratum')
  const now = Date.now()
  await env.STRATUM_DB!.prepare(
    'INSERT INTO sessions (id, created_at, last_active) VALUES (?, ?, ?)',
  )
    .bind(sessionId, now, now)
    .run()

  return jsonResponse(
    {
      sessionId,
      sessionToken: await signSession(env.SESSION_SECRET!, sessionId),
    },
    { status: 201 },
  )
}

async function requireSessionAccess(
  request: Request,
  env: Env,
  sessionId: string,
) {
  if (!validSessionId(sessionId)) {
    return jsonResponse({ error: 'invalid_session_id' }, { status: 400 })
  }

  const unavailable = databaseUnavailable(env)
  if (unavailable) {
    return unavailable
  }

  if (!bearerToken(request)) {
    return jsonResponse({ error: 'missing_authorization' }, { status: 401 })
  }

  if (!(await isAuthorized(request, env, sessionId))) {
    return jsonResponse({ error: 'forbidden' }, { status: 403 })
  }

  return null
}

async function listMessages(request: Request, env: Env, sessionId: string) {
  const blocked = await requireSessionAccess(request, env, sessionId)
  if (blocked) {
    return blocked
  }

  if (!(await sessionExists(env.STRATUM_DB!, sessionId))) {
    return jsonResponse({ error: 'session_not_found' }, { status: 404 })
  }

  const result = await env.STRATUM_DB!.prepare(
    'SELECT id, role, content, citations_json, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC',
  )
    .bind(sessionId)
    .all<Omit<StoredMessage, 'session_id'>>()

  return jsonResponse({
    sessionId,
    messages: (result.results || []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.created_at,
      citations: message.citations_json ? JSON.parse(message.citations_json) : [],
    })),
  })
}

async function appendMessages(request: Request, env: Env, sessionId: string) {
  const blocked = await requireSessionAccess(request, env, sessionId)
  if (blocked) {
    return blocked
  }

  const body = await readJson(request)
  if (body === undefined) {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 })
  }

  const messages = messagesFromBody(body)
  if (!messages || messages.length === 0) {
    return jsonResponse({ error: 'invalid_messages' }, { status: 400 })
  }

  const now = Date.now()
  await touchSession(env.STRATUM_DB!, sessionId, now)

  for (const message of messages) {
    await env.STRATUM_DB!.prepare(
      'INSERT OR REPLACE INTO messages (id, session_id, role, content, citations_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        message.id,
        sessionId,
        message.role,
        message.content,
        message.citations_json,
        message.created_at,
      )
      .run()
  }

  return jsonResponse({ ok: true, count: messages.length })
}

async function patchSession(request: Request, env: Env, sessionId: string) {
  const blocked = await requireSessionAccess(request, env, sessionId)
  if (blocked) {
    return blocked
  }

  if (!(await sessionExists(env.STRATUM_DB!, sessionId))) {
    return jsonResponse({ error: 'session_not_found' }, { status: 404 })
  }

  const body = await readJson(request)
  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const updates: string[] = ['last_active = ?']
  const values: Array<number | string> = [Date.now()]

  if (typeof payload.escalated === 'boolean') {
    updates.push('escalated = ?')
    values.push(payload.escalated ? 1 : 0)
  }

  const intakeComplete = payload.intakeComplete ?? payload.intake_complete
  if (typeof intakeComplete === 'boolean') {
    updates.push('intake_complete = ?')
    values.push(intakeComplete ? 1 : 0)
  }

  if (updates.length === 1) {
    return jsonResponse({ error: 'no_flags' }, { status: 400 })
  }

  await env.STRATUM_DB!.prepare(
    `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
  )
    .bind(...values, sessionId)
    .run()

  return jsonResponse({ ok: true })
}

async function deleteSession(request: Request, env: Env, sessionId: string) {
  const blocked = await requireSessionAccess(request, env, sessionId)
  if (blocked) {
    return blocked
  }

  if (!(await sessionExists(env.STRATUM_DB!, sessionId))) {
    return jsonResponse({ error: 'session_not_found' }, { status: 404 })
  }

  await env.STRATUM_DB!.prepare('DELETE FROM messages WHERE session_id = ?')
    .bind(sessionId)
    .run()
  await env.STRATUM_DB!.prepare('DELETE FROM sessions WHERE id = ?')
    .bind(sessionId)
    .run()

  return jsonResponse({ ok: true })
}

async function purgeOldSessions(request: Request, env: Env) {
  const blocked = requireAdminAccess(request, env)
  if (blocked) {
    return blocked
  }

  const body = await readJson(request)
  if (body === undefined) {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 })
  }

  const olderThanDays = purgeOlderThanDays(body)
  if (!olderThanDays) {
    return jsonResponse({ error: 'invalid_retention_window' }, { status: 400 })
  }

  const cutoff = Date.now() - olderThanDays * DAY_MS
  await env.STRATUM_DB!.prepare(
    'DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE last_active < ?)',
  )
    .bind(cutoff)
    .run()
  await env.STRATUM_DB!.prepare('DELETE FROM sessions WHERE last_active < ?')
    .bind(cutoff)
    .run()

  return jsonResponse({ ok: true, olderThanDays, cutoff })
}

export const onRequest: PagesFunction<Env, string, SessionParams> = async ({
  env,
  params,
  request,
}) => {
  const parts = routeParts(params.route)
  const method = request.method.toUpperCase()

  if (method === 'POST' && parts.length === 0) {
    return createSession(env)
  }

  if (method === 'POST' && parts.length === 1 && parts[0] === 'purge') {
    return purgeOldSessions(request, env)
  }

  if (parts.length === 2 && parts[1] === 'messages') {
    if (method === 'GET') {
      return listMessages(request, env, parts[0])
    }

    if (method === 'POST') {
      return appendMessages(request, env, parts[0])
    }
  }

  if (parts.length === 1 && method === 'PATCH') {
    return patchSession(request, env, parts[0])
  }

  if (parts.length === 1 && method === 'DELETE') {
    return deleteSession(request, env, parts[0])
  }

  return jsonResponse({ error: 'not_found' }, { status: 404 })
}
