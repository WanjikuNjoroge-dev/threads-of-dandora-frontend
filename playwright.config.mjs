import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const inCI = Boolean(process.env.CI);
const chromiumChannel = process.env.PLAYWRIGHT_CHANNEL || undefined;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 2 : 0,
  workers: inCI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
      scale: 'css'
    }
  },
  reporter: inCI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  outputDir: 'test-results/playwright',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  use: {
    baseURL,
    colorScheme: 'dark',
    locale: 'en-KE',
    timezoneId: 'Africa/Nairobi',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run serve',
        url: baseURL,
        reuseExistingServer: !inCI,
        timeout: 120_000
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: chromiumChannel }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
