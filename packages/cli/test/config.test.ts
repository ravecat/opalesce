import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigError,
  discoverConfigPath,
  loadConfig,
  resolveConfig,
  validateConfig,
} from "../src/config.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "opalesce-cli-config-"));
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

describe("config discovery", () => {
  it("discovers a config in the current directory", async () => {
    const directory = await temporaryDirectory();
    const configPath = join(directory, "opalesce.config.ts");
    await writeFile(configPath, "export default {};\n");

    await expect(discoverConfigPath(directory)).resolves.toBe(configPath);
  });

  it("uses the nearest ancestor config", async () => {
    const directory = await temporaryDirectory();
    const child = join(directory, "packages", "consumer");
    const parentConfig = join(directory, "opalesce.config.mjs");
    const childConfig = join(directory, "packages", "opalesce.config.js");
    await mkdir(child, { recursive: true });
    await writeFile(parentConfig, "export default {};\n");
    await writeFile(childConfig, "export default {};\n");

    await expect(discoverConfigPath(child)).resolves.toBe(childConfig);
  });

  it("rejects multiple candidates in the selected directory", async () => {
    const directory = await temporaryDirectory();
    await Promise.all([
      writeFile(join(directory, "opalesce.config.ts"), "export default {};\n"),
      writeFile(join(directory, "opalesce.config.mjs"), "export default {};\n"),
    ]);

    await expect(discoverConfigPath(directory)).rejects.toThrow(/Multiple Opalesce config files/u);
  });

  it("reports a missing config", async () => {
    const directory = await temporaryDirectory();

    await expect(discoverConfigPath(directory)).rejects.toThrow(/config not found/u);
  });
});

describe("config loading", () => {
  it("accepts a plugin with one generate hook", () => {
    const plugin = {
      name: "linear",
      generate() {
        return [];
      },
    };

    expect(
      validateConfig({
        input: "./asyncapi.yaml",
        output: { path: "./generated" },
        plugins: [plugin],
      }),
    ).toMatchObject({ plugins: [plugin] });
  });

  it.each([
    { name: "missing generate", plugin: { name: "missing-generate" } },
    { name: "legacy build", plugin: { name: "legacy-build", build() {} } },
    {
      name: "legacy setup",
      plugin: { name: "legacy-setup", setup() {}, generate: () => [] },
    },
    {
      name: "legacy dependency",
      plugin: { name: "legacy-dependency", dependsOn: ["other"], generate: () => [] },
    },
  ])("rejects a plugin with $name", ({ plugin }) => {
    expect(() =>
      validateConfig({
        input: "./asyncapi.yaml",
        output: { path: "./generated" },
        plugins: [plugin],
      }),
    ).toThrow("plugins");
  });

  it("loads an erasable TypeScript default export", async () => {
    const directory = await temporaryDirectory();
    const configPath = join(directory, "opalesce.config.ts");
    await writeFile(
      configPath,
      `const config: { input: string; output: { path: string } } = {
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
};

export default config;
`,
    );

    await expect(loadConfig(configPath)).resolves.toEqual({
      input: "./asyncapi.yaml",
      output: {
        path: "./generated",
      },
    });
  });

  it("loads a CommonJS default value", async () => {
    const directory = await temporaryDirectory();
    const configPath = join(directory, "opalesce.config.cjs");
    await writeFile(
      configPath,
      `module.exports = {
  input: "./asyncapi.yaml",
  output: { path: "./generated", clean: true },
};
`,
    );

    await expect(loadConfig(configPath)).resolves.toEqual({
      input: "./asyncapi.yaml",
      output: {
        path: "./generated",
        clean: true,
      },
    });
  });

  it.each([
    {
      name: "ESM TypeScript",
      fileName: "opalesce.config.mts",
      source: `export default {
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
};
`,
    },
    {
      name: "CommonJS TypeScript",
      fileName: "opalesce.config.cts",
      source: `module.exports = {
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
};
`,
    },
    {
      name: "CommonJS JavaScript",
      fileName: "opalesce.config.js",
      source: `module.exports = {
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
};
`,
    },
    {
      name: "ESM JavaScript",
      fileName: "opalesce.config.mjs",
      source: `export default {
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
};
`,
    },
  ])("loads $name config", async ({ fileName, source }) => {
    const directory = await temporaryDirectory();
    const configPath = join(directory, fileName);
    await writeFile(configPath, source);

    await expect(loadConfig(configPath)).resolves.toMatchObject({
      input: "./asyncapi.yaml",
      output: {
        path: "./generated",
      },
    });
  });

  it("rejects a module without a default export", async () => {
    const directory = await temporaryDirectory();
    const configPath = join(directory, "opalesce.config.mjs");
    await writeFile(configPath, "export const config = {};\n");

    await expect(loadConfig(configPath)).rejects.toThrow(/must have a default export/u);
  });

  it.each([
    {
      name: "empty input",
      value: { input: "", output: { path: "./generated" } },
      message: "input",
    },
    {
      name: "empty output",
      value: { input: "./asyncapi.yaml", output: { path: "" } },
      message: "output.path",
    },
    {
      name: "invalid clean",
      value: {
        input: "./asyncapi.yaml",
        output: { path: "./generated", clean: "yes" },
      },
      message: "output.clean",
    },
    {
      name: "invalid plugins",
      value: {
        input: "./asyncapi.yaml",
        output: { path: "./generated" },
        plugins: {},
      },
      message: "plugins",
    },
    {
      name: "invalid parser",
      value: {
        input: "./asyncapi.yaml",
        output: { path: "./generated" },
        parser: [],
      },
      message: "parser",
    },
  ])("rejects $name", ({ value, message }) => {
    expect(() => validateConfig(value)).toThrow(message);
  });

  it("uses config-relative paths and cwd-relative overrides", async () => {
    const directory = await temporaryDirectory();
    const nested = join(directory, "packages", "consumer");
    const configPath = join(directory, "opalesce.config.mjs");
    await mkdir(nested, { recursive: true });
    await writeFile(
      configPath,
      `export default {
  input: "./specs/asyncapi.yaml",
  output: { path: "./generated" },
};
`,
    );

    await expect(resolveConfig({ cwd: nested })).resolves.toMatchObject({
      configPath,
      configDir: directory,
      inputPath: join(directory, "specs", "asyncapi.yaml"),
      outputPath: join(directory, "generated"),
    });

    await expect(
      resolveConfig({
        cwd: nested,
        configPath,
        input: "./override.yaml",
        out: "./override-output",
      }),
    ).resolves.toMatchObject({
      inputPath: join(nested, "override.yaml"),
      outputPath: join(nested, "override-output"),
    });
  });

  it("rejects an unsupported explicit config extension", async () => {
    const directory = await temporaryDirectory();

    await expect(
      resolveConfig({
        cwd: directory,
        configPath: "./opalesce.config.json",
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});
