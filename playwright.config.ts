import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the local Supabase stack (pnpm db:start) and the
// fake AI (AI_MOCK=1 in .env.local). Set PLAYWRIGHT_CHROMIUM_PATH to use a
// preinstalled Chromium instead of `playwright install`.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
