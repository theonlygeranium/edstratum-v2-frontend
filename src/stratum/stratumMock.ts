import { ESCALATION_REQUEST_TEXT, INTAKE_QUESTIONS } from './stratumConfig'
import type {
  EscalationDelivery,
  RagCitation,
  ReadinessSnapshot,
  SourceConfidence,
  StratumStreamRequest,
  StreamEvent,
} from './stratumTypes'

declare global {
  interface Window {
    __STRATUM_LAST_MOCK_REQUEST__?: StratumStreamRequest
  }
}

export const SENTIMENT_TEST_SEQUENCES = {
  frustration: [
    'This is not working for our Canvas pilot.',
    'The guidance still feels useless.',
  ],
  urgency: ['We have a deadline today and need this now.'],
} as const

const MOCK_SOURCE: SourceConfidence = {
  label: 'EdStratum knowledge base',
  score: 0.86,
  grounded: true,
}

const MOCK_CITATIONS: RagCitation[] = [
  {
    source: 'EdStratum Services',
    excerpt:
      'EdStratum supports AI implementation strategy, Canvas LMS integration, production RAG engineering, learning analytics, workflow automation, and fractional AI leadership.',
  },
  {
    source: 'STRATUM RAG Methodology',
    excerpt:
      'STRATUM answers should be grounded in a maintained knowledge base with semantic chunking, keyword search, vector-style semantic matching, and reranking where available.',
  },
]

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export function sentimentTestMode() {
  if (import.meta.env.VITE_SENTIMENT_TEST_MODE === 'true') {
    return true
  }

  try {
    return window.localStorage.getItem('stratum_sentiment_test_mode') === 'true'
  } catch {
    return false
  }
}

function mockEscalationDelivery(): EscalationDelivery {
  const shouldFail =
    import.meta.env.VITE_MOCK_ESCALATION_FAIL === 'true' ||
    window.localStorage.getItem('stratum_mock_escalation_fail') === 'true'

  if (shouldFail) {
    return {
      success: false,
      status: 'failed',
      error: 'mock_failure',
    }
  }

  return {
    success: true,
    status: 'sent',
    messageId: 'mock-001',
  }
}

function lastUserText(request: StratumStreamRequest) {
  return [...request.messages].reverse().find((message) => message.role === 'user')?.content ?? ''
}

function snapshotFromAnswers(answers: Record<string, string>): ReadinessSnapshot {
  const organization = answers['org-type'] || 'your organization'
  const canvas = answers['canvas-usage'] || 'your learning platform context'
  const problem = answers.problem || 'the workflow you described'
  const data = answers['data-infra'] || 'your current data foundation'
  const engineering = answers.engineering || 'your delivery capacity'
  const timeline = answers.timeline || 'your target timeline'

  return {
    situation: `You are evaluating AI for ${organization}, with Canvas usage described as ${canvas}. The main problem is ${problem}, and feasibility depends on ${data} plus ${engineering}.`,
    capabilities:
      'The most relevant EdStratum capabilities are AI implementation strategy, Canvas integration architecture, and production RAG engineering where grounded knowledge retrieval is required.',
    firstStep: `Start with a short discovery audit against the ${timeline} timeline: confirm data access, identify the first workflow worth automating, and define a measurable pilot before production build work.`,
  }
}

