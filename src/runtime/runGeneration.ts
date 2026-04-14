import { PluginManager } from "~/runtime/PluginManager";
import type {
  GenerationContext,
  RunGenerationOptions,
  RunGenerationResult,
} from "~/types";

export async function runGeneration({
  cwd = process.cwd(),
  config,
}: RunGenerationOptions): Promise<RunGenerationResult> {
  const pluginManager = new PluginManager(config);
  const context: GenerationContext = {
    cwd,
    config,
    asyncapi: null,
    graph: null,
    diagnostics: [],
    artifacts: [],
  };

  await pluginManager.run(context);

  return {
    cwd,
    config,
    diagnostics: context.diagnostics,
    artifacts: context.artifacts,
  };
}
