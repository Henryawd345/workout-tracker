import { defineConfig, devices } from '@playwright/test'

// Offline check against a real production build in a sub-folder (/wt/), like GitHub Pages.
export default defineConfig({
  testDir: './e2e-offline',
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'iphone-14', use: { ...devices['iPhone 14'] } }],
  webServer: {
    command: 'npx vite build --outDir dist-offline --logLevel error && npx vite preview --outDir dist-offline --port 4173 --strictPort',
    url: 'http://localhost:4173/wt/',
    env: { BASE_PATH: '/wt/', MSYS_NO_PATHCONV: '1' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
