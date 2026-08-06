import { definePlugin } from "opalesce";

/** Options form the public configuration surface of a reusable plugin. */
export interface AsyncAPIReportOptions {
  /** Artifact path relative to the configured output directory. */
  readonly path: string;
}

/**
 * Creates a plugin that summarizes the parsed AsyncAPI document as JSON.
 *
 * The plugin lives next to the config while it serves this fixture. Move the same factory and
 * its option type into a package only when another project needs to reuse it.
 */
export const report = definePlugin((options: AsyncAPIReportOptions) => ({
  // The name identifies this plugin in generation results and execution errors.
  name: "report",

  // Plugins run this hook sequentially in the order declared by the consuming config.
  generate({ document, diagnostics }) {
    // `document` is the parsed AsyncAPI model shared with every plugin in this run.
    const info = document.info();

    // Return final text artifacts. Core validates and collects them before the CLI writes files.
    return [
      {
        path: options.path,
        contents: `${JSON.stringify(
          {
            title: info.title(),
            apiVersion: info.version(),
            asyncapiVersion: document.version(),
            channels: document
              .channels()
              .all()
              .map((channel) => ({
                id: channel.id(),
                address: channel.address() ?? null,
              })),
            operations: document
              .operations()
              .all()
              .map((operation) => ({
                id: operation.id() ?? null,
                action: operation.action(),
              })),
            diagnosticCount: diagnostics.length,
          },
          null,
          2,
        )}\n`,
      },
    ];
  },
}));
