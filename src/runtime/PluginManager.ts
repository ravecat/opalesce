import type {
  GenerationContext,
  GeneratedArtifact,
  PluginContext,
  PluginInstance,
  UserConfig,
} from "~/types";

export class PluginManager {
  config: UserConfig;
  plugins: PluginInstance[];

  constructor(config: UserConfig) {
    this.config = config;
    this.plugins = Array.isArray(config.plugins) ? [...config.plugins] : [];
  }

  async run(context: GenerationContext): Promise<GenerationContext> {
    const ordered = this.sortByDependencies(this.plugins);
    const injections: Record<string, unknown> = {};

    for (const plugin of ordered) {
      const pluginContext = this.createPluginContext({
        context,
        plugin,
        injections,
      });

      await plugin.install.call(pluginContext, pluginContext);

      if (typeof plugin.inject === "function") {
        Object.assign(
          injections,
          plugin.inject.call(pluginContext, pluginContext) ?? {},
        );
      }
    }

    return context;
  }

  sortByDependencies(plugins: PluginInstance[]): PluginInstance[] {
    const availableNames = new Set(plugins.map((plugin) => plugin.name));

    for (const plugin of plugins) {
      const dependencies = [...(plugin.pre ?? []), ...(plugin.post ?? [])];
      const missing = dependencies.filter((name) => !availableNames.has(name));

      if (missing.length > 0) {
        throw new Error(
          `Plugin "${plugin.name}" requires missing dependencies: ${missing.join(", ")}`,
        );
      }
    }

    const ordered: PluginInstance[] = [];
    const pending = [...plugins];
    const resolvedNames = new Set<string>();

    while (pending.length > 0) {
      const readyIndex = pending.findIndex((plugin) => {
        const dependencies = [...(plugin.pre ?? []), ...(plugin.post ?? [])];
        return dependencies.every((name) => resolvedNames.has(name));
      });

      if (readyIndex === -1) {
        throw new Error(
          `Cannot resolve plugin order for: ${pending
            .map((plugin) => plugin.name)
            .join(", ")}`,
        );
      }

      const [plugin] = pending.splice(readyIndex, 1);
      ordered.push(plugin);
      resolvedNames.add(plugin.name);
    }

    return ordered;
  }

  createPluginContext({
    context,
    plugin,
    injections,
  }: {
    context: GenerationContext;
    plugin: PluginInstance;
    injections: Record<string, unknown>;
  }): PluginContext {
    const pluginContext = {
      cwd: context.cwd,
      config: context.config,
      plugin,
      pluginManager: this,
      artifacts: context.artifacts,
      get asyncapi() {
        return context.asyncapi;
      },
      set asyncapi(value) {
        context.asyncapi = value;
      },
      get graph() {
        return context.graph;
      },
      set graph(value) {
        context.graph = value;
      },
      get diagnostics() {
        return context.diagnostics;
      },
      set diagnostics(value) {
        context.diagnostics = Array.isArray(value) ? value : [value];
      },
      addArtifact(artifact: GeneratedArtifact) {
        context.artifacts.push(artifact);
      },
      resolveName(name: string, type = "type") {
        return plugin.resolveName?.call(pluginContext, name, type) ?? name;
      },
      resolvePath(baseName: string, mode = "split") {
        return (
          plugin.resolvePath?.call(pluginContext, baseName, mode) ?? baseName
        );
      },
      ...injections,
    } as PluginContext;

    return pluginContext;
  }
}
