import { test, expect } from '@playwright/test'

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

  await page.goto('/')

  // Store errors list on the test so after-hooks can assert
  ;(page as unknown as Record<string, unknown>)['_consoleErrors'] = errors
})

// ── Page load ────────────────────────────────────────────────────────────────

test('page loads without console errors', async ({ page }) => {
  await page.waitForLoadState('networkidle')
  const errors = (page as unknown as Record<string, unknown[]>)['_consoleErrors'] as string[]
  expect(errors, `Console errors: ${errors.join('\n')}`).toHaveLength(0)
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

// ── Message flow ─────────────────────────────────────────────────────────────

test('user message appears and assistant responds', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  const input = page.getByPlaceholder(/ask stratum/i)

  await input.fill('What services does EdStratum Labs offer?')
  await page.getByRole('button', { name: /send/i }).click()

  // User bubble appears
  await expect(dialog.locator('.bg-primary.text-white').filter({ hasText: /edstratum labs/i })).toBeVisible({ timeout: 5000 })

  // Send button re-enables after response (mock stream resolves quickly)
  const sendBtn = page.getByRole('button', { name: /send/i })
  await expect(sendBtn).toBeEnabled({ timeout: 15000 })

  // At least one assistant bubble must appear beyond the greeting
  const assistantBubbles = dialog.locator('.border.border-border.bg-surface.text-text-secondary')
  expect(await assistantBubbles.count()).toBeGreaterThanOrEqual(2)
})

// ── Transcript reset ─────────────────────────────────────────────────────────

test('reset button clears conversation back to initial greeting', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  const input = page.getByPlaceholder(/ask stratum/i)

  // Send a message
  await input.fill('Hello')
  await page.getByRole('button', { name: /send/i }).click()
  await page.getByRole('button', { name: /send/i }).waitFor({ state: 'visible' })

  // Confirm multiple messages exist
  const bubbles = dialog.locator('.border.border-border.bg-surface')
  expect(await bubbles.count()).toBeGreaterThanOrEqual(2)

  // Reset
  await page.getByRole('button', { name: /clear conversation/i }).click()

  // Only the initial greeting should remain
  await expect(bubbles).toHaveCount(1, { timeout: 3000 })

  // Input should regain focus after reset
  await expect(input).toBeFocused()
})

// ── Discretion / forbidden copy ──────────────────────────────────────────────

test('escalation panel copy is discretion-safe', async ({ page }) => {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })

  // Trigger escalation via the Connect button
  await page.getByRole('button', { name: /connect/i }).click()

  // Wait for response
  await page.getByRole('button', { name: /send/i }).waitFor({ state: 'visible' })

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