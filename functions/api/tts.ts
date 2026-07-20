import {
  jsonResponse,
  railwayApiUrl,
  runtimeConfig,
  type Env,
} from './_types'

function forwardedHeaders(request: Request) {
  const headers = new Headers({
    Accept: request.headers.get('Accept') || 'audio/mpeg',
    'Content-Type': request.headers.get('Content-Type') || 'application/json',
  })
  const sessionId = request.headers.get('X-Stratum-Session')

  if (sessionId) {
    headers.set('X-Stratum-Session', sessionId)
  }

  return headers
}

function responseHeaders(upstream: Response) {
  const headers = new Headers()
  headers.set(
    'Content-Type',
    upstream.headers.get('Content-Type') || 'audio/mpeg',
  )
  headers.set('Cache-Control', 'no-store')
  return headers
}

async function runtimeVoiceEnabled(env: Env) {
  if (!env.STRATUM_CONFIG) {
    return false
  }

  try {
    const config = await env.STRATUM_CONFIG.get('runtime', { type: 'json' })
    return runtimeConfig(config).voiceEnabled
  } catch {
    return false
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!(await runtimeVoiceEnabled(env))) {
    return jsonResponse(
      { detail: 'tts_disabled' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  const upstreamUrl = `${railwayApiUrl(env)}/api/tts`

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: forwardedHeaders(request),
      body: await request.text(),
    })
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream),
    })
  } catch {
    return jsonResponse(
      { detail: 'tts_proxy_unavailable' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
  })
