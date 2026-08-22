import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,js}", "src/**/*.test.{ts,tsx}"],
    // Boots Kuzu WASM at import time, so it cannot run under the node environment.
    exclude: ["tests/kuzuHelpers/createSchema.test.js"],
  },
});
