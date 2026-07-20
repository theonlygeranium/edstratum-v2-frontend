import { expect, test, type Page } from '@playwright/test'

async function openReadyPage(page: Page, options: { mockFailure?: boolean } = {}) {
  if (options.mockFailure) {
    await page.addInitScript(() => {
      window.localStorage.setItem('stratum_mock_escalation_fail', 'true')
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

test('confirmation message appears after successful escalation', async ({ page }) => {
  const dialog = await openReadyPage(page)

  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()

  await expect(
    dialog.getByText(/will reach out within one business day/i),
  ).toBeVisible({ timeout: 15_000 })
})

test('failure message appears when escalation delivery fails', async ({ page }) => {
  const dialog = await openReadyPage(page, { mockFailure: true })

  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()

  await expect(dialog.getByText(/Please email hello@edstratumlabs\.ai directly/i)).toBeVisible({
    timeout: 15_000,
  })
})

test('escalation button is disabled after first trigger', async ({ page }) => {
  const dialog = await openReadyPage(page)
  const connectButton = dialog.getByRole('button', { name: 'Connect', exact: true })

  await connectButton.click()
  await expect(dialog.getByText(/will reach out within one business day/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect(connectButton).toBeDisabled()
})
