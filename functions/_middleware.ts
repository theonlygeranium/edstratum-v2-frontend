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

// The Cache API requires URL-like keys. This synthetic URL is never fetched —
// it only serves as a namespace for caches.default.
function cacheRequest(kvKey: string) {
  return new Request(
    `https://rate-limit.edstratumlabs.internal/${kvKey}`,
  )
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
  const kvKey = rateLimitKey(context.request, window.id)
  const cReq = cacheRequest(kvKey)

  // Read from the edge Cache API first. Unlike KV reads (which are cached for
  // 60 seconds at the edge), Cache API reads are instant and always reflect the
  // latest write within the same colo. This is the critical fix: the previous
  // implementation used RATE_LIMIT.get() with no cacheTtl override, so burst
  // requests all read a stale count of 0 and never triggered the 429 threshold.
  const cache = (caches as unknown as { default: Cache }).default
  const cached = await cache.match(cReq)
  let current: RateLimitRecord

  if (cached) {
    current = rateLimitRecord(await cached.json(), window.resetAt)
  } else {
    // First request in this window for this colo — fall back to KV. KV may be
    // stale by up to 60 seconds, but this only affects the first request per
    // colo per window. Subsequent requests in the same window read from the
    // Cache API, which is always current.
    current = rateLimitRecord(
      await context.env.RATE_LIMIT.get(kvKey, { type: 'json' }),
      window.resetAt,
    )
  }

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

  const updated: RateLimitRecord = {
    count: current.count + 1,
    resetAt: window.resetAt,
  }

  // Write to the edge Cache API (instant, per-colo). This ensures the next
  // request in the same colo sees the incremented count immediately.
  await cache.put(
    cReq,
    new Response(JSON.stringify(updated), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${RATE_LIMIT_WINDOW_SECONDS}`,
      },
    }),
  )

  // Persist to KV in the background. KV is eventually consistent, so this write
  // may take up to 60 seconds to propagate — but the Cache API is the source of
  // truth for the hot path. waitUntil ensures the write completes even if the
  // response is sent first.
  context.waitUntil(
    context.env.RATE_LIMIT.put(
      kvKey,
      JSON.stringify(updated),
      { expirationTtl: RATE_LIMIT_WINDOW_SECONDS },
    ),
  )

  return context.next()
}
