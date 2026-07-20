const DEFAULT_FRONTEND_URL = 'https://edstratumlabs.ai'
const DEFAULT_BACKEND_URL =
  'https://stratum-backend-production-a340.up.railway.app'

const frontendUrl = normalizeUrl(process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL)
const expected = {
  ragEnabled: readBool('EXPECTED_RAG_ENABLED', true),
  voiceEnabled: readBool('EXPECTED_VOICE_ENABLED', false),
  persistenceEnabled: readBool('EXPECTED_PERSISTENCE_ENABLED', false),
  analyticsEnabled: readBool('EXPECTED_ANALYTICS_ENABLED', false),
  embeddingProvider: process.env.EXPECTED_EMBEDDING_PROVIDER || 'hash',
  vectorStoreProvider: process.env.EXPECTED_VECTOR_STORE_PROVIDER || 'chroma',
  llmProvider: process.env.EXPECTED_LLM_PROVIDER || 'writer',
}

const results = []
let failures = 0

function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, '')
}

function readBool(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  if (/^(1|true|yes)$/i.test(value)) return true
  if (/^(0|false|no)$/i.test(value)) return false
  throw new Error(`${name} must be true or false when set`)
}

function record(ok, name, detail = '') {
  results.push({ ok, name, detail })
  if (!ok) failures += 1
  const label = ok ? '[OK]  ' : '[FAIL]'
  console.log(`${label} ${name}${detail ? `: ${detail}` : ''}`)
}

function expect(condition, name, detail = '') {
  record(Boolean(condition), name, detail)
}

function hasCacheNoStore(headers) {
  return /\bno-store\b/i.test(headers.get('cache-control') || '')
}

