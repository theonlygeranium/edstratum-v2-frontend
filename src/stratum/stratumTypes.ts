export type ProcessingPhase =
  | 'searching'
  | 'retrieving'
  | 'composing'
  | 'assessing'
  | 'escalating'
  | 'idle'

export type ConversationMode = 'open' | 'intake' | 'about' | 'escalation'

export type ChatPhase = 'intake' | 'conversation' | 'complete' | 'escalated'

export type EscalationTrigger =
  | 'explicit'
  | 'confidence'
  | 'high_intent'
  | 'sentiment'
  | null

export type SentimentEscalationSignal = 'frustration' | 'urgency'

export interface EscalationDelivery {
  success: boolean
  status: 'sent' | 'prepared' | 'failed' | 'rate_limited' | 'suppressed'
  messageId?: string | null
  error?: string | null
}

export interface SourceConfidence {
  label: string
  score: number
  grounded: boolean
  stale?: boolean
}

export interface RagCitation {
  source: string
  excerpt: string
}

export interface ReadinessSnapshot {
  situation: string
  capabilities: string
  firstStep: string
}

export interface RuntimeConfig {
  ragEnabled: boolean
  voiceEnabled: boolean
  persistenceEnabled: boolean
  maxIntakeQuestions: number
}

export interface IntakeQuestion {
  id: string
  text: string
  options: string[]
  highIntent?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  phases?: ProcessingPhase[]
  source?: SourceConfidence | null
  citations?: RagCitation[]
  isIntakeQuestion?: boolean
}

export type PhaseEvent = {
  type: 'phase'
  phase: ProcessingPhase
}

export type TokenEvent = {
  type: 'token'
  token: string
}

export type SourceEvent = {
  type: 'source'
  source: SourceConfidence
}

export type CitationsEvent = {
  type: 'citations'
  data: RagCitation[]
}

export type DoneEvent = {
  type: 'done'
  snapshot?: ReadinessSnapshot | null
  escalate?: EscalationTrigger
  escalation?: EscalationDelivery | null
}

export type ErrorEvent = {
  type: 'error'
  message: string
}

export type StreamEvent =
  | PhaseEvent
  | TokenEvent
  | SourceEvent
  | CitationsEvent
  | DoneEvent
  | ErrorEvent

export interface StratumStreamRequest {
  messages: ChatMessage[]
  mode: ConversationMode
  intakeIndex: number | null
  intakeAnswers: Record<string, string>
  sessionId: string
  escalationTrigger?: Exclude<EscalationTrigger, null>
  sentimentSignal?: SentimentEscalationSignal
}
