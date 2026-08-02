import { parseAsyncAPI } from "../parseAsyncAPI.js";
import { ArtifactStore } from "./artifacts.js";
import { PluginExecutionError } from "./errors.js";
import type { GeneratedArtifact, PipelineConfig, PipelineResult, PluginContext } from "./types.js";

async function runBuild(pluginName: string, build: () => void | Promise<void>): Promise<void> {
  try {
    await build();
  } catch (cause) {
    throw new PluginExecutionError(pluginName, cause);
  }
}

export async function run(config: PipelineConfig): Promise<PipelineResult> {
  const plugins = Object.freeze([...(config.plugins ?? [])]);
  const parsed = await parseAsyncAPI(config.input, config.parser);
  const artifacts = new ArtifactStore();

  const context: PluginContext = Object.freeze({
    document: parsed.document,
    diagnostics: parsed.diagnostics,
    emit(artifact: GeneratedArtifact): void {
      artifacts.emit(artifact);
    },
  });

  for (const plugin of plugins) {
    await runBuild(plugin.name, () => plugin.build(context));
  }

  return Object.freeze({
    document: parsed.document,
    diagnostics: parsed.diagnostics,
    artifacts: artifacts.snapshot(),
    pluginNames: Object.freeze(plugins.map((plugin) => plugin.name)),
  });
}
