import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  test: {
    include: ["test/emitters/**/*.test.ts", "test/runtime/**/*.test.ts"],
  },
  resolve: {
    alias: [
      {
        find: /^~\/(.*)\.js$/,
        replacement: `${srcDir}$1.ts`,
      },
      {
        find: /^~\//,
        replacement: srcDir,
      },
    ],
  },
  plugins: [tsconfigPaths()],
});
