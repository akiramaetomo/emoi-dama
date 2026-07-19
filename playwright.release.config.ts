import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/release",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4174/emoi-dama/",
    ...devices["Desktop Chrome"],
    channel: "chrome",
    viewport: { width: 768, height: 1024 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/emoi-dama/",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
