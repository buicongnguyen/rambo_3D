import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.ts",
  timeout: process.env.CI ? 120000 : 60000,
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
