import { getOrCreateSessionId } from '../lib/stratumSession'
import { STRATUM_API_URL, STRATUM_BACKEND_ENABLED } from './stratumConfig'
import { mockStreamResponse } from './stratumMock'
import type {
  EscalationDelivery,
  EscalationTrigger,
  ProcessingPhase,
  RagCitation,
  ReadinessSnapshot,
  RuntimeConfig,
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

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  ragEnabled: true,
  voiceEnabled: false,
  persistenceEnabled: false,
  maxIntakeQuestions: 6,
}

export function getSessionId() {
  return getOrCreateSessionId()
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

function normalizeRuntimeConfig(value: unknown): RuntimeConfig {
  if (!value || typeof value !== 'object') {
    return DEFAULT_RUNTIME_CONFIG
  }

  const config = value as Partial<RuntimeConfig>
  const maxIntakeQuestions =
    typeof config.maxIntakeQuestions === 'number' &&
    Number.isInteger(config.maxIntakeQuestions) &&
    config.maxIntakeQuestions > 0 &&
    config.maxIntakeQuestions <= 12
      ? config.maxIntakeQuestions
      : DEFAULT_RUNTIME_CONFIG.maxIntakeQuestions

  return {
    ragEnabled:
      typeof config.ragEnabled === 'boolean'
        ? config.ragEnabled
        : DEFAULT_RUNTIME_CONFIG.ragEnabled,
    voiceEnabled:
      typeof config.voiceEnabled === 'boolean'
        ? config.voiceEnabled
        : DEFAULT_RUNTIME_CONFIG.voiceEnabled,
    persistenceEnabled:
      typeof config.persistenceEnabled === 'boolean'
        ? config.persistenceEnabled
        : DEFAULT_RUNTIME_CONFIG.persistenceEnabled,
    maxIntakeQuestions,
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

export async function getStratumConfig(options: { signal?: AbortSignal } = {}) {
  try {
    const response = await fetch('/api/config', {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    })
    if (!response.ok) {
      return DEFAULT_RUNTIME_CONFIG
    }

    return normalizeRuntimeConfig(await response.json())
  } catch {
    return DEFAULT_RUNTIME_CONFIG
  }
}

export async function getStratumHealth(options: { signal?: AbortSignal } = {}) {
  try {
    const response = await fetch('/api/health', {
      headers: {
        Accept: 'application/json',
        'X-Stratum-Session': getSessionId(),
      },
      signal: options.signal,
    })
    if (!response.ok) {
      return null
    }

    return (await response.json()) as Record<string, unknown>
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
