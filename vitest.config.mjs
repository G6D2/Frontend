import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      include: ["lib/**/*.js", "app/lib/**/*.js"],
      exclude: [
        // Browser-only (sessionStorage / window) — not unit-testable in node
        "app/lib/auth.js",
        // HTTP client with window.location redirects — integration concern
        "app/lib/api.js",
        // Browser fetch + client-side cache — integration concern
        "app/lib/geocoding.js",
        // Feature flag constants — no executable logic to test
        "app/lib/features.js",
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
