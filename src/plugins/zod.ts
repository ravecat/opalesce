import { normalizeInclude } from "~/core/include";
import { definePlugin } from "~/plugins/definePlugin";
import { emitZodArtifacts } from "~/emitters/zod";
import type { IncludeSelector, PluginInstance } from "~/types";

interface BackendPluginOptions {
  output?: {
    path?: string;
  };
  include?: IncludeSelector[];
}

export const zod = definePlugin(
  (options: BackendPluginOptions = {}): PluginInstance => {
    const include = normalizeInclude(options.include);

    return {
      name: "zod",
      pre: ["asyncapi"],
      options: {
        output: {
          path: options.output?.path ?? "zod",
        },
        include: options.include ?? [],
      },
      async install() {
        const graph = await this.getEntityGraph?.();

        if (!graph) {
          throw new Error(
            "zod requires asyncapi to initialize the entity graph.",
          );
        }

        const artifacts = emitZodArtifacts({
          graph,
          outputPath: options.output?.path ?? "zod",
          include,
        });

        for (const artifact of artifacts) {
          this.addArtifact(artifact);
        }
      },
    };
  },
);
