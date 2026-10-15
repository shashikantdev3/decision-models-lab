import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "site/e2e",
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4173/decision-models-lab/", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/decision-models-lab/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
