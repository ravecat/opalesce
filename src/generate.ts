import { loadConfig } from "~/config";
import { PluginManager } from "~/runtime/PluginManager";
import { writeArtifacts } from "~/runtime/writeArtifacts";
import type {
  GenerateOptions,
  GenerateResult,
  GenerationContext,
} from "~/types";

export async function generate(
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig({
    cwd,
    configPath: options.config,
    input: options.input,
    out: options.out,
  });

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

  const outDir = await writeArtifacts({
    cwd,
    outDir: config.output.path,
    artifacts: context.artifacts,
  });

  return {
    total: context.artifacts.length,
    outDir,
    diagnostics: context.diagnostics,
    artifacts: context.artifacts,
  };
}
