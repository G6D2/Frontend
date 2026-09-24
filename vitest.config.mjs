import { defineConfig } from "vitest/config";

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
      include: ["lib/**/*.js", "app/lib/**/*.js"],
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
});
