import {
  DEFAULT_RUNTIME_CONFIG,
  jsonResponse,
  runtimeConfig,
  type Env,
} from './_types'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.STRATUM_CONFIG) {
    return jsonResponse(DEFAULT_RUNTIME_CONFIG, {
      headers: {
        'Cache-Control': 'public, max-age=30',
      },
    })
  }

  try {
    // cacheTtl: 0 bypasses Cloudflare's default 60-second edge read cache,
    // ensuring the endpoint always serves the latest KV value. Without this,
    // runtime flag changes (e.g. persistenceEnabled) can take minutes to
    // propagate across multiple colos due to anycast distribution.
    const config = await env.STRATUM_CONFIG.get('runtime', {
      type: 'json',
      cacheTtl: 0,
    })
    return jsonResponse(runtimeConfig(config), {
      headers: {
        'Cache-Control': 'public, max-age=30',
      },
    })
  } catch {
    return jsonResponse(DEFAULT_RUNTIME_CONFIG, {
      headers: {
        'Cache-Control': 'public, max-age=30',
      },
    })
  }
}
