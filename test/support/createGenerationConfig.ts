import { asyncapi } from "~/plugins/asyncapi";
import { typescript } from "~/plugins/typescript";
import { zod } from "~/plugins/zod";
import type { PluginInstance, UserConfig } from "~/types";

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
        "component-schema",
        "message-payload",
        "reply-payload",
        "channel-parameter",
      ],
    }),
    zod({
      output: { path: "zod" },
      include: [
        "component-schema",
        "message-payload",
        "reply-payload",
        "channel-parameter",
      ],
    }),
  ];
}

export function createGraphOnlyPlugins(): PluginInstance[] {
  return [
    asyncapi({ output: false }),
    typescript({
      output: { path: "types" },
      include: [
        "component-schema",
        "message-payload",
        "reply-payload",
        "channel-parameter",
      ],
    }),
    zod({
      output: { path: "zod" },
      include: [
        "component-schema",
        "message-payload",
        "reply-payload",
        "channel-parameter",
      ],
    }),
  ];
}
