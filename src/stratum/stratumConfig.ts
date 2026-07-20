import type { IntakeQuestion, ProcessingPhase } from './stratumTypes'

const PRODUCTION_HOSTS = new Set(['edstratumlabs.ai', 'www.edstratumlabs.ai'])

interface BrowserLocation {
  hostname: string
  origin: string
}

function currentLocation(): BrowserLocation | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.location
}

export function stratumApiUrlForRuntime(
  configuredApiUrl: string | undefined,
  location: BrowserLocation | null = currentLocation(),
) {
  if (location && PRODUCTION_HOSTS.has(location.hostname)) {
    return location.origin
  }

  return configuredApiUrl?.trim() ?? ''
}

function rawConfiguredApiUrl() {
  if (typeof import.meta.env?.VITE_STRATUM_API_URL !== 'string') {
    return ''
  }

  return import.meta.env.VITE_STRATUM_API_URL
}

const rawApiUrl = stratumApiUrlForRuntime(rawConfiguredApiUrl())

export const STRATUM_API_URL = rawApiUrl.replace(/\/+$/, '')
export const STRATUM_BACKEND_ENABLED = STRATUM_API_URL.length > 0
export const STRATUM_SESSION_KEY = 'stratum-session-id'

export const VOICE_CONFIG = {
  maxTTSCharsPerMessage: 500,
  autoSubmitOnQuestion: true,
  ttsEnabledByDefault: false,
} as const

export const INITIAL_GREETING =
  "Hi, I'm STRATUM - EdStratum's AI intake advisor. I can help you figure out whether an AI engagement makes sense for your situation. Ask me anything about our services, or run a quick readiness check."

export const ESCALATION_REQUEST_TEXT =
  "I'd like to connect with the Founding leadership team."

export const PROMPT_CHIPS = [
  {
    label: 'Does AI make sense for my Canvas environment?',
    mode: 'open',
  },
  {
    label: 'What does an EdStratum engagement look like?',
    mode: 'open',
  },
  {
    label: 'Run a quick AI readiness check',
    mode: 'intake',
  },
  {
    label: "AI strategy vs. AI implementation - what's the difference?",
    mode: 'open',
  },
  {
    label: 'Connect with the Founding leadership team',
    mode: 'escalation',
  },
] as const

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: 'org-type',
    text: 'What type of organization are you?',
    options: ['EdTech platform', 'Higher Ed institution', 'K-12', 'Other'],
  },
  {
    id: 'canvas-usage',
    text: 'Are you currently using Instructure Canvas? If so, in what capacity?',
    options: [],
  },
  {
    id: 'problem',
    text: 'What problem are you trying to solve with AI?',
    options: [],
  },
  {
    id: 'data-infra',
    text: 'What is your current data infrastructure and quality level?',
    options: ['Mature / clean', 'Developing', 'Minimal / messy', 'Unknown'],
  },
  {
    id: 'engineering',
    text: 'Do you have an internal engineering team, or would this be fully outsourced?',
    options: ['Internal team', 'Fully outsourced', 'Hybrid', 'Not sure yet'],
  },
  {
    id: 'timeline',
    text: 'What is your approximate timeline for an AI initiative?',
    options: ['30-60 days', '3-6 months', '6-12 months', 'Exploring'],
    highIntent: true,
  },
  {
    id: 'success',
    text: 'What does success look like in 6 months?',
    options: [],
  },
]

export const MAX_INTAKE_QUESTIONS = INTAKE_QUESTIONS.length

export const PHASE_LABELS: Record<ProcessingPhase, string> = {
  searching: 'Searching knowledge base',
  retrieving: 'Retrieving source context',
  composing: 'Composing response',
  assessing: 'Assessing readiness',
  escalating: 'Preparing leadership handoff',
  idle: 'Ready',
}
