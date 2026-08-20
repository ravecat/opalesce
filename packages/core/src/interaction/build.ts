import type {
  AsyncAPIDocumentInterface,
  BaseModel,
  ChannelInterface,
  MessageInterface,
  OperationAction,
  OperationInterface,
} from "@asyncapi/parser";
import { InteractionContractError } from "./errors.js";
import { createSchemaRegistry } from "./schema.js";
import type {
  ChannelContract,
  ChannelParameterContract,
  InteractionAction,
  InteractionAsyncAPIVersion,
  InteractionContract,
  MessageContract,
  OperationContract,
  ReplyContract,
} from "./types.js";

function parserObject(model: BaseModel): object | undefined {
  const value: unknown = model.json<unknown>();
  return typeof value === "object" && value !== null ? value : undefined;
}

function requireVersion(version: string): InteractionAsyncAPIVersion {
  switch (version) {
    case "2.6.0":
    case "3.0.0":
    case "3.1.0":
      return version;
    default:
      throw new InteractionContractError(
        "INTERACTION_VERSION_UNSUPPORTED",
        `AsyncAPI ${version} is not supported by the interaction contract.`,
        { pointer: "/asyncapi", details: { version } },
      );
  }
}

function requireName(value: string | undefined, kind: string, pointer: string): string {
  if (value !== undefined && value.length > 0) {
    return value;
  }
  throw new InteractionContractError(
    "INTERACTION_IDENTITY_MISSING",
    `The ${kind} at ${pointer} has no stable identity.`,
    { pointer, details: { kind } },
  );
}

function normalizeAction(action: OperationAction, pointer: string): InteractionAction {
  switch (action) {
    case "publish":
    case "send":
      return "send";
    case "receive":
    case "subscribe":
      return "receive";
    default: {
      const exhaustive: never = action;
      throw new InteractionContractError(
        "INTERACTION_IDENTITY_MISSING",
        `The operation at ${pointer} has an unsupported action.`,
        { pointer, details: { action: exhaustive } },
      );
    }
  }
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)));
}

function messageBaseName(message: MessageInterface, pointer: string): string {
  const id = message.id();
  if (typeof id === "string" && id.length > 0) {
    return id;
  }
  const name = message.name();
  if (name !== undefined && name.length > 0) {
    return name;
  }
  return pointer;
}

interface MessageRegistry {
  readonly messages: Map<string, MessageContract>;
  readonly identityByObject: WeakMap<object, string>;
  readonly identityByPointer: Map<string, string>;
}

function registerMessage(
  registry: MessageRegistry,
  message: MessageInterface,
  identity: string,
  name: string,
  asyncapiVersion: InteractionAsyncAPIVersion,
  createSchemaRole: ReturnType<typeof createSchemaRegistry>["createRole"],
  ownerIdentity?: string,
): string {
  const existing = registry.messages.get(identity);
  if (existing !== undefined) {
    return existing.identity;
  }

  const pointer = message.meta("pointer");
  const payload = message.payload();
  const headers = message.headers();
  const description = message.description();
  const contract: MessageContract = Object.freeze({
    identity,
    kind: "message",
    name,
    pointer,
    asyncapiVersion,
    ...(ownerIdentity === undefined ? {} : { ownerIdentity }),
    ...(description === undefined ? {} : { description }),
    ...(payload === undefined ? {} : { payload: createSchemaRole(payload) }),
    ...(headers === undefined ? {} : { headers: createSchemaRole(headers) }),
  });
  registry.messages.set(identity, contract);
  registry.identityByPointer.set(pointer, identity);
  const object = parserObject(message);
  if (object !== undefined) {
    registry.identityByObject.set(object, identity);
  }
  return identity;
}

function existingMessageIdentity(
  registry: MessageRegistry,
  message: MessageInterface,
): string | undefined {
  const object = parserObject(message);
  if (object !== undefined) {
    const identity = registry.identityByObject.get(object);
    if (identity !== undefined) {
      return identity;
    }
  }
  return registry.identityByPointer.get(message.meta("pointer"));
}

function channelIdentity(channel: ChannelInterface): string {
  const pointer = channel.meta("pointer");
  return `channel:${requireName(channel.id(), "channel", pointer)}`;
}

function operationName(operation: OperationInterface): string {
  const id = operation.id();
  if (typeof id === "string" && id.length > 0) {
    return id;
  }
  const pointer = operation.meta("pointer");
  const channel = operation.channels().all()[0];
  if (channel === undefined) {
    return requireName(undefined, "operation", pointer);
  }
  return `${channel.id()}-${operation.action()}`;
}

