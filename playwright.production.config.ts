import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['cold-load.spec.ts', 'stats.spec.ts'],
  outputDir: './.scratch/production-e2e-results',
  reporter: [['list'], ['html', { outputFolder: './.scratch/production-e2e-report', open: 'never' }]],
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off',
  },
  webServer: [
    {
      command: 'node node_modules/vitepress/bin/vitepress.js preview docs --port 4174',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node node_modules/vitepress/bin/vitepress.js build e2e/diagram-site && node node_modules/vitepress/bin/vitepress.js preview e2e/diagram-site --port 4175',
      url: 'http://127.0.0.1:4175',
      timeout: 120_000,
    },
  ],
})
