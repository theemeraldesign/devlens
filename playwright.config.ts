import { defineConfig, devices } from "@playwright/test";

const liveBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const hasAccountCredentials = Boolean(process.env.DEVLENS_E2E_EMAIL && process.env.DEVLENS_E2E_PASSWORD);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: hasAccountCredentials ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: liveBaseUrl || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"]
  },
  webServer: liveBaseUrl ? undefined : {
    command: "npm run preview -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
