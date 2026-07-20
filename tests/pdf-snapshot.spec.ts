import { expect, test, type Locator, type Page } from '@playwright/test'

test.setTimeout(60_000)

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

async function completeIntake(dialog: Locator) {
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
}

async function completeEscalation(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(dialog.getByText(/Leadership handoff/i)).toBeVisible({
    timeout: 15_000,
  })
}

async function downloadSummary(page: Page, dialog: Locator) {
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', {
    name: /download session summary as pdf/i,
  }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^edstratum-intake-.+\.pdf$/)
  expect(await download.path()).toBeTruthy()
  return download
}

test('Download button appears after intake completion', async ({ page }) => {
  const dialog = await openChat(page)

  await completeIntake(dialog)

  await expect(dialog.getByRole('button', {
    name: /download session summary as pdf/i,
  })).toBeVisible()
})

test('Download button appears after escalation', async ({ page }) => {
  const dialog = await openChat(page)

  await completeEscalation(dialog)

  await expect(dialog.getByRole('button', {
    name: /download session summary as pdf/i,
  })).toBeVisible()
})

test('Download button not visible during active intake', async ({ page }) => {
  const dialog = await openChat(page)

  await dialog.getByRole('button', { name: /run a quick ai readiness check/i }).click()

  await expect(dialog.getByRole('button', {
    name: /download session summary as pdf/i,
  })).toHaveCount(0)
})

test('clicking Download button triggers file download', async ({ page }) => {
  const dialog = await openChat(page)
  await completeEscalation(dialog)

  await downloadSummary(page, dialog)
})

test('PDF generation does not throw for empty citations array', async ({ page }) => {
  const dialog = await openChat(page)
  await completeEscalation(dialog)

  await downloadSummary(page, dialog)
  await expect(dialog.getByText(/temporary issue/i)).toHaveCount(0)
})

test('PDF generation handles very long messages without crash', async ({ page }) => {
  const dialog = await openChat(page)
  const longMessage = Array.from(
    { length: 140 },
    (_, index) => `Canvas readiness context ${index + 1}`,
  ).join(' ')

  await sendMessage(dialog, longMessage)
  await expect(dialog.getByText(/For Canvas environments/i)).toBeVisible({
    timeout: 20_000,
  })
  await completeEscalation(dialog)

  await downloadSummary(page, dialog)
  await expect(dialog.getByText(/temporary issue/i)).toHaveCount(0)
})
