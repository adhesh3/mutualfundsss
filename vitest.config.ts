import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Focus on the pure logic we actually unit-test (engine + data helpers).
      include: ["src/lib/analysis/**", "src/lib/data/**", "src/lib/format.ts"],
      // Network/DB clients and orchestration are integration code, not unit-tested.
      exclude: [
        "**/*.test.ts",
        "src/lib/data/http.ts",
        "src/lib/data/cache.ts",
        "src/lib/data/kuvera.ts",
        "src/lib/data/mfdata.ts",
        "src/lib/data/mfapi.ts",
        "src/lib/data/merge.ts",
        "src/lib/data/refresh.ts",
        "src/lib/data/types.ts",
        "src/lib/analysis/analyze.ts",
      ],
    },
  },
});
