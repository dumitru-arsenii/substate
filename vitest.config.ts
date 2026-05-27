import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@substate\/core$/,
        replacement: resolve(__dirname, "packages/core/src/index.ts"),
      },
      {
        find: /^@substate\/react$/,
        replacement: resolve(__dirname, "packages/react/src/index.ts"),
      },
    ],
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
  },
});
