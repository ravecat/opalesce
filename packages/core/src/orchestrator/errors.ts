import type { PluginExecutionPhase } from "./types.js";

export type PluginConfigurationErrorCode =
  | "empty-name"
  | "duplicate-name"
  | "missing-dependency"
  | "dependency-cycle";

export class PluginConfigurationError extends Error {
  override readonly name = "PluginConfigurationError";
  readonly code: PluginConfigurationErrorCode;
  readonly pluginNames: readonly string[];

  constructor(
    code: PluginConfigurationErrorCode,
    message: string,
    pluginNames: readonly string[] = [],
  ) {
    super(message);
    this.code = code;
    this.pluginNames = Object.freeze([...pluginNames]);
  }
}

export type ServiceRegistryErrorCode = "duplicate-service" | "missing-service";

export class ServiceRegistryError extends Error {
  override readonly name = "ServiceRegistryError";
  readonly code: ServiceRegistryErrorCode;
  readonly serviceName: string;

  constructor(code: ServiceRegistryErrorCode, serviceName: string) {
    super(
      code === "duplicate-service"
        ? `Service "${serviceName}" has already been provided.`
        : `Service "${serviceName}" has not been provided.`,
    );
    this.code = code;
    this.serviceName = serviceName;
  }
}

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
  readonly phase: PluginExecutionPhase;

  constructor(pluginName: string, phase: PluginExecutionPhase, cause: unknown) {
    super(`Plugin "${pluginName}" failed during ${phase}.`, { cause });
    this.pluginName = pluginName;
    this.phase = phase;
  }
}
