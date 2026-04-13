import { definePlugin } from "~/plugins/definePlugin";
import { emitTypescriptArtifacts } from "~/emitters/typescript";
import type { EntityKind, PluginInstance } from "~/types";

interface BackendPluginOptions {
  output?: {
    path?: string;
  };
  include?: EntityKind[];
}

export const typescript = definePlugin(
  (options: BackendPluginOptions = {}): PluginInstance => ({
    name: "typescript",
    pre: ["asyncapi"],
    options: {
      output: {
        path: options.output?.path ?? "types",
      },
      include: options.include ?? [],
    },
    async install() {
      const graph = await this.getEntityGraph?.();

      if (!graph) {
        throw new Error(
          "typescript requires asyncapi to initialize the entity graph.",
        );
      }

      const artifacts = await emitTypescriptArtifacts({
        graph,
        outputPath: options.output?.path ?? "types",
        include: options.include,
      });

      for (const artifact of artifacts) {
        this.addArtifact(artifact);
      }
    },
  }),
);
