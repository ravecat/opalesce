import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ASYNCAPI_3_0 = `asyncapi: 3.0.0
info:
  title: Facade fixture
  version: 1.0.0
channels:
  events:
    address: events
    messages:
      Event:
        payload:
          type: object
operations:
  sendEvent:
    action: send
    channel:
      $ref: "#/channels/events"
`;

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(process.cwd(), ".tmp-facade-bin-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("facade opalesce bin", () => {
  it("generates from a TypeScript config that imports an independent plugin package", async () => {
    const directory = await temporaryDirectory();
    const binPath = fileURLToPath(new URL("../bin/opalesce.js", import.meta.url));
    const tscPath = fileURLToPath(
      new URL("../../../node_modules/typescript/lib/tsc.js", import.meta.url),
    );
    await writeFile(join(directory, "asyncapi.yaml"), ASYNCAPI_3_0);
    await writeFile(
      join(directory, "opalesce.config.ts"),
      `import { defineConfig, definePlugin } from "opalesce";
import typescript from "@opalesce/plugin-typescript";

const metadata = definePlugin(() => ({
  name: "facade-bin-fixture",
  generate(context) {
    return [{
      path: "metadata/version.txt",
      contents: \`\${context.document.version()}\\n\`,
    }];
  },
}));

export default defineConfig({
  input: "./asyncapi.yaml",
  output: { path: "./generated", clean: true },
  plugins: [metadata(), typescript()],
});
`,
    );

    const result = spawnSync(process.execPath, [binPath, "generate"], {
      cwd: directory,
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Generated 4 artifacts -> ${join(directory, "generated")}`);
    expect(result.stderr).toContain("[asyncapi:");
    await expect(
      readFile(join(directory, "generated", "metadata", "version.txt"), "utf8"),
    ).resolves.toBe("3.0.0\n");
    await expect(
      readFile(join(directory, "generated", "types", "index.ts"), "utf8"),
    ).resolves.toContain('export type { SendEventMessage } from "./operations/SendEvent.js";');
    await writeFile(
      join(directory, "consumer.ts"),
      `import type { SendEventMessage } from "./generated/types/index.js";

const message: SendEventMessage = { payload: {} };
void message;
`,
    );
    const compilation = spawnSync(
      process.execPath,
      [
        tscPath,
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--exactOptionalPropertyTypes",
        "--isolatedModules",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2022",
        join(directory, "consumer.ts"),
      ],
      { cwd: directory, encoding: "utf8" },
    );

    expect(compilation.status, `${compilation.stdout}${compilation.stderr}`).toBe(0);
  });
});
