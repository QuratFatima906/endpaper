import { defineConfig, devices } from "@playwright/test";

// E2E runs against a production build (the service worker only registers in production).
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  // Point E2E_BASE_URL at an already-running server (e.g. `pnpm dev`) to skip the build.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start -p 3100",
        // Device-only build: blank keys win over .env.local, so these tests never touch real Supabase.
        env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" },
        port: 3100,
        reuseExistingServer: true,
        timeout: 240_000,
      },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