export function buildInteractionContract(document: AsyncAPIDocumentInterface): InteractionContract {
  const asyncapiVersion = requireVersion(document.version());
  const schemaRegistry = createSchemaRegistry(
    document.components().schemas().all(),
    asyncapiVersion,
  );

  const messageRegistry: MessageRegistry = {
    messages: new Map(),
    identityByObject: new WeakMap(),
    identityByPointer: new Map(),
  };

  for (const message of document.components().messages().all()) {
    const pointer = message.meta("pointer");
    const name = requireName(message.id(), "component message", pointer);
    registerMessage(
      messageRegistry,
      message,
      `message:component:${name}`,
      name,
      asyncapiVersion,
      schemaRegistry.createRole,
      undefined,
    );
  }

  const channelIdentityByObject = new WeakMap<object, string>();
  const channelIdentityById = new Map<string, string>();
  const channels: ChannelContract[] = [];

  for (const channel of document.channels().all()) {
    const identity = channelIdentity(channel);
    const name = requireName(channel.id(), "channel", channel.meta("pointer"));
    const object = parserObject(channel);
    if (object !== undefined) {
      channelIdentityByObject.set(object, identity);
    }
    channelIdentityById.set(name, identity);

    const messageIdentities = channel
      .messages()
      .all()
      .map((message) => {
        const existing = existingMessageIdentity(messageRegistry, message);
        if (existing !== undefined) {
          return existing;
        }
        const pointer = message.meta("pointer");
        return registerMessage(
          messageRegistry,
          message,
          `message:${identity}:${pointer}`,
          messageBaseName(message, pointer),
          asyncapiVersion,
          schemaRegistry.createRole,
          identity,
        );
      });

    const parameters = channel
      .parameters()
      .all()
      .map((parameter): ChannelParameterContract => {
        const schema = parameter.schema();
        const description = parameter.description();
        const location = parameter.location();
        return Object.freeze({
          name: requireName(parameter.id(), "channel parameter", parameter.meta("pointer")),
          pointer: parameter.meta("pointer"),
          ...(description === undefined ? {} : { description }),
          ...(location === undefined ? {} : { location }),
          ...(schema === undefined ? {} : { schema: schemaRegistry.createRole(schema) }),
        });
      });

    const address = channel.address();
    const description = channel.description();
    channels.push(
      Object.freeze({
        identity,
        kind: "channel",
        name,
        pointer: channel.meta("pointer"),
        asyncapiVersion,
        ...(address === undefined ? {} : { address }),
        ...(description === undefined ? {} : { description }),
        parameters: Object.freeze(
          [...parameters].sort((left, right) => left.name.localeCompare(right.name)),
        ),
        messageIdentities: uniqueSorted(messageIdentities),
      }),
    );
  }

  const resolveChannelIdentity = (channel: ChannelInterface): string => {
    const object = parserObject(channel);
    if (object !== undefined) {
      const byObject = channelIdentityByObject.get(object);
      if (byObject !== undefined) {
        return byObject;
      }
    }
    const byId = channelIdentityById.get(channel.id());
    if (byId !== undefined) {
      return byId;
    }
    throw new InteractionContractError(
      "INTERACTION_REFERENCE_UNSUPPORTED",
      `The channel reference at ${channel.meta("pointer")} has no stable target.`,
      { pointer: channel.meta("pointer"), details: { referenceKind: "channel" } },
    );
  };

  const resolveMessageIdentity = (message: MessageInterface, ownerIdentity: string): string => {
    const existing = existingMessageIdentity(messageRegistry, message);
    if (existing !== undefined) {
      return existing;
    }
    const pointer = message.meta("pointer");
    return registerMessage(
      messageRegistry,
      message,
      `message:${ownerIdentity}:${pointer}`,
      messageBaseName(message, pointer),
      asyncapiVersion,
      schemaRegistry.createRole,
      ownerIdentity,
    );
  };

  const operations: OperationContract[] = [];
  const replies: ReplyContract[] = [];

  for (const operation of document.operations().all()) {
    const pointer = operation.meta("pointer");
    const name = operationName(operation);
    const identity = `operation:${name}`;
    const channel = operation.channels().all()[0];
    if (channel === undefined) {
      throw new InteractionContractError(
        "INTERACTION_REFERENCE_UNSUPPORTED",
        `The operation at ${pointer} has no resolved channel.`,
        { pointer, details: { referenceKind: "channel" } },
      );
    }
    const operationChannelIdentity = resolveChannelIdentity(channel);
    const messageIdentities = uniqueSorted(
      operation
        .messages()
        .all()
        .map((message) => resolveMessageIdentity(message, operationChannelIdentity)),
    );

    const reply = operation.reply();
    let replyIdentity: string | undefined;
    if (reply !== undefined) {
      replyIdentity = `reply:${identity}`;
      const replyChannel = reply.channel();
      const resolvedReplyChannelIdentity =
        replyChannel === undefined ? undefined : resolveChannelIdentity(replyChannel);
      const explicitMessages = reply.messages().all();
      const effectiveMessages =
        explicitMessages.length > 0
          ? explicitMessages
          : (replyChannel?.messages().all() ?? explicitMessages);
      replies.push(
        Object.freeze({
          identity: replyIdentity,
          kind: "reply",
          name: `${name}-reply`,
          pointer: reply.meta("pointer"),
          asyncapiVersion,
          operationIdentity: identity,
          ...(resolvedReplyChannelIdentity === undefined
            ? {}
            : { channelIdentity: resolvedReplyChannelIdentity }),
          messageIdentities: uniqueSorted(
            effectiveMessages.map((message) =>
              resolveMessageIdentity(message, replyIdentity ?? identity),
            ),
          ),
        }),
      );
    }

    const description = operation.description();
    const summary = operation.summary();
    operations.push(
      Object.freeze({
        identity,
        kind: "operation",
        name,
        pointer,
        asyncapiVersion,
        action: normalizeAction(operation.action(), pointer),
        channelIdentity: operationChannelIdentity,
        messageIdentities,
        ...(replyIdentity === undefined ? {} : { replyIdentity }),
        ...(description === undefined ? {} : { description }),
        ...(summary === undefined ? {} : { summary }),
      }),
    );
  }

  return Object.freeze({
    asyncapiVersion,
    schemas: schemaRegistry.roots,
    messages: Object.freeze(
      [...messageRegistry.messages.values()].sort((left, right) =>
        left.identity.localeCompare(right.identity),
      ),
    ),
    channels: Object.freeze(
      channels.sort((left, right) => left.identity.localeCompare(right.identity)),
    ),
    operations: Object.freeze(
      operations.sort((left, right) => left.identity.localeCompare(right.identity)),
    ),
    replies: Object.freeze(
      replies.sort((left, right) => left.identity.localeCompare(right.identity)),
    ),
  });
}
