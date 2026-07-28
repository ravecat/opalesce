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
  it("generates from a TypeScript config that imports only the facade", async () => {
    const directory = await temporaryDirectory();
    const binPath = fileURLToPath(new URL("../bin/opalesce.js", import.meta.url));
    await writeFile(join(directory, "asyncapi.yaml"), ASYNCAPI_3_0);
    await writeFile(
      join(directory, "opalesce.config.ts"),
      `import { defineConfig, definePlugin } from "opalesce";

const metadata = definePlugin(() => ({
  name: "facade-bin-fixture",
  build(context) {
    context.emit({
      path: "metadata/version.txt",
      contents: \`\${context.document.version()}\\n\`,
    });
  },
}));

export default defineConfig({
  input: "./asyncapi.yaml",
  output: { path: "./generated", clean: true },
  plugins: [metadata()],
});
`,
    );

    const result = spawnSync(process.execPath, [binPath, "generate"], {
      cwd: directory,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Generated 1 artifact -> ${join(directory, "generated")}`);
    expect(result.stderr).toContain("[asyncapi:");
    await expect(
      readFile(join(directory, "generated", "metadata", "version.txt"), "utf8"),
    ).resolves.toBe("3.0.0\n");
  });
});