async function fetchWithTimeout(pathOrUrl, init = {}) {
  const url = /^https?:\/\//.test(pathOrUrl)
    ? pathOrUrl
    : `${frontendUrl}${pathOrUrl}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(init.headers || {}),
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readJson(pathOrUrl, init) {
  const response = await fetchWithTimeout(pathOrUrl, init)
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { parseError: text.slice(0, 160) }
  }
  return { response, body }
}

async function readText(pathOrUrl) {
  const response = await fetchWithTimeout(pathOrUrl, {
    headers: { accept: 'text/html, text/plain, */*' },
  })
  return { response, text: await response.text() }
}

function assetPaths(manifest) {
  return Array.isArray(manifest.assets)
    ? manifest.assets.map((asset) =>
        typeof asset === 'string' ? asset : asset.path || asset.fileName || '',
      )
    : []
}

function forbiddenCopyFailures(text) {
  const patterns = [
    /calendly\.com/i,
    /cal\.com/i,
    /jeffrey geronimo/i,
    /jg@writer\.com/i,
    /jgeronimo@/i,
  ]
  return patterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source)
}

async function main() {
  console.log(`STRATUM live smoke: ${frontendUrl}`)

  const manifestResult = await readJson('/build-manifest.json')
  const manifest = manifestResult.body
  expect(manifestResult.response.status === 200, 'manifest returns HTTP 200')
  expect(manifest.schemaVersion === 1, 'manifest schemaVersion is 1')
  expect(Boolean(manifest.commitShortSha), 'manifest includes commitShortSha')
  expect(
    /\bmax-age=60\b/.test(manifestResult.response.headers.get('cache-control') || ''),
    'manifest has short cache window',
    manifestResult.response.headers.get('cache-control') || 'missing',
  )

  const paths = assetPaths(manifest)
  const chatAsset =
    manifest.chatAsset || paths.find((path) => /StratumChat-[\w-]+\.js$/.test(path))
  expect(paths.length > 0, 'manifest lists assets', `${paths.length} assets`)
  expect(Boolean(manifest.entryAsset || paths.find((path) => /\/index-[\w-]+\.js$/.test(path))), 'manifest identifies entry asset')
  expect(Boolean(manifest.stylesheetAsset || paths.find((path) => /\/index-[\w-]+\.css$/.test(path))), 'manifest identifies stylesheet asset')
  expect(Boolean(chatAsset), 'manifest identifies STRATUM chat asset', chatAsset || 'missing')

  const root = await readText('/')
  expect(root.response.status === 200, 'site root returns HTTP 200')
  const rootForbidden = forbiddenCopyFailures(root.text)
  expect(rootForbidden.length === 0, 'site root has no forbidden copy', rootForbidden.join(', '))

  if (chatAsset) {
    const chat = await readText(chatAsset)
    expect(chat.response.status === 200, 'chat asset returns HTTP 200')
    const chatForbidden = forbiddenCopyFailures(chat.text)
    expect(chatForbidden.length === 0, 'chat asset has no forbidden copy', chatForbidden.join(', '))
  }

  const configResult = await readJson('/api/config')
  const config = configResult.body
  expect(configResult.response.status === 200, '/api/config returns HTTP 200')
  expect(config.ragEnabled === expected.ragEnabled, 'ragEnabled matches expected', String(config.ragEnabled))
  expect(config.voiceEnabled === expected.voiceEnabled, 'voiceEnabled matches expected', String(config.voiceEnabled))
  expect(
    config.persistenceEnabled === expected.persistenceEnabled,
    'persistenceEnabled matches expected',
    String(config.persistenceEnabled),
  )

  const frontendHealthResult = await readJson('/api/health')
  const frontendHealth = frontendHealthResult.body
  expect(frontendHealthResult.response.status === 200, '/api/health returns HTTP 200')
  expect(frontendHealth.status === 'healthy', '/api/health reports healthy')
  expect(frontendHealth.rag?.status === 'ok', '/api/health reports RAG ok')
  expect(frontendHealth.tts?.status === 'unconfigured', '/api/health reports TTS unconfigured while disabled')

  if (!expected.voiceEnabled) {
    const ttsResult = await readJson('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'STRATUM disabled voice smoke' }),
    })
    expect(ttsResult.response.status === 503, '/api/tts fails closed while voice is disabled')
    expect(ttsResult.body.detail === 'tts_disabled', '/api/tts returns tts_disabled')
    expect(hasCacheNoStore(ttsResult.response.headers), '/api/tts response is no-store')
  } else {
    record(true, '/api/tts generation skipped because voice is expected enabled')
  }

  const analyticsResult = await readJson('/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'chat_open',
      sessionId: `live-smoke-${Date.now()}`,
      properties: { source: 'live-smoke' },
    }),
  })
  if (expected.analyticsEnabled) {
    expect(analyticsResult.response.status === 202, '/api/analytics accepts allowlisted event')
  } else {
    expect(analyticsResult.response.status === 503, '/api/analytics fails closed while unbound')
    expect(
      analyticsResult.body.error === 'analytics_not_configured',
      '/api/analytics returns analytics_not_configured',
    )
    expect(hasCacheNoStore(analyticsResult.response.headers), '/api/analytics response is no-store')
  }

  const backendUrl = normalizeUrl(
    process.env.BACKEND_URL || manifest.backendUrl || DEFAULT_BACKEND_URL,
  )
  const backendHealthResult = await readJson(`${backendUrl}/api/health`)
  const backendHealth = backendHealthResult.body
  expect(backendHealthResult.response.status === 200, 'direct backend /api/health returns HTTP 200')
  expect(backendHealth.status === 'healthy', 'direct backend reports healthy')
  expect(backendHealth.rag?.status === 'ok', 'direct backend reports RAG ok')

  const runtimeResult = await readJson(`${backendUrl}/api/runtime`)
  const runtime = runtimeResult.body
  expect(runtimeResult.response.status === 200, 'direct backend /api/runtime returns HTTP 200')
  expect(runtime.graph_runtime === 'langgraph', 'runtime graph is langgraph')
  expect(
    runtime.embedding_provider === expected.embeddingProvider,
    'runtime embedding provider matches expected',
    String(runtime.embedding_provider),
  )
  expect(
    runtime.vector_store_provider === expected.vectorStoreProvider,
    'runtime vector store provider matches expected',
    String(runtime.vector_store_provider),
  )
  expect(
    runtime.llm_provider === expected.llmProvider,
    'runtime LLM provider matches expected',
    String(runtime.llm_provider),
  )

  console.log(
    JSON.stringify(
      {
        frontendUrl,
        backendUrl,
        manifestCommit: manifest.commitShortSha,
        assetCount: paths.length,
        expected,
        failures,
      },
      null,
      2,
    ),
  )

  if (failures > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  record(false, 'live smoke crashed', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
