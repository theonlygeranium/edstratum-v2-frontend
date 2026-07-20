import { jsonResponse, type Env } from './api/_types'

const API_RATE_LIMIT = 60
const RATE_LIMIT_WINDOW_SECONDS = 60

interface RateLimitRecord {
  count: number
  resetAt: number
}

function clientAddress(request: Request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'anonymous'
  )
}

function rateLimitWindow(now: number) {
  const windowId = Math.floor(now / (RATE_LIMIT_WINDOW_SECONDS * 1000))
  return {
    id: windowId,
    resetAt: (windowId + 1) * RATE_LIMIT_WINDOW_SECONDS * 1000,
  }
}

function rateLimitKey(request: Request, windowId: number) {
  return `rate:${clientAddress(request)}:${windowId}`
}

function rateLimitRecord(value: unknown, resetAt: number): RateLimitRecord {
  if (!value || typeof value !== 'object') {
    return { count: 0, resetAt }
  }

  const candidate = value as Partial<RateLimitRecord>
  return {
    count: typeof candidate.count === 'number' ? candidate.count : 0,
    resetAt: typeof candidate.resetAt === 'number' ? candidate.resetAt : resetAt,
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  if (!url.pathname.startsWith('/api/')) {
    return context.next()
  }

  if (!context.env.RATE_LIMIT) {
    return context.next()
  }

  const now = Date.now()
  const window = rateLimitWindow(now)
  const key = rateLimitKey(context.request, window.id)
  const current = rateLimitRecord(
    await context.env.RATE_LIMIT.get(key, { type: 'json' }),
    window.resetAt,
  )

  if (current.count >= API_RATE_LIMIT) {
    const retryAfter = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    )
    return jsonResponse(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      },
    )
  }

  await context.env.RATE_LIMIT.put(
    key,
    JSON.stringify({ count: current.count + 1, resetAt: current.resetAt }),
    { expirationTtl: RATE_LIMIT_WINDOW_SECONDS },
  )

  return context.next()
}
