import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { transitions } from '../lib/motionVariants'
import { detectSentiment, type SentimentSignal } from '../lib/sentimentSignal'
import {
  clearPersistentSession,
  deletePersistentSession,
  getOrCreateSessionId,
  initializePersistentSession,
  loadMessagesFromBackend,
  syncMessageToBackend,
  updateSessionFlags,
} from '../lib/stratumSession'
import { trackEvent } from '../lib/stratumAnalytics'
import { TTSPlayer, ttsFeatureFlagEnabled } from '../lib/ttsPlayer'
import {
  createVoiceInputController,
  type VoiceInputController,
  type VoiceInputStatus,
} from '../lib/voiceInput'
import {
  ESCALATION_REQUEST_TEXT,
  INITIAL_GREETING,
  INTAKE_QUESTIONS,
  MAX_INTAKE_QUESTIONS,
  PHASE_LABELS,
  PROMPT_CHIPS,
  VOICE_CONFIG,
} from './stratumConfig'
import { getStratumConfig, streamStratumResponse } from './stratumApi'
import { sentimentTestMode } from './stratumMock'
import type {
  ChatMessage,
  ChatPhase,
  ConversationMode,
  EscalationDelivery,
  EscalationTrigger,
  ProcessingPhase,
  RagCitation,
  ReadinessSnapshot,
  RuntimeConfig,
  SentimentEscalationSignal,
  SourceConfidence,
} from './stratumTypes'

const SENTIMENT_ESCALATION_COOLDOWN_MS = 10 * 60 * 1000
const PROMPT_CHIP_ANALYTICS: Record<string, string> = {
  'Does AI make sense for my Canvas environment?': 'canvas_ai',
  'What does an EdStratum engagement look like?': 'engagement_shape',
  'Run a quick AI readiness check': 'readiness_check',
  "AI strategy vs. AI implementation - what's the difference?": 'strategy_vs_implementation',
  'Connect with the Founding leadership team': 'founding_leadership',
}
const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  ragEnabled: true,
  voiceEnabled: false,
  persistenceEnabled: false,
  maxIntakeQuestions: MAX_INTAKE_QUESTIONS,
}

type StreamAssistantOptions = {
  escalationTrigger?: Exclude<EscalationTrigger, null>
  sentimentSignal?: SentimentEscalationSignal
}

type SubmitSource = 'connect_button' | 'manual_submit' | 'prompt_chip' | 'voice'
type SubmitText = (text: string, forcedMode?: ConversationMode, source?: SubmitSource) => Promise<void>

function createId(prefix: string) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function assistantMessage(content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: createId('assistant'),
    role: 'assistant',
    content,
    timestamp: Date.now(),
    ...extra,
  }
}

