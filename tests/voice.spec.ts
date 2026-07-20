import { expect, test, type Locator, type Page } from '@playwright/test'

const TTS_ENABLED_KEY = 'stratum_tts_enabled'
const TTS_TEST_OVERRIDE_KEY = 'stratum_tts_test_enabled'

async function mockRuntimeConfig(page: Page, voiceEnabled: boolean) {
  await page.route('**/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ragEnabled: true,
        voiceEnabled,
        persistenceEnabled: false,
        maxIntakeQuestions: 6,
      }),
    })
  })
}

async function enableSpeechRecognition(page: Page) {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      static instances: MockSpeechRecognition[] = []

      continuous = false
      interimResults = false
      lang = ''
      onstart: (() => void) | null = null
      onend: (() => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onresult: ((event: unknown) => void) | null = null

      start() {
        MockSpeechRecognition.instances.push(this)
        this.onstart?.()
      }

      stop() {
        this.onend?.()
      }

      abort() {
        this.onend?.()
      }

      static emit(transcript: string, final = true) {
        const instance = MockSpeechRecognition.instances.at(-1)
        instance?.onresult?.({
          resultIndex: 0,
          results: {
            0: {
              0: { transcript },
              isFinal: final,
            },
            length: 1,
          },
        })
        if (final) {
          instance?.onend?.()
        }
      }
    }

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      writable: true,
      value: MockSpeechRecognition,
    })
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    ;(window as unknown as Record<string, unknown>).__STRATUM_SPEECH_MOCK__ = MockSpeechRecognition
  })
}

async function disableSpeechRecognition(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      writable: true,
      value: undefined,
    })
  })
}

async function enableTTSTestFlag(page: Page) {
  await page.addInitScript((overrideKey) => {
    window.localStorage.setItem(overrideKey, 'true')
  }, TTS_TEST_OVERRIDE_KEY)
}

async function openChat(page: Page): Promise<Locator> {
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

test('mic appears when SpeechRecognition is available', async ({ page }) => {
  await enableSpeechRecognition(page)
  await mockRuntimeConfig(page, true)

  const dialog = await openChat(page)

  await expect(dialog.getByRole('button', { name: /start voice input/i })).toBeVisible()
})

test('mic is hidden when SpeechRecognition is unavailable', async ({ page }) => {
  await disableSpeechRecognition(page)
  await mockRuntimeConfig(page, true)

  const dialog = await openChat(page)

  await expect(dialog.getByRole('button', { name: /start voice input/i })).toHaveCount(0)
})

test('voice input controller applies final transcript to the input', async ({ page }) => {
  await enableSpeechRecognition(page)
  await mockRuntimeConfig(page, true)

  const dialog = await openChat(page)
  await dialog.getByRole('button', { name: /start voice input/i }).click()
  await page.evaluate(() => {
    const mock = (
      window as unknown as {
        __STRATUM_SPEECH_MOCK__?: { emit: (text: string, final?: boolean) => void }
      }
    ).__STRATUM_SPEECH_MOCK__
    mock?.emit('Plan this Canvas pilot', true)
  })

  await expect(dialog.getByPlaceholder(/ask stratum/i)).toHaveValue('Plan this Canvas pilot')
})

test('TTS starts disabled on first load', async ({ page }) => {
  await enableTTSTestFlag(page)
  await mockRuntimeConfig(page, true)

  const dialog = await openChat(page)

  await expect(dialog.getByRole('button', { name: /enable voice playback/i })).toBeVisible()
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), TTS_ENABLED_KEY)
  expect(stored).not.toBe('true')
})

test('TTS toggle persists enabled state to localStorage', async ({ page }) => {
  await enableTTSTestFlag(page)
  await mockRuntimeConfig(page, true)

  const dialog = await openChat(page)
  await dialog.getByRole('button', { name: /enable voice playback/i }).click()

  await expect(dialog.getByRole('button', { name: /disable voice playback/i })).toBeVisible()
  expect(await page.evaluate((key) => window.localStorage.getItem(key), TTS_ENABLED_KEY)).toBe('true')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  await expect(
    page.getByRole('dialog', { name: /stratum ai intake advisor/i })
      .getByRole('button', { name: /disable voice playback/i }),
  ).toBeVisible()
})

test('TTS network failure does not surface as a chat error', async ({ page }) => {
  let ttsCalls = 0
  await enableTTSTestFlag(page)
  await mockRuntimeConfig(page, true)
  await page.route('**/api/tts', async (route) => {
    ttsCalls += 1
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'tts_failed' }),
    })
  })

  const dialog = await openChat(page)
  await dialog.getByRole('button', { name: /enable voice playback/i }).click()
  await sendMessage(dialog, 'Hello there')

  await expect(dialog.getByText(/Share the workflow or constraint/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect.poll(() => ttsCalls).toBeGreaterThan(0)
  await expect(dialog.getByText(/temporary issue/i)).toHaveCount(0)
})

test('markdown is stripped before text is sent to TTS', async ({ page }) => {
  let ttsPayload: { text?: string } | null = null
  await enableTTSTestFlag(page)
  await mockRuntimeConfig(page, true)
  await page.route('**/api/tts', async (route) => {
    ttsPayload = route.request().postDataJSON() as { text?: string }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'tts_failed' }),
    })
  })

  const dialog = await openChat(page)
  await dialog.getByRole('button', { name: /enable voice playback/i }).click()
  await dialog.getByRole('button', { name: /run a quick ai readiness check/i }).click()

  for (const answer of [
    'Higher Ed institution',
    'Canvas is our primary LMS.',
    'We need grounded student support workflows.',
    'Developing',
    'Hybrid',
    '3-6 months',
    'A measured pilot is live.',
  ]) {
    await dialog.getByPlaceholder(/answer the readiness question/i).fill(answer)
    await dialog.getByRole('button', { name: 'Send', exact: true }).click()
  }

  await expect(dialog.getByText(/AI Readiness Snapshot/i)).toBeVisible({
    timeout: 20_000,
  })
  await expect.poll(() => ttsPayload?.text ?? '').toContain('Your Situation')
  expect(ttsPayload?.text).not.toMatch(/[#*_`]/)
  expect(ttsPayload?.text?.length).toBeLessThanOrEqual(500)
})
