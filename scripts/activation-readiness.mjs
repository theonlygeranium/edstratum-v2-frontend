const DEFAULT_FRONTEND_URL = 'https://edstratumlabs.ai'
const DEFAULT_BACKEND_URL =
  'https://stratum-backend-production-a340.up.railway.app'

const PROFILE_TARGETS = {
  current: {
    analyticsEnabled: false,
    rateLimitEnabled: false,
    frontendFlags: {
      ragEnabled: true,
      voiceEnabled: false,
      persistenceEnabled: false,
      maxIntakeQuestions: 7,
    },
    backendRuntime: {
      graph_runtime: 'langgraph',
      session_store_backend: 'postgres',
      embedding_provider: 'hash',
      vector_store_provider: 'chroma',
      llm_provider: 'writer',
    },
    backendTtsStatus: 'unconfigured',
  },
  analytics: {
    analyticsEnabled: true,
    rateLimitEnabled: false,
    frontendFlags: {
      ragEnabled: true,
      voiceEnabled: false,
      persistenceEnabled: false,
      maxIntakeQuestions: 7,
    },
    backendRuntime: {
      graph_runtime: 'langgraph',
      session_store_backend: 'postgres',
      embedding_provider: 'hash',
      vector_store_provider: 'chroma',
      llm_provider: 'writer',
    },
    backendTtsStatus: 'unconfigured',
  },
  'managed-rag': {
    analyticsEnabled: false,
    rateLimitEnabled: false,
    frontendFlags: {
      ragEnabled: true,
      voiceEnabled: false,
      persistenceEnabled: false,
      maxIntakeQuestions: 7,
    },
    backendRuntime: {
      graph_runtime: 'langgraph',
      session_store_backend: 'postgres',
      embedding_provider: 'openai',
      vector_store_provider: 'pinecone',
      llm_provider: 'writer',
    },
    backendTtsStatus: 'unconfigured',
  },
  persistence: {
    analyticsEnabled: false,
    rateLimitEnabled: false,
    frontendFlags: {
      ragEnabled: true,
      voiceEnabled: false,
      persistenceEnabled: true,
      maxIntakeQuestions: 7,
    },
    backendRuntime: {
      graph_runtime: 'langgraph',
      session_store_backend: 'postgres',
      embedding_provider: 'hash',
      vector_store_provider: 'chroma',
      llm_provider: 'writer',
    },
    backendTtsStatus: 'unconfigured',
  },
  voice: {
    analyticsEnabled: false,
    rateLimitEnabled: false,
    frontendFlags: {
      ragEnabled: true,
      voiceEnabled: true,
      persistenceEnabled: false,
      maxIntakeQuestions: 7,
    },
    backendRuntime: {
      graph_runtime: 'langgraph',
      session_store_backend: 'postgres',
      embedding_provider: 'hash',
      vector_store_provider: 'chroma',
      llm_provider: 'writer',
    },
    backendTtsStatus: 'ok',
  },
  'full-activation': {
    analyticsEnabled: true,
    rateLimitEnabled: true,
    frontendFlags: {
      ragEnabled: true,
      voiceEnabled: true,
      persistenceEnabled: true,
      maxIntakeQuestions: 7,
    },
    backendRuntime: {
      graph_runtime: 'langgraph',
      session_store_backend: 'postgres',
      embedding_provider: 'openai',
      vector_store_provider: 'pinecone',
      llm_provider: 'writer',
    },
    backendTtsStatus: 'ok',
  },
}

const SOURCE_EXPECTATIONS = {
  'wrangler.toml': [
    'RAILWAY_API_URL',
    'STRATUM_CONFIG',
    'RATE_LIMIT',
    'ANALYTICS_EVENTS',
    'STRATUM_DB',
    'SESSION_SECRET',
    'VITE_TTS_ENABLED',
  ],
  'functions/api/_types.ts': [
    'STRATUM_CONFIG',
    'RATE_LIMIT',
    'ANALYTICS_EVENTS',
    'STRATUM_DB',
    'SESSION_SECRET',
  ],
  'package.json': ['qa:live', 'qa:live:rendered', 'qa:activation'],
}

