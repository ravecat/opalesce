import { defineConfig, type OpalesceConfig, type OutputConfig } from "@opalesce/config";
import { definePlugin, type ParseAsyncAPIOptions } from "@opalesce/orchestrator";

declare const parser: ParseAsyncAPIOptions;

const plugin = definePlugin(() => ({
  name: "package-consumer",
}));

const output: OutputConfig = {
  path: "./generated",
};

const config: OpalesceConfig = defineConfig({
  input: "./asyncapi.yaml",
  output,
  parser,
  plugins: [plugin()],
});

void config;
