import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3000", 10);
const baseURL = `http://127.0.0.1:${port}`;
const imageUpstreamPort = process.env.PLAYWRIGHT_IMAGE_UPSTREAM_PORT ?? "45731";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  webServer: {
    command: "npm run start",
    url: `${baseURL}/setup`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      APP_URL: process.env.APP_URL ?? baseURL,
      LIDARR_URL: process.env.PLAYWRIGHT_LIDARR_URL ?? `http://127.0.0.1:${imageUpstreamPort}`,
      SESSION_SECRET: process.env.SESSION_SECRET ?? "playwright-test-session-secret-with-enough-entropy-for-ci",
    },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
