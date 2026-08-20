import typescript, {
  TypeScriptGenerationError,
  type TypeScriptPluginOptions,
} from "../src/index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

const defaultPlugin = typescript();
const configuredPlugin = typescript({ outputPath: "generated/contracts" });

void defaultPlugin;
void configuredPlugin;
void TypeScriptGenerationError;

export type PublicRuntimeExportsAreFocused = Expect<
  Equal<keyof typeof import("../src/index.js"), "TypeScriptGenerationError" | "default">
>;
export type PluginNameIsStable = Expect<Equal<typeof defaultPlugin.name, "typescript">>;
export type PluginOptionsAreReadonly = Expect<
  Equal<TypeScriptPluginOptions, { readonly outputPath?: string }>
>;
