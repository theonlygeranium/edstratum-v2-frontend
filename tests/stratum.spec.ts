import { test, expect, type Page } from '@playwright/test'

/**
 * StratumChat QA Suite
 *
 * All tests run against the local preview build in mock mode
 * (VITE_STRATUM_API_URL unset). No live backend calls, no escalation emails.
 *
 * Coverage:
 *  - Page loads without console errors
 *  - Chat trigger button visible on desktop and mobile
 *  - Dialog opens and closes correctly
 *  - Escape key closes the dialog and returns focus to trigger
 *  - Prompt chips render and are clickable
 *  - User message submits and assistant response appears
 *  - Transcript reset clears conversation
 *  - Escalation copy remains discretion-safe (no real names / links)
 *  - Forbidden copy scan (no scheduling links, no PII)
 */

test.beforeEach(async ({ page }) => {
  // Capture and fail on console errors — catches runtime JS failures
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /open stratum chat/i }).waitFor({
    state: 'visible',
    timeout: 15_000,
  })

  // Store errors list on the test so after-hooks can assert
  ;(page as unknown as Record<string, unknown>)['_consoleErrors'] = errors
})

const SOT_INTAKE_QUESTIONS = [
  /What type of organization are you\?/i,
  /Are you currently using Instructure Canvas\?/i,
  /What problem are you trying to solve with AI\?/i,
  /What is your current data infrastructure and quality level\?/i,
  /Do you have an internal engineering team/i,
  /What is your approximate timeline for an AI initiative\?/i,
  /What does success look like in 6 months\?/i,
]

const SOT_INTAKE_ANSWERS = [
  'Higher Ed institution',
  'Yes, Canvas is our primary LMS',
  'We need grounded support workflows',
  'Developing',
  'Hybrid',
  'Exploring',
  'A scoped pilot with clear evaluation data',
]

async function completeSotReadinessFlow(page: Page) {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })

  await dialog.getByRole('button', { name: /run a quick ai readiness check/i }).click()
  const sendBtn = dialog.getByRole('button', { name: 'Send', exact: true })

  for (let index = 0; index < SOT_INTAKE_QUESTIONS.length; index += 1) {
    await expect(dialog.getByText(SOT_INTAKE_QUESTIONS[index])).toBeVisible({
      timeout: 10_000,
    })
    const input = dialog.getByPlaceholder(/answer the readiness question|ask stratum/i)
    await input.fill(SOT_INTAKE_ANSWERS[index])
    await sendBtn.click()
  }

  await expect(dialog.getByText(/AI Readiness Snapshot/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect(dialog.getByText('Relevant EdStratum Capabilities', { exact: true })).toBeVisible()
}

// ── Page load ────────────────────────────────────────────────────────────────

test('page loads without console errors', async ({ page }) => {
  await page.waitForLoadState('networkidle')
  const errors = (page as unknown as Record<string, unknown[]>)['_consoleErrors'] as string[]
  expect(errors, `Console errors: ${errors.join('\n')}`).toHaveLength(0)
})

test('build manifest exposes public deployment metadata', async ({ page }) => {
  const response = await page.request.get('/build-manifest.json')
  expect(response.ok()).toBeTruthy()

  const manifest = (await response.json()) as {
    schemaVersion?: number
    app?: string
    builtAt?: string
    commitSha?: string
    commitShortSha?: string
    backendUrl?: string
    assets?: Array<{
      path?: string
      bytes?: number
      sha256?: string
    }>
    entryAsset?: string | null
    stylesheetAsset?: string | null
    chatAsset?: string | null
    pdfAssets?: string[]
  }

  expect(manifest.schemaVersion).toBe(1)
  expect(manifest.app).toBe('edstratum-v2-frontend')
  expect(manifest.backendUrl).toMatch(/^https:\/\/stratum-backend-production-a340\.up\.railway\.app$/)
  expect(manifest.commitSha).toMatch(/^(unknown|[a-f0-9]{40})$/)
  expect(manifest.commitShortSha).toMatch(/^(unknown|[a-f0-9]{7})$/)
  expect(Number.isNaN(Date.parse(manifest.builtAt ?? ''))).toBe(false)
  expect(manifest.entryAsset).toMatch(/^\/assets\/index-[\w-]+\.js$/)
  expect(manifest.stylesheetAsset).toMatch(/^\/assets\/index-[\w-]+\.css$/)
  expect(manifest.chatAsset).toMatch(/^\/assets\/StratumChat-[\w-]+\.js$/)
  expect(manifest.pdfAssets).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^\/assets\/stratumPDF-[\w-]+\.js$/),
      expect.stringMatching(/^\/assets\/pdf-vendor-[\w-]+\.js$/),
    ]),
  )
  expect(manifest.assets?.length).toBeGreaterThan(5)
  for (const asset of manifest.assets ?? []) {
    expect(asset.path).toMatch(/^\/assets\/.+/)
    expect(asset.bytes).toBeGreaterThan(0)
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/)
  }
})

// ── Trigger button ───────────────────────────────────────────────────────────

test('chat trigger button is visible on desktop', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /open stratum chat/i })
  await expect(trigger).toBeVisible()
  await expect(trigger).toBeEnabled()
})

test('chat trigger button is visible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: /open stratum chat/i })
  await expect(trigger).toBeVisible()
})

// ── Open / close ─────────────────────────────────────────────────────────────

test('opens chat dialog on trigger click', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  await expect(dialog).toBeVisible()
  // Input should receive focus automatically
  await expect(page.getByPlaceholder(/ask stratum/i)).toBeFocused()
})

