import type {
  AsyncAPIDocumentInterface,
  Diagnostic,
  Input,
  ParseAsyncAPIOptions,
} from "../parseAsyncAPI.js";
import type { ServiceToken } from "./services.js";

export interface GeneratedArtifact {
  readonly path: string;
  readonly contents: string;
}

export interface PluginContext {
  readonly document: AsyncAPIDocumentInterface;
  readonly diagnostics: readonly Diagnostic[];
  get<T>(token: ServiceToken<T>): T;
}

export interface PluginSetupContext extends PluginContext {
  provide<T>(token: ServiceToken<T>, value: T): void;
}

export interface PluginBuildContext extends PluginContext {
  readonly artifacts: readonly GeneratedArtifact[];
  emit(artifact: GeneratedArtifact): void;
}

export interface OrchestrationPlugin<TName extends string = string> {
  readonly name: TName;
  readonly dependsOn?: readonly string[];
  setup?(context: PluginSetupContext): void | Promise<void>;
  build?(context: PluginBuildContext): void | Promise<void>;
}

export interface PipelineConfig {
  readonly input: Input;
  readonly parser?: ParseAsyncAPIOptions;
  readonly plugins?: readonly OrchestrationPlugin[];
}

export interface PipelineResult {
  readonly document: AsyncAPIDocumentInterface;
  readonly diagnostics: readonly Diagnostic[];
  readonly artifacts: readonly GeneratedArtifact[];
  readonly pluginNames: readonly string[];
}

export type PluginExecutionPhase = "setup" | "build";
