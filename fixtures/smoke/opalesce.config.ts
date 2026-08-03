import { defineConfig } from "opalesce";
import { report } from "./report.plugin.ts";

export default defineConfig({
  // Relative input and output paths resolve from this config file's directory.
  input: "./asyncapi.yaml",
  output: {
    path: "./generated/demo",
    // Keep repeated learning runs deterministic by removing stale output first.
    clean: true,
  },
  plugins: [
    // Import a plugin factory and call it with this project's options.
    report({
      path: "report.json",
    }),
  ],
});