function responseFor(request: StratumStreamRequest) {
  const text = lastUserText(request).toLowerCase()

  if (request.mode === 'escalation' || text.includes('founding leadership')) {
    const trigger = request.escalationTrigger ?? 'explicit'
    const isSentiment = trigger === 'sentiment'
    return {
      phases: ['escalating'] as const,
      text: isSentiment
        ? 'I am routing this to EdStratum\'s Founding leadership team with the context so it gets direct attention.'
        : "Absolutely. I can connect you with EdStratum's Founding leadership team about the project.\n\n" +
          "I've prepared a summary for the Founding leadership team so the handoff has the right context.",
      escalate: trigger,
      escalation: mockEscalationDelivery(),
    }
  }

  if (request.mode === 'about') {
    return {
      phases: ['searching', 'composing'] as const,
      text:
        'EdStratum Labs is a founder-led AI strategy and implementation consultancy focused on practical AI systems for EdTech, Canvas LMS workflows, RAG engineering, and customer education. The operating style is evidence-driven: clarify the workflow, confirm the data foundation, and ship the smallest useful production pilot before expanding scope.',
      source: MOCK_SOURCE,
      citations: [MOCK_CITATIONS[0]],
    }
  }

  if (request.mode === 'intake') {
    const index = request.intakeIndex ?? 0
    if (Object.keys(request.intakeAnswers).length >= INTAKE_QUESTIONS.length || index >= INTAKE_QUESTIONS.length) {
      const snapshot = snapshotFromAnswers(request.intakeAnswers)
      return {
        phases: ['assessing', 'composing'] as const,
        text:
          `Here is your AI Readiness Snapshot.\n\n### Your Situation\n${snapshot.situation}\n\n` +
          `### Relevant EdStratum Capabilities\n${snapshot.capabilities}\n\n` +
          `### Realistic First Step\n${snapshot.firstStep}`,
        snapshot,
        escalate: request.intakeAnswers.timeline === '30-60 days' ? ('high_intent' as const) : null,
        escalation:
          request.intakeAnswers.timeline === '30-60 days'
            ? mockEscalationDelivery()
            : null,
      }
    }

    const question = INTAKE_QUESTIONS[index]
    const options = question.options.length > 0 ? `\n\nOptions: ${question.options.join(' / ')}` : ''
    return {
      phases: ['assessing', 'composing'] as const,
      text: `Got it. ${question.text}${options}`,
    }
  }

  const mentionsCanvas = text.includes('canvas') || text.includes('lms')
  const mentionsStrategy = text.includes('strategy') || text.includes('implementation')
  const fallbackText = mentionsCanvas
    ? 'For Canvas environments, the useful first question is whether the AI workflow needs LMS data, LTI placement, content retrieval, or analytics. EdStratum can help map that into a practical pilot instead of starting with a broad model-selection exercise.'
    : mentionsStrategy
      ? 'AI strategy defines the roadmap, ROI assumptions, governance, and first pilot. AI implementation turns that plan into production architecture, integrations, evaluation, and maintainable workflows. EdStratum usually links the two so the strategy stays grounded in what can actually ship.'
      : 'EdStratum is best suited for grounded AI implementation questions: Canvas LMS integration, RAG systems, learning workflows, customer education, and AI readiness. Share the workflow or constraint you are considering and I can help frame a practical next step.'

  return {
    phases: ['searching', 'retrieving', 'composing'] as const,
    text: fallbackText,
    source: MOCK_SOURCE,
    citations: mentionsCanvas || mentionsStrategy ? MOCK_CITATIONS : [],
  }
}

export async function* mockStreamResponse(
  request: StratumStreamRequest,
): AsyncGenerator<StreamEvent> {
  if (sentimentTestMode()) {
    window.__STRATUM_LAST_MOCK_REQUEST__ = request
  }

  const response = responseFor({
    ...request,
    messages:
      request.messages.length > 0
        ? request.messages
        : [
            {
              id: 'mock-user',
              role: 'user',
              content: ESCALATION_REQUEST_TEXT,
              timestamp: Date.now(),
            },
          ],
  })

  for (const phase of response.phases) {
    yield { type: 'phase', phase }
    await delay(120)
  }

  if ('source' in response && response.source) {
    yield { type: 'source', source: response.source }
    await delay(80)
  }

  for (const token of response.text.match(/\S+\s*/g) ?? []) {
    yield { type: 'token', token }
    await delay(18)
  }

  const citations: RagCitation[] = 'citations' in response ? response.citations ?? [] : []
  if (citations.length > 0) {
    yield { type: 'citations', data: citations }
    await delay(60)
  }

  yield {
    type: 'done',
    snapshot: 'snapshot' in response ? response.snapshot ?? null : null,
    escalate: 'escalate' in response ? response.escalate ?? null : null,
    escalation: 'escalation' in response ? response.escalation ?? null : null,
  }
}
