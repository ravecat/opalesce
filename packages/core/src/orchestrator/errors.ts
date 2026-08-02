export type ArtifactErrorCode = "invalid-path" | "path-collision";

export class ArtifactError extends Error {
  override readonly name = "ArtifactError";
  readonly code: ArtifactErrorCode;
  readonly path: string;

  constructor(code: ArtifactErrorCode, path: string) {
    super(
      code === "invalid-path"
        ? `Artifact path "${path}" must be a canonical relative path using forward slashes.`
        : `Artifact path "${path}" has already been emitted.`,
    );
    this.code = code;
    this.path = path;
  }
}

export class PluginExecutionError extends Error {
  override readonly name = "PluginExecutionError";
  readonly pluginName: string;

  constructor(pluginName: string, cause: unknown) {
    super(`Plugin "${pluginName}" failed.`, { cause });
    this.pluginName = pluginName;
  }
}
