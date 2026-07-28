import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

const ASYNCAPI_3_0 = `asyncapi: 3.0.0
info:
  title: Built CLI fixture
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
  const directory = await mkdtemp(join(tmpdir(), "opalesce-cli-bin-"));
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

describe("built opalesce bin", () => {
  it("loads TypeScript config, runs plugins, reports diagnostics, and writes artifacts", async () => {
    const directory = await temporaryDirectory();
    const binPath = fileURLToPath(new URL("../bin/opalesce.js", import.meta.url));
    await writeFile(join(directory, "asyncapi.yaml"), ASYNCAPI_3_0);
    await writeFile(
      join(directory, "opalesce.config.ts"),
      `const config: {
  input: string;
  output: { path: string; clean: boolean };
  plugins: object[];
} = {
  input: "./asyncapi.yaml",
  output: { path: "./generated", clean: true },
  plugins: [{
    name: "built-bin-fixture",
    build(context) {
      context.emit({
        path: "metadata/version.txt",
        contents: \`\${context.document.version()}\\n\`,
      });
    },
  }],
};

export default config;
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
