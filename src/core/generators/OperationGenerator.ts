import type {
  ChannelInterface,
  ChannelParameterInterface,
  MessageInterface,
  OperationInterface,
} from "@asyncapi/parser";
import type { AsyncApiDocument } from "~/core/AsyncApiDocument";
import { pascalCase } from "~/core/naming";
import { normalizeSchema } from "~/core/normalizeSchema";
import type { AsyncApiEntity } from "~/types";

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

  async build(): Promise<AsyncApiEntity[]> {
    const entities: AsyncApiEntity[] = [];

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
          entities.push({
            id: `operations.${operationId}.messages.${messageId}.payload`,
            kind: "message-payload",
            baseName: getPayloadBaseName(
              operationId,
              messageId,
              messages.length,
            ),
            name: getPayloadBaseName(operationId, messageId, messages.length),
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
            kind: "message-header",
            baseName: getHeadersBaseName(
              operationId,
              messageId,
              messages.length,
              "message",
            ),
            name: getHeadersBaseName(
              operationId,
              messageId,
              messages.length,
              "message",
            ),
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
          entities.push({
            id: `operations.${operationId}.reply.messages.${messageId}.payload`,
            kind: "reply-payload",
            baseName: getReplyBaseName(
              operationId,
              messageId,
              replyMessages.length,
            ),
            name: getReplyBaseName(
              operationId,
              messageId,
              replyMessages.length,
            ),
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
            kind: "message-header",
            baseName: getHeadersBaseName(
              operationId,
              messageId,
              replyMessages.length,
              "reply",
            ),
            name: getHeadersBaseName(
              operationId,
              messageId,
              replyMessages.length,
              "reply",
            ),
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
          kind: "channel-parameter",
          baseName: `${channelId} ${parameterId} Parameter`,
          name: `${channelId} ${parameterId} Parameter`,
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
