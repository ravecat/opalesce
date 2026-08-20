import type {
  AsyncAPIDocumentInterface,
  Diagnostic,
  Input,
  ParseAsyncAPIOptions,
} from "../parseAsyncAPI.js";
import type { AsyncAPISource } from "../source.js";
import type { InteractionContract } from "../interaction/types.js";
export interface GeneratedArtifact {
  readonly path: string;
  readonly contents: string;
}

export interface PluginContext {
  readonly document: AsyncAPIDocumentInterface;
  readonly interaction: InteractionContract;
  readonly diagnostics: readonly Diagnostic[];
  readonly source?: AsyncAPISource;
}

export interface OrchestrationPlugin<TName extends string = string> {
  readonly name: TName;
  generate(
    context: PluginContext,
  ): readonly GeneratedArtifact[] | Promise<readonly GeneratedArtifact[]>;
}

export interface PipelineConfig {
  readonly input: Input;
  readonly parser?: ParseAsyncAPIOptions;
  readonly plugins?: readonly OrchestrationPlugin[];
}

export interface PipelineResult {
  readonly document: AsyncAPIDocumentInterface;
  readonly diagnostics: readonly Diagnostic[];
  readonly source?: AsyncAPISource;
  readonly artifacts: readonly GeneratedArtifact[];
  readonly pluginNames: readonly string[];
}
