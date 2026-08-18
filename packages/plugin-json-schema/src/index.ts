import type { OrchestrationPlugin, PluginContext } from "@opalesce/core";
import { JsonSchemaGenerationError } from "./errors.js";
import { buildOutput } from "./output.js";
import { stableJson } from "./serialize.js";
import { validateOutput } from "./validate.js";

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

      const output = buildOutput(context.source);
      validateOutput(output);
      const outputPath = options.outputPath ?? "schemas";

      return [
        {
          path: `${outputPath}/index.schema.json`,
          contents: stableJson(output.index),
        },
        ...output.components.map((component) => ({
          path: `${outputPath}/${component.filename}`,
          contents: stableJson(component.document),
        })),
      ];
    },
  };
}
