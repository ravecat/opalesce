import {
  createServiceToken,
  defineConfig,
  definePipelineConfig,
  definePlugin,
  run,
  type Input,
  type OpalesceConfig,
  type OrchestrationPlugin,
  type PipelineResult,
} from "opalesce";
import { defineConfig as defineConfigFromSubpath, type OutputConfig } from "opalesce/config";

declare const input: Input;
declare const result: PipelineResult;

const service = createServiceToken<string>("package-consumer");
const plugin = definePlugin(() => ({
  name: "package-consumer",
  setup(context) {
    context.provide(service, context.document.version());
  },
}));
const output: OutputConfig = {
  path: "./generated",
};
const projectConfig: OpalesceConfig = defineConfig({
  input: "./asyncapi.yaml",
  output,
  plugins: [plugin()],
});
const projectConfigFromSubpath = defineConfigFromSubpath({
  input: "./asyncapi.yaml",
  output,
});
const pipelinePlugin: OrchestrationPlugin = plugin();
const pipelineConfig = definePipelineConfig({
  input,
  plugins: [pipelinePlugin],
});
const pipelineResult = run(pipelineConfig);

void projectConfig;
void projectConfigFromSubpath;
void pipelineResult;
void result;
