import { STRATUM_SESSION_KEY } from '../stratum/stratumConfig'
import type { ChatMessage } from '../stratum/stratumTypes'

const STRATUM_SESSION_TOKEN_KEY = `${STRATUM_SESSION_KEY}-token`

type SessionStorageMode = 'session' | 'persistent'

interface PersistentSession {
  sessionId: string
  sessionToken: string
}

interface PersistedMessage {
  id?: unknown
  role?: unknown
  content?: unknown
  timestamp?: unknown
  citations?: unknown
}

function newSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `stratum-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function storageFor(mode: SessionStorageMode) {
  return mode === 'persistent' ? window.localStorage : window.sessionStorage
}

function safeGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage can fail in hardened browser modes; the chat still works.
  }
}

function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // Best-effort cleanup only.
  }
}

function persistentSession() {
  const sessionId = safeGet(window.localStorage, STRATUM_SESSION_KEY)
  const sessionToken = safeGet(window.localStorage, STRATUM_SESSION_TOKEN_KEY)
  return sessionId && sessionToken ? { sessionId, sessionToken } : null
}

function authHeaders(sessionToken: string) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  }
}

function normalizePersistedMessage(message: PersistedMessage): ChatMessage | null {
  if (
    message.role !== 'user' &&
    message.role !== 'assistant' &&
    message.role !== 'system'
  ) {
    return null
  }

  if (typeof message.content !== 'string' || message.content.length === 0) {
    return null
  }

  return {
    id: typeof message.id === 'string' && message.id ? message.id : newSessionId(),
    role: message.role,
    content: message.content,
    timestamp:
      typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)
        ? message.timestamp
        : Date.now(),
    citations: Array.isArray(message.citations)
      ? message.citations.filter((citation) => {
          if (!citation || typeof citation !== 'object') {
            return false
          }

          const candidate = citation as Record<string, unknown>
          return typeof candidate.source === 'string' && typeof candidate.excerpt === 'string'
        }) as ChatMessage['citations']
      : [],
  }
}

export function getOrCreateSessionId(options: { persistent?: boolean } = {}) {
  const storage = storageFor(options.persistent ? 'persistent' : 'session')
  const current = safeGet(storage, STRATUM_SESSION_KEY)
  if (current) {
    return current
  }

  const next = newSessionId()
  safeSet(storage, STRATUM_SESSION_KEY, next)
  return next
}

export function clearPersistentSession() {
  safeRemove(window.localStorage, STRATUM_SESSION_KEY)
  safeRemove(window.localStorage, STRATUM_SESSION_TOKEN_KEY)
}

export async function deletePersistentSession(sessionId?: string): Promise<void> {
  const session = persistentSession()
  if (!session || (sessionId && session.sessionId !== sessionId)) {
    return
  }

  try {
    await fetch(`/api/sessions/${encodeURIComponent(session.sessionId)}`, {
      method: 'DELETE',
      headers: authHeaders(session.sessionToken),
    })
  } catch {
    // Persistence cleanup is best-effort and must never block transcript reset.
  }
}

export async function initializePersistentSession(): Promise<PersistentSession | null> {
  const current = persistentSession()
  if (current) {
    return current
  }

  clearPersistentSession()

  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      return null
    }

    const data = await response.json() as Partial<PersistentSession>
    if (typeof data.sessionId !== 'string' || typeof data.sessionToken !== 'string') {
      return null
    }

    safeSet(window.localStorage, STRATUM_SESSION_KEY, data.sessionId)
    safeSet(window.localStorage, STRATUM_SESSION_TOKEN_KEY, data.sessionToken)
    return {
      sessionId: data.sessionId,
      sessionToken: data.sessionToken,
    }
  } catch {
    return null
  }
}

export async function loadMessagesFromBackend(sessionId: string): Promise<ChatMessage[]> {
  const session = persistentSession()
  if (!session || session.sessionId !== sessionId) {
    return []
  }

  try {
    const response = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        headers: authHeaders(session.sessionToken),
      },
    )
    if (!response.ok) {
      return []
    }

    const data = await response.json() as { messages?: unknown }
    if (!Array.isArray(data.messages)) {
      return []
    }

    return data.messages
      .map((message) => normalizePersistedMessage(message as PersistedMessage))
      .filter((message): message is ChatMessage => message !== null)
  } catch {
    return []
  }
}

export async function syncMessageToBackend(
  sessionId: string,
  message: ChatMessage,
): Promise<void> {
  const session = persistentSession()
  if (!session || session.sessionId !== sessionId) {
    return
  }

  try {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify({ message }),
    })
  } catch {
    // Persistence is best-effort and must never block the chat.
  }
}

export async function updateSessionFlags(
  sessionId: string,
  flags: { escalated?: boolean; intakeComplete?: boolean },
): Promise<void> {
  const session = persistentSession()
  if (!session || session.sessionId !== sessionId) {
    return
  }

  try {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: authHeaders(session.sessionToken),
      body: JSON.stringify(flags),
    })
  } catch {
    // Persistence is best-effort and must never block the chat.
  }
}
