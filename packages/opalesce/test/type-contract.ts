import { defineConfig, definePlugin, type InteractionContract } from "../src/index.js";
import typescript, { type TypeScriptPluginOptions } from "@opalesce/plugin-typescript";
import { defineConfig as defineConfigFromSubpath } from "../src/config.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

const plugin = definePlugin((options: { readonly path: string }) => ({
  name: "facade-plugin",
  generate(context) {
    const interaction: InteractionContract = context.interaction;
    return [
      {
        path: options.path,
        contents: `${context.document.version()}:${interaction.asyncapiVersion}`,
      },
    ];
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
const typescriptPlugin = typescript({ outputPath: "types" });

// @ts-expect-error Project config requires an output path.
defineConfig({ input: "./asyncapi.yaml" });

void projectConfig;
void projectConfigFromSubpath;
void typescriptPlugin;

export type ConfigInputLiteralIsPreserved = Expect<
  Equal<typeof projectConfig.input, "./asyncapi.yaml">
>;
export type PluginOptionsArePreserved = Expect<
  Equal<Parameters<typeof plugin>, [{ readonly path: string }]>
>;
export type TypeScriptOptionsArePreserved = Expect<
  Equal<TypeScriptPluginOptions, { readonly outputPath?: string }>
>;
export type TypeScriptNameIsStable = Expect<Equal<typeof typescriptPlugin.name, "typescript">>;
