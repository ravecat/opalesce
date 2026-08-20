import type { GeneratedArtifact, OrchestrationPlugin, PluginContext } from "@opalesce/core";
import { planFiles } from "./plan.js";
import { renderFile } from "./render.js";

export { TypeScriptGenerationError } from "./errors.js";
export type { TypeScriptGenerationErrorCode, TypeScriptGenerationErrorOptions } from "./errors.js";

export interface TypeScriptPluginOptions {
  readonly outputPath?: string;
}

function generate(
  context: PluginContext,
  options: TypeScriptPluginOptions,
): readonly GeneratedArtifact[] {
  const files = planFiles(context.interaction, options.outputPath ?? "types");
  return Object.freeze(
    files.map((file) =>
      Object.freeze({
        path: file.path,
        contents: renderFile(file),
      }),
    ),
  );
}

export default function typescript(
  options: TypeScriptPluginOptions = {},
): OrchestrationPlugin<"typescript"> {
  return Object.freeze({
    name: "typescript",
    generate(context: PluginContext) {
      return generate(context, options);
    },
  });
}
