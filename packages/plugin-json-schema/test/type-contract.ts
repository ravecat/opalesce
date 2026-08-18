import jsonSchema from "../src/index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

const defaultPlugin = jsonSchema();
const configuredPlugin = jsonSchema({
  outputPath: "contracts/schemas",
});

void defaultPlugin;
void configuredPlugin;

type JsonSchemaOptions = NonNullable<Parameters<typeof jsonSchema>[0]>;

export type PublicExportIsDefaultOnly = Expect<
  Equal<keyof typeof import("../src/index.js"), "default">
>;
export type PluginNameIsStable = Expect<Equal<typeof defaultPlugin.name, "json-schema">>;
export type PluginOptionsAreReadonly = Expect<
  Equal<
    JsonSchemaOptions,
    {
      readonly outputPath?: string;
    }
  >
>;
