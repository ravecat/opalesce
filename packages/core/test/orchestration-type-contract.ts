import {
  defineConfig,
  definePlugin,
  run,
  type AsyncAPIDocumentInterface,
  type AsyncAPISource,
  type Diagnostic,
  type GeneratedArtifact,
  type Input,
  type InteractionContract,
  type OrchestrationPlugin,
  type ParseAsyncAPIOptions,
  type PipelineConfig,
  type PipelineResult,
  type PluginContext,
} from "../src/index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

declare const pluginContext: PluginContext;
declare const input: Input;

const configuredPlugin = definePlugin((options: { readonly prefix: string }) => ({
  name: "typed-plugin",
  generate() {
    return [{ path: "typed.txt", contents: options.prefix }];
  },
}));

const config = defineConfig({
  input,
  plugins: [configuredPlugin({ prefix: "value" })],
});

const document = pluginContext.document;
const diagnostics = pluginContext.diagnostics;
const sourceSnapshot = pluginContext.source;
const interaction = pluginContext.interaction;

void config;
void document;
void diagnostics;
void sourceSnapshot;
void interaction;

export type ConfigPreservesPluginList = Expect<
  Equal<typeof config.plugins, readonly [ReturnType<typeof configuredPlugin>]>
>;
export type PluginOptionsArePreserved = Expect<
  Equal<Parameters<typeof configuredPlugin>, [{ readonly prefix: string }]>
>;
export type PluginUsesSingleGenerateHook = Expect<
  Equal<keyof OrchestrationPlugin, "name" | "generate">
>;
export type ContextHasOnlyGenerateInputs = Expect<
  Equal<keyof PluginContext, "diagnostics" | "document" | "interaction" | "source">
>;
export type ContextUsesInteractionContract = Expect<
  Equal<PluginContext["interaction"], InteractionContract>
>;
export type PluginGenerateReturnsArtifacts = Expect<
  Equal<
    ReturnType<OrchestrationPlugin["generate"]>,
    readonly GeneratedArtifact[] | Promise<readonly GeneratedArtifact[]>
  >
>;
export type ConfigUsesCoreInput = Expect<Equal<PipelineConfig["input"], Input>>;
export type ConfigUsesCoreParserOptions = Expect<
  Equal<PipelineConfig["parser"], ParseAsyncAPIOptions | undefined>
>;
export type RunUsesPipelineConfig = Expect<Equal<Parameters<typeof run>[0], PipelineConfig>>;
export type ResultUsesOfficialDocument = Expect<
  Equal<PipelineResult["document"], AsyncAPIDocumentInterface>
>;
export type ResultUsesReadonlyDiagnostics = Expect<
  Equal<PipelineResult["diagnostics"], readonly Diagnostic[]>
>;
export type ContextUsesOptionalSource = Expect<
  Equal<PluginContext["source"], AsyncAPISource | undefined>
>;
export type ResultUsesOptionalSource = Expect<
  Equal<PipelineResult["source"], AsyncAPISource | undefined>
>;
export type ResultUsesReadonlyArtifacts = Expect<
  Equal<
    PipelineResult["artifacts"],
    readonly { readonly path: string; readonly contents: string }[]
  >
>;
export type ResultUsesReadonlyPluginNames = Expect<
  Equal<PipelineResult["pluginNames"], readonly string[]>
>;
