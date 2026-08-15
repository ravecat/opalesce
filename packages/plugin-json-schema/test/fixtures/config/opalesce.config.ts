import jsonSchema from "@opalesce/plugin-json-schema";
import { defineConfig } from "opalesce";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
  },
  plugins: [
    jsonSchema({
      outputPath: "schemas/events.json",
    }),
  ],
});
