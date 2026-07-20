import { chromium, devices } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_FRONTEND_URL = 'https://edstratumlabs.ai'
const DEFAULT_PROMPT = 'What does an EdStratum engagement look like?'

const frontendUrl = normalizeUrl(process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL)
const expectedManifestCommit = process.env.EXPECTED_MANIFEST_COMMIT || ''
const expectedMaxIntakeQuestions = readInt('EXPECTED_MAX_INTAKE_QUESTIONS', 7)
const chatPrompt = process.env.LIVE_RENDER_PROMPT || DEFAULT_PROMPT
const screenshotDir =
  process.env.LIVE_RENDER_SCREENSHOT_DIR ||
  path.join(os.tmpdir(), `stratum-live-render-smoke-${Date.now()}`)

const screenshots = []
let failures = 0

const forbiddenCopyPatterns = [
  /calendly\.com/i,
  /cal\.com\/[a-z]/i,
  /jeffrey geronimo/i,
  /jg@writer\.com/i,
  /jgeronimo@/i,
]

const overlayPatterns = [
  /Failed to compile/i,
  /Internal Server Error/i,
  /Unhandled Runtime Error/i,
  /Vite Error/i,
  /ReferenceError:/i,
  /SyntaxError:/i,
]

function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, '')
}

function readInt(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed > 0) return parsed
  throw new Error(`${name} must be a positive integer when set`)
}

function record(ok, name, detail = '') {
  if (!ok) failures += 1
  const label = ok ? '[OK]  ' : '[FAIL]'
  console.log(`${label} ${name}${detail ? `: ${detail}` : ''}`)
}

function assertCheck(condition, name, detail = '') {
  record(Boolean(condition), name, detail)
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
  }
}

function forbiddenCopyFailures(text) {
  return forbiddenCopyPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source)
}

function overlayFailures(text) {
  return overlayPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source)
}

function attachDiagnostics(page) {
  const diagnostics = []

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      // Optional production services intentionally fail closed with HTTP 503
      // while their bindings are unconfigured. The endpoint contracts are
      // checked in qa:live; Chromium logs these URL-less resource errors.
      if (/Failed to load resource: the server responded with a status of 503/i.test(message.text())) {
        return
      }

      diagnostics.push({
        type: `console.${message.type()}`,
        text: message.text(),
      })
    }
  })

  page.on('pageerror', (error) => {
    diagnostics.push({
      type: 'pageerror',
      text: error.message,
    })
  })

  page.on('requestfailed', (request) => {
    const resourceType = request.resourceType()
    if (!['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(resourceType)) {
      return
    }
    const failureText = request.failure()?.errorText || 'unknown failure'
    if (
      resourceType === 'fetch' &&
      request.method() === 'POST' &&
      request.url().startsWith(`${frontendUrl}/api/chat`) &&
      /net::ERR_ABORTED/i.test(failureText)
    ) {
      return
    }

    diagnostics.push({
      type: `requestfailed.${resourceType}`,
      text: `${request.method()} ${request.url()} - ${failureText}`,
    })
  })

  return diagnostics
}

function assertDiagnosticsClean(diagnostics, label) {
  const detail = diagnostics
    .slice(0, 5)
    .map((item) => `${item.type}: ${item.text}`)
    .join(' | ')
  assertCheck(diagnostics.length === 0, `${label} console/page/request diagnostics are clean`, detail)
}

function diagnosticSummary(diagnostics) {
  return diagnostics
    .slice(0, 5)
    .map((item) => `${item.type}: ${item.text}`)
    .join(' | ')
}

async function readJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
    },
  })
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { parseError: text.slice(0, 160) }
  }

  return { response, body }
}

