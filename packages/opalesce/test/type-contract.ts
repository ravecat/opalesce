import {
  createServiceToken,
  defineConfig,
  definePipelineConfig,
  definePlugin,
  runPipeline,
  type Input,
  type OpalesceConfig,
  type PipelineConfig,
  type ServiceToken,
} from "../src/index.js";
import { defineConfig as defineConfigFromSubpath } from "../src/config.js";
import { defineConfig as definePipelineConfigFromSubpath } from "../src/orchestrator.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

declare const input: Input;

const token = createServiceToken<{ readonly value: string }>("facade-service");
const plugin = definePlugin((options: { readonly path: string }) => ({
  name: "facade-plugin",
  build(context) {
    context.emit({
      path: options.path,
      contents: context.document.version(),
    });
  },
}));

const projectConfig = defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
  },
  plugins: [plugin({ path: "version.txt" })],
});

const projectConfigFromSubpath = defineConfigFromSubpath({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
  },
});

const pipelineConfig = definePipelineConfig({
  input,
  plugins: [plugin({ path: "version.txt" })],
});

const pipelineConfigFromSubpath = definePipelineConfigFromSubpath({
  input,
});

const result = runPipeline(pipelineConfig);

// @ts-expect-error Project config requires an output path.
defineConfig({ input: "./asyncapi.yaml" });

// @ts-expect-error Project config input is a filesystem path.
defineConfig({ input, output: { path: "./generated" } });

void projectConfig;
void projectConfigFromSubpath;
void pipelineConfigFromSubpath;
void result;
void token;

export type ConfigUsesProjectContract = Expect<
  typeof projectConfig extends OpalesceConfig ? true : false
>;
export type PipelineHelperUsesPipelineContract = Expect<
  Equal<Parameters<typeof runPipeline>[0], PipelineConfig>
>;
export type PluginOptionsArePreserved = Expect<
  Equal<Parameters<typeof plugin>, [{ readonly path: string }]>
>;
export type ServiceTypeIsPreserved = Expect<
  Equal<typeof token, ServiceToken<{ readonly value: string }>>
>;
