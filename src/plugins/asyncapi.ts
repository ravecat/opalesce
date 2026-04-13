import { createEntityGraph } from "~/core/entityGraph";
import type { AsyncApiEntity } from "~/types";
import { OperationGenerator } from "~/core/generators/OperationGenerator";
import { SchemaGenerator } from "~/core/generators/SchemaGenerator";
import { loadFromConfig } from "~/core/loadFromConfig";
import { definePlugin } from "~/plugins/definePlugin";
import { emitJsonSchemaArtifacts } from "~/emitters/json-schema";
import type { EntityKind, PluginInstance } from "~/types";

interface AsyncApiPluginOptions {
  output?: { path?: string } | false;
  include?: EntityKind[];
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
          asyncapi.resolveNames([
            ...(await schemaGenerator.build()),
            ...(await operationGenerator.build()),
          ]) as AsyncApiEntity[],
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
          include: options.include,
        });

        for (const artifact of artifacts) {
          this.addArtifact(artifact);
        }
      },
    };
  },
);
