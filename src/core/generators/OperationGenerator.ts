import type {
  ChannelInterface,
  ChannelParameterInterface,
  MessageInterface,
  OperationInterface,
} from "@asyncapi/parser";
import type { AsyncApiDocument } from "~/core/AsyncApiDocument";
import { pascalCase } from "~/core/naming";
import { normalizeSchema } from "~/core/normalizeSchema";
import type { AsyncApiEntitySeed, EntityScope } from "~/types";

function getMessageVariant(operationId: string, messageId: string): string {
  const operationName = pascalCase(operationId);
  const messageName = pascalCase(messageId);

  if (
    messageName.startsWith(operationName) &&
    messageName.length > operationName.length
  ) {
    return messageName.slice(operationName.length);
  }

  return messageName;
}

function getPayloadBaseName(
  operationId: string,
  messageId: string,
  totalMessages: number,
): string {
  if (totalMessages === 1) {
    return `${operationId}Payload`;
  }

  return `${operationId}${getMessageVariant(operationId, messageId)}Payload`;
}

function getReplyBaseName(
  operationId: string,
  messageId: string,
  totalMessages: number,
): string {
  if (totalMessages === 1) {
    return `${operationId}ReplyPayload`;
  }

  let variant = getMessageVariant(operationId, messageId);

  if (variant.startsWith("Reply") && variant.length > "Reply".length) {
    variant = variant.slice("Reply".length);
  }

  return `${operationId}${variant || "Reply"}ReplyPayload`;
}

function getHeadersBaseName(
  operationId: string,
  messageId: string,
  totalMessages: number,
  role: "message" | "reply",
): string {
  if (role === "reply" && totalMessages === 1) {
    return `${operationId}ReplyHeaders`;
  }

  if (role === "message" && totalMessages === 1) {
    return `${operationId}Headers`;
  }

  const variant = getMessageVariant(operationId, messageId);
  return `${operationId}${variant}Headers`;
}

export class OperationGenerator {
  asyncapi: AsyncApiDocument;

  constructor(asyncapi: AsyncApiDocument) {
    this.asyncapi = asyncapi;
  }

