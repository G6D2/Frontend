import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Config aparte para los tests de integración del BFF (app/api/**).
//
// Van en un config propio (no en vitest.config.mjs) porque:
//  - los route.js importan con el alias "@/..." (igual que el resto de la
//    app), que vitest no resuelve sin este `resolve.alias` explícito —
//    jsconfig.json solo le sirve al editor/TS, no a vitest;
//  - no deben contar para los umbrales de cobertura de unit (80% sobre
//    lib/** y app/lib/**, ver vitest.config.mjs): son tests de integración
//    del BFF completo (route handler + helpers), no unit tests de lib/.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.js"],
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
});
