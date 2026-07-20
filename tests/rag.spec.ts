import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /open stratum chat/i }).waitFor({
    state: 'visible',
    timeout: 15_000,
  })
})

async function sendChatMessage(page: Page, text: string) {
  await page.getByRole('button', { name: /open stratum chat/i }).click()
  const dialog = page.getByRole('dialog', { name: /stratum ai intake advisor/i })
  await page.getByPlaceholder(/ask stratum/i).fill(text)
  await dialog.getByRole('button', { name: 'Send', exact: true }).click()
  return dialog
}

test('assistant message displays citation badge when citations returned', async ({ page }) => {
  const dialog = await sendChatMessage(page, 'How should we plan an AI strategy implementation?')

  await expect(dialog.getByText(/AI strategy defines the roadmap/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect(dialog.getByRole('button', { name: /2 sources/i })).toBeVisible()
})

test('citation panel expands on click and shows excerpt text', async ({ page }) => {
  const dialog = await sendChatMessage(page, 'How should we plan an AI strategy implementation?')
  const sourcesButton = dialog.getByRole('button', { name: /2 sources/i })

  await expect(sourcesButton).toBeVisible({ timeout: 15_000 })
  await sourcesButton.click()

  await expect(dialog.getByText('EdStratum Services', { exact: true })).toBeVisible()
  await expect(dialog.getByText(/production RAG engineering/i)).toBeVisible()
})

test('citation panel collapses on second click', async ({ page }) => {
  const dialog = await sendChatMessage(page, 'How should we plan an AI strategy implementation?')
  const sourcesButton = dialog.getByRole('button', { name: /2 sources/i })

  await expect(sourcesButton).toBeVisible({ timeout: 15_000 })
  await sourcesButton.click()
  await expect(dialog.getByText(/production RAG engineering/i)).toBeVisible()

  await sourcesButton.click()
  await expect(dialog.getByText(/production RAG engineering/i)).not.toBeVisible()
})

test('messages without citations render no citation UI', async ({ page }) => {
  const dialog = await sendChatMessage(page, 'Hello there')

  await expect(dialog.getByText(/Share the workflow or constraint/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect(dialog.getByRole('button', { name: /sources?/i })).toHaveCount(0)
})

test('RAG degradation: chat still works when no citation excerpts are available', async ({ page }) => {
  const dialog = await sendChatMessage(page, 'Can you help with something general?')

  await expect(dialog.getByText(/EdStratum is best suited/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect(dialog.getByRole('button', { name: /sources?/i })).toHaveCount(0)
})

test('RAG citations are hidden when runtime config disables RAG', async ({ page }) => {
  await page.route('/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ragEnabled: false,
        voiceEnabled: false,
        persistenceEnabled: false,
        maxIntakeQuestions: 7,
      }),
    })
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /open stratum chat/i }).waitFor({
    state: 'visible',
    timeout: 15_000,
  })

  const dialog = await sendChatMessage(page, 'How should we plan an AI strategy implementation?')

  await expect(dialog.getByText(/AI strategy defines the roadmap/i)).toBeVisible({
    timeout: 15_000,
  })
  await expect(dialog.getByRole('button', { name: /sources?/i })).toHaveCount(0)
})
