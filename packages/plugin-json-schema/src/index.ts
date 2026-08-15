import type { OrchestrationPlugin, PluginContext } from "@opalesce/core";
import { buildBundle } from "./bundle.js";
import { JsonSchemaGenerationError } from "./errors.js";
import { stableJson } from "./serialize.js";
import { validateBundle } from "./validate.js";

export default function jsonSchema(
  options: {
    readonly outputPath?: string;
  } = {},
): OrchestrationPlugin<"json-schema"> {
  return {
    name: "json-schema",
    generate(context: PluginContext) {
      if (context.source === undefined) {
        throw new JsonSchemaGenerationError(
          "SOURCE_UNAVAILABLE",
          "JSON Schema generation requires the unresolved AsyncAPI source snapshot.",
          { sourcePointer: "" },
        );
      }

      const bundle = buildBundle(context.source);
      validateBundle(bundle);

      return [
        {
          path: options.outputPath ?? "schemas.json",
          contents: stableJson(bundle.document),
        },
      ];
    },
  };
}
