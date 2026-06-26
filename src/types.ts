import type { Diagnostic } from "@asyncapi/parser";
import type { AsyncApiDocument } from "~/core/AsyncApiDocument";

export type EntitySource = "component" | "operation" | "channel";
export type EntityRole = "schema" | "payload" | "header" | "parameter";
export type EntityScope = "message" | "reply";

export type IncludeSelector =
  | "components.schemas"
  | "operations.messages.payloads"
  | "operations.messages.headers"
  | "operations.replies.payloads"
  | "operations.replies.headers"
  | "channels.parameters";

export interface AsyncApiEntityIdentity {
  schemaId?: string;
  schemaTitle?: string;
  operationId?: string;
  messageId?: string;
  messageTitle?: string;
  channelId?: string;
  channelTitle?: string;
  parameterId?: string;
}

export interface AsyncApiEntitySeed {
  id: string;
  source: EntitySource;
  role: EntityRole;
  scope?: EntityScope;
  canonicalKey?: string;
  displayNameHint?: string;
  namespaceHint?: string;
  identity?: AsyncApiEntityIdentity;
  schema: unknown;
  sourcePath: string;
}

export interface AsyncApiEntity extends AsyncApiEntitySeed {
  name: string;
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
  resolveName?(this: PluginContext, name: string, type?: "file" | "type"): string | undefined;
  resolvePath?(
    this: PluginContext,
    baseName: string,
    mode?: "single" | "split",
  ): string | undefined;
  inject?(this: PluginContext, context: PluginContext): Record<string, unknown> | void;
  install(this: PluginContext, context: PluginContext): Promise<void> | void;
}
