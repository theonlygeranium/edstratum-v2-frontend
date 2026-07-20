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
    const config = await env.STRATUM_CONFIG.get('runtime', { type: 'json' })
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
