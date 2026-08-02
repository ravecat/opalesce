import type {
  AsyncAPIDocumentInterface,
  Diagnostic,
  Input,
  ParseAsyncAPIOptions,
} from "../parseAsyncAPI.js";
export interface GeneratedArtifact {
  readonly path: string;
  readonly contents: string;
}

export interface PluginContext {
  readonly document: AsyncAPIDocumentInterface;
  readonly diagnostics: readonly Diagnostic[];
  emit(artifact: GeneratedArtifact): void;
}

export interface OrchestrationPlugin<TName extends string = string> {
  readonly name: TName;
  build(context: PluginContext): void | Promise<void>;
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
