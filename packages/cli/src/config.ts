import { access, readdir } from "node:fs/promises";
import { dirname, extname, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { OpalesceConfig, OutputConfig } from "@opalesce/config";
import type { OrchestrationPlugin, ParseAsyncAPIOptions } from "@opalesce/core";

export const CONFIG_CANDIDATES = [
  "opalesce.config.ts",
  "opalesce.config.mts",
  "opalesce.config.cts",
  "opalesce.config.js",
  "opalesce.config.mjs",
  "opalesce.config.cjs",
] as const;

const CONFIG_EXTENSIONS = new Set(CONFIG_CANDIDATES.map((candidate) => extname(candidate)));

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

export interface ResolveConfigOptions {
  readonly cwd: string;
  readonly configPath?: string;
  readonly input?: string;
  readonly out?: string;
}

export interface ResolvedConfig {
  readonly configPath: string;
  readonly configDir: string;
  readonly inputPath: string;
  readonly outputPath: string;
  readonly config: OpalesceConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlugin(value: unknown): value is OrchestrationPlugin {
  if (!isRecord(value) || typeof value.name !== "string") {
    return false;
  }

  if (value.dependsOn !== undefined && !isStringArray(value.dependsOn)) {
    return false;
  }

  if (value.setup !== undefined && typeof value.setup !== "function") {
    return false;
  }

  return value.build === undefined || typeof value.build === "function";
}

function isParserOptions(value: unknown): value is ParseAsyncAPIOptions {
  return isRecord(value);
}

function validateOutput(value: unknown): OutputConfig {
  if (!isRecord(value)) {
    throw new ConfigError('Config field "output" must be an object.');
  }

  if (typeof value.path !== "string" || value.path.trim().length === 0) {
    throw new ConfigError('Config field "output.path" must be a non-empty string.');
  }

  if (value.clean !== undefined && typeof value.clean !== "boolean") {
    throw new ConfigError('Config field "output.clean" must be a boolean when provided.');
  }

  return value.clean === undefined
    ? { path: value.path }
    : { path: value.path, clean: value.clean };
}

export function validateConfig(value: unknown): OpalesceConfig {
  if (!isRecord(value)) {
    throw new ConfigError("Config must default-export an object.");
  }

  if (typeof value.input !== "string" || value.input.trim().length === 0) {
    throw new ConfigError('Config field "input" must be a non-empty string.');
  }

  const output = validateOutput(value.output);

  if (value.parser !== undefined && !isParserOptions(value.parser)) {
    throw new ConfigError('Config field "parser" must be an object when provided.');
  }

  if (
    value.plugins !== undefined &&
    (!Array.isArray(value.plugins) || !value.plugins.every(isPlugin))
  ) {
    throw new ConfigError('Config field "plugins" must be an array of plugins when provided.');
  }

  return {
    input: value.input,
    output,
    ...(value.parser === undefined ? {} : { parser: value.parser }),
    ...(value.plugins === undefined ? {} : { plugins: value.plugins }),
  };
}

async function candidatesIn(directory: string): Promise<readonly string[]> {
  let entries: readonly string[];

  try {
    entries = await readdir(directory);
  } catch (error) {
    throw new ConfigError(`Cannot search for config in "${directory}".`, { cause: error });
  }

  return CONFIG_CANDIDATES.filter((candidate) => entries.includes(candidate));
}

export async function discoverConfigPath(cwd: string): Promise<string> {
  let directory = resolve(cwd);

  while (true) {
    const candidates = await candidatesIn(directory);

    if (candidates.length > 1) {
      throw new ConfigError(
        `Multiple Opalesce config files found in "${directory}": ${candidates.join(", ")}.`,
      );
    }

    const candidate = candidates[0];

    if (candidate !== undefined) {
      return resolve(directory, candidate);
    }

    const parent = dirname(directory);

    if (parent === directory) {
      throw new ConfigError(
        `Opalesce config not found from "${resolve(cwd)}" to the filesystem root.`,
      );
    }

    directory = parent;
  }
}

async function explicitConfigPath(cwd: string, configPath: string): Promise<string> {
  const resolvedPath = resolve(cwd, configPath);
  const extension = extname(resolvedPath);

  if (!CONFIG_EXTENSIONS.has(extension)) {
    throw new ConfigError(
      `Unsupported config extension "${extension || "<none>"}" for "${resolvedPath}".`,
    );
  }

  try {
    await access(resolvedPath);
  } catch (error) {
    throw new ConfigError(`Cannot access config "${resolvedPath}".`, { cause: error });
  }

  return resolvedPath;
}

export async function loadConfig(configPath: string): Promise<OpalesceConfig> {
  let imported: unknown;

  try {
    imported = await import(pathToFileURL(configPath).href);
  } catch (error) {
    throw new ConfigError(`Cannot import config "${configPath}".`, { cause: error });
  }

  if (!isRecord(imported) || !("default" in imported)) {
    throw new ConfigError(`Config "${configPath}" must have a default export.`);
  }

  return validateConfig(imported.default);
}

export async function resolveConfig(options: ResolveConfigOptions): Promise<ResolvedConfig> {
  const configPath =
    options.configPath === undefined
      ? await discoverConfigPath(options.cwd)
      : await explicitConfigPath(options.cwd, options.configPath);
  const configDir = parse(configPath).dir;
  const config = await loadConfig(configPath);
  const inputPath = resolve(
    options.input === undefined ? configDir : options.cwd,
    options.input ?? config.input,
  );
  const outputPath = resolve(
    options.out === undefined ? configDir : options.cwd,
    options.out ?? config.output.path,
  );

  return {
    configPath,
    configDir,
    inputPath,
    outputPath,
    config,
  };
}
