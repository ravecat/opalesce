import type { SchemaInterface } from "@asyncapi/parser";

export type InteractionAsyncAPIVersion = "2.6.0" | "3.0.0" | "3.1.0";

export type InteractionAction = "send" | "receive";

export type InteractionRootKind = "schema" | "message" | "channel" | "operation" | "reply";

export interface InteractionRootMetadata {
  readonly identity: string;
  readonly kind: InteractionRootKind;
  readonly name: string;
  readonly pointer: string;
  readonly asyncapiVersion: InteractionAsyncAPIVersion;
}

export interface SchemaDependencyContract {
  readonly targetIdentity: string;
  readonly pointer: string;
}

export interface SchemaRoleContract {
  readonly pointer: string;
  readonly schemaFormat: string;
  readonly schema: SchemaInterface;
  readonly dependencies: readonly SchemaDependencyContract[];
}

export interface SchemaContract extends InteractionRootMetadata, SchemaRoleContract {
  readonly kind: "schema";
}

export interface MessageContract extends InteractionRootMetadata {
  readonly kind: "message";
  readonly ownerIdentity?: string;
  readonly description?: string;
  readonly payload?: SchemaRoleContract;
  readonly headers?: SchemaRoleContract;
}

export interface ChannelParameterContract {
  readonly name: string;
  readonly pointer: string;
  readonly description?: string;
  readonly location?: string;
  readonly schema?: SchemaRoleContract;
}

export interface ChannelContract extends InteractionRootMetadata {
  readonly kind: "channel";
  readonly address?: string | null;
  readonly description?: string;
  readonly parameters: readonly ChannelParameterContract[];
  readonly messageIdentities: readonly string[];
}

export interface ReplyContract extends InteractionRootMetadata {
  readonly kind: "reply";
  readonly operationIdentity: string;
  readonly channelIdentity?: string;
  readonly messageIdentities: readonly string[];
}

export interface OperationContract extends InteractionRootMetadata {
  readonly kind: "operation";
  readonly action: InteractionAction;
  readonly description?: string;
  readonly summary?: string;
  readonly channelIdentity: string;
  readonly messageIdentities: readonly string[];
  readonly replyIdentity?: string;
}

export interface InteractionContract {
  readonly asyncapiVersion: InteractionAsyncAPIVersion;
  readonly schemas: readonly SchemaContract[];
  readonly messages: readonly MessageContract[];
  readonly channels: readonly ChannelContract[];
  readonly operations: readonly OperationContract[];
  readonly replies: readonly ReplyContract[];
}
