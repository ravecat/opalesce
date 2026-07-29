import { defineConfig, definePlugin } from "../src/index.js";
import { defineConfig as defineConfigFromSubpath } from "../src/config.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

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

// @ts-expect-error Project config requires an output path.
defineConfig({ input: "./asyncapi.yaml" });

void projectConfig;
void projectConfigFromSubpath;

export type ConfigInputLiteralIsPreserved = Expect<
  Equal<typeof projectConfig.input, "./asyncapi.yaml">
>;
export type PluginOptionsArePreserved = Expect<
  Equal<Parameters<typeof plugin>, [{ readonly path: string }]>
>;
