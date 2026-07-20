import { jsonResponse, railwayApiUrl, type Env } from './_types'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const upstreamUrl = `${railwayApiUrl(env)}/api/health`
  const headers = new Headers({ Accept: 'application/json' })
  const sessionId = request.headers.get('X-Stratum-Session')

  if (sessionId) {
    headers.set('X-Stratum-Session', sessionId)
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers,
      cf: {
        cacheTtlByStatus: {
          '200-299': 30,
          '300-599': 0,
        },
      },
    })
    const text = await upstream.text()
    const responseHeaders = new Headers()
    responseHeaders.set(
      'Content-Type',
      upstream.headers.get('Content-Type') || 'application/json',
    )
    responseHeaders.set(
      'Cache-Control',
      upstream.ok ? 'public, max-age=30' : 'no-store',
    )
    return new Response(text, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch {
    return jsonResponse(
      {
        status: 'degraded',
        stratum: 'offline',
        backend_enabled: false,
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}
