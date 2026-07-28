import {
  ArtifactError,
  AsyncAPIParseError,
  createServiceToken,
  defineConfig,
  definePlugin,
  parseAsyncAPI,
  PluginConfigurationError,
  PluginExecutionError,
  run,
  ServiceRegistryError,
  type AsyncAPIDocumentInterface,
  type AsyncAPIParserOptions,
  type Diagnostic,
  type GeneratedArtifact,
  type Input,
  type OrchestrationPlugin,
  type ParseAsyncAPIOptions,
  type ParseOptions,
  type ParsedAsyncAPI,
  type PipelineConfig,
  type PipelineResult,
  type PluginBuildContext,
  type PluginSetupContext,
  type ServiceToken,
} from "@opalesce/core";

declare const input: Input;
declare const parserOptions: AsyncAPIParserOptions;
declare const parseOptions: ParseOptions;
declare const document: AsyncAPIDocumentInterface;
declare const diagnostics: readonly Diagnostic[];

const options: ParseAsyncAPIOptions = {
  parser: parserOptions,
  parse: parseOptions,
};
const result: Promise<ParsedAsyncAPI> = parseAsyncAPI(input, options);
const error = new AsyncAPIParseError(diagnostics);
const service: ServiceToken<string> = createServiceToken<string>("consumer");
const pluginFactory = definePlugin((prefix: string) => ({
  name: "consumer",
  setup(context: PluginSetupContext) {
    context.provide(service, prefix);
  },
  build(context: PluginBuildContext) {
    const value: string = context.get(service);
    context.emit({ path: "consumer.txt", contents: value });
  },
}));
const plugin: OrchestrationPlugin = pluginFactory("value");
const pipelineConfig: PipelineConfig = defineConfig({
  input,
  parser: options,
  plugins: [plugin],
});
const pipelineResult: Promise<PipelineResult> = run(pipelineConfig);
const artifact: GeneratedArtifact = { path: "consumer.txt", contents: "value" };

document.version();
document.channels();
document.operations();
void result;
void error;
void artifact;
void pipelineResult;
void ArtifactError;
void PluginConfigurationError;
void PluginExecutionError;
void ServiceRegistryError;
