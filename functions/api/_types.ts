export interface RuntimeConfig {
  ragEnabled: boolean
  voiceEnabled: boolean
  persistenceEnabled: boolean
  maxIntakeQuestions: number
}

export interface Env {
  RAILWAY_API_URL?: string
  STRATUM_CONFIG?: KVNamespace
  RATE_LIMIT?: KVNamespace
}

export const DEFAULT_RAILWAY_API_URL =
  'https://stratum-backend-production-a340.up.railway.app'

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  ragEnabled: true,
  voiceEnabled: false,
  persistenceEnabled: false,
  maxIntakeQuestions: 6,
}

export function railwayApiUrl(env: Env) {
  return (env.RAILWAY_API_URL || DEFAULT_RAILWAY_API_URL).replace(/\/+$/, '')
}

export function runtimeConfig(value: unknown): RuntimeConfig {
  if (!value || typeof value !== 'object') {
    return DEFAULT_RUNTIME_CONFIG
  }

  const candidate = value as Partial<RuntimeConfig>
  const maxIntakeQuestions =
    typeof candidate.maxIntakeQuestions === 'number' &&
    Number.isInteger(candidate.maxIntakeQuestions) &&
    candidate.maxIntakeQuestions > 0 &&
    candidate.maxIntakeQuestions <= 12
      ? candidate.maxIntakeQuestions
      : DEFAULT_RUNTIME_CONFIG.maxIntakeQuestions

  return {
    ragEnabled:
      typeof candidate.ragEnabled === 'boolean'
        ? candidate.ragEnabled
        : DEFAULT_RUNTIME_CONFIG.ragEnabled,
    voiceEnabled:
      typeof candidate.voiceEnabled === 'boolean'
        ? candidate.voiceEnabled
        : DEFAULT_RUNTIME_CONFIG.voiceEnabled,
    persistenceEnabled:
      typeof candidate.persistenceEnabled === 'boolean'
        ? candidate.persistenceEnabled
        : DEFAULT_RUNTIME_CONFIG.persistenceEnabled,
    maxIntakeQuestions,
  }
}

export function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  })
}
