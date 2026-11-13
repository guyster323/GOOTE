import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 3000);
const host = "127.0.0.1";
const baseURL = `http://${host}:${port}`;
const production = process.env.PLAYWRIGHT_USE_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  reporter: "line",
  webServer: {
    command: production
      ? `npx next start -H ${host} -p ${port}`
      : `npx next dev -H ${host} -p ${port}`,
    url: baseURL,
    reuseExistingServer: production ? false : !process.env.CI,
    timeout: 120 * 1000,
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
