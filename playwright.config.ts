import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for OAE Form E2E tests.
 * Focused on testing complex form fields like map interactions and conditional dropdowns.
 */
export default defineConfig({
  testDir: "./e2e",

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Map tests run WebGL through SwiftShader on CI runners, which is slow.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Reporter to use
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"], ["list"]]
    : [["html", { open: "never" }], ["list"]],

  // Shared settings for all projects
  use: {
    // Base URL for the application
    baseURL: "http://localhost:3000",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Take screenshot on failure
    screenshot: "only-on-failure",

    // Increase default timeout for map loading
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Can add more browsers later if needed:
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Locally an already-running dev server is reused as-is, so its own env
    // (not the one below) applies. Stop it, or run with CI=1, when that matters.
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for dev server to start
    // e2e never needs a Supabase project; the in-memory auth client stands in.
    env: { VITE_AUTH_ENABLED: "false" },
  },
});
