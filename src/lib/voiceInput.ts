export type VoiceInputStatus = 'idle' | 'listening' | 'processing'

type SpeechRecognitionAlternative = {
  transcript?: string
}

type SpeechRecognitionResultLike = {
  isFinal?: boolean
  [index: number]: SpeechRecognitionAlternative | undefined
}

type SpeechRecognitionEventLike = {
  resultIndex?: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike | undefined
  }
}

type SpeechRecognitionErrorLike = {
  error?: string
  message?: string
}

type NativeSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

type SpeechRecognitionConstructor = new () => NativeSpeechRecognition

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export interface VoiceInputController {
  readonly isSupported: boolean
  status: VoiceInputStatus
  onTranscript: (text: string) => void
  onFinalTranscript?: (text: string) => void
  onError: (message: string) => void
  onStatusChange?: (status: VoiceInputStatus) => void
  start: () => void
  stop: () => void
}

function recognitionConstructor() {
  if (typeof window === 'undefined') {
    return null
  }

  const speechWindow = window as SpeechRecognitionWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export function createVoiceInputController(): VoiceInputController {
  const Recognition = recognitionConstructor()
  let recognition: NativeSpeechRecognition | null = null

  const controller: VoiceInputController = {
    isSupported: Boolean(Recognition),
    status: 'idle',
    onTranscript: () => undefined,
    onError: () => undefined,
    start,
    stop,
  }

  function setStatus(status: VoiceInputStatus) {
    controller.status = status
    controller.onStatusChange?.(status)
  }

  function buildRecognition() {
    if (!Recognition) {
      return null
    }

    const instance = new Recognition()
    instance.continuous = false
    instance.interimResults = true
    instance.lang = 'en-US'

    instance.onstart = () => setStatus('listening')
    instance.onend = () => {
      if (controller.status !== 'idle') {
        setStatus('idle')
      }
    }
    instance.onerror = (event) => {
      setStatus('idle')
      controller.onError(event.error || event.message || 'voice_input_error')
    }
    instance.onresult = (event) => {
      const startIndex = event.resultIndex ?? 0
      let transcript = ''
      let final = false

      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const alternative = result?.[0]
        transcript += alternative?.transcript ?? ''
        final = final || Boolean(result?.isFinal)
      }

      const cleanTranscript = transcript.trim()
      if (!cleanTranscript) {
        return
      }

      controller.onTranscript(cleanTranscript)
      if (final) {
        setStatus('processing')
        controller.onFinalTranscript?.(cleanTranscript)
        setStatus('idle')
      }
    }

    return instance
  }

  function start() {
    if (!Recognition) {
      controller.onError('speech_recognition_unsupported')
      return
    }

    if (controller.status === 'listening') {
      return
    }

    recognition?.abort?.()
    recognition = buildRecognition()
    try {
      setStatus('listening')
      recognition?.start()
    } catch {
      setStatus('idle')
      controller.onError('voice_input_start_failed')
    }
  }

  function stop() {
    if (!recognition || controller.status !== 'listening') {
      setStatus('idle')
      return
    }

    setStatus('processing')
    recognition.stop()
  }

  return controller
}
