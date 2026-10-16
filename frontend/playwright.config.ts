import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    // Uses the locally installed Chrome so no browser download is needed.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
