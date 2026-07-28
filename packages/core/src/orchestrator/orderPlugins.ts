import { PluginConfigurationError } from "./errors.js";
import type { OrchestrationPlugin } from "./types.js";

interface PluginRecord {
  readonly plugin: OrchestrationPlugin;
  readonly dependencies: readonly string[];
}

export function orderPlugins(
  configuredPlugins: readonly OrchestrationPlugin[],
): readonly OrchestrationPlugin[] {
  const records: PluginRecord[] = [];
  const pluginsByName = new Map<string, OrchestrationPlugin>();

  for (const plugin of configuredPlugins) {
    if (typeof plugin.name !== "string" || plugin.name.trim().length === 0) {
      throw new PluginConfigurationError(
        "empty-name",
        "Plugin names must contain at least one non-whitespace character.",
      );
    }

    if (pluginsByName.has(plugin.name)) {
      throw new PluginConfigurationError(
        "duplicate-name",
        `Plugin name "${plugin.name}" is configured more than once.`,
        [plugin.name],
      );
    }

    pluginsByName.set(plugin.name, plugin);
    records.push({
      plugin,
      dependencies: Object.freeze([...new Set(plugin.dependsOn ?? [])]),
    });
  }

  for (const record of records) {
    if (record.dependencies.includes(record.plugin.name)) {
      throw new PluginConfigurationError(
        "dependency-cycle",
        `Plugin "${record.plugin.name}" cannot depend on itself.`,
        [record.plugin.name],
      );
    }

    const missing = record.dependencies.filter((name) => !pluginsByName.has(name));

    if (missing.length > 0) {
      throw new PluginConfigurationError(
        "missing-dependency",
        `Plugin "${record.plugin.name}" requires missing dependencies: ${missing.join(", ")}.`,
        [record.plugin.name, ...missing],
      );
    }
  }

  const pending = [...records];
  const resolvedNames = new Set<string>();
  const ordered: OrchestrationPlugin[] = [];

  while (pending.length > 0) {
    const ready = pending.find((record) =>
      record.dependencies.every((name) => resolvedNames.has(name)),
    );

    if (ready === undefined) {
      const cyclicNames = pending.map((record) => record.plugin.name);

      throw new PluginConfigurationError(
        "dependency-cycle",
        `Plugin dependency cycle detected: ${cyclicNames.join(", ")}.`,
        cyclicNames,
      );
    }

    pending.splice(pending.indexOf(ready), 1);
    ordered.push(ready.plugin);
    resolvedNames.add(ready.plugin.name);
  }

  return Object.freeze(ordered);
}
