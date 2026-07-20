import { VOICE_CONFIG } from '../stratum/stratumConfig'
import { getOrCreateSessionId } from './stratumSession'

const TTS_STORAGE_KEY = 'stratum_tts_enabled'
const TTS_TEST_OVERRIDE_KEY = 'stratum_tts_test_enabled'

type AudioContextConstructor = new () => AudioContext

type AudioWindow = Window & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
}

export interface TTSPlayerOptions {
  apiBaseUrl?: string
  sessionId?: () => string
}

export class TTSPlayer {
  private apiBaseUrl: string
  private sessionId: () => string
  private enabled: boolean
  private speaking = false
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private queue: Promise<void> = Promise.resolve()

  constructor(options: TTSPlayerOptions = {}) {
    this.apiBaseUrl = (options.apiBaseUrl ?? '').replace(/\/+$/, '')
    this.sessionId = options.sessionId ?? getOrCreateSessionId
    this.enabled = readStoredEnabled()
  }

  get isEnabled() {
    return this.enabled
  }

  get isSpeaking() {
    return this.speaking
  }

  toggle(next?: boolean) {
    this.enabled = typeof next === 'boolean' ? next : !this.enabled
    writeStoredEnabled(this.enabled)
    if (!this.enabled) {
      this.stop()
    }
    return this.enabled
  }

  stop() {
    this.queue = Promise.resolve()
    this.speaking = false
    try {
      this.currentSource?.stop()
    } catch {
      // Stopping an already-ended source can throw in some browsers.
    }
    this.currentSource = null
  }

  async speak(text: string) {
    const cleanText = sanitizeTTSInput(text)
    if (!this.enabled || !cleanText || prefersReducedMotion()) {
      return
    }

    this.queue = this.queue
      .catch(() => undefined)
      .then(() => this.play(cleanText))
      .catch(() => undefined)

    await this.queue
  }

  private async play(text: string) {
    const response = await fetch(`${this.apiBaseUrl}/api/tts`, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'X-Stratum-Session': this.sessionId(),
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      return
    }

    const audioData = await response.arrayBuffer()
    const AudioContextClass = audioContextConstructor()
    if (!AudioContextClass) {
      return
    }

    const context = this.audioContext ?? new AudioContextClass()
    this.audioContext = context
    if (context.state === 'suspended') {
      await context.resume()
    }

    const buffer = await context.decodeAudioData(audioData.slice(0))
    await new Promise<void>((resolve) => {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null
          this.speaking = false
        }
        resolve()
      }
      this.currentSource = source
      this.speaking = true
      source.start()
    })
  }
}

export function ttsFeatureFlagEnabled() {
  if (import.meta.env.VITE_TTS_ENABLED === 'true') {
    return true
  }

  if (typeof window === 'undefined' || window.location.hostname !== 'localhost') {
    return false
  }

  try {
    return window.localStorage.getItem(TTS_TEST_OVERRIDE_KEY) === 'true'
  } catch {
    return false
  }
}

export function sanitizeTTSInput(
  text: string,
  maxCharacters = VOICE_CONFIG.maxTTSCharsPerMessage,
) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxCharacters)
}

function audioContextConstructor() {
  if (typeof window === 'undefined') {
    return null
  }

  const audioWindow = window as AudioWindow
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') {
    return true
  }

  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function readStoredEnabled() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(TTS_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeStoredEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(TTS_STORAGE_KEY, enabled ? 'true' : 'false')
  } catch {
    // Voice playback remains best-effort if storage is unavailable.
  }
}
