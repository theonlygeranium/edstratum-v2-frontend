import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { transitions } from '../lib/motionVariants'
import {
  ESCALATION_REQUEST_TEXT,
  INITIAL_GREETING,
  INTAKE_QUESTIONS,
  PHASE_LABELS,
  PROMPT_CHIPS,
} from './stratumConfig'
import { getSessionId, streamStratumResponse } from './stratumApi'
import type {
  ChatMessage,
  ConversationMode,
  EscalationTrigger,
  ProcessingPhase,
  RagCitation,
  ReadinessSnapshot,
  SourceConfidence,
} from './stratumTypes'
import { trackEvent } from '../lib/stratumAnalytics'

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

function questionText(index: number) {
  const question = INTAKE_QUESTIONS[index]
  if (!question) {
    return ''
  }

  const options = question.options.length > 0 ? `\n\nOptions: ${question.options.join(' / ')}` : ''
  return `${question.text}${options}`
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
  const [intakeIndex, setIntakeIndex] = useState(0)
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({})
  const [activePhases, setActivePhases] = useState<ProcessingPhase[]>([])
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null)
  const [escalation, setEscalation] = useState<Exclude<EscalationTrigger, null> | null>(null)
  const messagesRef = useRef(messages)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Accessibility: refs for focus management
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Accessibility: move focus into input when dialog opens
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 80)
      return () => window.clearTimeout(id)
    }
  }, [open])

  // Accessibility: close helper — returns focus to trigger button
  function closeChat() {
    setOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 50)
  }

  // Accessibility: transcript reset — clears state back to initial greeting
  function resetTranscript() {
    abortRef.current?.abort()
    abortRef.current = null
    setPending(false)
    setMessages([assistantMessage(INITIAL_GREETING)])
    setMode('open')
    setIntakeIndex(0)
    setIntakeAnswers({})
    setSnapshot(null)
    setEscalation(null)
    setActivePhases([])
    trackEvent('transcript_reset')
    // Return focus to input after reset
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  const appendMessage = (message: ChatMessage) => {
    setMessages((current) => [...current, message])
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

  async function streamAssistantResponse(
    requestMode: ConversationMode,
    requestMessages: ChatMessage[],
    nextIntakeIndex: number | null,
    nextIntakeAnswers: Record<string, string>,
  ) {
    const responseId = createId('assistant')
    const controller = new AbortController()
    abortRef.current = controller

    setPending(true)
    setActivePhases([])
    setSnapshot(null)
    setEscalation(null)
    appendMessage({
      id: responseId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    })

    try {
      for await (const event of streamStratumResponse(
        {
          messages: requestMessages,
          mode: requestMode,
          intakeIndex: nextIntakeIndex,
          intakeAnswers: nextIntakeAnswers,
          sessionId: getSessionId(),
        },
        { signal: controller.signal },
      )) {
        if (event.type === 'phase') {
          setActivePhases((current) =>
            current.includes(event.phase) ? current : [...current, event.phase],
          )
          patchMessage(responseId, (message) => ({
            ...message,
            phases: [...(message.phases ?? []), event.phase],
          }))
        }

        if (event.type === 'source') {
          patchMessage(responseId, { source: event.source })
        }

        if (event.type === 'citations') {
          patchMessage(responseId, { citations: event.data })
        }

        if (event.type === 'token') {
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
            trackEvent('intake_completed')
          }
          if (event.escalate) {
            trackEvent('escalation_triggered', { trigger: event.escalate })
          }
        }

        if (event.type === 'error') {
          setActivePhases([])
          patchMessage(responseId, { content: event.message })
          break
        }
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        patchMessage(responseId, {
          content: 'STRATUM hit a temporary issue. Please try again in a moment.',
        })
      }
    } finally {
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
    setIntakeIndex(0)
    setIntakeAnswers({})
    setSnapshot(null)
    setEscalation(null)
    appendMessage(assistantMessage(questionText(0), { isIntakeQuestion: true }))
  }

  async function submitText(text: string, forcedMode?: ConversationMode) {
    const clean = text.trim()
    if (!clean || pending) {
      return
    }

    const requestMode = forcedMode ?? mode
    const nextUserMessage = userMessage(clean)
    const requestMessages = [...messagesRef.current, nextUserMessage]
    appendMessage(nextUserMessage)
    setInput('')
    setOpen(true)

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

  function handlePrompt(label: string, promptMode: ConversationMode) {
    trackEvent('prompt_chip_clicked', { chip: label })
    if (promptMode === 'intake') {
      startIntake()
      return
    }

    const promptText = promptMode === 'escalation' ? ESCALATION_REQUEST_TEXT : label
    void submitText(promptText, promptMode)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitText(input)
  }

  function handleOpen() {
    setOpen(true)
    trackEvent('chatbot_opened')
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
                onClick={() => void submitText(ESCALATION_REQUEST_TEXT, 'escalation')}
                disabled={pending}
                className="rounded-md px-2 py-1 text-xs font-semibold text-text-accent hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-50"
              >
                Connect
              </button>
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
                      message.role === 'user' ? 'justify-end' : 'justify-start',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'max-w-[82%] rounded-lg px-3.5 py-3 text-sm leading-relaxed',
                        'break-words [overflow-wrap:anywhere]',
                        message.role === 'user'
                          ? 'bg-primary text-white'
                          : 'border border-border bg-surface text-text-secondary',
                      ].join(' ')}
                    >
                      {message.content ? <MessageContent content={message.content} /> : <TypingDots />}
                      {message.source ? <SourceBadge source={message.source} /> : null}
                      {message.citations && message.citations.length > 0 ? (
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