  async build(): Promise<AsyncApiEntitySeed[]> {
    const entities: AsyncApiEntitySeed[] = [];

    for (const [index, operation] of (
      this.asyncapi.getOperations() as OperationInterface[]
    ).entries()) {
      const operationId = operation.id?.() ?? `operation${index + 1}`;
      const messages = [
        ...(operation.messages?.() ?? []),
      ] as MessageInterface[];

      for (const [messageIndex, message] of messages.entries()) {
        const messageId =
          message.id?.() ?? `${operationId}Message${messageIndex + 1}`;
        const payload = message.payload?.();
        const headers = message.headers?.();

        if (payload) {
          const schemaId = getSchemaId(payload.id?.());
          entities.push({
            id: `operations.${operationId}.messages.${messageId}.payload`,
            source: "operation",
            role: "payload",
            scope: "message",
            canonicalKey: getOperationCanonicalKey({
              operationId,
              messageId,
              role: "payload",
              scope: "message",
              schemaId,
            }),
            displayNameHint: getPayloadBaseName(
              operationId,
              messageId,
              messages.length,
            ),
            namespaceHint: operationId,
            identity: {
              schemaId,
              schemaTitle: payload.title?.(),
              operationId,
              messageId,
              messageTitle: message.title?.(),
            },
            schema: await normalizeSchema({
              schemaModel: payload,
              schemaFormat: message.schemaFormat?.(),
              name: `${operationId}.${messageId}.payload`,
            }),
            sourcePath: `#/operations/${operationId}/messages/${messageId}/payload`,
          });
        }

        if (headers) {
          entities.push({
            id: `operations.${operationId}.messages.${messageId}.headers`,
            source: "operation",
            role: "header",
            scope: "message",
            canonicalKey: getOperationCanonicalKey({
              operationId,
              messageId,
              role: "header",
              scope: "message",
            }),
            displayNameHint: getHeadersBaseName(
              operationId,
              messageId,
              messages.length,
              "message",
            ),
            namespaceHint: operationId,
            identity: {
              operationId,
              messageId,
              messageTitle: message.title?.(),
            },
            schema: await normalizeSchema({
              schemaModel: headers,
              name: `${operationId}.${messageId}.headers`,
            }),
            sourcePath: `#/operations/${operationId}/messages/${messageId}/headers`,
          });
        }
      }

      const reply = operation.reply?.();
      const replyMessages = reply
        ? ([...(reply.messages?.() ?? [])] as MessageInterface[])
        : [];

      for (const [replyIndex, message] of replyMessages.entries()) {
        const messageId =
          message.id?.() ?? `${operationId}Reply${replyIndex + 1}`;
        const payload = message.payload?.();
        const headers = message.headers?.();

        if (payload) {
          const schemaId = getSchemaId(payload.id?.());
          entities.push({
            id: `operations.${operationId}.reply.messages.${messageId}.payload`,
            source: "operation",
            role: "payload",
            scope: "reply",
            canonicalKey: getOperationCanonicalKey({
              operationId,
              messageId,
              role: "payload",
              scope: "reply",
              schemaId,
            }),
            displayNameHint: getReplyBaseName(
              operationId,
              messageId,
              replyMessages.length,
            ),
            namespaceHint: operationId,
            identity: {
              schemaId,
              schemaTitle: payload.title?.(),
              operationId,
              messageId,
              messageTitle: message.title?.(),
            },
            schema: await normalizeSchema({
              schemaModel: payload,
              schemaFormat: message.schemaFormat?.(),
              name: `${operationId}.${messageId}.reply.payload`,
            }),
            sourcePath: `#/operations/${operationId}/reply/messages/${messageId}/payload`,
          });
        }

        if (headers) {
          entities.push({
            id: `operations.${operationId}.reply.messages.${messageId}.headers`,
            source: "operation",
            role: "header",
            scope: "reply",
            canonicalKey: getOperationCanonicalKey({
              operationId,
              messageId,
              role: "header",
              scope: "reply",
            }),
            displayNameHint: getHeadersBaseName(
              operationId,
              messageId,
              replyMessages.length,
              "reply",
            ),
            namespaceHint: operationId,
            identity: {
              operationId,
              messageId,
              messageTitle: message.title?.(),
            },
            schema: await normalizeSchema({
              schemaModel: headers,
              name: `${operationId}.${messageId}.reply.headers`,
            }),
            sourcePath: `#/operations/${operationId}/reply/messages/${messageId}/headers`,
          });
        }
      }
    }

    for (const [channelIndex, channel] of (
      this.asyncapi.getChannels() as ChannelInterface[]
    ).entries()) {
      const channelId = channel.id?.() ?? `channel${channelIndex + 1}`;
      const parameters = [
        ...(channel.parameters?.() ?? []),
      ] as ChannelParameterInterface[];

      for (const [parameterIndex, parameter] of parameters.entries()) {
        const parameterId =
          parameter.id?.() ?? `parameter${parameterIndex + 1}`;
        const schema = parameter.schema?.();

        if (!schema) {
          continue;
        }

        entities.push({
          id: `channels.${channelId}.parameters.${parameterId}`,
          source: "channel",
          role: "parameter",
          canonicalKey: `channel:${channelId}:parameter:${parameterId}`,
          displayNameHint: `${channelId} ${parameterId}`,
          namespaceHint: channelId,
          identity: {
            channelId,
            parameterId,
          },
          schema: await normalizeSchema({
            schemaModel: schema,
            name: `${channelId}.${parameterId}.parameter`,
          }),
          sourcePath: `#/channels/${channelId}/parameters/${parameterId}`,
        });
      }
    }

    return entities;
  }
}

function getSchemaId(value: string | undefined): string | undefined {
  if (!value || /^<anonymous-schema-\d+>$/.test(value)) {
    return undefined;
  }

  return value;
}

function getOperationCanonicalKey({
  operationId,
  messageId,
  role,
  scope,
  schemaId,
}: {
  operationId: string;
  messageId: string;
  role: "payload" | "header";
  scope: EntityScope;
  schemaId?: string;
}): string {
  if (role === "payload" && schemaId) {
    return `component:${schemaId}`;
  }

  return `operation:${operationId}:${scope}:${messageId}:${role}`;
}
