import { expect, test, type Locator, type Page } from '@playwright/test'

type CapturedMockRequest = {
  mode?: string
  escalationTrigger?: string
  sentimentSignal?: string
}

async function openChat(page: Page, options: { sentimentTestMode?: boolean } = {}) {
  if (options.sentimentTestMode) {
    await page.addInitScript(() => {
      window.localStorage.setItem('stratum_sentiment_test_mode', 'true')
    })
  }

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /open stratum chat/i }).waitFor({
    state: 'visible',
    timeout: 15_000,
  })
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  return page.getByRole('dialog', { name: /stratum ai intake advisor/i })
}

async function sendMessage(dialog: Locator, text: string) {
  await dialog.getByPlaceholder(/ask stratum/i).fill(text)
  await dialog.getByRole('button', { name: 'Send', exact: true }).click()
}

test('frustration sequence offers a leadership handoff CTA', async ({ page }) => {
  const dialog = await openChat(page)

  await sendMessage(dialog, 'This Canvas pilot is not working.')
  await expect(dialog.getByText(/For Canvas environments/i)).toBeVisible({
    timeout: 15_000,
  })

  await sendMessage(dialog, 'The guidance still feels useless.')

  await expect(dialog.getByText(/running into some friction/i)).toBeVisible({
    timeout: 5_000,
  })
  await expect(dialog.getByText(/Founding leadership team/i)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled()
})

test('urgency signal automatically triggers sentiment escalation', async ({ page }) => {
  const dialog = await openChat(page)

  await sendMessage(dialog, 'This is urgent. We have a deadline today and need this now.')

  await expect(dialog.getByText(/time-sensitive/i)).toBeVisible({ timeout: 5_000 })
  await expect(dialog.getByText(/Leadership handoff/i)).toBeVisible({ timeout: 15_000 })
  await expect(dialog.getByText(/will reach out within one business day/i)).toBeVisible({
    timeout: 15_000,
  })
})

test('sentiment escalation does not fire again during cooldown', async ({ page }) => {
  const dialog = await openChat(page)
  const connectButton = dialog.getByRole('button', { name: 'Connect', exact: true })

  await connectButton.click()
  await expect(dialog.getByText(/will reach out within one business day/i)).toBeVisible({
    timeout: 15_000,
  })

  await sendMessage(dialog, 'This is urgent and I need this now.')
  await expect(dialog.getByText(/grounded AI implementation questions/i)).toBeVisible({
    timeout: 15_000,
  })

  await expect(dialog.getByText(/time-sensitive/i)).toHaveCount(0)
  expect(await dialog.getByText(/will reach out within one business day/i).count()).toBe(1)
})

test('neutral messages do not trigger sentiment escalation', async ({ page }) => {
  const dialog = await openChat(page)

  await sendMessage(dialog, 'How should we evaluate an AI readiness pilot for Canvas?')
  await expect(dialog.getByText(/Canvas environments/i)).toBeVisible({ timeout: 15_000 })

  await expect(dialog.getByText(/Leadership handoff/i)).toHaveCount(0)
  await expect(dialog.getByText(/time-sensitive/i)).toHaveCount(0)
  await expect(dialog.getByText(/running into some friction/i)).toHaveCount(0)
})

test("negated frustration terms don't trigger a handoff prompt", async ({ page }) => {
  const dialog = await openChat(page)

  await sendMessage(dialog, "I don't hate it.")
  await expect(dialog.getByText(/grounded AI implementation questions/i)).toBeVisible({
    timeout: 15_000,
  })

  await sendMessage(dialog, "It is not useless for our Canvas planning.")
  await expect(dialog.getByText(/running into some friction/i)).toHaveCount(0)
  await expect(dialog.getByText(/Leadership handoff/i)).toHaveCount(0)
})

test("negated urgency terms don't trigger automatic escalation", async ({ page }) => {
  const dialog = await openChat(page)

  await sendMessage(dialog, 'This is not urgent and there is no deadline today.')
  await expect(dialog.getByText(/grounded AI implementation questions/i)).toBeVisible({
    timeout: 15_000,
  })

  await expect(dialog.getByText(/time-sensitive/i)).toHaveCount(0)
  await expect(dialog.getByText(/Leadership handoff/i)).toHaveCount(0)
})

test('urgency escalation request includes sentiment payload', async ({ page }) => {
  const dialog = await openChat(page, { sentimentTestMode: true })

  await sendMessage(dialog, 'This is urgent. We have a deadline today and need this now.')
  await page.waitForFunction(() => {
    const captured = (
      window as unknown as { __STRATUM_LAST_MOCK_REQUEST__?: CapturedMockRequest }
    ).__STRATUM_LAST_MOCK_REQUEST__
    return captured?.escalationTrigger === 'sentiment' && captured.sentimentSignal === 'urgency'
  })

  const request = await page.evaluate(() => (
    window as unknown as { __STRATUM_LAST_MOCK_REQUEST__?: CapturedMockRequest }
  ).__STRATUM_LAST_MOCK_REQUEST__)

  expect(request).toMatchObject({
    mode: 'escalation',
    escalationTrigger: 'sentiment',
    sentimentSignal: 'urgency',
  })
})
