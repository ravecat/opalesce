import type { OrchestrationPlugin, ParseAsyncAPIOptions } from "@opalesce/orchestrator";

export interface OutputConfig {
  readonly path: string;
  readonly clean?: boolean;
}

export interface OpalesceConfig {
  readonly input: string;
  readonly output: OutputConfig;
  readonly parser?: ParseAsyncAPIOptions;
  readonly plugins?: readonly OrchestrationPlugin[];
}

export function defineConfig<const TConfig extends OpalesceConfig>(config: TConfig): TConfig {
  return config;
}
