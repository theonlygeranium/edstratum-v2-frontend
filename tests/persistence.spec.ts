import { expect, test, type Page, type Route } from '@playwright/test'

const SESSION_KEY = 'stratum-session-id'
const SESSION_TOKEN_KEY = `${SESSION_KEY}-token`

async function mockRuntimeConfig(page: Page, persistenceEnabled: boolean) {
  await page.route('**/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ragEnabled: true,
        voiceEnabled: false,
        persistenceEnabled,
        maxIntakeQuestions: 6,
      }),
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

async function sendMessage(page: Page, text: string) {
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  await dialog.getByPlaceholder(/ask stratum/i).fill(text)
  await dialog.getByRole('button', { name: 'Send', exact: true }).click()
  return dialog
}

function persistenceRouter(options: {
  sessionId?: string
  token?: string
  createdSessionIds?: string[]
  restoredMessages?: unknown[]
  failWrites?: boolean
  onMessageWrite?: (body: unknown) => void
  onSessionDelete?: (sessionId: string) => void
  onSessionCall?: () => void
}) {
  const sessionId = options.sessionId ?? 'stratum-persist-test'
  const token = options.token ?? 'session-token'
  let createCount = 0

  return async (route: Route) => {
    options.onSessionCall?.()
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (method === 'POST' && url.pathname === '/api/sessions') {
      const createdSessionId = options.createdSessionIds?.[createCount] ?? sessionId
      createCount += 1
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: createdSessionId, sessionToken: token }),
      })
      return
    }

    if (method === 'GET' && url.pathname === `/api/sessions/${sessionId}/messages`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId,
          messages: options.restoredMessages ?? [],
        }),
      })
      return
    }

    if (method === 'POST' && url.pathname === `/api/sessions/${sessionId}/messages`) {
      options.onMessageWrite?.(request.postDataJSON())
      await route.fulfill({
        status: options.failWrites ? 500 : 200,
        contentType: 'application/json',
        body: JSON.stringify(options.failWrites ? { error: 'write_failed' } : { ok: true }),
      })
      return
    }

    if (method === 'PATCH' && url.pathname === `/api/sessions/${sessionId}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    if (method === 'DELETE' && url.pathname.startsWith('/api/sessions/')) {
      options.onSessionDelete?.(decodeURIComponent(url.pathname.split('/').at(-1) ?? ''))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    await route.fulfill({ status: 404, body: '{}' })
  }
}

test('session ID is created and stored in sessionStorage on mount', async ({ page }) => {
  await mockRuntimeConfig(page, false)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /open stratum chat/i }).waitFor({
    state: 'visible',
    timeout: 15_000,
  })

  await page.waitForFunction((key) => Boolean(window.sessionStorage.getItem(key)), SESSION_KEY)
  const sessionId = await page.evaluate((key) => window.sessionStorage.getItem(key), SESSION_KEY)

  expect(sessionId).toBeTruthy()
})

test('messages are POSTed to /api/sessions/:id/messages after send', async ({ page }) => {
  const writes: unknown[] = []
  await mockRuntimeConfig(page, true)
  await page.route('**/api/sessions**', persistenceRouter({
    onMessageWrite: (body) => writes.push(body),
  }))

  await openChat(page)
  await page.waitForFunction(
    ([key, tokenKey]) => Boolean(window.localStorage.getItem(key) && window.localStorage.getItem(tokenKey)),
    [SESSION_KEY, SESSION_TOKEN_KEY],
  )
  const dialog = await sendMessage(page, 'How should we plan an AI strategy implementation?')

  await expect(dialog.getByText(/AI strategy defines the roadmap/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect.poll(() => writes.length).toBeGreaterThan(0)
  expect(writes).toContainEqual({
    message: expect.objectContaining({
      role: 'user',
      content: 'How should we plan an AI strategy implementation?',
    }),
  })
})

test('page refresh with existing session ID restores conversation', async ({ page }) => {
  await page.addInitScript(
    ([key, tokenKey]) => {
      window.localStorage.setItem(key, 'stratum-restored')
      window.localStorage.setItem(tokenKey, 'restored-token')
    },
    [SESSION_KEY, SESSION_TOKEN_KEY],
  )
  await mockRuntimeConfig(page, true)
  await page.route('**/api/sessions**', persistenceRouter({
    sessionId: 'stratum-restored',
    token: 'restored-token',
    restoredMessages: [
      {
        id: 'restored-user',
        role: 'user',
        content: 'Restore my Canvas readiness discussion.',
        timestamp: 10,
      },
      {
        id: 'restored-assistant',
        role: 'assistant',
        content: 'Here is the restored readiness context.',
        timestamp: 20,
      },
    ],
  }))

  const dialog = await openChat(page)

  await expect(dialog.getByText('Restore my Canvas readiness discussion.')).toBeVisible({
    timeout: 10_000,
  })
  await expect(dialog.getByText('Here is the restored readiness context.')).toBeVisible()
})

test('persistence disabled: no API calls to session endpoints', async ({ page }) => {
  let sessionCalls = 0
  await mockRuntimeConfig(page, false)
  await page.route('**/api/sessions**', persistenceRouter({
    onSessionCall: () => {
      sessionCalls += 1
    },
  }))

  await openChat(page)
  const dialog = await sendMessage(page, 'Hello there')

  await expect(dialog.getByText(/Share the workflow or constraint/i)).toBeVisible({
    timeout: 15_000,
  })
  expect(sessionCalls).toBe(0)
})

test('D1 write failure does not block or error the chat UI', async ({ page }) => {
  await mockRuntimeConfig(page, true)
  await page.route('**/api/sessions**', persistenceRouter({ failWrites: true }))

  await openChat(page)
  await page.waitForFunction(
    ([key, tokenKey]) => Boolean(window.localStorage.getItem(key) && window.localStorage.getItem(tokenKey)),
    [SESSION_KEY, SESSION_TOKEN_KEY],
  )
  const dialog = await sendMessage(page, 'Hello there')

  await expect(dialog.getByText(/Share the workflow or constraint/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect(dialog.getByText(/temporary issue/i)).toHaveCount(0)
})

test('clear conversation deletes the persisted session before starting a new one', async ({ page }) => {
  const deletedSessions: string[] = []
  await mockRuntimeConfig(page, true)
  await page.route('**/api/sessions**', persistenceRouter({
    sessionId: 'stratum-reset-old',
    createdSessionIds: ['stratum-reset-old', 'stratum-reset-new'],
    onSessionDelete: (sessionId) => {
      deletedSessions.push(sessionId)
    },
  }))

  const dialog = await openChat(page)
  await page.waitForFunction(
    (key) => window.localStorage.getItem(key) === 'stratum-reset-old',
    SESSION_KEY,
  )

  await dialog.getByRole('button', { name: /clear conversation and start over/i }).click()

  await expect.poll(() => deletedSessions).toEqual(['stratum-reset-old'])
  await expect.poll(
    async () => page.evaluate((key) => window.localStorage.getItem(key), SESSION_KEY),
  ).toBe('stratum-reset-new')
  await expect(dialog.getByText(/Hi, I'm STRATUM/i)).toBeVisible()
})
