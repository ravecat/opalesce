import {
  ArtifactError,
  createServiceToken,
  defineConfig,
  definePlugin,
  PluginConfigurationError,
  PluginExecutionError,
  runPipeline,
  ServiceRegistryError,
  type AsyncAPIDocumentInterface,
  type Diagnostic,
  type GeneratedArtifact,
  type Input,
  type OrchestrationPlugin,
  type ParseAsyncAPIOptions,
  type PipelineConfig,
  type PipelineResult,
  type PluginBuildContext,
  type PluginSetupContext,
  type ServiceToken,
} from "@opalesce/orchestrator";

declare const input: Input;
declare const document: AsyncAPIDocumentInterface;
declare const diagnostic: Diagnostic;
declare const parseOptions: ParseAsyncAPIOptions;

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

const config: PipelineConfig = defineConfig({
  input,
  parser: parseOptions,
  plugins: [plugin],
});
const result: Promise<PipelineResult> = runPipeline(config);
const artifact: GeneratedArtifact = { path: "consumer.txt", contents: "value" };

void document;
void diagnostic;
void artifact;
void result;
void ArtifactError;
void PluginConfigurationError;
void PluginExecutionError;
void ServiceRegistryError;
