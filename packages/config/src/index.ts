import type { OrchestrationPlugin, ParseAsyncAPIOptions } from "@opalesce/core";

export interface OutputConfig {
  readonly path: string;
  readonly clean?: boolean;
}

export interface Config {
  readonly input: string;
  readonly output: OutputConfig;
  readonly parser?: ParseAsyncAPIOptions;
  readonly plugins?: readonly OrchestrationPlugin[];
}

export function defineConfig<const TConfig extends Config>(config: TConfig): TConfig {
  return config;
}
