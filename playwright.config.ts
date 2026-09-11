import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.ts",
  timeout: process.env.CI ? 180000 : 60000,
  expect: { timeout: process.env.CI ? 30000 : 5000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5177",
    storageState: process.env.CI
      ? {
          cookies: [],
          origins: [
            {
              origin: "http://127.0.0.1:5177",
              localStorage: [
                {
                  name: "nightfall-prefs",
                  value: JSON.stringify({ low: true, sound: false }),
                },
              ],
            },
          ],
        }
      : undefined,
    viewport: { width: 1440, height: 900 },
    // Preserve CSS layout while reducing software-rendered framebuffer work on CI.
    deviceScaleFactor: process.env.CI ? 0.5 : 1,
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5177",
    url: "http://127.0.0.1:5177",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
