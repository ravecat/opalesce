import { parseAsyncAPI } from "../parseAsyncAPI.js";
import { buildInteractionContract } from "../interaction/build.js";
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
  let interaction: ReturnType<typeof buildInteractionContract> | undefined;
  let interactionError: unknown;
  let interactionFailed = false;

  const getInteraction = (): ReturnType<typeof buildInteractionContract> => {
    if (interaction !== undefined) {
      return interaction;
    }
    if (interactionFailed) {
      throw interactionError;
    }
    try {
      interaction = buildInteractionContract(parsed.document);
      return interaction;
    } catch (error: unknown) {
      interactionError = error;
      interactionFailed = true;
      throw error;
    }
  };

  const context: PluginContext = Object.freeze({
    document: parsed.document,
    get interaction() {
      return getInteraction();
    },
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
