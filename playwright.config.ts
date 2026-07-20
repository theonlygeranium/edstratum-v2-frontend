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
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
  reporter: process.env.CI ? 'github' : 'html',
})