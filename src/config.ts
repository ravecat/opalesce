import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { UserConfig } from "~/types";

const CONFIG_FILE_NAMES = [
  "asyncapi.config.mjs",
  "asyncapi.config.js",
  "asyncapi.config.cjs",
];

export function defineConfig<T extends UserConfig>(config: T): T {
  return config;
}

function assertConfigShape(value: unknown): asserts value is UserConfig {
  if (!value || typeof value !== "object") {
    throw new Error("Config must export an object.");
  }

  const config = value as UserConfig;

  if (
    !config.input ||
    typeof config.input.path !== "string" ||
    !config.input.path
  ) {
    throw new Error("Config must define input.path.");
  }

  if (
    !config.output ||
    typeof config.output.path !== "string" ||
    !config.output.path
  ) {
    throw new Error("Config must define output.path.");
  }

  if (config.plugins !== undefined && !Array.isArray(config.plugins)) {
    throw new Error("Config plugins must be an array when provided.");
  }
}

async function resolveConfigPath({
  cwd,
  configPath,
}: {
  cwd: string;
  configPath?: string;
}): Promise<string> {
  if (configPath) {
    return resolve(cwd, configPath);
  }

  for (const candidate of CONFIG_FILE_NAMES) {
    const resolved = resolve(cwd, candidate);

    try {
      await access(resolved, constants.R_OK);
      return resolved;
    } catch {
      continue;
    }
  }

  throw new Error(
    "Config not found. Create asyncapi.config.mjs or pass one with --config.",
  );
}

export async function loadConfig({
  cwd,
  configPath,
  input,
  out,
}: {
  cwd: string;
  configPath?: string;
  input?: string;
  out?: string;
}): Promise<UserConfig> {
  const resolvedConfigPath = await resolveConfigPath({ cwd, configPath });
  const moduleUrl = pathToFileURL(resolvedConfigPath).href;
  const imported = (await import(moduleUrl)) as { default?: UserConfig };
  const loaded = imported.default ?? imported;

  assertConfigShape(loaded);

  return {
    ...loaded,
    input: {
      ...loaded.input,
      path: input ?? loaded.input.path,
    },
    output: {
      ...loaded.output,
      path: out ?? loaded.output.path,
    },
    plugins: Array.isArray(loaded.plugins) ? loaded.plugins : [],
  };
}
