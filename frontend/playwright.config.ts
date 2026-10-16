import { defineConfig, devices } from "@playwright/test";

const port = 3100;

// Defaults to Playwright's bundled Chromium. Set PW_CHANNEL=chrome (or msedge) to use an installed browser,
// and PW_DEV=1 to test against `next dev` instead of a production build.
const channel = process.env.PW_CHANNEL;
const server = process.env.PW_DEV
  ? `npm run dev -- -p ${port}`
  : `npm run build && npm run start -- -p ${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(channel ? { channel } : {}) } }],
  webServer: {
    command: server,
    url: `http://localhost:${port}`,
    // Never silently test whatever happens to be running on the port in CI.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
