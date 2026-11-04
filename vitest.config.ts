// Minimal vitest config — resolves the `@/` path alias the same way
// tsconfig.json and Next.js's bundler do, so test files can import
// modules that use `@/lib/...` internally (e.g. src/lib/query-engine.ts)
// without every test needing to know about that internal detail.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig keeps jsx: "preserve" for Next.js; tests that render a
  // component (tests/rtp-0925-a5-ui.test.ts) need Vite (oxc) to compile TSX.
  oxc: { jsx: { runtime: "automatic" } },
  // Every DB test file shares one TEST_DATABASE_URL and some assert line-wide
  // tallies (dashboard counts) or upsert the shared Line rows: run files one at a
  // time so a parallel file's writes never land between a before/after snapshot.
  // (~15s for the whole suite.)
  test: { fileParallelism: false },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
