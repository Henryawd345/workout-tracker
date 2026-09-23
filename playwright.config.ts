import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run in WebKit (the engine behind iPhone Safari) at iPhone 14 size.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'iphone-14', use: { ...devices['iPhone 14'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    // Locally, reuse a running dev server; in CI always start a fresh one.
    reuseExistingServer: !process.env.CI,
  },
})
