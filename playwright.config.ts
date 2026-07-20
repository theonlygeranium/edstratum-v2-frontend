import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Run tests against the local preview build (mock mode — no live backend)
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    // No trace by default; capture on failure for debugging
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // CI environments run against a single `vite preview` server. Running
  // browser tests in parallel causes port contention and flaky timeouts
  // (chat-button visibility failures). Serialize to one worker in CI; local
  // runs keep default parallelism for speed.
  workers: process.env.CI ? 1 : undefined,
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'html',
})
