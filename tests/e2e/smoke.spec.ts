import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const BACKEND_URL =
  process.env.STRATUM_E2E_BACKEND_URL ??
  'https://stratum-backend-production-a340.up.railway.app'

test.skip(process.env.STRATUM_E2E !== 'true', 'Set STRATUM_E2E=true to run live smoke.')

function chatPayload(content: string, sessionId: string, extra: Record<string, unknown> = {}) {
  return {
    messages: [{ role: 'user', content, timestamp: Date.now() }],
    mode: 'open',
    intakeIndex: null,
    intakeAnswers: {},
    sessionId,
    ...extra,
  }
}

function parseSse(text: string) {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block && !block.startsWith(':'))
    .map((block) => {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      return data ? JSON.parse(data) as Record<string, unknown> : null
    })
    .filter((event): event is Record<string, unknown> => event !== null)
}

async function postChat(request: APIRequestContext, payload: Record<string, unknown>) {
  const response = await request.post(`${BACKEND_URL}/api/chat`, {
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      'X-Stratum-QA': 'true',
    },
    data: payload,
    timeout: 30_000,
  })
  expect(response.ok()).toBeTruthy()
  expect(response.headers()['content-type']).toContain('text/event-stream')
  return parseSse(await response.text())
}

async function openChat(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  return page.getByRole('dialog', { name: /stratum ai intake advisor/i })
}

test('real backend SSE and frontend chat smoke', async ({ page, request }) => {
  test.setTimeout(60_000)

  const events = await postChat(
    request,
    chatPayload('What does EdStratum do?', `e2e-rag-${Date.now()}`),
  )
  expect(events.map((event) => event.type)).toEqual(
    expect.arrayContaining(['phase', 'source', 'token', 'citations', 'done']),
  )
  expect(events.at(-1)).toMatchObject({ type: 'done' })
  expect(events.some((event) => event.type === 'source' && event.source)).toBe(true)
  expect(
    events
      .filter((event) => event.type === 'token')
      .map((event) => event.token)
      .join(''),
  ).toMatch(/EdStratum|AI|Canvas|RAG/i)

  const escalationEvents = await postChat(
    request,
    chatPayload(
      "I'd like to connect with the Founding leadership team",
      `e2e-escalation-${Date.now()}`,
      { mode: 'escalation', escalationTrigger: 'explicit' },
    ),
  )
  expect(escalationEvents.at(-1)).toMatchObject({
    type: 'done',
    escalate: 'explicit',
    escalation: { status: 'suppressed' },
  })

  const dialog = await openChat(page)
  await dialog.getByPlaceholder(/ask stratum/i).fill('What does EdStratum do?')
  await dialog.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(dialog.getByText(/EdStratum|AI|Canvas|RAG/i)).toBeVisible({
    timeout: 20_000,
  })
})
