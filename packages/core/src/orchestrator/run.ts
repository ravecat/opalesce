import { parseAsyncAPI } from "../parseAsyncAPI.js";
import { ArtifactStore } from "./artifacts.js";
import { PluginExecutionError } from "./errors.js";
import type { PipelineConfig, PipelineResult, PluginContext } from "./types.js";

async function runPlugin(pluginName: string, generate: () => void | Promise<void>): Promise<void> {
  try {
    await generate();
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
    ...(parsed.source === undefined ? {} : { source: parsed.source }),
  });

  for (const plugin of plugins) {
    await runPlugin(plugin.name, async () => {
      for (const artifact of await plugin.generate(context)) {
        artifacts.add(artifact);
      }
    });
  }

  return Object.freeze({
    document: parsed.document,
    diagnostics: parsed.diagnostics,
    ...(parsed.source === undefined ? {} : { source: parsed.source }),
    artifacts: artifacts.snapshot(),
    pluginNames: Object.freeze(plugins.map((plugin) => plugin.name)),
  });
}
