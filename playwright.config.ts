import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the local Supabase stack (pnpm db:start).
// - "mobile-chrome": dev server with the fake AI (AI_MOCK=1 in .env.local).
// - "pwa": a production build (service worker enabled) on port 3100.
// Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium instead of
// `playwright install`.
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure", launchOptions },
  projects: [
    {
      name: "mobile-chrome",
      testIgnore: /pwa\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: "http://localhost:3000" },
    },
    {
      name: "pwa",
      testMatch: /pwa\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: "http://localhost:3100" },
    },
  ],
  webServer: [
    {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm build && pnpm start -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
