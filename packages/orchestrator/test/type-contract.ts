import type {
  AsyncAPIDocumentInterface,
  Diagnostic,
  Input,
  ParseAsyncAPIOptions,
} from "@opalesce/core";
import {
  createServiceToken,
  defineConfig,
  definePlugin,
  type PipelineConfig,
  type PipelineResult,
  type PluginBuildContext,
  type PluginSetupContext,
} from "../src/index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

const token = createServiceToken<{ readonly id: string }>("typed-service");
declare const setupContext: PluginSetupContext;
declare const buildContext: PluginBuildContext;
declare const input: Input;

const configuredPlugin = definePlugin((options: { readonly prefix: string }) => ({
  name: "typed-plugin",
  setup(context: PluginSetupContext) {
    context.provide(token, { id: options.prefix });
  },
  build(context: PluginBuildContext) {
    const service = context.get(token);
    context.emit({ path: "typed.txt", contents: service.id });
  },
}));

const config = defineConfig({
  input,
  plugins: [configuredPlugin({ prefix: "value" })],
});

const setupService = setupContext.get(token);
const buildService = buildContext.get(token);

void config;
void setupService;
void buildService;

export type ConfigPreservesPluginList = Expect<
  Equal<typeof config.plugins, readonly [ReturnType<typeof configuredPlugin>]>
>;
export type PluginOptionsArePreserved = Expect<
  Equal<Parameters<typeof configuredPlugin>, [{ readonly prefix: string }]>
>;
export type SetupServiceIsTyped = Expect<Equal<typeof setupService, { readonly id: string }>>;
export type BuildServiceIsTyped = Expect<Equal<typeof buildService, { readonly id: string }>>;
export type ConfigUsesCoreInput = Expect<Equal<PipelineConfig["input"], Input>>;
export type ConfigUsesCoreParserOptions = Expect<
  Equal<PipelineConfig["parser"], ParseAsyncAPIOptions | undefined>
>;
export type ResultUsesOfficialDocument = Expect<
  Equal<PipelineResult["document"], AsyncAPIDocumentInterface>
>;
export type ResultUsesReadonlyDiagnostics = Expect<
  Equal<PipelineResult["diagnostics"], readonly Diagnostic[]>
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