function userMessage(content: string): ChatMessage {
  return {
    id: createId('user'),
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

function systemMessage(content: string): ChatMessage {
  return {
    id: createId('system'),
    role: 'system',
    content,
    timestamp: Date.now(),
  }
}

function escalationConfirmation(delivery: EscalationDelivery | null | undefined) {
  if (delivery?.success) {
    return 'A member of the EdStratum Labs team will reach out within one business day.'
  }

  if (delivery) {
    return 'We encountered an issue. Please email hello@edstratumlabs.ai directly.'
  }

  return null
}

function questionText(index: number) {
  const question = INTAKE_QUESTIONS[index]
  if (!question) {
    return ''
  }

  const options = question.options.length > 0 ? `\n\nOptions: ${question.options.join(' / ')}` : ''
  return `${question.text}${options}`
}

function shouldAutoSubmitVoiceTranscript(text: string) {
  if (!VOICE_CONFIG.autoSubmitOnQuestion) {
    return false
  }

  const clean = text.trim()
  return clean.endsWith('?') || clean.split(/\s+/).filter(Boolean).length > 20
}

function intakeSummaryForPDF(intakeAnswers: Record<string, string>) {
  return INTAKE_QUESTIONS.reduce<Record<string, string>>((summary, question) => {
    const answer = intakeAnswers[question.id]
    if (answer?.trim()) {
      summary[question.text] = answer
    }

    return summary
  }, {})
}

function MessageContent({ content }: { content: string }) {
  return (
    <>
      {content.split('\n').map((line, index) => {
        if (line.trim().length === 0) {
          return <span key={`spacer-${index}`} className="block h-2" />
        }

        if (line.startsWith('### ')) {
          return (
            <strong key={`${index}-${line}`} className="block pt-1 text-text">
              {line.slice(4)}
            </strong>
          )
        }

        return <span key={`${index}-${line}`} className="block">{line}</span>
      })}
    </>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="STRATUM is composing">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-light" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-light [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-light [animation-delay:240ms]" />
    </span>
  )
}

function SourceBadge({ source }: { source: SourceConfidence }) {
  return (
    <div className="mt-2 rounded-md border border-border bg-background/70 px-2.5 py-1.5 text-[11px] leading-snug text-text-muted">
      Source: {source.label} - confidence {Math.round(source.score * 100)}%
    </div>
  )
}

function CitationPanel({ citations }: { citations: RagCitation[] }) {
  const [expanded, setExpanded] = useState(false)
  const [panelId] = useState(() => createId('citation-panel'))

  if (citations.length === 0) {
    return null
  }

  const sourceNames = citations.map((citation) => citation.source).join(', ')

  return (
    <div className="mt-2 rounded-md border border-border bg-background/70 text-[11px] leading-snug text-text-muted">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left font-medium text-text-secondary hover:bg-surface-raised"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span>{citations.length === 1 ? '1 source' : `${citations.length} sources`}</span>
        <span className="min-w-0 flex-1 truncate text-right text-text-muted">{sourceNames}</span>
      </button>
      {expanded ? (
        <div id={panelId} className="space-y-2 border-t border-border px-2.5 py-2">
          {citations.map((citation) => (
            <div key={`${citation.source}-${citation.excerpt.slice(0, 24)}`}>
              <div className="font-semibold text-text">{citation.source}</div>
              <p className="mt-1 text-text-muted">{citation.excerpt}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PhaseRail({ phases }: { phases: ProcessingPhase[] }) {
  if (phases.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3" aria-live="polite">
      {phases.map((phase) => (
        <span
          key={phase}
          className="rounded-md border border-border bg-surface-raised px-2 py-1 text-[11px] font-medium text-text-muted"
        >
          {PHASE_LABELS[phase]}
        </span>
      ))}
    </div>
  )
}

function SnapshotPanel({ snapshot }: { snapshot: ReadinessSnapshot }) {
  return (
    <div className="mx-4 mb-3 rounded-lg border border-border bg-surface px-3 py-3 text-xs leading-relaxed text-text-secondary">
      <div className="mb-2 text-sm font-semibold text-text">Readiness snapshot</div>
      <div className="space-y-2">
        <p><span className="font-semibold text-text">Situation:</span> {snapshot.situation}</p>
        <p><span className="font-semibold text-text">Capabilities:</span> {snapshot.capabilities}</p>
        <p><span className="font-semibold text-text">First step:</span> {snapshot.firstStep}</p>
      </div>
    </div>
  )
}

function EscalationPanel({ trigger }: { trigger: Exclude<EscalationTrigger, null> }) {
  const copy =
    trigger === 'high_intent'
      ? 'The handoff context is ready for the Founding leadership team.'
      : 'The Founding leadership team can follow up with the right context.'

  return (
    <div className="mx-4 mb-3 rounded-lg border border-primary/40 bg-primary-dim px-3 py-3 text-xs leading-relaxed text-text-secondary">
      <div className="text-sm font-semibold text-text">Leadership handoff</div>
      <p className="mt-1">{copy}</p>
    </div>
  )
}

function LogoMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-dim" aria-hidden="true">
      <span className="flex h-4 w-4 flex-col justify-end gap-0.5">
        <span className="block h-0.5 w-1.5 rounded-full bg-primary-light" />
        <span className="block h-0.5 w-3 rounded-full bg-primary-light" />
        <span className="block h-0.5 w-4 rounded-full bg-primary-light" />
      </span>
    </span>
  )
}

export default function StratumChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    assistantMessage(INITIAL_GREETING),
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState<ConversationMode>('open')
  const [chatPhase, setChatPhase] = useState<ChatPhase>('conversation')
  const [intakeIndex, setIntakeIndex] = useState(0)
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({})
  const [activePhases, setActivePhases] = useState<ProcessingPhase[]>([])
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null)
  const [escalation, setEscalation] = useState<Exclude<EscalationTrigger, null> | null>(null)
  const [sentimentEscalationFired, setSentimentEscalationFired] = useState(false)
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG)
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId())
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<VoiceInputStatus>('idle')
  const [voiceAnnouncement, setVoiceAnnouncement] = useState('')
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(VOICE_CONFIG.ttsEnabledByDefault)
  const [pdfPending, setPdfPending] = useState(false)
  const messagesRef = useRef(messages)
  const firstMessageTrackedRef = useRef(false)
  const lastSentimentSignalRef = useRef<SentimentSignal>('neutral')
  const lastEscalationAtRef = useRef<number | null>(null)
  const persistenceHydratedRef = useRef(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const submitTextRef = useRef<SubmitText>(async () => undefined)
  const voiceInputRef = useRef<VoiceInputController | null>(null)
  const ttsPlayerRef = useRef<TTSPlayer | null>(null)
  // Accessibility: refs for focus management
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const voiceFeatureEnabled = runtimeConfig.voiceEnabled
  const showVoiceInput = voiceFeatureEnabled && voiceSupported
  const showTTSControls = voiceFeatureEnabled && ttsFeatureFlagEnabled()
  const showDownloadSummary = chatPhase === 'complete' || chatPhase === 'escalated'
  const showCitationPanels = runtimeConfig.ragEnabled

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const controller = new AbortController()
    void getStratumConfig({ signal: controller.signal }).then((config) => {
      if (!controller.signal.aborted) {
        setRuntimeConfig(config)
      }
    })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!runtimeConfig.persistenceEnabled || persistenceHydratedRef.current) {
      return
    }

    let cancelled = false
    persistenceHydratedRef.current = true

    void (async () => {
      const session = await initializePersistentSession()
      if (!session || cancelled) {
        return
      }

      setSessionId(session.sessionId)
      const restored = await loadMessagesFromBackend(session.sessionId)
      if (cancelled || restored.length === 0) {
        return
      }

      if (messagesRef.current.length === 1) {
        setMessages([assistantMessage(INITIAL_GREETING), ...restored])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [runtimeConfig.persistenceEnabled])

  useEffect(() => {
    const controller = createVoiceInputController()
    voiceInputRef.current = controller
    setVoiceSupported(controller.isSupported)

    controller.onStatusChange = (status) => {
      setVoiceStatus(status)
      if (status === 'listening') {
        setVoiceAnnouncement('Listening for voice input.')
      } else if (status === 'processing') {
        setVoiceAnnouncement('Processing voice input.')
      } else if (status === 'error') {
        setVoiceAnnouncement('Voice input is unavailable.')
      }
    }
    controller.onTranscript = (transcript) => {
      setInput(transcript)
    }
    controller.onFinalTranscript = (transcript) => {
      setInput(transcript)
      setVoiceAnnouncement('Voice input captured.')
      if (shouldAutoSubmitVoiceTranscript(transcript)) {
        window.setTimeout(() => {
          void submitTextRef.current(transcript, undefined, 'voice')
        }, 0)
      }
    }
    controller.onError = () => {
      setVoiceStatus('error')
      setVoiceAnnouncement('Voice input is unavailable.')
    }

    return () => {
      controller.stop()
      if (voiceInputRef.current === controller) {
        voiceInputRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!showTTSControls) {
      ttsPlayerRef.current?.stop()
      ttsPlayerRef.current = null
      setTtsEnabled(false)
      return
    }

    const player = new TTSPlayer({
      sessionId: () => sessionId,
    })
    ttsPlayerRef.current = player
    setTtsEnabled(player.isEnabled)

    return () => {
      player.stop()
      if (ttsPlayerRef.current === player) {
        ttsPlayerRef.current = null
      }
    }
  }, [sessionId, showTTSControls])

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, activePhases, snapshot, escalation])

  // Abort any in-flight stream on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Accessibility: Escape key closes the dialog and returns focus to trigger
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeChat()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Accessibility: move focus into input when dialog opens
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 80)
      return () => window.clearTimeout(id)
    }
  }, [open])

  // Accessibility: close helper — returns focus to trigger button
  function closeChat() {
    voiceInputRef.current?.stop()
    setOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 50)
  }

  // Accessibility: transcript reset — clears state back to initial greeting
  function resetTranscript() {
    abortRef.current?.abort()
    abortRef.current = null
    voiceInputRef.current?.stop()
    ttsPlayerRef.current?.stop()
    setPending(false)
    setMessages([assistantMessage(INITIAL_GREETING)])
    setMode('open')
    setChatPhase('conversation')
    setIntakeIndex(0)
    setIntakeAnswers({})
    setSnapshot(null)
    setEscalation(null)
    setSentimentEscalationFired(false)
    lastSentimentSignalRef.current = 'neutral'
    lastEscalationAtRef.current = null
    setActivePhases([])
    if (runtimeConfig.persistenceEnabled) {
      void deletePersistentSession()
      clearPersistentSession()
      void initializePersistentSession().then((session) => {
        if (session) {
          setSessionId(session.sessionId)
        }
      })
    }
    trackEvent('transcript_reset')
    // Return focus to input after reset
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  function speakAssistantMessage(content: string) {
    const player = ttsPlayerRef.current
    if (!showTTSControls || !player?.isEnabled) {
      return
    }

    void player.speak(content)
  }

  function persistMessage(message: ChatMessage) {
    if (runtimeConfig.persistenceEnabled) {
      void syncMessageToBackend(sessionId, message)
    }
  }

  function persistSessionFlags(flags: { escalated?: boolean; intakeComplete?: boolean }) {
    if (runtimeConfig.persistenceEnabled) {
      void updateSessionFlags(sessionId, flags)
    }
  }

  const appendMessage = (
    message: ChatMessage,
    options: { persist?: boolean } = {},
  ) => {
    setMessages((current) => [...current, message])
    if (options.persist !== false) {
      persistMessage(message)
    }
  }

  const patchMessage = (id: string, patch: Partial<ChatMessage> | ((message: ChatMessage) => ChatMessage)) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== id) {
          return message
        }

        return typeof patch === 'function' ? patch(message) : { ...message, ...patch }
      }),
    )
  }

  function sentimentCooldownActive() {
    if (sentimentTestMode()) {
      return false
    }

    const lastEscalationAt = lastEscalationAtRef.current
    return lastEscalationAt !== null && Date.now() - lastEscalationAt < SENTIMENT_ESCALATION_COOLDOWN_MS
  }

  async function handleSentimentSignal(
    signal: SentimentSignal,
    requestMessages: ChatMessage[],
  ) {
    if (signal === 'neutral') {
      lastSentimentSignalRef.current = 'neutral'
      return false
    }

    const changedFromNeutral = lastSentimentSignalRef.current === 'neutral'
    lastSentimentSignalRef.current = signal

    if (!changedFromNeutral || sentimentEscalationFired || sentimentCooldownActive()) {
      return false
    }

    setSentimentEscalationFired(true)

    if (signal === 'frustration') {
      appendMessage(assistantMessage(
        "It sounds like you're running into some friction. Would it help to connect with EdStratum's Founding leadership team?",
      ))
      trackEvent('sentiment_escalation_prompted', { signal })
      return true
    }

    appendMessage(assistantMessage(
      "This sounds time-sensitive. I'll make sure EdStratum's Founding leadership team sees the context right away.",
    ))
    trackEvent('handoff_intent', { trigger: 'sentiment', signal })
    trackEvent('sentiment_escalation_triggered', { signal })
    lastEscalationAtRef.current = Date.now()
    await streamAssistantResponse('escalation', requestMessages, null, intakeAnswers, {
      escalationTrigger: 'sentiment',
      sentimentSignal: signal,
    })
    return true
  }

  async function streamAssistantResponse(
    requestMode: ConversationMode,
    requestMessages: ChatMessage[],
    nextIntakeIndex: number | null,
    nextIntakeAnswers: Record<string, string>,
    options: StreamAssistantOptions = {},
  ) {
    const responseId = createId('assistant')
    const controller = new AbortController()
    let assistantDraft: ChatMessage = {
      id: responseId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    let assistantPersisted = false
    const persistAssistantDraft = () => {
      if (!assistantPersisted && assistantDraft.content.trim().length > 0) {
        assistantPersisted = true
        persistMessage(assistantDraft)
      }
    }
    abortRef.current = controller

    setPending(true)
    setActivePhases([])
    setSnapshot(null)
    setEscalation(null)
    appendMessage(assistantDraft, { persist: false })

    try {
      for await (const event of streamStratumResponse(
        {
          messages: requestMessages,
          mode: requestMode,
          intakeIndex: nextIntakeIndex,
          intakeAnswers: nextIntakeAnswers,
          sessionId,
          ...options,
        },
        { signal: controller.signal },
      )) {
        if (event.type === 'phase') {
          setActivePhases((current) =>
            current.includes(event.phase) ? current : [...current, event.phase],
          )
          assistantDraft = {
            ...assistantDraft,
            phases: [...(assistantDraft.phases ?? []), event.phase],
          }
          patchMessage(responseId, (message) => ({
            ...message,
            phases: [...(message.phases ?? []), event.phase],
          }))
        }

        if (event.type === 'source') {
          assistantDraft = { ...assistantDraft, source: event.source }
          patchMessage(responseId, { source: event.source })
        }

        if (event.type === 'citations') {
          assistantDraft = { ...assistantDraft, citations: event.data }
          patchMessage(responseId, { citations: event.data })
        }

        if (event.type === 'token') {
          assistantDraft = {
            ...assistantDraft,
            content: `${assistantDraft.content}${event.token}`,
          }
          patchMessage(responseId, (message) => ({
            ...message,
            content: `${message.content}${event.token}`,
          }))
        }

        if (event.type === 'done') {
          setActivePhases([])
          setSnapshot(event.snapshot ?? null)
          setEscalation(event.escalate ?? null)
          if (event.snapshot) {
            setChatPhase('complete')
            trackEvent('intake_completed')
            trackEvent('readiness_completed')
            persistSessionFlags({ intakeComplete: true })
          }
          if (event.escalate) {
            setChatPhase('escalated')
            lastEscalationAtRef.current = Date.now()
            if (event.escalate === 'sentiment') {
              setSentimentEscalationFired(true)
            }
            persistSessionFlags({ escalated: true })
            trackEvent('escalation_triggered', {
              trigger: event.escalate,
              deliveryStatus: event.escalation?.status ?? 'prepared',
            })
            const confirmation = escalationConfirmation(event.escalation)
            if (confirmation) {
              appendMessage(systemMessage(confirmation))
            }
          }
          persistAssistantDraft()
          speakAssistantMessage(assistantDraft.content)
        }

        if (event.type === 'error') {
          setActivePhases([])
          trackEvent('backend_error', { mode: requestMode, status: 'stream_event' })
          assistantDraft = { ...assistantDraft, content: event.message }
          patchMessage(responseId, { content: event.message })
          persistAssistantDraft()
          break
        }
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        trackEvent('backend_error', { mode: requestMode, status: 'unknown' })
        assistantDraft = {
          ...assistantDraft,
          content: 'STRATUM hit a temporary issue. Please try again in a moment.',
        }
        patchMessage(responseId, {
          content: 'STRATUM hit a temporary issue. Please try again in a moment.',
        })
        persistAssistantDraft()
      }
    } finally {
      persistAssistantDraft()
      setPending(false)
      abortRef.current = null
      if (requestMode !== 'intake') {
        setMode('open')
      }
    }
  }

  function startIntake() {
    setOpen(true)
    setMode('intake')
    setChatPhase('intake')
    setIntakeIndex(0)
    setIntakeAnswers({})
    setSnapshot(null)
    setEscalation(null)
    appendMessage(assistantMessage(questionText(0), { isIntakeQuestion: true }))
  }

  async function submitText(
    text: string,
    forcedMode?: ConversationMode,
    source: SubmitSource = 'manual_submit',
  ) {
    const clean = text.trim()
    if (!clean || pending) {
      return
    }

    const requestMode = forcedMode ?? mode
    if (!firstMessageTrackedRef.current) {
      firstMessageTrackedRef.current = true
      trackEvent('first_message_sent', {
        mode: requestMode,
        source,
      })
    }

    const nextUserMessage = userMessage(clean)
    const requestMessages = [...messagesRef.current, nextUserMessage]
    appendMessage(nextUserMessage)
    setInput('')
    setOpen(true)

    if (requestMode !== 'escalation') {
      const sentimentSignal = detectSentiment(
        requestMessages
          .filter((message) => message.role === 'user')
          .map((message) => message.content),
      )
      if (await handleSentimentSignal(sentimentSignal, requestMessages)) {
        return
      }
    }

    if (requestMode === 'intake') {
      const question = INTAKE_QUESTIONS[intakeIndex]
      const nextAnswers = question
        ? { ...intakeAnswers, [question.id]: clean }
        : intakeAnswers
      const nextIndex = intakeIndex + 1

      setIntakeAnswers(nextAnswers)
      setIntakeIndex(nextIndex)

      if (nextIndex < INTAKE_QUESTIONS.length) {
        appendMessage(assistantMessage(questionText(nextIndex), { isIntakeQuestion: true }))
        return
      }

      await streamAssistantResponse('intake', requestMessages, nextIndex, nextAnswers)
      setMode('open')
      return
    }

    await streamAssistantResponse(requestMode, requestMessages, null, intakeAnswers)
  }

  submitTextRef.current = submitText

  function handlePrompt(label: string, promptMode: ConversationMode) {
    trackEvent('prompt_chip_clicked', { chip: PROMPT_CHIP_ANALYTICS[label] ?? 'canvas_ai' })
    if (promptMode === 'intake') {
      startIntake()
      return
    }

    if (promptMode === 'escalation') {
      trackEvent('handoff_intent', { trigger: 'explicit' })
    }

    const promptText = promptMode === 'escalation' ? ESCALATION_REQUEST_TEXT : label
    void submitText(promptText, promptMode, 'prompt_chip')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitText(input)
  }

  function handleVoiceInput() {
    const controller = voiceInputRef.current
    if (!controller) {
      return
    }

    if (voiceStatus === 'listening') {
      controller.stop()
      return
    }

    setVoiceAnnouncement('')
    controller.start()
  }

  function handleTTSToggle() {
    const player = ttsPlayerRef.current
    if (!player) {
      return
    }

    setTtsEnabled(player.toggle())
  }

  async function handleDownloadSummary() {
    if (pdfPending) {
      return
    }

    setPdfPending(true)
    try {
      const { downloadSessionPDF } = await import('../lib/stratumPDF')
      await downloadSessionPDF({
        messages: messagesRef.current,
        intakeSummary: intakeSummaryForPDF(intakeAnswers),
        sessionId,
        generatedAt: new Date().toISOString(),
      })
      trackEvent('session_summary_downloaded', { phase: chatPhase })
    } catch {
      trackEvent('session_summary_download_failed', { phase: chatPhase })
    } finally {
      setPdfPending(false)
    }
  }

  function handleOpen() {
    setOpen(true)
    trackEvent('chatbot_opened')
  }

  function handleExplicitHandoff() {
    trackEvent('handoff_intent', { trigger: 'explicit' })
    void submitText(ESCALATION_REQUEST_TEXT, 'escalation', 'connect_button')
  }

  const showPromptChips = messages.length === 1 && !pending

  return (
    <>
      <m.button
        ref={triggerRef}
        type="button"
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={transitions.snapSpring}
        onClick={handleOpen}
        data-stratum-trigger="open"
        className={[
          'fixed bottom-5 right-5 z-[70] flex items-center gap-3 rounded-lg',
          'border border-border-bright bg-surface px-4 py-3 text-left shadow-2xl',
          'text-text hover:border-primary/60 hover:bg-surface-raised',
          open ? 'pointer-events-none opacity-0' : 'opacity-100',
        ].join(' ')}
        aria-label="Open STRATUM chat"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <LogoMark />
        <span className="hidden sm:block">
          <span className="block text-sm font-semibold leading-tight">STRATUM</span>
          <span className="block text-xs text-text-muted">AI Intake Advisor</span>
        </span>
      </m.button>

      <AnimatePresence>
        {open && (
          <m.aside
            key="stratum-chat"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={transitions.enter}
            role="dialog"
            aria-modal="true"
            aria-label="STRATUM AI Intake Advisor"
            className={[
              'fixed bottom-3 left-3 right-3 z-[70] flex flex-col overflow-hidden rounded-lg',
              'border border-border-bright bg-background shadow-2xl shadow-black/50',
              'sm:bottom-6 sm:left-auto sm:right-6 sm:w-[380px]',
            ].join(' ')}
            style={{ height: 'min(640px, calc(100vh - 1.5rem))' }}
          >
            <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
              <LogoMark />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight text-text">STRATUM</div>
                <div className="truncate text-xs text-text-muted">AI Intake Advisor</div>
              </div>
              <button
                type="button"
                onClick={handleExplicitHandoff}
                disabled={pending || escalation !== null}
                className="rounded-md px-2 py-1 text-xs font-semibold text-text-accent hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-50"
              >
                Connect
              </button>
              {showTTSControls ? (
                <button
                  type="button"
                  onClick={handleTTSToggle}
                  aria-pressed={ttsEnabled}
                  aria-label={ttsEnabled ? 'Disable voice playback' : 'Enable voice playback'}
                  className={[
                    'rounded-md px-2 py-1 text-xs font-semibold',
                    ttsEnabled
                      ? 'bg-primary-dim text-text-accent'
                      : 'text-text-muted hover:bg-surface-raised hover:text-text',
                  ].join(' ')}
                >
                  {ttsEnabled ? 'Voice on' : 'Voice'}
                </button>
              ) : null}
              {/* Accessibility: transcript reset button */}
              <button
                type="button"
                onClick={resetTranscript}
                disabled={pending}
                title="Clear conversation"
                aria-label="Clear conversation and start over"
                className="rounded-md px-2 py-1 text-sm text-text-muted hover:bg-surface-raised hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                ↺
              </button>
              {/* Accessibility: close button now calls closeChat() for focus return */}
              <button
                type="button"
                onClick={closeChat}
                className="rounded-md px-2 py-1 text-sm font-semibold text-text-muted hover:bg-surface-raised hover:text-text"
                aria-label="Close STRATUM chat (Escape)"
              >
                ✕
              </button>
            </header>

            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      'flex',
                      message.role === 'system'
                        ? 'justify-center'
                        : message.role === 'user'
                          ? 'justify-end'
                          : 'justify-start',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'break-words [overflow-wrap:anywhere]',
                        message.role === 'user'
                          ? 'max-w-[82%] rounded-lg bg-primary px-3.5 py-3 text-sm leading-relaxed text-white'
                          : message.role === 'system'
                            ? 'max-w-[90%] rounded-full border border-primary/40 bg-primary-dim px-3 py-2 text-center text-xs font-semibold leading-snug text-text'
                            : 'max-w-[82%] rounded-lg border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed text-text-secondary',
                      ].join(' ')}
                    >
                      {message.content ? <MessageContent content={message.content} /> : <TypingDots />}
                      {message.role !== 'system' && message.source ? <SourceBadge source={message.source} /> : null}
                      {showCitationPanels && message.role !== 'system' && message.citations && message.citations.length > 0 ? (
                        <CitationPanel citations={message.citations} />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {showPromptChips ? (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium text-text-muted">Try one of these to get started:</div>
                  <div className="grid gap-2">
                    {PROMPT_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => handlePrompt(chip.label, chip.mode)}
                        className={[
                          'rounded-lg border border-border bg-surface px-3.5 py-3 text-left',
                          'text-sm leading-snug text-text-secondary transition-colors',
                          'hover:border-primary/50 hover:bg-surface-raised hover:text-text',
                        ].join(' ')}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <PhaseRail phases={activePhases} />
            {snapshot ? <SnapshotPanel snapshot={snapshot} /> : null}
            {escalation ? <EscalationPanel trigger={escalation} /> : null}
            {showDownloadSummary ? (
              <div className="mx-4 mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleDownloadSummary()}
                  disabled={pdfPending}
                  aria-label="Download session summary as PDF"
                  className={[
                    'inline-flex items-center gap-2 rounded-md border border-primary/50',
                    'bg-primary-dim px-3 py-2 text-xs font-semibold text-text-accent',
                    'hover:border-primary hover:bg-surface-raised disabled:cursor-wait disabled:opacity-70',
                  ].join(' ')}
                >
                  {pdfPending ? (
                    <>
                      <span
                        className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                        aria-hidden="true"
                      />
                      Preparing
                    </>
                  ) : (
                    'Download Summary'
                  )}
                </button>
              </div>
            ) : null}
            <span className="sr-only" aria-live="polite">{voiceAnnouncement}</span>

            <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border bg-surface p-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={pending}
                placeholder={mode === 'intake' ? 'Answer the readiness question' : 'Ask STRATUM'}
                className={[
                  'min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2',
                  'text-sm text-text placeholder:text-text-disabled',
                  'focus:border-primary focus:outline-none',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                ].join(' ')}
              />
              {showVoiceInput ? (
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  disabled={pending && voiceStatus !== 'listening'}
                  aria-pressed={voiceStatus === 'listening'}
                  aria-label={voiceStatus === 'listening' ? 'Stop voice input' : 'Start voice input'}
                  className={[
                    'inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold',
                    voiceStatus === 'listening'
                      ? 'border-red-400/70 bg-red-500/10 text-red-200'
                      : 'bg-background text-text-secondary hover:border-primary/50 hover:bg-surface-raised',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  ].join(' ')}
                >
                  {voiceStatus === 'listening' ? (
                    <>
                      <span
                        className="h-2 w-2 animate-pulse rounded-full bg-red-300"
                        aria-hidden="true"
                      />
                      Listening...
                    </>
                  ) : voiceStatus === 'processing' ? (
                    'Processing'
                  ) : (
                    'Mic'
                  )}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={pending || input.trim().length === 0}
                className={[
                  'rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white',
                  'hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                Send
              </button>
            </form>
          </m.aside>
        )}
      </AnimatePresence>
    </>
  )
}
