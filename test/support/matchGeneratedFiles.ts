import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { format as prettierFormat } from "prettier";
import { expect } from "vitest";

async function formatFile(filePath: string, code: string): Promise<string> {
  try {
    return await prettierFormat(code, {
      parser: filePath.endsWith(".json") ? "json" : "typescript",
    });
  } catch {
    return code;
  }
}

function collectFiles(rootDir: string): string[] {
  return readdirSync(rootDir)
    .sort()
    .flatMap((entry) => {
      const absolutePath = path.join(rootDir, entry);

      if (statSync(absolutePath).isDirectory()) {
        return collectFiles(absolutePath);
      }

      return [absolutePath];
    });
}

export async function matchGeneratedFiles({
  rootDir,
  snapshotSegments,
}: {
  rootDir: string;
  snapshotSegments: string[];
}): Promise<void> {
  for (const absolutePath of collectFiles(rootDir)) {
    const relativePath = path.relative(rootDir, absolutePath).replaceAll("\\", "/");
    const snapshotPath = path.join("__snapshots__", ...snapshotSegments, relativePath);
    const code = readFileSync(absolutePath, "utf8");

    await expect(await formatFile(relativePath, code)).toMatchFileSnapshot(snapshotPath);
  }
}
