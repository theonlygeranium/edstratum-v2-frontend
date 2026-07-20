/**
 * Lightweight, privacy-respecting analytics for StratumChat.
 *
 * Tracks behavioral funnel signals only: no conversation text, no prompt input,
 * no PII, no third-party SDK added to the bundle.
 */

export type AnalyticsEventName =
  | 'backend_error'
  | 'chatbot_opened'
  | 'escalation_triggered'
  | 'first_message_sent'
  | 'handoff_intent'
  | 'intake_completed'
  | 'prompt_chip_clicked'
  | 'readiness_completed'
  | 'sentiment_escalation_prompted'
  | 'sentiment_escalation_triggered'
  | 'session_summary_download_failed'
  | 'session_summary_downloaded'
  | 'transcript_reset'

type AnalyticsPayload = {
  event: AnalyticsEventName
  properties?: Record<string, string>
  ts: number
  session: string
}

const EVENT_NAMES = new Set<AnalyticsEventName>([
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

const ANALYTICS_ENDPOINT: string =
  typeof import.meta.env?.VITE_ANALYTICS_ENDPOINT === 'string'
    ? import.meta.env.VITE_ANALYTICS_ENDPOINT.trim()
    : '/api/analytics'

const queue: AnalyticsPayload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function safeGetSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetSessionValue(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Storage can fail in private or restricted browser contexts.
  }
}

function getAnalyticsSessionId(): string {
  const key = 'stratum_analytics_sid'
  let sid = safeGetSessionValue(key)
  if (!sid) {
    sid = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
    safeSetSessionValue(key, sid)
  }
  return sid
}

function sanitizeProperties(properties?: Record<string, string>) {
  if (!properties) {
    return undefined
  }

  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(properties)) {
    const allowedValues = PROPERTY_VALUES[key]
    if (!allowedValues) {
      continue
    }

    const normalizedValue = value.trim()
    if (allowedValues.has(normalizedValue)) {
      output[key] = normalizedValue
    }
  }

  return Object.keys(output).length > 0 ? output : undefined
}

function flush() {
  if (queue.length === 0 || !ANALYTICS_ENDPOINT) {
    return
  }

  const batch = queue.splice(0, queue.length)
  try {
    const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' })
    if (navigator.sendBeacon?.(ANALYTICS_ENDPOINT, blob)) {
      return
    }

    void fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(batch),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    })
  } catch {
    // Analytics is best-effort. Never interrupt the chat experience.
  }
}

/**
 * Track a named event with optional string properties. Properties are
 * enum-whitelisted so callers cannot accidentally send conversation text.
 */
export function trackEvent(event: AnalyticsEventName, properties?: Record<string, string>): void {
  if (typeof window === 'undefined' || !ANALYTICS_ENDPOINT || !EVENT_NAMES.has(event)) {
    return
  }

  queue.push({
    event,
    properties: sanitizeProperties(properties),
    ts: Date.now(),
    session: getAnalyticsSessionId(),
  })

  if (flushTimer) {
    clearTimeout(flushTimer)
  }
  flushTimer = setTimeout(flush, 2000)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush()
    }
  })
}
