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
  ANALYTICS_EVENTS?: KVNamespace
  STRATUM_DB?: D1Database
  SESSION_SECRET?: string
}

export const DEFAULT_RAILWAY_API_URL =
  'https://stratum-backend-production-a340.up.railway.app'

const DEFAULT_MAX_INTAKE_QUESTIONS = 7

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  ragEnabled: true,
  voiceEnabled: false,
  persistenceEnabled: false,
  maxIntakeQuestions: DEFAULT_MAX_INTAKE_QUESTIONS,
}

export function railwayApiUrl(env: Env) {
  return (env.RAILWAY_API_URL || DEFAULT_RAILWAY_API_URL).replace(/\/+$/, '')
}

export function runtimeConfig(value: unknown): RuntimeConfig {
  if (!value || typeof value !== 'object') {
    return DEFAULT_RUNTIME_CONFIG
  }

  const candidate = value as Partial<RuntimeConfig>

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
    maxIntakeQuestions: DEFAULT_MAX_INTAKE_QUESTIONS,
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
