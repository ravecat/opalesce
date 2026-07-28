import type { OrchestrationPlugin, PipelineConfig } from "./types.js";

export function defineConfig<const TConfig extends PipelineConfig>(config: TConfig): TConfig {
  return config;
}

export function definePlugin<TFactory extends (...arguments_: never[]) => OrchestrationPlugin>(
  factory: TFactory,
): TFactory {
  return factory;
}
