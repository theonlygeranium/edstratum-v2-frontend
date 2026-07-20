import { expect, test, type Locator, type Page } from '@playwright/test'

type AnalyticsPayload = {
  event?: string
  properties?: Record<string, string>
}

declare global {
  interface Window {
    __STRATUM_ANALYTICS__?: Array<{ url: string; body: string }>
  }
}

async function installAnalyticsCapture(page: Page) {
  await page.addInitScript(() => {
    window.__STRATUM_ANALYTICS__ = []
    const originalBeacon = navigator.sendBeacon?.bind(navigator)
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: (url: string | URL, data?: BodyInit | null) => {
        const target = String(url)
        if (!target.includes('/api/analytics')) {
          return originalBeacon ? originalBeacon(url, data) : false
        }

        if (data instanceof Blob) {
          void data.text().then((body) => {
            window.__STRATUM_ANALYTICS__?.push({ url: target, body })
          })
        } else {
          window.__STRATUM_ANALYTICS__?.push({ url: target, body: String(data ?? '') })
        }
        return true
      },
    })
  })
}

async function openChat(page: Page) {
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

async function analyticsEvents(page: Page, requiredEvents: string[]) {
  await page.waitForFunction((expected) => {
    const events = (window.__STRATUM_ANALYTICS__ ?? [])
      .flatMap((item) => JSON.parse(item.body) as AnalyticsPayload[])
    return expected.every((eventName) =>
      events.some((event) => event.event === eventName),
    )
  }, requiredEvents)

  return page.evaluate(() => (
    window.__STRATUM_ANALYTICS__ ?? []
  ).flatMap((item) => JSON.parse(item.body) as AnalyticsPayload[]))
}

test('chatbot funnel analytics include open and first message without prompt text', async ({ page }) => {
  await installAnalyticsCapture(page)
  const dialog = await openChat(page)
  const sensitivePrompt = 'Our confidential Canvas migration plan needs review.'

  await sendMessage(dialog, sensitivePrompt)
  await expect(dialog.getByText(/For Canvas environments/i)).toBeVisible({ timeout: 15_000 })

  const events = await analyticsEvents(page, ['chatbot_opened', 'first_message_sent'])
  expect(events).toEqual(expect.arrayContaining([
    expect.objectContaining({ event: 'chatbot_opened' }),
    expect.objectContaining({
      event: 'first_message_sent',
      properties: { mode: 'open', source: 'manual_submit' },
    }),
  ]))
  expect(JSON.stringify(events)).not.toContain(sensitivePrompt)
})

test('readiness completion analytics are emitted without intake answers', async ({ page }) => {
  await installAnalyticsCapture(page)
  const dialog = await openChat(page)

  await dialog.getByRole('button', { name: /run a quick ai readiness check/i }).click()
  const answers = [
    'Higher Ed institution',
    'We use Canvas with custom LTIs.',
    'We need a private AI pilot.',
    'Developing',
    'Hybrid',
    '3-6 months',
    'A scoped pilot with governance.',
  ]

  for (const answer of answers) {
    await dialog.getByPlaceholder(/answer the readiness question/i).fill(answer)
    await dialog.getByRole('button', { name: 'Send', exact: true }).click()
  }

  await expect(dialog.getByRole('button', {
    name: /download session summary as pdf/i,
  })).toBeVisible({ timeout: 15_000 })

  const events = await analyticsEvents(page, ['intake_completed', 'readiness_completed'])
  expect(events).toEqual(expect.arrayContaining([
    expect.objectContaining({ event: 'readiness_completed' }),
    expect.objectContaining({ event: 'intake_completed' }),
  ]))
  for (const answer of answers) {
    expect(JSON.stringify(events)).not.toContain(answer)
  }
})

test('handoff intent analytics fire before backend-confirmed escalation', async ({ page }) => {
  await installAnalyticsCapture(page)
  const dialog = await openChat(page)

  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(dialog.getByText(/will reach out within one business day/i)).toBeVisible({
    timeout: 15_000,
  })

  const events = await analyticsEvents(page, ['handoff_intent', 'first_message_sent', 'escalation_triggered'])
  expect(events).toEqual(expect.arrayContaining([
    expect.objectContaining({
      event: 'handoff_intent',
      properties: { trigger: 'explicit' },
    }),
    expect.objectContaining({
      event: 'first_message_sent',
      properties: { mode: 'escalation', source: 'connect_button' },
    }),
    expect.objectContaining({
      event: 'escalation_triggered',
      properties: { trigger: 'explicit', deliveryStatus: 'sent' },
    }),
  ]))
})

test('backend error analytics are emitted without failed prompt text', async ({ page }) => {
  await installAnalyticsCapture(page)
  await page.addInitScript(() => {
    window.localStorage.setItem('stratum_mock_backend_error', 'true')
  })

  const dialog = await openChat(page)
  const sensitivePrompt = 'This failed request contains private rollout details.'
  await sendMessage(dialog, sensitivePrompt)

  await expect(dialog.getByText(/could not complete that request/i)).toBeVisible({
    timeout: 15_000,
  })

  const events = await analyticsEvents(page, ['backend_error'])
  expect(events).toEqual(expect.arrayContaining([
    expect.objectContaining({
      event: 'backend_error',
      properties: { mode: 'open', status: 'stream_event' },
    }),
  ]))
  expect(JSON.stringify(events)).not.toContain(sensitivePrompt)
})
