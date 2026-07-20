import { jsonResponse, type Env } from './_types'

const MAX_EVENTS_PER_BATCH = 20
const ANALYTICS_TTL_SECONDS = 60 * 60 * 24 * 400

const EVENT_NAMES = new Set([
  'backend_error',
  'chatbot_opened',
  'escalation_triggered',
  'first_message_sent',
  'handoff_intent',
  'intake_completed',
  'prompt_chip_clicked',
  'readiness_completed',
  'sentiment_escalation_prompted',
  'sentiment_escalation_triggered',
  'session_summary_download_failed',
  'session_summary_downloaded',
  'transcript_reset',
])

const PROPERTY_VALUES: Record<string, Set<string>> = {
  chip: new Set([
    'canvas_ai',
    'engagement_shape',
    'readiness_check',
    'strategy_vs_implementation',
    'founding_leadership',
  ]),
  deliveryStatus: new Set([
    'failed',
    'prepared',
    'rate_limited',
    'sent',
    'suppressed',
  ]),
  mode: new Set(['about', 'escalation', 'intake', 'open']),
  phase: new Set(['complete', 'conversation', 'escalated', 'intake']),
  signal: new Set(['frustration', 'urgency']),
  source: new Set(['connect_button', 'manual_submit', 'prompt_chip', 'voice']),
  status: new Set(['fetch_error', 'http_error', 'missing_stream', 'stream_event', 'unknown']),
  trigger: new Set(['confidence', 'explicit', 'high_intent', 'sentiment']),
}

interface CounterRecord {
  count: number
  updatedAt: number
}

interface AnalyticsEvent {
  event: string
  properties: Record<string, string>
}

function noStoreHeaders(headers?: HeadersInit) {
  const output = new Headers(headers)
  output.set('Cache-Control', 'no-store')
  return output
}

function emptyNoStoreResponse(status = 204, headers?: HeadersInit) {
  return new Response(null, {
    status,
    headers: noStoreHeaders(headers),
  })
}

function analyticsEvents(value: unknown) {
  if (Array.isArray(value)) {
    return value
  }

  if (value && typeof value === 'object' && Array.isArray((value as { events?: unknown }).events)) {
    return (value as { events: unknown[] }).events
  }

  return null
}

function normalizeProperties(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const output: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    const allowedValues = PROPERTY_VALUES[key]
    if (!allowedValues || typeof rawValue !== 'string') {
      continue
    }

    const normalizedValue = rawValue.trim()
    if (allowedValues.has(normalizedValue)) {
      output[key] = normalizedValue
    }
  }
  return output
}

function normalizeEvent(value: unknown): AnalyticsEvent | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as {
    event?: unknown
    properties?: unknown
    session?: unknown
    ts?: unknown
  }
  if (typeof candidate.event !== 'string' || !EVENT_NAMES.has(candidate.event)) {
    return null
  }
  if (typeof candidate.session !== 'string' || candidate.session.length < 1 || candidate.session.length > 80) {
    return null
  }
  if (typeof candidate.ts !== 'number' || !Number.isFinite(candidate.ts)) {
    return null
  }

  return {
    event: candidate.event,
    properties: normalizeProperties(candidate.properties),
  }
}

function dayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10)
}

async function incrementCounter(kv: KVNamespace, key: string, by: number, now: number) {
  const current = await kv.get<CounterRecord>(key, { type: 'json' })
  const count =
    current && typeof current.count === 'number'
      ? current.count
      : 0

  await kv.put(
    key,
    JSON.stringify({ count: count + by, updatedAt: now }),
    { expirationTtl: ANALYTICS_TTL_SECONDS },
  )
}

async function recordEvents(kv: KVNamespace, events: AnalyticsEvent[], now: number) {
  const date = dayKey(now)
  const counters = new Map<string, number>()

  for (const event of events) {
    const eventKey = `analytics:v1:daily:${date}:event:${event.event}`
    counters.set(eventKey, (counters.get(eventKey) ?? 0) + 1)

    for (const [property, value] of Object.entries(event.properties)) {
      const propertyKey = `analytics:v1:daily:${date}:property:${event.event}:${property}:${value}`
      counters.set(propertyKey, (counters.get(propertyKey) ?? 0) + 1)
    }
  }

  await Promise.all(
    [...counters].map(([key, count]) => incrementCounter(kv, key, count, now)),
  )
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.ANALYTICS_EVENTS) {
    return jsonResponse(
      { error: 'analytics_not_configured' },
      { status: 503, headers: noStoreHeaders() },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return jsonResponse(
      { error: 'invalid_analytics_payload' },
      { status: 400, headers: noStoreHeaders() },
    )
  }

  const rawEvents = analyticsEvents(payload)
  if (!rawEvents) {
    return jsonResponse(
      { error: 'invalid_analytics_payload' },
      { status: 400, headers: noStoreHeaders() },
    )
  }
  if (rawEvents.length > MAX_EVENTS_PER_BATCH) {
    return jsonResponse(
      { error: 'analytics_batch_too_large' },
      { status: 413, headers: noStoreHeaders() },
    )
  }

  const events = rawEvents
    .map(normalizeEvent)
    .filter((event): event is AnalyticsEvent => event !== null)

  if (events.length !== rawEvents.length) {
    return jsonResponse(
      { error: 'invalid_analytics_event' },
      { status: 400, headers: noStoreHeaders() },
    )
  }

  if (events.length > 0) {
    try {
      await recordEvents(env.ANALYTICS_EVENTS, events, Date.now())
    } catch {
      return jsonResponse(
        { error: 'analytics_storage_unavailable' },
        { status: 503, headers: noStoreHeaders() },
      )
    }
  }

  return jsonResponse(
    { ok: true, count: events.length },
    { status: 202, headers: noStoreHeaders() },
  )
}

export const onRequestOptions: PagesFunction<Env> = async () =>
  emptyNoStoreResponse(204, { Allow: 'POST, OPTIONS' })