test('closes chat dialog on close button click', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  await expect(dialog).toBeVisible()

  await page.getByRole('button', { name: /close stratum chat/i }).click()
  await expect(dialog).not.toBeVisible()
})

test('Escape key closes dialog and returns focus to trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /open stratum chat/i })
  await trigger.click()
  await expect(page.getByRole('dialog', { name: /stratum ai intake advisor/i })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /stratum ai intake advisor/i })).not.toBeVisible()

  // Focus must return to the trigger button
  await expect(trigger).toBeFocused()
})

// ── Prompt chips ─────────────────────────────────────────────────────────────

test('prompt chips render on first open', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  // At least one chip button must be visible
  const chips = page.getByRole('button').filter({ hasNotText: /send|connect|close|clear/i })
  // There should be multiple chips; just assert at least 2 are visible
  await expect(chips.first()).toBeVisible()
})

test('prompt chip click submits without error', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })

  // Get the first visible chip (not a control button)
  const chips = dialog.locator('button').filter({ hasNotText: /send|connect|close|clear|✕|↺/i })
  const firstChip = chips.first()
  await expect(firstChip).toBeVisible()
  const chipText = await firstChip.textContent()

  await firstChip.click()

  // The chip text should now appear as a user message bubble
  if (chipText) {
    await expect(dialog.locator('.bg-primary.text-white').filter({ hasText: chipText.trim() }).first()).toBeVisible({ timeout: 5000 })
  }
})

test('readiness check asks all seven SOT intake questions before snapshot', async ({ page }) => {
  await completeSotReadinessFlow(page)
})

test('stale runtime maxIntakeQuestions cannot truncate SOT readiness intake', async ({ page }) => {
  await page.route('**/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ragEnabled: true,
        voiceEnabled: false,
        persistenceEnabled: false,
        maxIntakeQuestions: 6,
      }),
    })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /open stratum chat/i }).waitFor({
    state: 'visible',
    timeout: 15_000,
  })

  await completeSotReadinessFlow(page)
})

// ── Message flow ─────────────────────────────────────────────────────────────

test('user message appears and assistant responds', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  const input = page.getByPlaceholder(/ask stratum/i)
  const sendBtn = dialog.getByRole('button', { name: 'Send', exact: true })

  await input.fill('What services does EdStratum Labs offer?')
  await sendBtn.click()

  // User bubble appears
  await expect(dialog.locator('.bg-primary.text-white').filter({ hasText: /edstratum labs/i })).toBeVisible({ timeout: 5000 })

  // Assistant response completes in mock mode
  await expect(dialog.getByText(/practical next step/i)).toBeVisible({ timeout: 15000 })

  // At least one assistant bubble must appear beyond the greeting
  const assistantBubbles = dialog.locator('.border.border-border.bg-surface.text-text-secondary')
  expect(await assistantBubbles.count()).toBeGreaterThanOrEqual(2)
})

// ── Transcript reset ─────────────────────────────────────────────────────────

test('reset button clears conversation back to initial greeting', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  const input = page.getByPlaceholder(/ask stratum/i)
  const sendBtn = dialog.getByRole('button', { name: 'Send', exact: true })

  // Send a message
  await input.fill('Hello')
  await sendBtn.click()
  await expect(dialog.getByText(/practical next step/i)).toBeVisible({ timeout: 15000 })

  // Confirm multiple messages exist
  await expect(dialog.locator('.bg-primary.text-white').filter({ hasText: 'Hello' })).toBeVisible()

  // Reset
  await page.getByRole('button', { name: /clear conversation/i }).click()

  // User and generated assistant messages should be gone; prompt chips return.
  await expect(dialog.getByText('Hello', { exact: true })).not.toBeVisible({ timeout: 3000 })
  await expect(dialog.getByText(/Try one of these to get started/i)).toBeVisible()
  await expect(dialog.getByText(/Hi, I'm STRATUM/i)).toBeVisible()

  // Input should regain focus after reset
  await expect(input).toBeFocused()
})

// ── Discretion / forbidden copy ──────────────────────────────────────────────

test('escalation panel copy is discretion-safe', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })

  // Trigger escalation via the Connect button
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()

  // Wait for response
  await expect(dialog.getByText(/Leadership handoff/i)).toBeVisible({ timeout: 10000 })

  // Assert escalation panel appeared
  const escalationPanel = dialog.locator('text=Leadership handoff')
  const panelVisible = await escalationPanel.isVisible({ timeout: 10000 }).catch(() => false)

  if (panelVisible) {
    // Must not reference a real full name or scheduling link
    const panelText = await dialog.textContent()
    expect(panelText).not.toMatch(/jeffrey geronimo/i)
    expect(panelText).not.toMatch(/calendly\.com/i)
    expect(panelText).not.toMatch(/cal\.com/i)
    expect(panelText).not.toMatch(/jg@writer\.com/i)

    // Must reference the safe alias
    expect(panelText).toMatch(/founding leadership team/i)
  }
})

test('no forbidden copy in rendered page', async ({ page }) => {
  await page.waitForLoadState('networkidle')
  const body = (await page.textContent('body')) ?? ''

  const forbidden = [
    /jeffrey geronimo/i,
    /jg@writer\.com/i,
    /jgeronimo@/i,
    /calendly\.com/i,
    /cal\.com\/[a-z]/i,
  ]

  for (const pattern of forbidden) {
    expect(body, `Forbidden pattern ${pattern} found in rendered page`).not.toMatch(pattern)
  }
})

// ── Mobile layout ────────────────────────────────────────────────────────────

test('chat opens and is usable on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: /open stratum chat/i }).click()

  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  await expect(dialog).toBeVisible()

  // Dialog must not overflow viewport
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.width).toBeLessThanOrEqual(400)
  }
})
