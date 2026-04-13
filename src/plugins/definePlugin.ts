import type { PluginInstance } from "~/types";

export function definePlugin<
  TOptions extends Record<string, unknown> | undefined,
  TPlugin extends PluginInstance,
>(build: (options?: TOptions) => TPlugin): (options?: TOptions) => TPlugin {
  return (options) => build(options);
}
