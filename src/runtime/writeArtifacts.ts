import { dirname, join, resolve } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import prettier from "prettier";
import type { GeneratedArtifact } from "~/types";

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function assertSafeOutputRoot(root: string, cwd: string): void {
  if (root === cwd) {
    throw new Error(
      "Refusing to clean the current working directory. Use a dedicated output.path.",
    );
  }

  const parent = dirname(root);
  if (root === parent) {
    throw new Error(`Refusing to clean filesystem root: ${root}`);
  }
}

function createBarrelFiles(
  artifacts: GeneratedArtifact[],
): Map<string, string> {
  const groups = new Map<
    string,
    Array<{
      filePath: string;
      export: NonNullable<GeneratedArtifact["export"]>;
    }>
  >();

  for (const artifact of artifacts) {
    if (!artifact.export) {
      continue;
    }

    const directory = dirname(artifact.filePath);
    const items = groups.get(directory) ?? [];
    items.push({
      filePath: artifact.filePath,
      export: artifact.export,
    });
    groups.set(directory, items);
  }

  const generated = new Map();

  for (const [directory, items] of [...groups.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const lines = items
      .sort((left, right) => left.filePath.localeCompare(right.filePath))
      .map((item) => {
        const fileName = item.filePath
          .slice(directory.length + 1)
          .replace(/\.ts$/, ".js");
        const path = `./${toPosixPath(fileName)}`;
        return item.export.kind === "type"
          ? `export type { ${item.export.name} } from "${path}";`
          : `export { ${item.export.name} } from "${path}";`;
      });

    generated.set(join(directory, "index.ts"), `${lines.join("\n")}\n`);
  }

  const rootLines = [...groups.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map(
      (directory) =>
        `export * from "./${toPosixPath(join(directory, "index.js"))}";`,
    );

  if (rootLines.length > 0) {
    generated.set("index.ts", `${rootLines.join("\n")}\n`);
  }

  return generated;
}

export async function writeArtifacts({
  cwd,
  outDir,
  artifacts,
}: {
  cwd: string;
  outDir: string;
  artifacts: GeneratedArtifact[];
}): Promise<string> {
  const resolvedOutDir = resolve(cwd, outDir);
  assertSafeOutputRoot(resolvedOutDir, cwd);

  rmSync(resolvedOutDir, { recursive: true, force: true });
  mkdirSync(resolvedOutDir, { recursive: true });

  const prettierConfig = await prettier.resolveConfig(cwd);
  const files = new Map(createBarrelFiles(artifacts));

  for (const artifact of artifacts) {
    files.set(artifact.filePath, artifact.code);
  }

  for (const [relativePath, code] of [...files.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const absolutePath = resolve(resolvedOutDir, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    const formatted = await prettier.format(code, {
      ...(prettierConfig ?? {}),
      filepath: absolutePath,
    });
    writeFileSync(absolutePath, formatted);
  }

  return resolvedOutDir;
}
