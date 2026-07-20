import { STRATUM_API_URL, STRATUM_BACKEND_ENABLED, STRATUM_SESSION_KEY } from './stratumConfig'
import { mockStreamResponse } from './stratumMock'
import type {
  EscalationDelivery,
  EscalationTrigger,
  ProcessingPhase,
  RagCitation,
  ReadinessSnapshot,
  SourceConfidence,
  StratumStreamRequest,
  StreamEvent,
} from './stratumTypes'

const PHASES = new Set<ProcessingPhase>([
  'searching',
  'retrieving',
  'composing',
  'assessing',
  'escalating',
  'idle',
])

const ESCALATION_TRIGGERS = new Set([
  'explicit',
  'confidence',
  'high_intent',
  'sentiment',
])

const ESCALATION_DELIVERY_STATUSES = new Set([
  'sent',
  'prepared',
  'failed',
  'rate_limited',
  'suppressed',
])

function newSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `stratum-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getSessionId() {
  try {
    const current = window.sessionStorage.getItem(STRATUM_SESSION_KEY)
    if (current) {
      return current
    }

    const next = newSessionId()
    window.sessionStorage.setItem(STRATUM_SESSION_KEY, next)
    return next
  } catch {
    return newSessionId()
  }
}

function isSource(value: unknown): value is SourceConfidence {
  if (!value || typeof value !== 'object') {
    return false
  }

  const source = value as SourceConfidence
  return (
    typeof source.label === 'string' &&
    typeof source.score === 'number' &&
    typeof source.grounded === 'boolean'
  )
}

function isCitation(value: unknown): value is RagCitation {
  if (!value || typeof value !== 'object') {
    return false
  }

  const citation = value as RagCitation
  return typeof citation.source === 'string' && typeof citation.excerpt === 'string'
}

function isReadinessSnapshot(value: unknown): value is ReadinessSnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }

  const snapshot = value as ReadinessSnapshot
  return (
    typeof snapshot.situation === 'string' &&
    typeof snapshot.capabilities === 'string' &&
    typeof snapshot.firstStep === 'string'
  )
}

function normalizeEscalation(value: unknown): EscalationTrigger {
  if (typeof value === 'string' && ESCALATION_TRIGGERS.has(value)) {
    return value as Exclude<EscalationTrigger, null>
  }

  return null
}

function normalizeEscalationDelivery(value: unknown): EscalationDelivery | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const delivery = value as Record<string, unknown>
  if (
    typeof delivery.success !== 'boolean' ||
    typeof delivery.status !== 'string' ||
    !ESCALATION_DELIVERY_STATUSES.has(delivery.status)
  ) {
    return null
  }

  return {
    success: delivery.success,
    status: delivery.status as EscalationDelivery['status'],
    messageId: typeof delivery.messageId === 'string' ? delivery.messageId : null,
    error: typeof delivery.error === 'string' ? delivery.error : null,
  }
}

function normalizeStreamEvent(value: unknown): StreamEvent | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const event = value as Record<string, unknown>

  if (event.type === 'phase' && typeof event.phase === 'string' && PHASES.has(event.phase as ProcessingPhase)) {
    return { type: 'phase', phase: event.phase as ProcessingPhase }
  }

  if (event.type === 'token' && typeof event.token === 'string') {
    return { type: 'token', token: event.token }
  }

  if (event.type === 'source' && isSource(event.source)) {
    return { type: 'source', source: event.source }
  }

  if (event.type === 'citations' && Array.isArray(event.data) && event.data.every(isCitation)) {
    return { type: 'citations', data: event.data }
  }

  if (event.type === 'done') {
    return {
      type: 'done',
      snapshot: isReadinessSnapshot(event.snapshot) ? event.snapshot : null,
      escalate: normalizeEscalation(event.escalate),
      escalation: normalizeEscalationDelivery(event.escalation),
    }
  }

  if (event.type === 'error' && typeof event.message === 'string') {
    return { type: 'error', message: event.message }
  }

  return null
}

function parseSseBlock(block: string): StreamEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')

  if (!data || data === '[DONE]') {
    return null
  }

  try {
    return normalizeStreamEvent(JSON.parse(data))
  } catch {
    return null
  }
}

export async function* streamStratumResponse(
  request: StratumStreamRequest,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<StreamEvent> {
  if (!STRATUM_BACKEND_ENABLED) {
    yield* mockStreamResponse(request)
    return
  }

  let response: Response
  try {
    response = await fetch(`${STRATUM_API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: options.signal,
    })
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') {
      return
    }

    yield {
      type: 'error',
      message: 'STRATUM could not reach the live intake service. Please try again in a moment.',
    }
    return
  }

  if (!response.ok) {
    yield {
      type: 'error',
      message: 'STRATUM could not complete that request. Please try again in a moment.',
    }
    return
  }

  if (!response.body) {
    yield {
      type: 'error',
      message: 'STRATUM did not receive a stream from the intake service.',
    }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const event = parseSseBlock(block)
        if (event) {
          yield event
        }
      }
    }

    buffer += decoder.decode()
    const finalEvent = parseSseBlock(buffer)
    if (finalEvent) {
      yield finalEvent
    }
  } finally {
    reader.releaseLock()
  }
}
