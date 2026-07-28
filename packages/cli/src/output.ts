import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, parse, relative, resolve, sep } from "node:path";
import type { GeneratedArtifact } from "@opalesce/orchestrator";

export class OutputError extends Error {
  override readonly name = "OutputError";
}

export interface WriteArtifactsOptions {
  readonly artifacts: readonly GeneratedArtifact[];
  readonly outputPath: string;
  readonly configDir: string;
  readonly cwd: string;
  readonly clean: boolean;
}

function isStrictDescendant(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);

  return (
    relativePath.length > 0 &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function validateCleanupTarget(options: WriteArtifactsOptions): void {
  const outputPath = resolve(options.outputPath);
  const configDir = resolve(options.configDir);
  const cwd = resolve(options.cwd);
  const filesystemRoot = parse(outputPath).root;

  if (
    outputPath === filesystemRoot ||
    !isStrictDescendant(configDir, outputPath) ||
    outputPath === cwd ||
    isStrictDescendant(outputPath, cwd)
  ) {
    throw new OutputError(`Refusing to clean unsafe output directory "${outputPath}".`);
  }
}

function resolveArtifactPath(outputPath: string, artifactPath: string): string {
  const destination = resolve(outputPath, artifactPath);

  if (!isStrictDescendant(outputPath, destination)) {
    throw new OutputError(
      `Artifact path "${artifactPath}" escapes output directory "${outputPath}".`,
    );
  }

  return destination;
}

export async function writeArtifacts(options: WriteArtifactsOptions): Promise<void> {
  const outputPath = resolve(options.outputPath);
  const destinations = options.artifacts.map((artifact) => ({
    artifact,
    destination: resolveArtifactPath(outputPath, artifact.path),
  }));

  if (options.clean) {
    validateCleanupTarget(options);
    await rm(outputPath, { recursive: true, force: true });
  }

  await mkdir(outputPath, { recursive: true });

  for (const { artifact, destination } of destinations) {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, artifact.contents, "utf8");
  }
}
