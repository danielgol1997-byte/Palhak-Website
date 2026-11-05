import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PW_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? "html" : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      // Phone-sized checks (375×812, touch, mobile UA)
      name: "mobile",
      // Chromium with iPhone metrics (WebKit is not installed locally).
      use: { ...devices["iPhone 13"], browserName: "chromium" },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: "mobile-small",
      use: { ...devices["iPhone SE"], browserName: "chromium" },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
