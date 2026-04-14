import { canonicalizeEntities } from "~/core/canonicalizeEntities";
import { createEntityGraph } from "~/core/entityGraph";
import { OperationGenerator } from "~/core/generators/OperationGenerator";
import { SchemaGenerator } from "~/core/generators/SchemaGenerator";
import { normalizeInclude } from "~/core/include";
import { assignEntityNames } from "~/core/naming";
import { loadFromConfig } from "~/core/loadFromConfig";
import { definePlugin } from "~/plugins/definePlugin";
import { emitJsonSchemaArtifacts } from "~/emitters/json-schema";
import type { IncludeSelector, PluginInstance } from "~/types";

interface AsyncApiPluginOptions {
  output?: { path?: string } | false;
  include?: IncludeSelector[];
}

function normalizeOutput(
  output: AsyncApiPluginOptions["output"],
  defaultPath: string,
): { path: string } | null {
  if (output === false) {
    return null;
  }

  return {
    path: output?.path ?? defaultPath,
  };
}

export const asyncapi = definePlugin(
  (
    options: AsyncApiPluginOptions = {},
  ): PluginInstance<
    Required<Pick<AsyncApiPluginOptions, "include">> & {
      output: { path: string } | null;
    }
  > => {
    const output = normalizeOutput(options.output, "schemas");
    const include = normalizeInclude(options.include);

    return {
      name: "asyncapi",
      options: {
        output,
        include: options.include ?? [],
      },
      inject() {
        return {
          getAsyncApi: async () => this.asyncapi,
          getEntityGraph: async () => this.graph,
        };
      },
      async install() {
        const asyncapi = await loadFromConfig({
          cwd: this.cwd,
          input: this.config.input,
        });

        const schemaGenerator = new SchemaGenerator(asyncapi);
        const operationGenerator = new OperationGenerator(asyncapi);
        const graph = createEntityGraph(
          assignEntityNames(
            canonicalizeEntities([
              ...(await schemaGenerator.build()),
              ...(await operationGenerator.build()),
            ]),
          ),
        );

        this.asyncapi = asyncapi;
        this.graph = graph;
        this.diagnostics = asyncapi.diagnostics;

        if (!output) {
          return;
        }

        const artifacts = emitJsonSchemaArtifacts({
          graph,
          outputPath: output.path,
          include,
        });

        for (const artifact of artifacts) {
          this.addArtifact(artifact);
        }
      },
    };
  },
);
