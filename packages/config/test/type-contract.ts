import { definePlugin, type ParseAsyncAPIOptions } from "@opalesce/core";
import { type Config, defineConfig, type OutputConfig } from "../src/index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

declare const parser: ParseAsyncAPIOptions;

const plugin = definePlugin((options: { readonly prefix: string }) => ({
  name: "typed-config-plugin",
  generate() {
    return [
      {
        path: "typed.txt",
        contents: options.prefix,
      },
    ];
  },
}));

const config = defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
    clean: true,
  },
  parser,
  plugins: [plugin({ prefix: "value" })],
});

void config;

export type ConfigPreservesPluginList = Expect<
  Equal<typeof config.plugins, readonly [ReturnType<typeof plugin>]>
>;
export type ConfigPreservesInputLiteral = Expect<Equal<typeof config.input, "./asyncapi.yaml">>;
export type ConfigUsesParserOptions = Expect<
  Equal<Config["parser"], ParseAsyncAPIOptions | undefined>
>;
export type OutputCleanIsOptional = Expect<Equal<OutputConfig["clean"], boolean | undefined>>;
