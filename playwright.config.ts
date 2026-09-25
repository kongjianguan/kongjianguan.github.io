import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: './.scratch/e2e-results',
  reporter: [['list'], ['html', { outputFolder: './.scratch/e2e-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off',
  },
  webServer: {
    command: 'VITE_LOCALEDIT=1 pnpm dev --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
