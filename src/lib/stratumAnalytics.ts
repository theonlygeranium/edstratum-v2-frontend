/**
 * stratumAnalytics.ts
 *
 * Lightweight, privacy-respecting analytics for StratumChat.
 * Tracks chatbot behavioral signals only — no conversation text,
 * no PII, no third-party SDK added to the bundle.
 *
 * Storage: sessionStorage (cleared on tab close, never persists cross-session).
 * Flush: batches events and sends via navigator.sendBeacon to Cloudflare
 *        Web Analytics or any lightweight endpoint. Falls back to a no-op
 *        if the endpoint is not configured.
 *
 * Events tracked:
 *   chatbot_opened          — user opens the chat panel
 *   prompt_chip_clicked     — user clicks a prompt chip ({ chip: string })
 *   intake_completed        — user completes all intake questions
 *   escalation_triggered    — escalation fires ({ trigger: string })
 *   transcript_reset        — user clears the conversation
 */

type AnalyticsPayload = {
  event: string
  properties?: Record<string, string>
  ts: number
  session: string
}

// Resolve endpoint from Vite env — omit the var to disable analytics silently.
const ANALYTICS_ENDPOINT: string =
  import.meta.env?.VITE_ANALYTICS_ENDPOINT ?? ''

function getAnalyticsSessionId(): string {
  const key = 'stratum_analytics_sid'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
    sessionStorage.setItem(key, sid)
  }
  return sid
}

const queue: AnalyticsPayload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flush() {
  if (queue.length === 0 || !ANALYTICS_ENDPOINT) return
  const batch = queue.splice(0, queue.length)
  try {
    const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' })
    navigator.sendBeacon(ANALYTICS_ENDPOINT, blob)
  } catch {
    // sendBeacon is best-effort — swallow all errors
  }
}

/**
 * Track a named event with optional string properties.
 * Safe to call in any environment — no-op if analytics is not configured.
 */
export function trackEvent(event: string, properties?: Record<string, string>): void {
  if (typeof window === 'undefined') return

  queue.push({
    event,
    properties,
    ts: Date.now(),
    session: getAnalyticsSessionId(),
  })

  // Debounce flush: batch events within a 2s window, then send
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, 2000)
}

// Flush remaining events when the page is hidden (tab switch, navigation, close)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}