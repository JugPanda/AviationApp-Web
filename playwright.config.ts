import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/premium.spec.ts", "**/product-story.spec.ts"],
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 12000 },
  outputDir: process.env.OUTPUT_DIRECTORY || "test-results",
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `${process.env.OUTPUT_DIRECTORY || "test-results"}/results.json`,
      },
    ],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3198",
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        "/snap/chromium/current/usr/lib/chromium-browser/chrome",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
