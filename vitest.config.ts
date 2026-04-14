import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^~\//,
        replacement: srcDir,
      },
    ],
  },
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/emitters/**/*.test.ts", "test/runtime/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "smoke",
          include: ["test/smoke/**/*.test.ts"],
        },
      },
    ],
  },
});
