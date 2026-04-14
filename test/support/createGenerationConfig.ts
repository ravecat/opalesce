import { asyncapi } from "~/plugins/asyncapi";
import { typescript } from "~/plugins/typescript";
import { zod } from "~/plugins/zod";
import type { IncludeSelector, PluginInstance, UserConfig } from "~/types";

export function createGenerationConfig({
  inputPath,
  outputPath,
  plugins,
}: {
  inputPath: string;
  outputPath: string;
  plugins: PluginInstance[];
}): UserConfig {
  return {
    input: { path: inputPath },
    output: { path: outputPath },
    plugins,
  };
}

export function createSharedPlugins(): PluginInstance[] {
  return [
    asyncapi({ output: { path: "schemas" } }),
    typescript({
      output: { path: "types" },
      include: [
        "components.schemas",
        "operations.messages.payloads",
        "operations.replies.payloads",
        "channels.parameters",
      ],
    }),
    zod({
      output: { path: "zod" },
      include: [
        "components.schemas",
        "operations.messages.payloads",
        "operations.replies.payloads",
        "channels.parameters",
      ],
    }),
  ];
}

export function createGraphOnlyPlugins(): PluginInstance[] {
  const include: IncludeSelector[] = [
    "components.schemas",
    "operations.messages.payloads",
    "operations.replies.payloads",
    "channels.parameters",
  ];

  return [
    asyncapi({ output: false }),
    typescript({
      output: { path: "types" },
      include,
    }),
    zod({
      output: { path: "zod" },
      include,
    }),
  ];
}
