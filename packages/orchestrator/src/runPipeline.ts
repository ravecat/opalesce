import { parseAsyncAPI } from "@opalesce/core";
import { ArtifactStore } from "./artifacts.js";
import { PluginExecutionError } from "./errors.js";
import { orderPlugins } from "./orderPlugins.js";
import { ServiceRegistry, type ServiceToken } from "./services.js";
import type {
  GeneratedArtifact,
  PipelineConfig,
  PipelineResult,
  PluginBuildContext,
  PluginExecutionPhase,
  PluginSetupContext,
} from "./types.js";

async function runHook(
  pluginName: string,
  phase: PluginExecutionPhase,
  hook: () => void | Promise<void>,
): Promise<void> {
  try {
    await hook();
  } catch (cause) {
    throw new PluginExecutionError(pluginName, phase, cause);
  }
}

export async function runPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const plugins = orderPlugins(config.plugins ?? []);
  const parsed = await parseAsyncAPI(config.input, config.parser);
  const services = new ServiceRegistry();
  const artifacts = new ArtifactStore();

  function get<T>(token: ServiceToken<T>): T {
    return services.get(token);
  }

  const setupContext: PluginSetupContext = Object.freeze({
    document: parsed.document,
    diagnostics: parsed.diagnostics,
    get,
    provide<T>(token: ServiceToken<T>, value: T): void {
      services.provide(token, value);
    },
  });

  const buildContext: PluginBuildContext = Object.freeze({
    document: parsed.document,
    diagnostics: parsed.diagnostics,
    get,
    get artifacts(): readonly GeneratedArtifact[] {
      return artifacts.snapshot();
    },
    emit(artifact: GeneratedArtifact): void {
      artifacts.emit(artifact);
    },
  });

  for (const plugin of plugins) {
    if (plugin.setup !== undefined) {
      await runHook(plugin.name, "setup", () => plugin.setup?.(setupContext));
    }
  }

  for (const plugin of plugins) {
    if (plugin.build !== undefined) {
      await runHook(plugin.name, "build", () => plugin.build?.(buildContext));
    }
  }

  return Object.freeze({
    document: parsed.document,
    diagnostics: parsed.diagnostics,
    artifacts: artifacts.snapshot(),
    pluginNames: Object.freeze(plugins.map((plugin) => plugin.name)),
  });
}
