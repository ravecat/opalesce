import type { Diagnostic } from "@asyncapi/parser";
import type { AsyncApiDocument } from "~/core/AsyncApiDocument";

export type EntityKind =
  | "component-schema"
  | "message-payload"
  | "reply-payload"
  | "channel-parameter"
  | "message-header";

export interface AsyncApiEntity {
  id: string;
  kind: EntityKind;
  baseName?: string;
  name: string;
  schema: unknown;
  sourcePath: string;
}

export interface AsyncApiEntitySeed {
  id: string;
  kind: EntityKind;
  baseName?: string;
  name?: string;
}

export interface AsyncApiEntityGraph {
  entities: AsyncApiEntity[];
  byId: Map<string, AsyncApiEntity>;
}

export interface GeneratedArtifact {
  kind: "json-schema" | "types" | "zod";
  filePath: string;
  code: string;
  export?: {
    name: string;
    kind: "type" | "value";
  };
}

export interface UserConfig {
  input: {
    path: string;
  };
  output: {
    path: string;
  };
  plugins?: PluginInstance[];
}

export interface RunGenerationOptions {
  cwd?: string;
  config: UserConfig;
}

export interface RunGenerationResult {
  cwd: string;
  config: UserConfig;
  diagnostics: Diagnostic[];
  artifacts: GeneratedArtifact[];
}

export interface GenerateOptions {
  cwd?: string;
  config?: string;
  input?: string;
  out?: string;
}

export interface GenerateResult {
  total: number;
  outDir: string;
  diagnostics: Diagnostic[];
  artifacts: GeneratedArtifact[];
}

export interface GenerationContext {
  cwd: string;
  config: UserConfig;
  asyncapi: AsyncApiDocument | null;
  graph: AsyncApiEntityGraph | null;
  diagnostics: Diagnostic[];
  artifacts: GeneratedArtifact[];
}

export interface PluginContext extends GenerationContext {
  plugin: PluginInstance;
  pluginManager: unknown;
  addArtifact(artifact: GeneratedArtifact): void;
  resolveName(name: string, type?: "file" | "type"): string;
  resolvePath(baseName: string, mode?: "single" | "split"): string;
  getAsyncApi?(): Promise<AsyncApiDocument | null>;
  getEntityGraph?(): Promise<AsyncApiEntityGraph | null>;
}

export interface PluginInstance<
  TOptions extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  options: TOptions;
  pre?: string[];
  post?: string[];
  resolveName?(
    this: PluginContext,
    name: string,
    type?: "file" | "type",
  ): string | undefined;
  resolvePath?(
    this: PluginContext,
    baseName: string,
    mode?: "single" | "split",
  ): string | undefined;
  inject?(
    this: PluginContext,
    context: PluginContext,
  ): Record<string, unknown> | void;
  install(this: PluginContext, context: PluginContext): Promise<void> | void;
}
