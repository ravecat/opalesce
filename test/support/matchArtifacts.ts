import path from "node:path";
import { format as prettierFormat } from "prettier";
import { expect } from "vitest";
import type { GeneratedArtifact } from "../../src/types";

async function formatArtifact(artifact: GeneratedArtifact): Promise<string> {
  try {
    return await prettierFormat(artifact.code, {
      parser: artifact.filePath.endsWith(".json") ? "json" : "typescript",
    });
  } catch {
    return artifact.code;
  }
}

export async function matchArtifacts(
  artifacts: GeneratedArtifact[] | undefined,
  prefix?: string,
): Promise<void> {
  if (!artifacts?.length) {
    return;
  }

  const ordered = [...artifacts].sort((left, right) =>
    left.filePath.localeCompare(right.filePath),
  );

  for (const artifact of ordered) {
    const snapshotPath = path.join(
      "__snapshots__",
      ...(prefix ? [prefix] : []),
      artifact.filePath,
    );
    await expect(await formatArtifact(artifact)).toMatchFileSnapshot(
      snapshotPath,
    );
  }
}
