import { readFile } from "node:fs/promises";
import { run, type Diagnostic, type PipelineConfig } from "@opalesce/core";
import { resolveConfig, type ResolveConfigOptions } from "./config.js";
import { writeArtifacts } from "./output.js";

export interface GenerateResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly artifactCount: number;
  readonly outputPath: string;
}

export async function generate(options: ResolveConfigOptions): Promise<GenerateResult> {
  const resolved = await resolveConfig(options);
  const input = await readFile(resolved.inputPath, "utf8");
  const pipelineConfig: PipelineConfig = {
    input,
    ...(resolved.config.parser === undefined ? {} : { parser: resolved.config.parser }),
    ...(resolved.config.plugins === undefined ? {} : { plugins: resolved.config.plugins }),
  };
  const result = await run(pipelineConfig);

  await writeArtifacts({
    artifacts: result.artifacts,
    outputPath: resolved.outputPath,
    configDir: resolved.configDir,
    cwd: options.cwd,
    clean: resolved.config.output.clean ?? false,
  });

  return {
    diagnostics: result.diagnostics,
    artifactCount: result.artifacts.length,
    outputPath: resolved.outputPath,
  };
}