async function capture(page, label) {
  const file = path.join(screenshotDir, `${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  screenshots.push(file)
  record(true, `screenshot captured: ${label}`, file)
}

async function waitForDialogSettled(dialog) {
  await dialog.waitFor({ state: 'visible', timeout: 15_000 })
  await dialog.evaluate(async (node) => {
    const view = node.ownerDocument.defaultView
    if (!view) return

    await new Promise((resolve, reject) => {
      const started = Date.now()
      const check = () => {
        const style = view.getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        const opacity = Number.parseFloat(style.opacity)
        if (opacity >= 0.99 && rect.width > 0 && rect.height > 0) {
          resolve(undefined)
          return
        }

        if (Date.now() - started > 5_000) {
          reject(new Error('STRATUM dialog did not settle before screenshot capture'))
          return
        }

        view.requestAnimationFrame(check)
      }

      check()
    })
  })
  record(true, 'STRATUM dialog animation settled before visual capture')
}

async function checkPageShell(page, label, diagnostics) {
  await page.goto(`${frontendUrl}/?live-render-smoke=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

  const title = await page.title()
  const trigger = page.getByRole('button', { name: /open stratum chat/i })
  try {
    await trigger.waitFor({ state: 'visible', timeout: 30_000 })
  } catch (error) {
    const detail = diagnosticSummary(diagnostics)
    throw new Error(
      `${label} STRATUM trigger did not render${detail ? `; diagnostics: ${detail}` : ''}; ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    )
  }
  await page
    .waitForFunction('document.body.innerText.trim().length > 200', undefined, {
      timeout: 15_000,
    })
    .catch(() => {})
  const bodyText = await page.locator('body').innerText({ timeout: 15_000 })
  const forbidden = forbiddenCopyFailures(bodyText)
  const overlays = overlayFailures(bodyText)

  assertCheck(page.url().startsWith(frontendUrl), `${label} page identity matches target`, page.url())
  assertCheck(/EdStratum/i.test(title), `${label} title identifies EdStratum`, title)
  assertCheck(bodyText.trim().length > 200, `${label} first meaningful screen renders`, `${bodyText.length} chars`)
  assertCheck(overlays.length === 0, `${label} has no framework error overlay`, overlays.join(', '))
  assertCheck(forbidden.length === 0, `${label} rendered copy has no forbidden patterns`, forbidden.join(', '))

  assertCheck(await trigger.isEnabled(), `${label} STRATUM trigger is enabled`)

  return { trigger, bodyText }
}

async function runDesktopFlow(browser, config) {
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  const diagnostics = attachDiagnostics(page)
  const sameOriginChatRequests = []
  const directBackendChatRequests = []

  page.on('request', (request) => {
    if (request.method() !== 'POST') {
      return
    }

    const url = request.url()
    if (url === `${frontendUrl}/api/chat`) {
      sameOriginChatRequests.push(url)
    }
    if (url.includes('stratum-backend-production-a340.up.railway.app/api/chat')) {
      directBackendChatRequests.push(url)
    }
  })

  try {
    const { trigger } = await checkPageShell(page, 'desktop', diagnostics)
    await capture(page, 'desktop-home')

    await trigger.click()
    const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
    await waitForDialogSettled(dialog)
    await capture(page, 'desktop-chat-open')

    const input = page.getByPlaceholder(/ask stratum/i)
    assertCheck(await input.isVisible(), 'desktop chat input is visible')
    assertCheck(await input.evaluate((node) => node.ownerDocument.activeElement === node), 'desktop chat input receives focus')

    if (config.voiceEnabled === false) {
      const hiddenVoiceControls = await dialog
        .getByRole('button', { name: /enable voice playback|start voice input/i })
        .count()
      assertCheck(hiddenVoiceControls === 0, 'voice controls stay hidden while runtime voice is disabled')
    }

    await input.fill(chatPrompt)
    await dialog.getByRole('button', { name: 'Send', exact: true }).click()
    await dialog
      .locator('.bg-primary.text-white')
      .filter({ hasText: chatPrompt })
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
    record(true, 'desktop user message renders')

    await dialog
      .locator('.border.border-border.bg-surface')
      .nth(1)
      .waitFor({ state: 'visible', timeout: 60_000 })
    record(true, 'desktop assistant response renders')

    const sourcesButton = dialog.getByRole('button', { name: /sources?/i }).first()
    await sourcesButton.waitFor({ state: 'visible', timeout: 90_000 })
    record(true, 'desktop live RAG citation control appears', (await sourcesButton.textContent())?.trim() || '')

    await dialog
      .getByLabel(/STRATUM is composing/i)
      .waitFor({ state: 'hidden', timeout: 60_000 })
      .catch(() => {})
    assertCheck(
      !(await dialog.getByLabel(/STRATUM is composing/i).isVisible().catch(() => false)),
      'desktop live RAG stream reaches a completed rendered state',
    )
    assertCheck(
      sameOriginChatRequests.length > 0,
      'desktop chat request uses same-origin /api/chat',
      sameOriginChatRequests[0] || 'none',
    )
    assertCheck(
      directBackendChatRequests.length === 0,
      'desktop chat does not call Railway directly',
      directBackendChatRequests.join(', '),
    )

    await sourcesButton.click()
    const citationPanel = dialog.locator('[id^="citation-panel"]').first()
    await citationPanel.waitFor({ state: 'visible', timeout: 10_000 })
    const citationText = await citationPanel.innerText()
    assertCheck(
      citationText.trim().length > 40,
      'desktop citation panel exposes source excerpts',
      citationText.trim().slice(0, 120),
    )

    const dialogText = (await dialog.textContent()) || ''
    const forbidden = forbiddenCopyFailures(dialogText)
    assertCheck(forbidden.length === 0, 'desktop chat copy has no forbidden patterns', forbidden.join(', '))

    await capture(page, 'desktop-chat-response')
    assertDiagnosticsClean(diagnostics, 'desktop')
  } finally {
    await context.close()
  }
}

async function runMobileFlow(browser) {
  const viewport = { width: 390, height: 844 }
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    viewport,
  })
  const page = await context.newPage()
  const diagnostics = attachDiagnostics(page)

  try {
    const { trigger } = await checkPageShell(page, 'mobile', diagnostics)
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
    await waitForDialogSettled(dialog)
    const box = await dialog.boundingBox()

    assertCheck(Boolean(box), 'mobile chat dialog has layout bounds')
    if (box) {
      assertCheck(box.x >= -1 && box.y >= -1, 'mobile chat dialog stays inside top-left viewport bounds')
      assertCheck(box.width <= viewport.width + 1, 'mobile chat dialog width fits viewport', `${box.width}px`)
      assertCheck(box.height <= viewport.height + 1, 'mobile chat dialog height fits viewport', `${box.height}px`)
    }

    assertCheck(await page.getByPlaceholder(/ask stratum/i).isVisible(), 'mobile chat input is visible')
    await capture(page, 'mobile-chat-open')
    assertDiagnosticsClean(diagnostics, 'mobile')
  } finally {
    await context.close()
  }
}

async function main() {
  await mkdir(screenshotDir, { recursive: true })

  console.log(`STRATUM live rendered smoke: ${frontendUrl}`)

  const manifestResult = await readJson(`${frontendUrl}/build-manifest.json?live-render-smoke=${Date.now()}`)
  const manifest = manifestResult.body
  assertCheck(manifestResult.response.status === 200, 'manifest returns HTTP 200')
  assertCheck(manifest.schemaVersion === 1, 'manifest schemaVersion is 1')
  assertCheck(Boolean(manifest.commitShortSha), 'manifest includes commitShortSha')
  if (expectedManifestCommit) {
    assertCheck(
      manifest.commitSha === expectedManifestCommit ||
        manifest.commitShortSha === expectedManifestCommit ||
        manifest.commitSha?.startsWith(expectedManifestCommit),
      'manifest commit matches expected',
      manifest.commitShortSha || manifest.commitSha || 'missing',
    )
  }

  const configResult = await readJson(`${frontendUrl}/api/config`)
  const config = configResult.body
  assertCheck(configResult.response.status === 200, '/api/config returns HTTP 200')
  assertCheck(config.ragEnabled === true, 'runtime RAG is enabled for rendered live smoke', String(config.ragEnabled))
  assertCheck(
    config.maxIntakeQuestions === expectedMaxIntakeQuestions,
    'runtime maxIntakeQuestions matches expected',
    String(config.maxIntakeQuestions),
  )

  const browser = await chromium.launch()
  try {
    await runDesktopFlow(browser, config)
    await runMobileFlow(browser)
  } finally {
    await browser.close()
  }

  console.log(
    JSON.stringify(
      {
        frontendUrl,
        manifestCommit: manifest.commitShortSha,
        prompt: chatPrompt,
        screenshotDir,
        screenshots,
        browserPath: 'Playwright fallback; Browser plugin not available in this session',
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
  record(false, 'live rendered smoke crashed', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
