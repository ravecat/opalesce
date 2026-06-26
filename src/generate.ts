import { loadConfig } from "~/config";
import { runGeneration } from "~/runtime/runGeneration";
import { writeArtifacts } from "~/runtime/writeArtifacts";
import type { GenerateOptions, GenerateResult } from "~/types";

export async function generate(options: GenerateOptions = {}): Promise<GenerateResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig({
    cwd,
    configPath: options.config,
    input: options.input,
    out: options.out,
  });

  const result = await runGeneration({
    cwd,
    config,
  });

  const outDir = await writeArtifacts({
    cwd: result.cwd,
    outDir: result.config.output.path,
    artifacts: result.artifacts,
  });

  return {
    total: result.artifacts.length,
    outDir,
    diagnostics: result.diagnostics,
    artifacts: result.artifacts,
  };
}
