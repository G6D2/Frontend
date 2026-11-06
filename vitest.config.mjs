import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Los tests de integración del BFF viven en tests/integration/ y corren
    // aparte con su propio config (vitest.integration.config.mjs): no deben
    // duplicarse acá ni contar para el umbral de cobertura de unit de abajo.
    exclude: ["tests/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      include: ["lib/**/*.js", "app/lib/**/*.js", "middleware.js"],
      exclude: [
        // Browser-only (sessionStorage / window) — not unit-testable in node
        "app/lib/auth.js",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    // middleware.js importa con el alias "@/..." (igual que el resto de la
    // app); vitest no lee jsconfig.json, así que hay que declararlo acá.
    alias: {
      "@": rootDir,
    },
  },
});