const results = []
let blockers = 0
let warnings = 0

function usage() {
  return `Usage: npm run qa:activation -- [options]

Options:
  --profile <name>       current, analytics, managed-rag, persistence, voice, full-activation
  --frontend-url <url>   Frontend URL to inspect (default: ${DEFAULT_FRONTEND_URL})
  --backend-url <url>    Backend URL fallback when manifest has none
  --probe-rate-limit     Burst /api/config to prove RATE_LIMIT returns 429
  --json                 Print a JSON summary
  --help                 Show this help
`
}

function parseArgs(argv) {
  const args = {
    profile: process.env.STRATUM_ACTIVATION_PROFILE || 'current',
    frontendUrl: process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL,
    backendUrl: process.env.BACKEND_URL || DEFAULT_BACKEND_URL,
    json: false,
    probeRateLimit: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => {
      index += 1
      return argv[index]
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true
    } else if (arg === '--json') {
      args.json = true
    } else if (arg === '--probe-rate-limit') {
      args.probeRateLimit = true
    } else if (arg === '--profile') {
      args.profile = next()
    } else if (arg.startsWith('--profile=')) {
      args.profile = arg.slice('--profile='.length)
    } else if (arg === '--frontend-url') {
      args.frontendUrl = next()
    } else if (arg.startsWith('--frontend-url=')) {
      args.frontendUrl = arg.slice('--frontend-url='.length)
    } else if (arg === '--backend-url') {
      args.backendUrl = next()
    } else if (arg.startsWith('--backend-url=')) {
      args.backendUrl = arg.slice('--backend-url='.length)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!PROFILE_TARGETS[args.profile]) {
    throw new Error(
      `Unknown profile ${args.profile}. Expected one of: ${Object.keys(PROFILE_TARGETS).join(', ')}`,
    )
  }

  args.frontendUrl = normalizeUrl(args.frontendUrl)
  args.backendUrl = normalizeUrl(args.backendUrl)
  return args
}

function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, '')
}

function record(status, name, detail = '') {
  results.push({ status, name, detail })
  if (status === 'blocked') blockers += 1
  if (status === 'warn') warnings += 1

  const label = status === 'ok' ? '[OK]      ' : status === 'warn' ? '[WARN]    ' : '[BLOCKED] '
  console.log(`${label}${name}${detail ? `: ${detail}` : ''}`)
}

function ok(name, detail = '') {
  record('ok', name, detail)
}

function warn(name, detail = '') {
  record('warn', name, detail)
}

function blocked(name, detail = '') {
  record('blocked', name, detail)
}

function expectEqual(actual, expected, name) {
  if (actual === expected) {
    ok(name, String(actual))
  } else {
    blocked(name, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
  }
}

async function readTextFile(path) {
  return await import('node:fs/promises').then(({ readFile }) => readFile(path, 'utf8'))
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache',
        ...(init.headers || {}),
      },
    })
    const text = await response.text()
    let body
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { parseError: text.slice(0, 160) }
    }
    return { response, body }
  } finally {
    clearTimeout(timeout)
  }
}

async function checkSourceReadiness() {
  for (const [path, needles] of Object.entries(SOURCE_EXPECTATIONS)) {
    let text
    try {
      text = await readTextFile(new URL(`../${path}`, import.meta.url))
    } catch (error) {
      blocked(`source file exists: ${path}`, error instanceof Error ? error.message : String(error))
      continue
    }

    ok(`source file exists: ${path}`)
    for (const needle of needles) {
      if (text.includes(needle)) {
        ok(`${path} mentions ${needle}`)
      } else {
        blocked(`${path} mentions ${needle}`, 'missing')
      }
    }
  }
}

