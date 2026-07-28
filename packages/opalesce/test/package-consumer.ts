import {
  createServiceToken,
  defineConfig,
  definePipelineConfig,
  definePlugin,
  runPipeline,
  type Input,
  type OpalesceConfig,
  type PipelineResult,
} from "opalesce";
import { defineConfig as defineConfigFromSubpath, type OutputConfig } from "opalesce/config";
import {
  defineConfig as definePipelineConfigFromSubpath,
  type OrchestrationPlugin,
} from "opalesce/orchestrator";

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
const pipelineConfigFromSubpath = definePipelineConfigFromSubpath({
  input,
});
const pipelineResult = runPipeline(pipelineConfig);

void projectConfig;
void projectConfigFromSubpath;
void pipelineConfigFromSubpath;
void pipelineResult;
void result;
