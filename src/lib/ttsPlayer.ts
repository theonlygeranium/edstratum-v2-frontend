import { VOICE_CONFIG } from '../stratum/stratumConfig'
import { getOrCreateSessionId } from './stratumSession'

const TTS_STORAGE_KEY = 'stratum_tts_enabled'
const TTS_TEST_OVERRIDE_KEY = 'stratum_tts_test_enabled'

type AudioContextConstructor = new () => AudioContext

type AudioWindow = Window & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
  MediaSource?: typeof MediaSource
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
  private currentMediaElement: HTMLAudioElement | null = null
  private currentObjectUrl: string | null = null
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
    this.cleanupMediaElement()
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

    const contentType = audioContentType(response.headers.get('Content-Type'))
    if (response.body && mediaSourceSupported(contentType)) {
      await this.playStreaming(response.body, contentType)
      return
    }

    await this.playBuffered(response)
  }

  private async playBuffered(response: Response) {
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

  private async playStreaming(stream: ReadableStream<Uint8Array>, contentType: string) {
    const AudioContextClass = audioContextConstructor()
    const MediaSourceClass = mediaSourceConstructor()
    if (!AudioContextClass || !MediaSourceClass) {
      return
    }

    this.cleanupMediaElement()
    const context = this.audioContext ?? new AudioContextClass()
    this.audioContext = context
    if (context.state === 'suspended') {
      await context.resume()
    }

    const audio = new Audio()
    audio.preload = 'auto'
    audio.hidden = true
    const mediaSource = new MediaSourceClass()
    const objectUrl = URL.createObjectURL(mediaSource)
    audio.src = objectUrl
    document.body.append(audio)

    let mediaNode: MediaElementAudioSourceNode | null = null
    try {
      mediaNode = context.createMediaElementSource(audio)
      mediaNode.connect(context.destination)
    } catch {
      mediaNode = null
    }

    this.currentMediaElement = audio
    this.currentObjectUrl = objectUrl

    await new Promise<void>((resolve) => {
      let resolved = false
      const finish = () => {
        if (resolved) {
          return
        }
        resolved = true
        mediaNode?.disconnect()
        if (this.currentMediaElement === audio) {
          this.cleanupMediaElement()
        }
        this.speaking = false
        resolve()
      }

      audio.addEventListener('ended', finish, { once: true })
      audio.addEventListener('error', finish, { once: true })

      mediaSource.addEventListener(
        'sourceopen',
        () => {
          void this.appendStreamingAudio(stream, mediaSource, contentType, audio)
            .then(() => {
              if (!this.speaking) {
                finish()
              }
            })
            .catch(finish)
        },
        { once: true },
      )
    })
  }

  private async appendStreamingAudio(
    stream: ReadableStream<Uint8Array>,
    mediaSource: MediaSource,
    contentType: string,
    audio: HTMLAudioElement,
  ) {
    const sourceBuffer = mediaSource.addSourceBuffer(contentType)
    const reader = stream.getReader()
    let started = false

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        if (!value || value.byteLength === 0) {
          continue
        }
        await appendBuffer(sourceBuffer, value)
        if (!started) {
          started = true
          this.speaking = true
          try {
            await audio.play()
          } catch {
            this.speaking = false
            break
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    await waitForSourceBuffer(sourceBuffer)
    if (mediaSource.readyState === 'open') {
      mediaSource.endOfStream()
    }
  }

  private cleanupMediaElement() {
    const element = this.currentMediaElement
    this.currentMediaElement = null
    try {
      element?.pause()
      element?.removeAttribute('src')
      element?.load()
      element?.remove()
    } catch {
      // Media cleanup is best-effort across browser implementations.
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl)
      this.currentObjectUrl = null
    }
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

function mediaSourceConstructor() {
  if (typeof window === 'undefined') {
    return null
  }

  return (window as AudioWindow).MediaSource ?? null
}

function mediaSourceSupported(contentType: string) {
  const MediaSourceClass = mediaSourceConstructor()
  if (!MediaSourceClass || typeof URL.createObjectURL !== 'function') {
    return false
  }

  if (typeof MediaSourceClass.isTypeSupported === 'function') {
    return MediaSourceClass.isTypeSupported(contentType)
  }

  return true
}

function audioContentType(header: string | null) {
  return (header || 'audio/mpeg').split(';')[0].trim() || 'audio/mpeg'
}

async function appendBuffer(sourceBuffer: SourceBuffer, chunk: Uint8Array) {
  await waitForSourceBuffer(sourceBuffer)
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      sourceBuffer.removeEventListener('updateend', onUpdateEnd)
      sourceBuffer.removeEventListener('error', onError)
    }
    const onUpdateEnd = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('tts_source_buffer_error'))
    }
    sourceBuffer.addEventListener('updateend', onUpdateEnd, { once: true })
    sourceBuffer.addEventListener('error', onError, { once: true })

    try {
      const buffer = new ArrayBuffer(chunk.byteLength)
      new Uint8Array(buffer).set(chunk)
      sourceBuffer.appendBuffer(buffer)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}

async function waitForSourceBuffer(sourceBuffer: SourceBuffer) {
  if (!sourceBuffer.updating) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      sourceBuffer.removeEventListener('updateend', onUpdateEnd)
      sourceBuffer.removeEventListener('error', onError)
    }
    const onUpdateEnd = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('tts_source_buffer_error'))
    }
    sourceBuffer.addEventListener('updateend', onUpdateEnd, { once: true })
    sourceBuffer.addEventListener('error', onError, { once: true })
  })
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
