import { defineConfig, devices } from "@playwright/test";
import {
  BACKEND_DIR,
  BACKEND_MODE,
  BACKEND_PORT,
  BACKEND_URL,
  FRONT_PORT,
  FRONT_URL,
  IDP_PORT,
  IDP_URL,
  realBackendEnv,
} from "./e2e/support/env.mjs";

// Tests de punta a punta (Playwright) contra `next start`. Se corren con
// `npm run test:e2e` después de `npm run build`; ver la sección "Tests e2e"
// del README. No forman parte de `npm test` (Vitest).

const isCI = Boolean(process.env.CI);

// El backend: el simulado (default, el de CI) o el real clonado en
// E2E_BACKEND_DIR, que antes de arrancar aplica las migraciones de Flyway.
const backendServer =
  BACKEND_MODE === "real"
    ? {
        command: "npm run migrate && node src/index.js",
        cwd: BACKEND_DIR,
        env: realBackendEnv(),
        url: `${BACKEND_URL}/health`,
        timeout: 180_000,
        reuseExistingServer: !isCI,
      }
    : {
        command: "node e2e/mocks/backend.mjs",
        url: `${BACKEND_URL}/health`,
        reuseExistingServer: !isCI,
      };

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.mjs",
  // Un solo worker: los dos specs comparten backend y el tablero del
  // dispatcher muestra todas las emergencias abiertas.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: FRONT_URL,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    backendServer,
    {
      command: "node e2e/mocks/login-federado.mjs",
      url: `${IDP_URL}/health`,
      reuseExistingServer: !isCI,
    },
    {
      command: "npm run start",
      url: `${FRONT_URL}/acceso`,
      timeout: 120_000,
      reuseExistingServer: !isCI,
      env: {
        PORT: String(FRONT_PORT),
        API_URL: `http://127.0.0.1:${BACKEND_PORT}`,
        CITYPASS_IDP_AUTH_URL: `http://127.0.0.1:${IDP_PORT}/auth/login`,
        BACKEND_WARMUP_PATH: "/health",
      },
    },
  ],
});