function assetBackendUrl(manifest, fallback) {
  return normalizeUrl(
    typeof manifest?.backendUrl === 'string' && manifest.backendUrl
      ? manifest.backendUrl
      : fallback,
  )
}

async function checkFrontendRuntime(frontendUrl, target) {
  const configResult = await fetchJson(`${frontendUrl}/api/config`)
  if (configResult.response.status !== 200) {
    blocked('frontend /api/config returns HTTP 200', String(configResult.response.status))
    return
  }

  ok('frontend /api/config returns HTTP 200')
  const config = configResult.body || {}
  for (const [key, expected] of Object.entries(target.frontendFlags)) {
    expectEqual(config[key], expected, `frontend runtime ${key}`)
  }
}

async function checkManifest(frontendUrl, backendUrl) {
  const manifestResult = await fetchJson(`${frontendUrl}/build-manifest.json?activation-readiness=${Date.now()}`)
  if (manifestResult.response.status !== 200) {
    blocked('frontend build manifest returns HTTP 200', String(manifestResult.response.status))
    return { backendUrl }
  }

  ok('frontend build manifest returns HTTP 200')
  const manifest = manifestResult.body || {}
  ok('frontend manifest commit', manifest.commitShortSha || manifest.commitSha || 'missing')
  if (Array.isArray(manifest.assets) && manifest.assets.length > 0) {
    ok('frontend manifest lists assets', `${manifest.assets.length} assets`)
  } else {
    blocked('frontend manifest lists assets', 'missing or empty')
  }
  return { backendUrl: assetBackendUrl(manifest, backendUrl) }
}

async function checkAnalytics(frontendUrl, target) {
  const result = await fetchJson(`${frontendUrl}/api/analytics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '[]',
  })

  if (target.analyticsEnabled) {
    if (result.response.status === 202 && result.body?.count === 0) {
      ok('analytics KV accepts an empty non-mutating event batch')
    } else {
      blocked(
        'analytics KV accepts an empty non-mutating event batch',
        `status ${result.response.status}, body ${JSON.stringify(result.body)}`,
      )
    }
    return
  }

  if (
    result.response.status === 503 &&
    result.body?.error === 'analytics_not_configured'
  ) {
    ok('analytics endpoint fails closed while inactive')
  } else {
    blocked(
      'analytics endpoint remains inactive for this profile',
      `status ${result.response.status}, body ${JSON.stringify(result.body)}`,
    )
  }
}

async function checkPersistence(frontendUrl, target) {
  const result = await fetchJson(`${frontendUrl}/api/sessions/stratum-readiness-check/messages`)

  if (target.frontendFlags.persistenceEnabled) {
    if (result.response.status === 401 && result.body?.error === 'missing_authorization') {
      ok('D1 session route is configured and auth-gated')
    } else {
      blocked(
        'D1 session route is configured and auth-gated',
        `status ${result.response.status}, body ${JSON.stringify(result.body)}`,
      )
    }
    return
  }

  if (
    result.response.status === 503 &&
    ['d1_not_configured', 'session_secret_not_configured'].includes(result.body?.error)
  ) {
    ok('D1 session route fails closed while inactive', result.body.error)
  } else if (result.response.status === 401 && result.body?.error === 'missing_authorization') {
    ok('D1 session route is bound but auth-gated while runtime persistence is off')
  } else {
    blocked(
      'D1 session route fails closed or auth-gates while inactive',
      `status ${result.response.status}, body ${JSON.stringify(result.body)}`,
    )
  }
}

async function checkTts(frontendUrl, target) {
  if (target.frontendFlags.voiceEnabled) {
    const result = await fetchJson(`${frontendUrl}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    if ([400, 422].includes(result.response.status)) {
      ok('same-origin TTS proxy reaches backend validation without generating audio')
    } else {
      blocked(
        'same-origin TTS proxy reaches backend validation without generating audio',
        `status ${result.response.status}, body ${JSON.stringify(result.body)}`,
      )
    }
    return
  }

  const result = await fetchJson(`${frontendUrl}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'STRATUM activation readiness disabled voice probe' }),
  })
  if (result.response.status === 503 && result.body?.detail === 'tts_disabled') {
    ok('same-origin TTS fails closed while voice is inactive')
  } else {
    blocked(
      'same-origin TTS fails closed while voice is inactive',
      `status ${result.response.status}, body ${JSON.stringify(result.body)}`,
    )
  }
}

async function checkBackendRuntime(backendUrl, target) {
  const healthResult = await fetchJson(`${backendUrl}/api/health`, {
    headers: { origin: DEFAULT_FRONTEND_URL },
  })
  if (healthResult.response.status !== 200) {
    blocked('backend /api/health returns HTTP 200', String(healthResult.response.status))
  } else {
    ok('backend /api/health returns HTTP 200')
    const health = healthResult.body || {}
    expectEqual(health.status, 'healthy', 'backend health status')
    expectEqual(health.rag?.status, 'ok', 'backend RAG status')
    expectEqual(health.tts?.status, target.backendTtsStatus, 'backend TTS status')
  }

  const runtimeResult = await fetchJson(`${backendUrl}/api/runtime`)
  if (runtimeResult.response.status !== 200) {
    blocked('backend /api/runtime returns HTTP 200', String(runtimeResult.response.status))
    return
  }

  ok('backend /api/runtime returns HTTP 200')
  const runtime = runtimeResult.body || {}
  for (const [key, expected] of Object.entries(target.backendRuntime)) {
    expectEqual(runtime[key], expected, `backend runtime ${key}`)
  }
  expectEqual(runtime.database_configured, true, 'backend runtime database_configured')
  expectEqual(runtime.llm_configured, true, 'backend runtime llm_configured')
  expectEqual(runtime.notifications_configured, true, 'backend runtime notifications_configured')
}

async function probeRateLimit(frontendUrl) {
  const nonce = Date.now()
  for (let index = 0; index < 65; index += 1) {
    const result = await fetchJson(`${frontendUrl}/api/config?activation-rate-limit=${nonce}-${index}`)
    if (result.response.status === 429) {
      ok('RATE_LIMIT binding enforces after a bounded burst', `429 after ${index + 1} requests`)
      return
    }
    if (![200, 304].includes(result.response.status)) {
      blocked('RATE_LIMIT bounded burst probe returned unexpected status', String(result.response.status))
      return
    }
  }
  blocked('RATE_LIMIT binding enforces after a bounded burst', 'no 429 observed in 65 requests')
}

async function checkRateLimit(frontendUrl, args, target) {
  if (!target.rateLimitEnabled) {
    ok('RATE_LIMIT burst proof not required for this profile')
    return
  }

  if (!args.probeRateLimit) {
    warn(
      'RATE_LIMIT burst proof skipped',
      'rerun with --probe-rate-limit after binding RATE_LIMIT',
    )
    return
  }

  await probeRateLimit(frontendUrl)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return
  }

  const target = PROFILE_TARGETS[args.profile]
  console.log('STRATUM activation readiness')
  console.log(`Profile:  ${args.profile}`)
  console.log(`Frontend: ${args.frontendUrl}`)

  await checkSourceReadiness()
  const manifest = await checkManifest(args.frontendUrl, args.backendUrl)
  console.log(`Backend:  ${manifest.backendUrl}`)
  await checkFrontendRuntime(args.frontendUrl, target)
  await checkAnalytics(args.frontendUrl, target)
  await checkPersistence(args.frontendUrl, target)
  await checkTts(args.frontendUrl, target)
  await checkRateLimit(args.frontendUrl, args, target)
  await checkBackendRuntime(manifest.backendUrl, target)

  const summary = {
    profile: args.profile,
    frontendUrl: args.frontendUrl,
    backendUrl: manifest.backendUrl,
    warnings,
    blockers,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (args.json) {
    console.log(JSON.stringify({ ...summary, results }, null, 2))
  }
  if (blockers > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  blocked('activation readiness crashed', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
